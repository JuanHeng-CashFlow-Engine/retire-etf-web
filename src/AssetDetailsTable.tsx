import type { RetirementOverview } from './data'
import { money, number, unitPrice } from './lib/format'
import { holdingMarketValue } from './lib/metrics'

type DetailRow = { id: string; category: string; code: string; name: string; quantity: string; shares: string; price: number | null; value: number; annualIncome: number; yieldRate: number; weight: number; source: string }

export function buildAssetDetailRows(data: RetirementOverview): DetailRow[] {
  const total = data.metrics.totalAssets
  const market = data.holdings.map((holding) => {
    const value = holdingMarketValue(holding)
    const quote = data.quotes.find((item) => item.ticker.split('.')[0] === holding.ticker.split('.')[0])
    return { id: `market:${holding.ticker}`, category: '股票／ETF', code: holding.ticker.replace(/\.(TW|TWO)$/i, ''), name: holding.name,
      quantity: `${number.format(holding.shares)} 張`, shares: `${number.format(holding.shares * 1000)} 股`, price: holding.price > 0 ? holding.price : null,
      value, annualIncome: value * holding.annualYield / 100, yieldRate: holding.annualYield,
      weight: total > 0 ? value / total * 100 : 0,
      source: quote ? `市場資料${quote.last_updated_at ? ` · ${quote.last_updated_at.slice(0, 10)}` : ''}` : '待補市場資料' }
  })
  const other = data.assets.map((asset) => {
    const value = Number(asset.current_value) || 0
    const quantity = Number(asset.quantity)
    const unit = asset.quantity_unit || (['stock', 'etf'].includes(asset.asset_type) ? '張' : '')
    const isMarket = ['stock', 'etf'].includes(asset.asset_type)
    const lots = isMarket && Number.isFinite(quantity) && quantity > 0 ? (unit === '股' ? quantity / 1000 : quantity) : null
    const yieldRate = asset.is_income_asset ? Number(asset.annual_yield) || 0 : 0
    return { id: `asset:${asset.id}`, category: ({ stock: '股票／ETF', etf: '股票／ETF', fund: '共同基金', cash: '現金', bond: '債券／定存', insurance: '保單／年金' } as Record<string, string>)[asset.asset_type] ?? '其他資產',
      code: asset.asset_code || '—', name: asset.asset_name,
      quantity: lots != null ? `${number.format(lots)} 張` : quantity > 0 ? `${number.format(quantity)} ${unit}` : '—',
      shares: lots != null ? `${number.format(lots * 1000)} 股` : '—',
      price: Number(asset.unit_price) > 0 ? Number(asset.unit_price) : null,
      value, annualIncome: value * yieldRate / 100, yieldRate,
      weight: total > 0 ? value / total * 100 : 0, source: asset.market_quote
        ? `市場資料${asset.market_quote.last_updated_at ? ` · ${asset.market_quote.last_updated_at.slice(0, 10)}` : ''}`
        : asset.is_income_asset ? '手動設定／待核對' : '待補資料' }
  })
  return [...market, ...other].sort((left, right) => right.value - left.value)
}

export function AssetDetailsTable({ data }: { data: RetirementOverview }) {
  const rows = buildAssetDetailRows(data)
  const weightedYield = data.metrics.totalAssets > 0 ? data.metrics.annualDividend / data.metrics.totalAssets * 100 : 0
  return <section className="jh-asset-details"><h2>我的退休資產明細</h2><p className="chart-note">顯示持有數量、價格、市值、年度配息、殖利率與占比。市場資料與自行輸入的估值分開標示。</p>
    <div className="jh-operational-summary"><div><span>總資產</span><strong>{money.format(data.metrics.totalAssets)}</strong></div><div><span>股票／ETF</span><strong>{money.format(data.metrics.stockValue + data.assets.filter((item) => ['stock', 'etf'].includes(item.asset_type)).reduce((sum, item) => sum + Number(item.current_value || 0), 0))}</strong></div><div><span>年度股息／配息</span><strong>{money.format(data.metrics.annualDividend)}</strong></div><div><span>加權殖利率</span><strong>{weightedYield.toFixed(2)}%</strong></div></div>
    <div className="table-wrap jh-detail-scroll"><table className="jh-detail-table"><thead><tr><th>資產類別</th><th>代號</th><th>名稱</th><th>持有數量</th><th>股數</th><th>目前價格</th><th>目前市值</th><th>年度股息／配息</th><th>殖利率</th><th>占總資產</th><th>配息資料</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.category}</td><td>{row.code}</td><td><strong>{row.name}</strong></td><td>{row.quantity}</td><td>{row.shares}</td><td>{row.price == null ? '—' : unitPrice.format(row.price)}</td><td>{money.format(row.value)}</td><td>{money.format(row.annualIncome)}</td><td className={row.yieldRate >= 5 ? 'yield-high' : row.yieldRate >= 3 ? 'yield-mid' : ''}>{row.yieldRate.toFixed(2)}%</td><td className={row.weight >= 20 ? 'weight-high' : row.weight >= 10 ? 'weight-mid' : ''}>{row.weight.toFixed(1)}%</td><td>{row.source}</td></tr>)}{!rows.length && <tr><td colSpan={11} className="empty">尚未輸入資產。</td></tr>}</tbody><tfoot><tr><td colSpan={6}>合計 · {rows.length} 筆</td><td>{money.format(data.metrics.totalAssets)}</td><td>{money.format(data.metrics.annualDividend)}</td><td>{weightedYield.toFixed(2)}%</td><td>{rows.length ? '100.0%' : '0.0%'}</td><td /></tr></tfoot></table></div><p className="chart-note">殖利率與集中度色彩僅供閱讀；估算配息不代表已公告或保證入帳。</p>
  </section>
}
