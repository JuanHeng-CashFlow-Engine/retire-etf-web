import { describe, expect, it } from 'vitest'
import { fixedIncomeForMonth, fixedIncomeRange } from './fixedIncome'

const pension = { id: '1', name: '勞退', category: 'labor_pension' as const, monthly_amount: 18_000, start_month: '2027-01-01', end_month: '2027-12-01' }

describe('fixed income schedule', () => {
  it('counts the start and end months inclusively', () => {
    expect(fixedIncomeForMonth([pension], '2026-12')).toBe(0)
    expect(fixedIncomeForMonth([pension], '2027-01')).toBe(18_000)
    expect(fixedIncomeForMonth([pension], '2027-12')).toBe(18_000)
    expect(fixedIncomeForMonth([pension], '2028-01')).toBe(0)
  })

  it('converts absolute months into simulation offsets', () => {
    expect(fixedIncomeRange(pension, new Date(2026, 8, 1))).toEqual({ monthlyAmount: 18_000, startMonthOffset: 4, endMonthOffset: 15 })
  })
})
