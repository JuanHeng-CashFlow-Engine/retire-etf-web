export type PortfolioHolding = {
  ticker: string
  name: string
  shares: number
  price: number
  annualYield: number
  dividendMonths?: number[]
}

export type AssetValue = {
  currentValue: number
  annualYield: number
}

export const TAIWAN_SHARES_PER_LOT = 1_000

export function holdingMarketValue(holding: PortfolioHolding): number {
  return holding.shares * TAIWAN_SHARES_PER_LOT * holding.price
}

export function calculateRetirementMetrics(
  holdings: PortfolioHolding[],
  assets: AssetValue[],
  targetAmount: number,
  monthlyExpense: number,
) {
  const stockValue = holdings.reduce((sum, row) => sum + holdingMarketValue(row), 0)
  const otherAssetValue = assets.reduce((sum, row) => sum + row.currentValue, 0)
  const annualDividend =
    holdings.reduce(
      (sum, row) => sum + holdingMarketValue(row) * (row.annualYield / 100),
      0,
    ) +
    assets.reduce(
      (sum, row) => sum + row.currentValue * (row.annualYield / 100),
      0,
    )
  const totalAssets = stockValue + otherAssetValue
  const monthlyIncome = annualDividend / 12
  const progressPct = targetAmount > 0 ? Math.min((totalAssets / targetAmount) * 100, 100) : 0
  const coveragePct = monthlyExpense > 0 ? (monthlyIncome / monthlyExpense) * 100 : 0

  return {
    stockValue,
    otherAssetValue,
    totalAssets,
    annualDividend,
    monthlyIncome,
    progressPct,
    coveragePct,
    monthlyGap: monthlyIncome - monthlyExpense,
  }
}

