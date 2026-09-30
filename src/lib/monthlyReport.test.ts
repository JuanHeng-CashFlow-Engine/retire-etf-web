import { describe, expect, it } from 'vitest'
import { compareMonthlyReports, deriveMonthlyReportMetrics } from './monthlyReport'

describe('monthly report comparison', () => {
  it('derives cashflow and static runway from saved report fields', () => {
    const result = deriveMonthlyReportMetrics({ totalAssets: 3_600_000, annualDividend: 120_000, monthlyExpense: 50_000, coveragePct: 40 })
    expect(result.monthlyIncome).toBe(20_000)
    expect(result.monthlyGap).toBe(-30_000)
    expect(result.staticRunwayMonths).toBe(120)
  })

  it('compares the current month with the immediately previous report', () => {
    const previous = deriveMonthlyReportMetrics({ totalAssets: 3_600_000, annualDividend: 120_000, monthlyExpense: 50_000, coveragePct: 40 })
    const current = deriveMonthlyReportMetrics({ totalAssets: 3_700_000, annualDividend: 108_000, monthlyExpense: 50_000, coveragePct: 46 })
    expect(compareMonthlyReports(current, previous)).toEqual({
      totalAssets: 100_000,
      annualDividend: -12_000,
      monthlyGap: 3_000,
      staticRunwayMonths: 3_700_000 / 27_000 - 120,
    })
  })

  it('does not invent runway when income covers expenses', () => {
    const result = deriveMonthlyReportMetrics({ totalAssets: 3_600_000, annualDividend: 120_000, monthlyExpense: 50_000, coveragePct: 110 })
    expect(result.incomeCoversExpense).toBe(true)
    expect(result.staticRunwayMonths).toBeNull()
  })
})

