import { describe, expect, it } from 'vitest'
import { quickStressScenario } from './stress'

const base = {
  assets: 1_000_000,
  exposed: 600_000,
  monthlyExpense: 30_000,
  cash: 100_000,
  cashInAssets: true,
  marketDropPct: 20,
  dividendIncome: 20_000,
  dividendDropPct: 25,
  externalIncome: 5_000,
}

describe('quickStressScenario', () => {
  it('shocks only exposed assets and separately reduces dividends', () => {
    const result = quickStressScenario(base)
    expect(result.assetsAfter).toBe(880_000)
    expect(result.marketLoss).toBe(120_000)
    expect(result.monthlyIncomeAfter).toBe(20_000)
    expect(result.monthlyGapAfter).toBe(-10_000)
    expect(result.cashBufferMonths).toBe(10)
  })

  it('adds cash once only when it is outside the total', () => {
    const result = quickStressScenario({ ...base, cashInAssets: false })
    expect(result.assetsBefore).toBe(1_100_000)
    expect(result.assetsAfter).toBe(980_000)
  })

  it('rejects duplicated cash and overstated market exposure', () => {
    expect(() => quickStressScenario({ ...base, assets: 50_000 })).toThrow('現金不可超過')
    expect(() => quickStressScenario({ ...base, exposed: 950_000 })).toThrow('受市場影響')
    expect(() => quickStressScenario({ ...base, dividendDropPct: 101 })).toThrow('跌幅')
  })

  it('does not imply a cash deficit when income covers expenses', () => {
    const result = quickStressScenario({ ...base, monthlyExpense: 10_000 })
    expect(result.cashBufferMonths).toBeNull()
  })
})

