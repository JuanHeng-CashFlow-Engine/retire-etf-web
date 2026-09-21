export type RetirementPlanInput = {
  currentAssets: number
  monthlyContribution: number
  targetAssets: number
  annualReturn: number
  annualVolatility: number
  yearsUntilRetirement: number
  retirementYears: number
  monthlyExpense: number
  inflationRate: number
  fixedIncomes?: Array<{ monthlyAmount: number; startMonthOffset: number; endMonthOffset: number | null }>
  simulations?: number
  seed?: number
}

export type RetirementPathPoint = {
  yearOffset: number
  p10: number
  p50: number
  p90: number
}

export type RetirementPlanResult = {
  path: RetirementPathPoint[]
  successProbability: number
  depletionProbability: number
  targetReachedProbability: number
  monthlyExpenseAtRetirement: number
  riskStartYearOffset: number | null
  simulations: number
}

function validate(input: RetirementPlanInput) {
  const nonnegative = [input.currentAssets, input.monthlyContribution, input.annualVolatility, input.yearsUntilRetirement, input.inflationRate]
  if (nonnegative.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('資產、投入、波動率、退休等待年數與通膨率不可為負數。')
  if (!Number.isFinite(input.targetAssets) || input.targetAssets <= 0) throw new Error('請先設定大於 0 的退休目標。')
  if (!Number.isFinite(input.monthlyExpense) || input.monthlyExpense <= 0) throw new Error('請先設定大於 0 的每月退休生活費。')
  if (!Number.isFinite(input.annualReturn) || input.annualReturn < -100 || input.annualReturn > 100) throw new Error('年化報酬假設超出可計算範圍。')
  if (!Number.isInteger(input.yearsUntilRetirement) || !Number.isInteger(input.retirementYears) || input.retirementYears < 1 || input.retirementYears > 80) throw new Error('退休年數設定無效。')
  if ((input.fixedIncomes ?? []).some((income) => !Number.isFinite(income.monthlyAmount) || income.monthlyAmount < 0 ||
    !Number.isInteger(income.startMonthOffset) || income.startMonthOffset < 0 ||
    (income.endMonthOffset != null && (!Number.isInteger(income.endMonthOffset) || income.endMonthOffset < income.startMonthOffset)))) {
    throw new Error('固定收入期間或金額無效。')
  }
}

function randomGenerator(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function normal(random: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(random(), Number.EPSILON))) * Math.cos(2 * Math.PI * random())
}

function percentile(sorted: number[], fraction: number) {
  const position = (sorted.length - 1) * fraction
  const lower = Math.floor(position)
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower)
}

// 與舊版相同的兩階段月模擬：退休前每月投入；退休後停止投入並按通膨提領。
// 隨機數產生器不同於 NumPy，因此結果不宣稱與舊版逐位相同。
export function simulateRetirementPlan(input: RetirementPlanInput): RetirementPlanResult {
  validate(input)
  const simulations = Math.max(500, Math.min(10_000, Math.trunc(input.simulations ?? 3_000)))
  const random = randomGenerator(input.seed ?? 42)
  const assets = new Float64Array(simulations).fill(input.currentAssets)
  const alive = new Uint8Array(simulations).fill(1)
  const monthlyReturn = input.annualReturn / 100 / 12
  const monthlyVolatility = input.annualVolatility / 100 / Math.sqrt(12)
  const monthlyInflation = Math.pow(1 + input.inflationRate / 100, 1 / 12)
  const preRetirementMonths = input.yearsUntilRetirement * 12
  const totalMonths = preRetirementMonths + input.retirementYears * 12
  const monthlyExpenseAtRetirement = input.monthlyExpense * Math.pow(1 + input.inflationRate / 100, input.yearsUntilRetirement)
  let currentExpense = monthlyExpenseAtRetirement
  const path: RetirementPathPoint[] = [{ yearOffset: 0, p10: input.currentAssets, p50: input.currentAssets, p90: input.currentAssets }]
  let targetReached = 0

  if (preRetirementMonths === 0) {
    for (const asset of assets) if (asset >= input.targetAssets) targetReached++
  }

  for (let month = 1; month <= totalMonths; month++) {
    const retired = month > preRetirementMonths
    const fixedIncome = retired ? (input.fixedIncomes ?? []).reduce((sum, income) => {
      const offset = month - 1
      return offset >= income.startMonthOffset && (income.endMonthOffset == null || offset <= income.endMonthOffset)
        ? sum + income.monthlyAmount : sum
    }, 0) : 0
    for (let index = 0; index < simulations; index++) {
      const shock = monthlyReturn + monthlyVolatility * normal(random)
      const balance = assets[index] * (1 + shock) + (retired ? fixedIncome - currentExpense : input.monthlyContribution)
      if (retired && balance <= 0) alive[index] = 0
      assets[index] = Math.max(0, balance)
    }
    if (month === preRetirementMonths) {
      for (const asset of assets) if (asset >= input.targetAssets) targetReached++
    }
    if (retired) currentExpense *= monthlyInflation
    if (month % 12 === 0) {
      const sorted = Array.from(assets).sort((a, b) => a - b)
      path.push({ yearOffset: month / 12, p10: percentile(sorted, .1), p50: percentile(sorted, .5), p90: percentile(sorted, .9) })
    }
  }

  const successProbability = alive.reduce((sum, value) => sum + value, 0) / simulations * 100
  return {
    path,
    successProbability,
    depletionProbability: 100 - successProbability,
    targetReachedProbability: targetReached / simulations * 100,
    monthlyExpenseAtRetirement,
    riskStartYearOffset: path.find((point) => point.yearOffset > input.yearsUntilRetirement && point.p10 <= 0)?.yearOffset ?? null,
    simulations,
  }
}

