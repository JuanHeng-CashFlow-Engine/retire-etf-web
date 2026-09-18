export type StressInput = {
  assets: number
  exposed: number
  monthlyExpense: number
  cash: number
  cashInAssets: boolean
  marketDropPct: number
  dividendIncome: number
  dividendDropPct: number
  externalIncome: number
}

export type StressResult = {
  assetsBefore: number
  assetsAfter: number
  marketLoss: number
  monthlyIncomeBefore: number
  monthlyIncomeAfter: number
  monthlyGapBefore: number
  monthlyGapAfter: number
  cashBufferMonths: number | null
}

// 移植舊版 quick_scenario 的單次衝擊規則；不讀寫帳戶，也不預測市場。
export function quickStressScenario(input: StressInput): StressResult {
  const amounts = [input.assets, input.exposed, input.monthlyExpense, input.cash, input.dividendIncome, input.externalIncome]
  if (amounts.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('資產、生活費、現金與收入必須是非負有效數字。')
  if (![input.marketDropPct, input.dividendDropPct].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) {
    throw new Error('市場及配息跌幅必須介於 0% 至 100%。')
  }
  if (input.cashInAssets && input.cash > input.assets) throw new Error('已包含的現金不可超過資產總額。')
  const availableExposure = input.assets - (input.cashInAssets ? input.cash : 0)
  if (input.exposed > availableExposure) throw new Error('受市場影響的資產不可超過扣除已包含現金後的資產。')

  const assetsBefore = input.assets + (input.cashInAssets ? 0 : input.cash)
  const marketLoss = input.exposed * input.marketDropPct / 100
  const assetsAfter = assetsBefore - marketLoss
  const monthlyIncomeBefore = input.dividendIncome + input.externalIncome
  const monthlyIncomeAfter = input.dividendIncome * (1 - input.dividendDropPct / 100) + input.externalIncome
  const monthlyGapBefore = monthlyIncomeBefore - input.monthlyExpense
  const monthlyGapAfter = monthlyIncomeAfter - input.monthlyExpense

  return {
    assetsBefore,
    assetsAfter,
    marketLoss,
    monthlyIncomeBefore,
    monthlyIncomeAfter,
    monthlyGapBefore,
    monthlyGapAfter,
    cashBufferMonths: monthlyGapAfter >= 0 ? null : input.cash / -monthlyGapAfter,
  }
}

