import type { FormEvent } from 'react'
import { money, number, unitPrice } from './lib/format'

export function HoldingForm({ ticker, lots, busy, onTickerChange, onLotsChange, onSubmit }: {
  ticker: string; lots: string; busy: boolean
  onTickerChange: (value: string) => void; onLotsChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}) {
  return <form className="holding-form" onSubmit={onSubmit} aria-busy={busy}>
    <label>股票／ETF 代號<input value={ticker} onChange={(event) => onTickerChange(event.target.value)} placeholder="例如 0050、2330、00981A" disabled={busy} required /></label>
    <label>張數／單位數<input type="number" min="0.001" step="0.001" value={lots} onChange={(event) => onLotsChange(event.target.value)} disabled={busy} required /></label>
    <button className="primary-button" disabled={busy}>{busy ? '讀取市場資料中…' : '加入或更新'}</button>
  </form>
}

export type HoldingRow = {
  id: string; ticker: string; name: string; lots: number; price: number; value: number
  annualYield: number | null; status: string
}

export function HoldingsTable({ rows, busy, onEdit, onRemove }: {
  rows: HoldingRow[]; busy: boolean; onEdit: (id: string) => void; onRemove: (id: string) => void
}) {
  return <div className="table-wrap"><table>
    <thead><tr><th>標的</th><th>張數</th><th>價格</th><th>市值</th><th>殖利率</th><th>資料狀態</th><th /></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id}>
      <td><strong>{row.name}</strong><small>{row.ticker}</small></td>
      <td>{number.format(row.lots)}</td><td>{row.price > 0 ? unitPrice.format(row.price) : '—'}</td>
      <td>{row.price > 0 || row.value > 0 ? money.format(row.value) : '—'}</td>
      <td>{row.annualYield == null ? '待補資料' : `${number.format(row.annualYield)}%`}</td><td>{row.status}</td>
      <td><button className="text-button" disabled={busy} onClick={() => onEdit(row.id)}>編輯</button><button className="text-button danger" disabled={busy} onClick={() => onRemove(row.id)}>移除</button></td>
    </tr>)}{!rows.length && <tr><td colSpan={7} className="empty">尚未建立持股。</td></tr>}</tbody>
    <tfoot><tr><td>合計</td><td>{number.format(rows.reduce((sum, row) => sum + row.lots, 0))}</td><td /><td>{money.format(rows.reduce((sum, row) => sum + row.value, 0))}</td><td /><td /><td /></tr></tfoot>
  </table></div>
}
