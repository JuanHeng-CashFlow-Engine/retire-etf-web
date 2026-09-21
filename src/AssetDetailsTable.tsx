import type { RetirementOverview } from './data'
import { money, number, unitPrice } from './lib/format'
import { holdingMarketValue } from './lib/metrics'
import { sameTicker } from './lib/ticker'
import type { DividendItem, MarketQuote } from './types'

export type DetailRow = {
  id: string
  category: string
  code: string
  name: string
  quantity: string
  shares: string
  price: number | null
  value: number
  annualIncome: number
  yieldRate: number
  weight: number
  source: string
  dividendStatus: string
}

const allocationColors = ['#f2cf7b', '#4da3ff', '#4bc28a', '#d77979', '#9b86e8', '#e79254', '#61c4cc', '#c580c8']

function dividendEvidence(ticker: string, calendar: DividendItem[], quote?: MarketQuote) {
  const events = calendar.filter((item) => sameTicker(ticker, item.ticker))
  const event = [...events].sort((left, right) => {
    const leftDate = left.actual_payment_date ?? left.expected_payment_date ?? `${left.dividend_year}-${String(left.dividend_month).padStart(2, '0')}-01`
    const rightDate = right.actual_payment_date ?? right.expected_payment_date ?? `${right.dividend_year}-${String(right.dividend_month).padStart(2, '0')}-01`
    return rightDate.localeCompare(leftDate)
  })[0]

  if (event) {
    const raw = String(event.status ?? '').toLowerCase()
    if (event.actual_amount != null || event.actual_payment_date || /actual|recorded|paid|入帳/.test(raw)) {
      return { source: '證交所公告／入帳紀錄', status: '已入帳' }
    }
    if (/announced|confirmed|公告|確認/.test(raw)) {
      return { source: '證交所公告', status: '已公告待入帳' }
    }
  }

  if (quote || ticker) return { source: '歷史配息資料推估', status: '預估／待確認' }
  return { source: '尚無配息資料', status: '待補資料' }
}

export function buildAssetDetailRows(data: RetirementOverview): DetailRow[] {
  const total = data.metrics.totalAssets
  const market = data.holdings.map((holding) => {
    const value = holdingMarketValue(holding)
    const quote = data.quotes.find((item) => sameTicker(item.ticker, holding.ticker))
    const evidence = dividendEvidence(holding.ticker, data.dividends, quote)
    return { id: `market:${holding.ticker}`, category: '股票／ETF', code: holding.ticker.replace(/\.(TW|TWO)$/i, ''), name: holding.name,
      quantity: `${number.format(holding.shares)} 張`, shares: `${number.format(holding.shares * 1000)} 股`, price: holding.price > 0 ? holding.price : null,
      value, annualIncome: value * holding.annualYield / 100, yieldRate: holding.annualYield,
      weight: total > 0 ? value / total * 100 : 0, source: evidence.source, dividendStatus: evidence.status }
  })
  const other = data.assets.map((asset) => {
    const value = Number(asset.current_value) || 0
    const quantity = Number(asset.quantity)
    const unit = asset.quantity_unit || (['stock', 'etf'].includes(asset.asset_type) ? '張' : '')
    const isMarket = ['stock', 'etf'].includes(asset.asset_type)
    const isCash = asset.asset_type === 'cash'
    const lots = isMarket && Number.isFinite(quantity) && quantity > 0 ? (unit === '股' ? quantity / 1000 : quantity) : null
    const yieldRate = asset.is_income_asset ? Number(asset.annual_yield) || 0 : 0
    const evidence = isCash
      ? { source: '自行輸入', status: '配息不用確認' }
      : isMarket
        ? dividendEvidence(asset.asset_code, data.dividends, asset.market_quote)
        : asset.is_income_asset
          ? { source: '自行輸入', status: '依設定估算' }
          : { source: '自行輸入', status: '無配息' }
    return { id: `asset:${asset.id}`, category: ({ stock: '股票／ETF', etf: '股票／ETF', fund: '共同基金', cash: '現金', bond: '債券／定存', insurance: '保單／年金' } as Record<string, string>)[asset.asset_type] ?? '其他資產',
      code: asset.asset_code || '—', name: asset.asset_name,
      quantity: isCash ? '—' : lots != null ? `${number.format(lots)} 張` : quantity > 0 ? `${number.format(quantity)} ${unit}` : '—',
      shares: isCash ? '—' : lots != null ? `${number.format(lots * 1000)} 股` : '—',
      price: isCash ? null : Number(asset.unit_price) > 0 ? Number(asset.unit_price) : null,
      value, annualIncome: value * yieldRate / 100, yieldRate,
      weight: total > 0 ? value / total * 100 : 0, source: evidence.source, dividendStatus: evidence.status }
  })
  return [...market, ...other].sort((left, right) => right.value - left.value)
}

function AssetAllocationChart({ rows }: { rows: DetailRow[] }) {
  const segments = rows.filter((row) => row.value > 0)
  let cursor = 0
  const stops = segments.map((row, index) => {
    const start = cursor
    cursor += row.weight
    return `${allocationColors[index % allocationColors.length]} ${start.toFixed(2)}% ${Math.min(cursor, 100).toFixed(2)}%`
  })
  const label = segments.map((row) => `${row.name} ${row.weight.toFixed(1)}%`).join('、')
  return <section className="jh-allocation"><div><h3>資產配置占比</h3><p className="chart-note">依目前市值計算各項資產占總資產的百分比。</p></div>
    {segments.length ? <div className="jh-allocation-body"><div className="jh-allocation-chart" role="img" aria-label={label} style={{ background: `conic-gradient(${stops.join(',')})` }}><span>總資產<strong>{money.format(segments.reduce((sum, row) => sum + row.value, 0))}</strong></span></div>
      <ul className="jh-allocation-legend">{segments.map((row, index) => <li key={row.id}><i style={{ background: allocationColors[index % allocationColors.length] }} /><span>{row.name}<small>{row.category}</small></span><strong>{row.weight.toFixed(1)}%</strong></li>)}</ul></div>
      : <p className="empty">尚未輸入可繪製的資產。</p>}
  </section>
}

export function AssetDetailsTable({ data }: { data: RetirementOverview }) {
  const rows = buildAssetDetailRows(data)
  const weightedYield = data.metrics.totalAssets > 0 ? data.metrics.annualDividend / data.metrics.totalAssets * 100 : 0
  return <section className="jh-asset-details"><h2>我的退休資產明細</h2><p className="chart-note">顯示持有數量、價格、市值、年度配息、殖利率與占比，並分開標示配息資料來源及目前狀態。</p>
    <div className="jh-operational-summary"><div><span>總資產</span><strong>{money.format(data.metrics.totalAssets)}</strong></div><div><span>股票／ETF</span><strong>{money.format(data.metrics.stockValue + data.assets.filter((item) => ['stock', 'etf'].includes(item.asset_type)).reduce((sum, item) => sum + Number(item.current_value || 0), 0))}</strong></div><div><span>年度股息／配息</span><strong>{money.format(data.metrics.annualDividend)}</strong></div><div><span>加權殖利率</span><strong>{weightedYield.toFixed(2)}%</strong></div></div>
    <div className="table-wrap jh-detail-scroll"><table className="jh-detail-table"><thead><tr><th>資產類別</th><th>代號</th><th>名稱</th><th>持有數量</th><th>股數</th><th>目前價格</th><th>目前市值</th><th>年度股息／配息</th><th>殖利率</th><th>占總資產</th><th>配息資料來源</th><th>配息狀態</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.category}</td><td>{row.code}</td><td><strong>{row.name}</strong></td><td>{row.quantity}</td><td>{row.shares}</td><td>{row.price == null ? '—' : unitPrice.format(row.price)}</td><td>{money.format(row.value)}</td><td>{money.format(row.annualIncome)}</td><td className={row.yieldRate >= 5 ? 'yield-high' : row.yieldRate >= 3 ? 'yield-mid' : ''}>{row.yieldRate.toFixed(2)}%</td><td className={row.weight >= 20 ? 'weight-high' : row.weight >= 10 ? 'weight-mid' : ''}>{row.weight.toFixed(1)}%</td><td>{row.source}</td><td><span className={`jh-status ${row.dividendStatus === '已入帳' ? 'done' : row.dividendStatus === '已公告待入帳' ? 'announced' : row.dividendStatus === '預估／待確認' ? 'estimated' : 'neutral'}`}>{row.dividendStatus}</span></td></tr>)}{!rows.length && <tr><td colSpan={12} className="empty">尚未輸入資產。</td></tr>}</tbody><tfoot><tr><td colSpan={6}>合計 · {rows.length} 筆</td><td>{money.format(data.metrics.totalAssets)}</td><td>{money.format(data.metrics.annualDividend)}</td><td>{weightedYield.toFixed(2)}%</td><td>{rows.length ? '100.0%' : '0.0%'}</td><td colSpan={2} /></tr></tfoot></table></div><p className="chart-note">「證交所公告」只用於已公告或已有入帳紀錄的資料；其餘配息金額依歷史配息與殖利率估算，不代表已公告或保證入帳。</p>
    <AssetAllocationChart rows={rows} />
  </section>
}

