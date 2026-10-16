import { describe, expect, it } from 'vitest'
import { planEtfCashflow } from './etfCashflowPlanner'

describe('ETF cashflow planner', () => {
  it('marks a covered conservative target as on track', () => {
    const plan = planEtfCashflow(2_400_000, 6_000, 'conservative')
    expect(plan.requiredYieldPct).toBe(3)
    expect(plan.planningYieldPct).toBeCloseTo(3.4)
    expect(plan.estimatedMonthlyIncome).toBeCloseTo(6_800)
    expect(plan.status).toBe('on-track')
  })

  it('does not present a double-digit yield target as feasible', () => {
    const plan = planEtfCashflow(2_000_000, 20_000, 'income')
    expect(plan.requiredYieldPct).toBe(12)
    expect(plan.status).toBe('unrealistic')
    expect(plan.additionalCapitalNeeded).toBeGreaterThan(3_000_000)
  })

  it('keeps allocations complete and stress income below the planning estimate', () => {
    const plan = planEtfCashflow(1_000_000, 3_000, 'balanced')
    expect(plan.allocations.reduce((sum, item) => sum + item.weightPct, 0)).toBe(100)
    expect(plan.allocations.reduce((sum, item) => sum + item.amount, 0)).toBeCloseTo(1_000_000)
    expect(plan.stressedMonthlyIncome).toBeLessThan(plan.estimatedMonthlyIncome)
    expect(plan.suggestedBuffer).toBe(18_000)
  })

  it('rejects invalid planning inputs', () => {
    expect(() => planEtfCashflow(0, 10_000, 'balanced')).toThrow('大於 0')
    expect(() => planEtfCashflow(1_000_000, -1, 'balanced')).toThrow('不可小於 0')
  })
})
