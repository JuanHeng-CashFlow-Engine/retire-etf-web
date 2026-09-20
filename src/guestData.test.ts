import { describe, expect, it } from 'vitest'
import { buildGuestOverview, emptyGuestDraft } from './guestData'

describe('free checkup without an account', () => {
  it('uses browser-entered assets and fixed income in the existing cashflow model', () => {
    const draft = emptyGuestDraft()
    draft.assets.push({ id: 'asset', asset_type: 'etf', asset_name: '測試 ETF', asset_code: '',
      current_value: 1_000_000, annual_yield: 6, dividend_months: [3, 6, 9, 12], is_income_asset: true })
    draft.incomes.push({ id: 'income', name: '年金', category: 'annuity', monthly_amount: 20_000,
      start_month: '2020-01-01', end_month: null })
    draft.goal = { currentAge: 60, targetAge: 65, targetAmount: 5_000_000, monthlyExpense: 30_000,
      monthlyContribution: 0, expectedReturn: 5, expectedYield: 6, inflationRate: 2, retirementYears: 30 }

    const overview = buildGuestOverview(draft)
    expect(overview.metrics.totalAssets).toBe(1_000_000)
    expect(overview.metrics.annualDividend).toBe(60_000)
    expect(overview.metrics.monthlyIncome).toBe(25_000)
    expect(overview.metrics.monthlyGap).toBe(-5_000)
    expect(overview.subscription).toBeNull()
  })
})
