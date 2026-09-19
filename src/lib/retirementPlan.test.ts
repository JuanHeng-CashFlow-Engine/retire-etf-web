import { describe, expect, it } from 'vitest'
import { simulateRetirementPlan } from './retirementPlan'

const base = {
  currentAssets: 1_300,
  monthlyContribution: 0,
  targetAssets: 1_000,
  annualReturn: 0,
  annualVolatility: 0,
  yearsUntilRetirement: 0,
  retirementYears: 1,
  monthlyExpense: 100,
  inflationRate: 0,
  simulations: 500,
}

describe('simulateRetirementPlan', () => {
  it('tracks target reached and retirement drawdown without market noise', () => {
    const result = simulateRetirementPlan(base)
    expect(result.targetReachedProbability).toBe(100)
    expect(result.successProbability).toBe(100)
    expect(result.depletionProbability).toBe(0)
    expect(result.path).toHaveLength(2)
    expect(result.path[1].p50).toBeCloseTo(100)
  })

  it('counts a balance reaching zero as depleted', () => {
    const result = simulateRetirementPlan({ ...base, currentAssets: 1_200 })
    expect(result.successProbability).toBe(0)
    expect(result.riskStartYearOffset).toBe(1)
  })

  it('allows pre-retirement contributions to build assets from zero', () => {
    const result = simulateRetirementPlan({ ...base, currentAssets: 0, monthlyContribution: 100, yearsUntilRetirement: 1, monthlyExpense: 50 })
    expect(result.targetReachedProbability).toBe(100)
    expect(result.successProbability).toBe(100)
    expect(result.path).toHaveLength(3)
  })

  it('is repeatable for the same seed and rejects missing expense', () => {
    const input = { ...base, annualVolatility: 15, seed: 42 }
    expect(simulateRetirementPlan(input)).toEqual(simulateRetirementPlan(input))
    expect(() => simulateRetirementPlan({ ...base, monthlyExpense: 0 })).toThrow('每月退休生活費')
  })

  it('uses scheduled fixed income only during its active retirement months', () => {
    const temporary = simulateRetirementPlan({ ...base, currentAssets: 600, fixedIncomes: [{ monthlyAmount: 100, startMonthOffset: 0, endMonthOffset: 5 }] })
    const permanent = simulateRetirementPlan({ ...base, currentAssets: 600, fixedIncomes: [{ monthlyAmount: 100, startMonthOffset: 0, endMonthOffset: null }] })
    expect(temporary.successProbability).toBe(0)
    expect(permanent.successProbability).toBe(100)
  })
})

