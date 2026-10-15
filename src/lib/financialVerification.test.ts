import { describe, expect, it } from 'vitest'
import { buildCashflowProjection } from './cashflow'
import { simulateRetirementPlan } from './retirementPlan'
import { estimateStaticRunway } from './runway'
import { quickStressScenario } from './stress'

describe('固定金融驗證案例', () => {
  it('鎖住零波動退休成功率的耗盡邊界', () => {
    const common = { monthlyContribution: 0, targetAssets: 1_000, annualReturn: 0, annualVolatility: 0, yearsUntilRetirement: 0, retirementYears: 1, monthlyExpense: 100, inflationRate: 0, simulations: 500, seed: 42 }
    expect(simulateRetirementPlan({ ...common, currentAssets: 1_300 }).successProbability).toBe(100)
    expect(simulateRetirementPlan({ ...common, currentAssets: 1_200 }).successProbability).toBe(0)
  })

  it('鎖住靜態續航公式與年月顯示所依據的小數月數', () => {
    const result = estimateStaticRunway({ assets: 3_688_105, currentMonthlyGap: -46_892 })
    expect(result.months).toBeCloseTo(78.6512, 3)
    expect(result.wholeYears).toBe(6)
    expect(result.remainingMonths).toBe(7)
  })

  it('鎖住配息張數、殖利率與月份分攤', () => {
    const result = buildCashflowProjection({ startDate: new Date('2026-09-01T00:00:00'), monthlyExpense: 50_000, calendar: [], assets: [], holdings: [{ ticker: '0050.TW', name: '元大台灣50', shares: 2, price: 100, annualYield: 6, dividendMonths: [3, 9] }] })
    expect(result.months[0].total).toBe(6_000)
    expect(result.total12Months).toBe(12_000)
  })

  it('鎖住壓力測試只衝擊曝險資產並獨立調降配息', () => {
    const result = quickStressScenario({ assets: 1_000_000, exposed: 600_000, monthlyExpense: 30_000, cash: 100_000, cashInAssets: true, marketDropPct: 20, dividendIncome: 20_000, dividendDropPct: 25, externalIncome: 5_000 })
    expect(result).toMatchObject({ assetsAfter: 880_000, marketLoss: 120_000, monthlyIncomeAfter: 20_000, monthlyGapAfter: -10_000, cashBufferMonths: 10 })
  })
})

