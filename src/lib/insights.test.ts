import { describe, expect, it } from 'vitest'
import type { RetirementOverview } from '../data'
import { assetConcentration, healthScore, memberState } from './insights'

function overview(): RetirementOverview {
  return {
    profile: { current_age: 55, monthly_expense: 40_000, monthly_contribution: 10_000, trial_ends_at: '2099-01-01' },
    portfolio: null,
    assets: [{ id: 'cash', asset_type: 'cash', asset_name: '現金', asset_code: '', current_value: 480_000, annual_yield: 0, dividend_months: [], is_income_asset: false }],
    goal: { id: 'g', target_amount: 10_000_000, current_assets: 0, monthly_expense: 40_000, target_age: 65, target_year: 2036, expected_return: 5, expected_yield: 3, inflation_rate: 2, retirement_years: 30, is_active: true },
    gps: null, gpsHistory: [], dividends: [], fixedIncomes: [], fixedIncomeSetupRequired: false,
    fixedMonthlyIncome: 0, monthlyReports: [], snapshotsV3: [], snapshotSetupRequired: false,
    memberAlerts: [], cashflowAlerts: [], subscription: null, quotes: [],
    holdings: [
      { ticker: '0050.TW', name: '0050', shares: 1, price: 100, annualYield: 3, dividendMonths: [1] },
      { ticker: '0050', name: '0050 alias', shares: 1, price: 100, annualYield: 3, dividendMonths: [1] },
    ],
    metrics: { stockValue: 200, otherAssets: 480_000, totalAssets: 480_200, annualDividend: 6, monthlyIncome: .5, monthlyGap: -39_999.5, coveragePct: .00125, progressPct: 4.802 },
    targetAmount: 10_000_000, monthlyExpense: 40_000,
  } as unknown as RetirementOverview
}

describe('V3 insights', () => {
  it('keeps the legacy profile trial fallback', () => expect(memberState(overview(), new Date('2026-01-01'))).toBe('trial'))

  it('groups ticker aliases before calculating concentration', () => {
    const result = assetConcentration(overview())
    expect(result.rows.filter((row) => row.kind === 'market')).toHaveLength(1)
    expect(result.rows.find((row) => row.kind === 'market')?.value).toBe(200_000)
  })

  it('does not publish a health score for incomplete forecasts', () => {
    expect(healthScore(overview(), 90, false)).toBeNull()
    expect(healthScore(overview(), 90, true)).toBeTypeOf('number')
  })
})
