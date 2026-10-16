const sourceAliases: Record<string, string> = {
  retirement_snapshots_v3: '每月退休快照',
  retirement_monthly_reports: '歷史退休月報',
  retirement_fixed_incomes: '固定收入設定',
  retirement_goals: '退休目標設定',
  user_portfolios: '股票與 ETF 持股',
  user_assets: '其他資產紀錄',
  dividend_calendar: '配息行事曆',
  etf_prices: '市場價格與配息快照',
}
export function friendlySourceLabel(source: string) {
  const value = String(source || '').trim()
  if (!value) return '系統保存資料'
  let result = value
  for (const [raw, label] of Object.entries(sourceAliases).sort(([left], [right]) => right.length - left.length)) {
    result = result.replaceAll(raw, label)
  }
  return /^[a-z0-9_.+\- ]+$/i.test(result) ? '系統保存資料' : result
}
