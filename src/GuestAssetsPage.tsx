import { type FormEvent, useState } from 'react'
import { AssetDetailsTable } from './AssetDetailsTable'
import { AssetImportPanel } from './AssetImportPanel'
import { importNumber, isMarketRow, validateImportRow, type ImportAssetRow } from './assetImport'
import { buildGuestOverview, type GuestDraft } from './guestData'
import { money, number } from './lib/format'
import type { UserAsset } from './types'

const monthsFrom = (value: string) => [...new Set(value.split(/[，,\s]+/).map(Number).filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))]

export function GuestAssetsPage({ draft, update }: { draft: GuestDraft; update: (next: GuestDraft) => void }) {
  const [marketId, setMarketId] = useState('')
  const [ticker, setTicker] = useState('')
  const [marketName, setMarketName] = useState('')
  const [lots, setLots] = useState('')
  const [price, setPrice] = useState('')
  const [marketYield, setMarketYield] = useState('')
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

  function saveMarket(event: FormEvent) {
    event.preventDefault()
    const code = ticker.trim().toUpperCase().replace(/\.(TW|TWO)$/, '')
    const count = Number(lots), unitPrice = Number(price), yieldRate = Number(marketYield || 0)
    if (!/^[0-9A-Z]{4,6}$/.test(code) || !(count > 0) || !(unitPrice > 0) || yieldRate < 0 || yieldRate > 30) { setMessage('請核對代號、張數、價格與殖利率。'); return }
    if (!marketId && draft.assets.some((item) => ['stock', 'etf'].includes(item.asset_type) && item.asset_code.toUpperCase() === code)) { setMessage('此代號已有資產，請編輯原紀錄。'); return }
    const asset: UserAsset = { id: marketId || crypto.randomUUID(), asset_type: 'etf', asset_name: marketName.trim() || code, asset_code: code,
      current_value: count * 1000 * unitPrice, quantity: count, quantity_unit: '張', unit_price: unitPrice,
      annual_yield: yieldRate, dividend_months: [], is_income_asset: yieldRate > 0 }
    update({ ...draft, assets: marketId ? draft.assets.map((item) => item.id === marketId ? asset : item) : [...draft.assets, asset] })
    setMarketId(''); setTicker(''); setMarketName(''); setLots(''); setPrice(''); setMarketYield(''); setMessage('股票／ETF 已加入本次試算。')
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
    update({ ...draft, assets: [...draft.assets, asset] })
  }
  function edit(asset: UserAsset) {
    setMessage('')
    if (['stock', 'etf'].includes(asset.asset_type)) {
      setMarketId(asset.id); setTicker(asset.asset_code); setMarketName(asset.asset_name)
      setLots(String(asset.quantity ?? '')); setPrice(String(asset.unit_price ?? '')); setMarketYield(String(asset.annual_yield))
    } else {
      setAssetId(asset.id); setAssetType(asset.asset_type); setAssetName(asset.asset_name)
      setAssetValue(String(asset.current_value)); setAssetYield(String(asset.annual_yield))
      setAssetMonths(Array.isArray(asset.dividend_months) ? asset.dividend_months.join(',') : '')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <section className="page-section jh-operational-page"><p className="eyebrow">免費版 / 第一步</p><h1>輸入資產</h1><p className="lead">與 Pro 版使用同一套股票／ETF、其他資產及匯入核對方式。免費版資料只留在本次瀏覽。</p>
    <h2>股票與 ETF</h2><form className="jh-asset-form" onSubmit={saveMarket}><label>股票／ETF 代號<input value={ticker} onChange={(event) => setTicker(event.target.value)} placeholder="例如 0050" required /></label><label>標的名稱（可選）<input value={marketName} onChange={(event) => setMarketName(event.target.value)} placeholder="例如 元大台灣50" /></label><label>持有張數<input type="number" min="0.001" step="0.001" value={lots} onChange={(event) => setLots(event.target.value)} required /></label><label>目前價格（元／股）<input type="number" min="0.01" step="any" value={price} onChange={(event) => setPrice(event.target.value)} required /></label><label>年化殖利率（%）<input type="number" min="0" max="30" step="any" value={marketYield} onChange={(event) => setMarketYield(event.target.value)} /></label><button className="primary-button">{marketId ? '更新持股' : '加入持股'}</button></form><p className="chart-note">市值＝張數 × 1,000 股 × 每股價格。免費版價格及殖利率由你輸入，並非即時行情。</p>
    <h2 className="jh-assets-subheading">其他資產</h2><form className="jh-asset-form" onSubmit={saveOther}><label>資產類別<select value={assetType} onChange={(event) => setAssetType(event.target.value)}><option value="cash">現金</option><option value="fund">基金</option><option value="bond">債券／定存</option><option value="insurance">保單／年金</option><option value="other">其他</option></select></label><label>資產名稱<input value={assetName} onChange={(event) => setAssetName(event.target.value)} required /></label><label>目前市值（元）<input type="number" min="0" step="any" value={assetValue} onChange={(event) => setAssetValue(event.target.value)} required /></label><label>年化配息率（%）<input type="number" min="0" max="30" step="any" value={assetYield} onChange={(event) => setAssetYield(event.target.value)} disabled={assetType === 'cash'} /></label><label>配息月份（可選）<input value={assetMonths} onChange={(event) => setAssetMonths(event.target.value)} placeholder="例如 3,6,9,12" disabled={assetType === 'cash'} /></label><button className="primary-button">{assetId ? '更新資產' : '新增資產'}</button></form>
    {message && <p className="form-message" role="status">{message}</p>}
    <AssetImportPanel guest onCommit={commitImport} existingKeys={existingKeys} />
    <h2 className="jh-assets-subheading">已加入的資產</h2><div className="table-wrap"><table><thead><tr><th>名稱／代號</th><th>類別</th><th>張數／數量</th><th>目前市值</th><th>殖利率</th><th /></tr></thead><tbody>{draft.assets.map((asset) => <tr key={asset.id}><td><strong>{asset.asset_name}</strong><small>{asset.asset_code}</small></td><td>{asset.asset_type}</td><td>{asset.quantity ? `${number.format(Number(asset.quantity))} ${asset.quantity_unit || ''}` : '—'}</td><td>{money.format(Number(asset.current_value))}</td><td>{number.format(Number(asset.annual_yield))}%</td><td><button className="text-button" onClick={() => edit(asset)}>編輯</button><button className="text-button danger" onClick={() => update({ ...draft, assets: draft.assets.filter((item) => item.id !== asset.id) })}>移除</button></td></tr>)}{!draft.assets.length && <tr><td colSpan={6} className="empty">尚未輸入資產。</td></tr>}</tbody></table></div>
    <AssetDetailsTable data={overview} />
  </section>
}
