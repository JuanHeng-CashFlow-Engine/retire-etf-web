import { describe, expect, it } from 'vitest'
import { buildCashflowProjection } from './cashflow'

describe('buildCashflowProjection', () => {
  it('places 00878 income in September even when an older quote lists August ex-dividend', () => {
    const result = buildCashflowProjection({ startDate: new Date(2026, 8, 1), monthlyExpense: 0,
      calendar: [], holdings: [], assets: [{ id: '878', asset_type: 'etf', asset_name: '國泰永續高股息',
        asset_code: '00878', current_value: 69660, annual_yield: 7.46, dividend_months: [2, 5, 8, 11],
        is_income_asset: true, quantity: 2, quantity_unit: '張' }] })
    expect(result.months[0].key).toBe('2026-09')
    expect(result.months[0].total).toBeGreaterThan(0)
    expect(result.months[0].events[0].ticker).toBe('00878')
    expect(result.months.find((month) => month.key === '2026-11')?.total).toBe(0)
  })

  it('always returns 12 months and classifies red yellow green by coverage', () => {
    const result = buildCashflowProjection({
      startDate: new Date('2026-09-18T00:00:00'),
      monthlyExpense: 10_000,
      calendar: [
        { id: '1', ticker: 'A', dividend_year: 2026, dividend_month: 9, expected_amount: 3_000, expected_payment_date: '2026-09-20', actual_amount: null, actual_payment_date: null, status: 'announced' },
        { id: '2', ticker: 'B', dividend_year: 2026, dividend_month: 10, expected_amount: 6_000, expected_payment_date: '2026-10-20', actual_amount: null, actual_payment_date: null, status: 'announced' },
        { id: '3', ticker: 'C', dividend_year: 2026, dividend_month: 11, expected_amount: 12_000, expected_payment_date: '2026-11-20', actual_amount: null, actual_payment_date: null, status: 'announced' },
      ],
      holdings: [],
      assets: [],
    })

    expect(result.months).toHaveLength(12)
    expect(result.months[0].level).toBe('red')
    expect(result.months[1].level).toBe('yellow')
    expect(result.months[2].level).toBe('green')
    expect(result.nextEvent?.ticker).toBe('A')
  })

  it('does not duplicate an estimate when a saved calendar item exists for the same ticker and month', () => {
    const result = buildCashflowProjection({
      startDate: new Date('2026-09-01T00:00:00'),
      monthlyExpense: 5_000,
      calendar: [{ id: 'saved', ticker: '0050.TW', dividend_year: 2026, dividend_month: 9, expected_amount: 1_000, expected_payment_date: null, actual_amount: null, actual_payment_date: null, status: 'expected' }],
      holdings: [{ ticker: '0050.TW', name: '元大台灣50', shares: 10, price: 200, annualYield: 6, dividendMonths: [9] }],
      assets: [],
    })

    expect(result.months[0].events).toHaveLength(1)
    expect(result.months[0].total).toBe(1_000)
  })

  it('treats one Taiwan lot as 1,000 shares in dividend estimates', () => {
    const result = buildCashflowProjection({
      startDate: new Date('2026-09-01T00:00:00'),
      monthlyExpense: 5_000,
      calendar: [],
      holdings: [{ ticker: '00981A.TW', name: '主動統一台股增長', shares: 2, price: 30, annualYield: 5, dividendMonths: [9] }],
      assets: [],
    })

    expect(result.months[0].total).toBe(3_000)
  })

  it('includes fixed income only between its start and end months', () => {
    const result = buildCashflowProjection({ startDate: new Date('2026-09-01T00:00:00'), monthlyExpense: 5_000, calendar: [], holdings: [], assets: [], fixedIncomes: [{ id: 'pension', name: '勞退', category: 'labor_pension', monthly_amount: 6_000, start_month: '2026-10-01', end_month: '2026-11-01' }] })
    expect(result.months.slice(0, 4).map((month) => month.total)).toEqual([0, 6_000, 6_000, 0])
    expect(result.nextEvent).toBeNull()
  })

  it('reconciles saved dividends across ticker aliases and never doubles the estimate', () => {
    const result = buildCashflowProjection({
      startDate: new Date(2026, 8, 18), monthlyExpense: 5_000,
      calendar: [{ id: 'saved', ticker: '0050', dividend_year: 2026, dividend_month: 9, expected_amount: 1_000, expected_payment_date: '2026-09-25', actual_amount: null, actual_payment_date: null, status: 'announced' }],
      holdings: [{ ticker: '0050.TW', name: '元大台灣50', shares: 1, price: 100, annualYield: 5, dividendMonths: [9] }],
      assets: [],
    })
    expect(result.months[0].events).toHaveLength(1)
    expect(result.months[0].total).toBe(1_000)
  })

  it('does not select a past payment as the next dividend', () => {
    const result = buildCashflowProjection({
      startDate: new Date(2026, 8, 18), monthlyExpense: 5_000,
      calendar: [
        { id: 'past', ticker: 'A', dividend_year: 2026, dividend_month: 9, expected_amount: 1_000, expected_payment_date: '2026-09-10', actual_amount: null, actual_payment_date: null, status: 'announced' },
        { id: 'future', ticker: 'B', dividend_year: 2026, dividend_month: 9, expected_amount: 1_000, expected_payment_date: '2026-09-25', actual_amount: null, actual_payment_date: null, status: 'announced' },
      ], holdings: [], assets: [],
    })
    expect(result.nextEvent?.id).toBe('future')
  })

  it('counts the same holding once when its ticker appears with two aliases', () => {
    const result = buildCashflowProjection({
      startDate: new Date(2026, 8, 18), monthlyExpense: 5_000, calendar: [],
      holdings: [
        { ticker: '0050', name: '元大台灣50', shares: 1, price: 100, annualYield: 5, dividendMonths: [9] },
        { ticker: '0050.TW', name: '元大台灣50', shares: 1, price: 100, annualYield: 5, dividendMonths: [9] },
      ], assets: [],
    })
    expect(result.months[0].events).toHaveLength(1)
    expect(result.months[0].total).toBe(5_000)
  })
})


