import { type FormEvent, useState } from 'react'
import { AssetDetailsTable } from './AssetDetailsTable'
import { AssetImportPanel } from './AssetImportPanel'
import { importNumber, isMarketRow, validateImportRow, type ImportAssetRow } from './assetImport'
import { buildGuestOverview, upsertGuestHolding, type GuestDraft, type GuestDraftUpdate } from './guestData'
import { HoldingForm, HoldingsTable } from './HoldingControls'
import { lookupMarketQuote } from './marketData'
import { money, number } from './lib/format'
import type { UserAsset } from './types'

const monthsFrom = (value: string) => [...new Set(value.split(/[，,\s]+/).map(Number).filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))]

export function GuestAssetsPage({ draft, update }: { draft: GuestDraft; update: GuestDraftUpdate }) {
  const [marketId, setMarketId] = useState('')
  const [ticker, setTicker] = useState('')
  const [lots, setLots] = useState('')
  const [busy, setBusy] = useState(false)
  const [assetId, setAssetId] = useState('')
  const [assetType, setAssetType] = useState('cash')
  const [assetName, setAssetName] = useState('')
  const [assetValue, setAssetValue] = useState('')
  const [assetYield, setAssetYield] = useState('')
  const [assetMonths, setAssetMonths] = useState('')
  const [message, setMessage] = useState('')
  const overview = buildGuestOverview(draft)
  const existingKeys = draft.assets.map((item) => ['stock', 'etf'].includes(item.asset_type)
    ? `market:${item.asset_code.toUpperCase().replace(/\.(TW|TWO)$/, '')}`
    : `asset:${item.asset_type}:${item.asset_name.toLowerCase()}:${(item.provider ?? '').toLowerCase()}`)

  async function saveMarket(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const count = Number(lots)
    if (!Number.isFinite(count) || count <= 0) { setMessage('請輸入大於 0 的持有張數。'); return }
    setBusy(true); setMessage('')
    try {
      const quote = await lookupMarketQuote(ticker)
      update((current) => upsertGuestHolding(current, quote, count, marketId || undefined))
      setMarketId(''); setTicker(''); setLots('')
      setMessage(`已更新 ${quote.name || quote.ticker}，並帶入市場價格與殖利率。`)
    } catch (error) { setMessage(error instanceof Error ? error.message : '市場資料暫時無法讀取，請稍後重試。') }
    finally { setBusy(false) }
  }
  function saveOther(event: FormEvent) {
    event.preventDefault()
    const value = Number(assetValue), yieldRate = assetType === 'cash' ? 0 : Number(assetYield || 0)
    if (!assetName.trim() || !(value >= 0) || yieldRate < 0 || yieldRate > 30) { setMessage('請核對名稱、市值與收益率。'); return }
    const asset: UserAsset = { id: assetId || crypto.randomUUID(), asset_type: assetType, asset_name: assetName.trim(), asset_code: '',
      current_value: value, annual_yield: yieldRate, dividend_months: monthsFrom(assetMonths), is_income_asset: yieldRate > 0 }
    update({ ...draft, assets: assetId ? draft.assets.map((item) => item.id === assetId ? asset : item) : [...draft.assets, asset] })
    setAssetId(''); setAssetName(''); setAssetValue(''); setAssetYield(''); setAssetMonths(''); setMessage('其他資產已加入本次試算。')
  }
  async function commitImport(raw: ImportAssetRow) {
    const { row, errors, value, lots } = validateImportRow(raw)
    if (errors.length || value == null) throw new Error(errors.join('；') || '資料尚未完成核對。')
    const key = isMarketRow(row) ? `market:${row.ticker}` : `asset:${row.assetType}:${row.name.toLowerCase()}:${row.account.toLowerCase()}`
    if (existingKeys.includes(key)) throw new Error('此資產已存在，請編輯原紀錄。')
    const asset: UserAsset = { id: crypto.randomUUID(), asset_type: row.assetType, asset_name: row.name || row.ticker, asset_code: row.ticker,
      provider: row.account, current_value: value, quantity: importNumber(row.quantity), quantity_unit: row.quantityUnit,
      unit_price: importNumber(row.unitPrice) ?? (lots && value ? value / (lots * 1000) : null),
      annual_yield: importNumber(row.annualYield) ?? 0, dividend_months: [], is_income_asset: (importNumber(row.annualYield) ?? 0) > 0,
      notes: `匯入資料日期：${row.dataDate}${row.notes ? `；${row.notes}` : ''}` }
    update((current) => ({ ...current, assets: [...current.assets, asset] }))
  }
  function edit(asset: UserAsset) {
    setMessage('')
    if (['stock', 'etf'].includes(asset.asset_type)) {
      setMarketId(asset.id); setTicker(asset.asset_code)
      setLots(String(asset.quantity ? Number(asset.quantity) / (asset.quantity_unit === '股' ? 1000 : 1) : ''))
    } else {
      setAssetId(asset.id); setAssetType(asset.asset_type); setAssetName(asset.asset_name)
      setAssetValue(String(asset.current_value)); setAssetYield(String(asset.annual_yield))
      setAssetMonths(Array.isArray(asset.dividend_months) ? asset.dividend_months.join(',') : '')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <section className="page-section jh-operational-page"><p className="eyebrow">免費版 / 第一步</p><h1>輸入資產</h1><p className="lead">與 Pro 版使用同一套股票／ETF、其他資產及匯入核對方式。免費版資料只留在本次瀏覽。</p>
    <h2>股票與 ETF</h2>
    <HoldingForm ticker={ticker} lots={lots} busy={busy} onTickerChange={setTicker} onLotsChange={setLots} onSubmit={saveMarket} />
    <p className="chart-note">輸入代號與張數，按「加入或更新」即可帶入中文名稱、價格、市值與殖利率。市值＝張數 × 1,000 股 × 每股價格；行情與 Pro 版使用相同資料來源，依標示日期為準。</p>
    {message && <p className="form-message" role="status">{message}</p>}
    <HoldingsTable busy={busy} rows={draft.assets.filter((asset) => ['stock', 'etf'].includes(asset.asset_type)).map((asset) => ({
      id: asset.id, ticker: asset.asset_code, name: asset.asset_name,
      lots: Number(asset.quantity || 0) / (asset.quantity_unit === '股' ? 1000 : 1),
      price: Number(asset.unit_price || 0), value: Number(asset.current_value),
      annualYield: asset.market_quote && asset.market_quote.yield == null ? null : Number(asset.annual_yield),
      status: asset.market_quote ? `市場資料${asset.market_quote.last_updated_at ? ` · ${asset.market_quote.last_updated_at.slice(0, 10)}` : '已載入'}` : '自行輸入／匯入',
    }))} onEdit={(id) => { const asset = draft.assets.find((item) => item.id === id); if (asset) edit(asset) }}
      onRemove={(id) => { update((current) => ({ ...current, assets: current.assets.filter((item) => item.id !== id) })); if (marketId === id) { setMarketId(''); setTicker(''); setLots('') } }} />
    <h2 className="jh-assets-subheading">其他資產</h2><form className="jh-asset-form" onSubmit={saveOther}><label>資產類別<select value={assetType} onChange={(event) => setAssetType(event.target.value)}><option value="cash">現金</option><option value="fund">基金</option><option value="bond">債券／定存</option><option value="insurance">保單／年金</option><option value="other">其他</option></select></label><label>資產名稱<input value={assetName} onChange={(event) => setAssetName(event.target.value)} required /></label><label>目前市值（元）<input type="number" min="0" step="any" value={assetValue} onChange={(event) => setAssetValue(event.target.value)} required /></label><label>年化配息率（%）<input type="number" min="0" max="30" step="any" value={assetYield} onChange={(event) => setAssetYield(event.target.value)} disabled={assetType === 'cash'} /></label><label>配息月份（可選）<input value={assetMonths} onChange={(event) => setAssetMonths(event.target.value)} placeholder="例如 3,6,9,12" disabled={assetType === 'cash'} /></label><button className="primary-button">{assetId ? '更新資產' : '新增資產'}</button></form>
    <AssetImportPanel guest onCommit={commitImport} existingKeys={existingKeys} />
    <h2 className="jh-assets-subheading">已加入的其他資產</h2><div className="table-wrap"><table><thead><tr><th>名稱／代號</th><th>類別</th><th>張數／數量</th><th>目前市值</th><th>殖利率</th><th /></tr></thead><tbody>{draft.assets.filter((asset) => !['stock', 'etf'].includes(asset.asset_type)).map((asset) => <tr key={asset.id}><td><strong>{asset.asset_name}</strong><small>{asset.asset_code}</small></td><td>{asset.asset_type}</td><td>{asset.quantity ? `${number.format(Number(asset.quantity))} ${asset.quantity_unit || ''}` : '—'}</td><td>{money.format(Number(asset.current_value))}</td><td>{number.format(Number(asset.annual_yield))}%</td><td><button className="text-button" onClick={() => edit(asset)}>編輯</button><button className="text-button danger" onClick={() => update({ ...draft, assets: draft.assets.filter((item) => item.id !== asset.id) })}>移除</button></td></tr>)}{!draft.assets.some((asset) => !['stock', 'etf'].includes(asset.asset_type)) && <tr><td colSpan={6} className="empty">尚未輸入資產。</td></tr>}</tbody></table></div>
    <AssetDetailsTable data={overview} />
  </section>
}
