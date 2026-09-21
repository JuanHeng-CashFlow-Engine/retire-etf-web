import { describe, expect, it } from 'vitest'
import { estimateStaticRunway, runwayLabel } from './runway'

describe('estimateStaticRunway', () => {
  it('uses current gap until future income starts, then switches to future gap', () => {
    const result = estimateStaticRunway({
      assets: 2_721_950.36,
      currentMonthlyGap: -49_374.97,
      futureMonthlyGap: -26_374.97,
      futureStartDate: '2030-12-01',
      asOfDate: '2026-09-21',
    })

    expect(result.monthsUntilFutureIncome).toBe(51)
    expect(result.depletedBeforeFutureIncome).toBe(false)
    expect(result.months).toBeGreaterThan(58)
    expect(result.months).toBeLessThan(60)
    expect(runwayLabel(result)).toBe('4 年 11 個月')
  })

  it('reports depletion before future income when assets cannot bridge to the start date', () => {
    const result = estimateStaticRunway({
      assets: 500_000,
      currentMonthlyGap: -20_000,
      futureMonthlyGap: -5_000,
      futureStartDate: '2030-12-01',
      asOfDate: '2026-09-21',
    })

    expect(result.depletedBeforeFutureIncome).toBe(true)
    expect(result.months).toBe(25)
  })

  it('treats non-negative monthly balance as no static depletion', () => {
    const result = estimateStaticRunway({
      assets: 1_000_000,
      currentMonthlyGap: 3_000,
    })
    expect(result.coveredIndefinitely).toBe(true)
    expect(result.months).toBeNull()
  })
})
