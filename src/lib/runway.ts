export type RunwayInput = {
  assets: number
  currentMonthlyGap: number
  futureMonthlyGap?: number | null
  futureStartDate?: string | null
  asOfDate?: string | Date
}

export type RunwayResult = {
  months: number | null
  years: number | null
  wholeYears: number | null
  remainingMonths: number | null
  coveredIndefinitely: boolean
  depletedBeforeFutureIncome: boolean
  monthsUntilFutureIncome: number | null
}

function monthDistance(from: Date, to: Date) {
  const raw = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
  return Math.max(0, raw)
}

function normalizeGap(value: number) {
  if (!Number.isFinite(value)) throw new Error('每月現金流缺口必須是有效數字。')
  return Math.max(0, -value)
}

// 靜態續航：不假設資本利得、通膨、稅費或市場復原。
// 若未來固定收入會開始，先扣除起領前的每月缺口，再切換成起領後缺口。
export function estimateStaticRunway(input: RunwayInput): RunwayResult {
  if (!Number.isFinite(input.assets) || input.assets < 0) throw new Error('資產必須是非負有效數字。')

  const currentGap = normalizeGap(input.currentMonthlyGap)
  const futureGap = input.futureMonthlyGap == null ? null : normalizeGap(input.futureMonthlyGap)
  const asOf = input.asOfDate instanceof Date ? input.asOfDate : new Date(input.asOfDate ?? new Date())
  const futureDate = input.futureStartDate ? new Date(input.futureStartDate) : null

  if (Number.isNaN(asOf.getTime())) throw new Error('試算日期無效。')
  if (futureDate && Number.isNaN(futureDate.getTime())) throw new Error('未來固定收入日期無效。')

  const monthsUntilFutureIncome = futureDate ? monthDistance(asOf, futureDate) : null

  if (currentGap === 0 && (futureGap == null || futureGap === 0)) {
    return {
      months: null,
      years: null,
      wholeYears: null,
      remainingMonths: null,
      coveredIndefinitely: true,
      depletedBeforeFutureIncome: false,
      monthsUntilFutureIncome,
    }
  }

  let months: number

  if (futureDate && futureGap != null && monthsUntilFutureIncome != null) {
    const neededBeforeFuture = currentGap * monthsUntilFutureIncome

    if (currentGap > 0 && input.assets <= neededBeforeFuture) {
      months = input.assets / currentGap
      return finish(months, false, true, monthsUntilFutureIncome)
    }

    const assetsAtFuture = Math.max(0, input.assets - neededBeforeFuture)

    if (futureGap === 0) {
      return {
        months: null,
        years: null,
        wholeYears: null,
        remainingMonths: null,
        coveredIndefinitely: true,
        depletedBeforeFutureIncome: false,
        monthsUntilFutureIncome,
      }
    }

    months = monthsUntilFutureIncome + assetsAtFuture / futureGap
    return finish(months, false, false, monthsUntilFutureIncome)
  }

  if (currentGap === 0) {
    return {
      months: null,
      years: null,
      wholeYears: null,
      remainingMonths: null,
      coveredIndefinitely: true,
      depletedBeforeFutureIncome: false,
      monthsUntilFutureIncome,
    }
  }

  months = input.assets / currentGap
  return finish(months, false, false, monthsUntilFutureIncome)
}

function finish(
  months: number,
  coveredIndefinitely: boolean,
  depletedBeforeFutureIncome: boolean,
  monthsUntilFutureIncome: number | null,
): RunwayResult {
  const safeMonths = Math.max(0, months)
  const roundedMonths = Math.round(safeMonths)
  return {
    months: safeMonths,
    years: safeMonths / 12,
    wholeYears: Math.floor(roundedMonths / 12),
    remainingMonths: roundedMonths % 12,
    coveredIndefinitely,
    depletedBeforeFutureIncome,
    monthsUntilFutureIncome,
  }
}

export function runwayLabel(result: RunwayResult) {
  if (result.coveredIndefinitely) return '目前收入可覆蓋支出'
  return `${result.wholeYears ?? 0} 年 ${result.remainingMonths ?? 0} 個月`
}

