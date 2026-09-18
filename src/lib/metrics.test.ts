import { describe, expect, it } from 'vitest'
import { calculateRetirementMetrics } from './metrics'

describe('calculateRetirementMetrics', () => {
  it('combines holdings and assets without double counting', () => {
    const result = calculateRetirementMetrics(
      [{ ticker: '0050.TW', name: '元大台灣50', shares: 10, price: 200, annualYield: 3 }],
      [{ currentValue: 8_000, annualYield: 6 }],
      20_000,
      1_000,
    )

    expect(result.totalAssets).toBe(10_000)
    expect(result.annualDividend).toBe(540)
    expect(result.progressPct).toBe(50)
    expect(result.monthlyIncome).toBe(45)
    expect(result.monthlyGap).toBe(-955)
  })

  it('handles an unset target and expense safely', () => {
    const result = calculateRetirementMetrics([], [], 0, 0)
    expect(result.progressPct).toBe(0)
    expect(result.coveragePct).toBe(0)
  })
})
