import type { RetirementOverview } from '../data'
import { holdingMarketValue } from './metrics'
import { simulateRetirementPlan, type RetirementPlanInput } from './retirementPlan'
import { fixedIncomeRange } from './fixedIncome'
import { tickerCode } from './ticker'

export type AllocationRow = { id: string; name: string; ticker: string; value: number }
export function portfolioRows(data: RetirementOverview): AllocationRow[] {
  const holdings = new Map<string, AllocationRow>()
  for (const h of data.holdings) {
    const id = `stock:${tickerCode(h.ticker)}`
    const value = holdingMarketValue(h)
    if (Number.isFinite(value) && value > (holdings.get(id)?.value ?? 0)) holdings.set(id, {id, name:h.name, ticker:h.ticker, value})
  }
  return [...holdings.values(), ...data.assets.map(a => ({ id: `asset:${a.id}`, name: a.asset_name, ticker: a.asset_code || '', value: Number(a.current_value) }))].filter(r => Number.isFinite(r.value) && r.value > 0)
}
export function rebalance(rows: AllocationRow[], targets: Record<string, number>, budget = 0) {
  if (!Number.isFinite(budget) || budget < 0) throw new Error('新增資金不可為負數。')
  const weights = rows.map(r => targets[r.id] ?? 0)
  if (weights.some(n => !Number.isFinite(n) || n < 0 || n > 100) || Math.abs(weights.reduce((a,b) => a+b, 0) - 100) > 0.01) throw new Error('目標比例合計必須為 100%。')
  const total = rows.reduce((a,b) => a+b.value, 0) + budget
  return rows.map((r,i) => ({ ...r, weight: weights[i], target: total * weights[i] / 100, adjustment: total * weights[i] / 100 - r.value }))
}
export function scenarioInput(data: RetirementOverview): RetirementPlanInput | null {
  const age = data.profile?.current_age, target = data.goal?.target_age
  if (age == null || target == null || target < age || !data.goal || data.targetAmount <= 0 || data.monthlyExpense <= 0 || data.holdings.some(h => h.shares > 0 && h.price <= 0)) return null
  const now = new Date()
  return { currentAssets: data.metrics.totalAssets, targetAssets: data.targetAmount, monthlyExpense: data.monthlyExpense,
    monthlyContribution: Number(data.profile?.monthly_contribution || 0) + data.assets.reduce((s,a) => s + Number(a.monthly_contribution || 0), 0),
    annualReturn: Number(data.goal.expected_return), annualVolatility: 15, yearsUntilRetirement: target-age, retirementYears: Number(data.goal.retirement_years || 30), inflationRate: Number(data.goal.inflation_rate || 0), simulations: 3000, seed: 42,
    fixedIncomes: data.fixedIncomes.filter(i => !i.end_month || i.end_month.slice(0,7) >= now.toISOString().slice(0,7)).map(i => fixedIncomeRange(i, now)) }
}
export function runScenario(input: RetirementPlanInput) {
  if (!Number.isFinite(input.yearsUntilRetirement) || input.yearsUntilRetirement > 80 || !Number.isInteger(input.simulations) || input.simulations! < 500 || input.simulations! > 10000 || input.annualVolatility > 100 || input.inflationRate > 30 || input.currentAssets > 1e12 || input.targetAssets > 1e12 || input.monthlyContribution > 1e8 || input.monthlyExpense > 1e8) throw new Error('請核對資產、模擬次數、波動、通膨與退休年限。')
  return simulateRetirementPlan(input)
}
export type DividendAlert = { key: string; title: string; detail: string; severity: 'warning' | 'danger' }
export function advancedDividendAlerts(data: RetirementOverview, today: string, days = 30, cut = 20): DividendAlert[] {
  const alerts: DividendAlert[] = []
  const now = Date.parse(`${today}T00:00:00Z`)
  for (const d of data.dividends) {
    const received = d.actual_amount != null || d.actual_payment_date || /^(recorded|paid|actual|已入帳)$/i.test(d.status)
    const expected = Number(d.expected_amount)
    if (received && d.actual_amount != null && expected > 0 && Number(d.actual_amount) < expected * (1-cut/100)) alerts.push({ key:`short:${d.id}`,title:`${d.ticker} 入帳低於預期`,detail:`預期 ${expected.toLocaleString()} 元，紀錄入帳 ${Number(d.actual_amount).toLocaleString()} 元；請核對稅費與配息公告。`,severity:'warning' })
    if (!received && d.expected_payment_date) {
      const distance = (Date.parse(`${d.expected_payment_date}T00:00:00Z`) - now)/86400000
      if (distance < 0) alerts.push({key:`late:${d.id}`,title:`${d.ticker} 入帳尚未確認`,detail:`原訂 ${d.expected_payment_date}，已過 ${Math.ceil(-distance)} 天；未記錄不代表未收到款項。`,severity:'warning'})
      else if (distance <= days) alerts.push({key:`due:${d.id}`,title:`${d.ticker} 即將配息`,detail:`${d.expected_payment_date}，預期 ${expected.toLocaleString()} 元（${d.status}）。`,severity:'warning'})
    }
  }
  for (const q of data.quotes) {
    if (data.holdings.some(h => h.shares > 0 && tickerCode(h.ticker) === tickerCode(q.ticker)) && q.dividend_change_pct != null && Number(q.dividend_change_pct) <= -cut) alerts.push({key:`cut:${q.ticker}:${q.dividend_change_pct}`,title:`${q.ticker} 配息下降待核對`,detail:`資料來源標示變動 ${Number(q.dividend_change_pct)}%；請核對相同期間每股配息。來源：${q.data_source || '未標示'}。`,severity:'danger'})
  }
  return alerts
}
