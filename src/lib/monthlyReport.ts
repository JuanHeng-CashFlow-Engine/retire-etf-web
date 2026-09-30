export type MonthlyReportInput = {
  totalAssets: number | null
  annualDividend: number | null
  monthlyExpense: number | null
  coveragePct: number | null
}

export type MonthlyReportMetrics = MonthlyReportInput & {
  monthlyIncome: number | null
  monthlyGap: number | null
  staticRunwayMonths: number | null
  incomeCoversExpense: boolean
}

export type MonthlyReportChanges = {
  totalAssets: number | null
  annualDividend: number | null
  monthlyGap: number | null
  staticRunwayMonths: number | null
}

const finite = (value: number | null) => value != null && Number.isFinite(value)

export function deriveMonthlyReportMetrics(input: MonthlyReportInput): MonthlyReportMetrics {
  const canCalculateCashflow = finite(input.monthlyExpense) && finite(input.coveragePct)
  const monthlyIncome = canCalculateCashflow ? input.monthlyExpense! * input.coveragePct! / 100 : null
  const monthlyGap = monthlyIncome == null ? null : monthlyIncome - input.monthlyExpense!
  const incomeCoversExpense = monthlyGap != null && monthlyGap >= 0
  const staticRunwayMonths = monthlyGap != null && monthlyGap < 0 && finite(input.totalAssets)
    ? input.totalAssets! / -monthlyGap
    : null
  return { ...input, monthlyIncome, monthlyGap, staticRunwayMonths, incomeCoversExpense }
}

function delta(current: number | null, previous: number | null) {
  return finite(current) && finite(previous) ? current! - previous! : null
}

export function compareMonthlyReports(current: MonthlyReportMetrics, previous: MonthlyReportMetrics | null): MonthlyReportChanges | null {
  if (!previous) return null
  return {
    totalAssets: delta(current.totalAssets, previous.totalAssets),
    annualDividend: delta(current.annualDividend, previous.annualDividend),
    monthlyGap: delta(current.monthlyGap, previous.monthlyGap),
    staticRunwayMonths: delta(current.staticRunwayMonths, previous.staticRunwayMonths),
  }
}

