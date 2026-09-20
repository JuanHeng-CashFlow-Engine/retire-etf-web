import { describe, expect, it } from 'vitest'
import { buildGuestOverview, emptyGuestDraft, upsertGuestHolding } from './guestData'
import { buildAssetDetailRows } from './AssetDetailsTable'
import type { MarketQuote } from './types'

const quote: MarketQuote = { ticker: '0050.TW', name: '元大台灣50', price: '100', yield: '2.5',
  dividend_months: [1, 7], dividend_status: null, data_source: 'test fixture', last_updated_at: '2026-09-01T00:00:00Z' }

describe('free checkup without an account', () => {
  it('converts fractional lots into market value and keeps quote provenance and dividend months', () => {
    const draft = upsertGuestHolding(emptyGuestDraft(), quote, 1.5)
    const overview = buildGuestOverview(draft)
    expect(draft.assets[0]).toMatchObject({ asset_name: '元大台灣50', asset_code: '0050', quantity: 1.5,
      unit_price: 100, current_value: 150000, annual_yield: 2.5, dividend_months: [1, 7] })
    expect(overview.metrics.totalAssets).toBe(150000)
    expect(overview.metrics.annualDividend).toBe(3750)
    expect(buildAssetDetailRows(overview)[0]).toMatchObject({ value: 150000, annualIncome: 3750, source: '市場資料 · 2026-09-01' })
  })

  it('updates aliases without duplicating the holding or losing other assets', () => {
    const draft = upsertGuestHolding(emptyGuestDraft(), quote, 1)
    draft.assets[0].asset_code = '0050.TW'
    draft.assets.push({ id: 'cash', asset_type: 'cash', asset_code: '', asset_name: '現金', current_value: 5000,
      annual_yield: 0, dividend_months: [], is_income_asset: false })
    const updated = upsertGuestHolding(draft, { ...quote, ticker: '0050' }, 2)
    expect(updated.assets).toHaveLength(2)
    expect(updated.assets.find((item) => item.id === draft.assets[0].id)?.quantity).toBe(2)
    expect(buildGuestOverview(updated).metrics.totalAssets).toBe(205000)
  })

  it('replaces an edited holding with an existing ticker without double counting', () => {
    const first = upsertGuestHolding(emptyGuestDraft(), quote, 1)
    const draft = upsertGuestHolding(first, { ...quote, ticker: '2330.TW', name: '台積電' }, 2)
    const updated = upsertGuestHolding(draft, quote, 3, draft.assets[1].id)
    expect(updated.assets).toHaveLength(1)
    expect(buildGuestOverview(updated).metrics.totalAssets).toBe(300000)
  })

  it('rejects invalid lots and unavailable prices instead of saving a zero valuation', () => {
    for (const lots of [0, -1, NaN, Infinity]) expect(() => upsertGuestHolding(emptyGuestDraft(), quote, lots)).toThrow()
    expect(() => upsertGuestHolding(emptyGuestDraft(), { ...quote, price: null }, 1)).toThrow()
  })

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
