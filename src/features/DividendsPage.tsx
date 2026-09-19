import { type FormEvent, useMemo, useState } from 'react'
import { markAlertRead, saveDividendCalendarEvent, type RetirementOverview } from '../data'
import { buildCashflowProjection, type CashflowEvent } from '../lib/cashflow'
import { dateLabel, money } from '../lib/format'
import { holdingMarketValue } from '../lib/metrics'
import type { ClaimsIdentity } from '../types'
import { Empty, FeatureHeader, FeaturePanel, MiniBars, SummaryStats } from './shared'

type Draft = { id?: string; ticker: string; monthKey: string; expectedAmount: string; expectedDate: string; actualAmount: string; actualDate: string; status: 'expected' | 'announced' | 'recorded' }
const emptyDraft = (): Draft => { const today = new Date(); return { ticker: '', monthKey: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`, expectedAmount: '', expectedDate: '', actualAmount: '', actualDate: '', status: 'expected' } }

export function DividendsPage({ data, identity, reload, onNavigate }: { data: RetirementOverview; identity: ClaimsIdentity; reload: () => Promise<void>; onNavigate: (page: string) => void }) {
  const projection = useMemo(() => buildCashflowProjection({ startDate: new Date(), monthlyExpense: data.monthlyExpense, calendar: data.dividends, holdings: data.holdings, assets: data.assets }), [data])
  const [selectedKey, setSelectedKey] = useState(projection.months[0].key)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const month = projection.months.find((item) => item.key === selectedKey) ?? projection.months[0]
  const recorded = projection.events.filter((event) => event.status === 'recorded').reduce((sum, event) => sum + event.amount, 0)
  const announced = projection.events.filter((event) => event.status === 'announced').reduce((sum, event) => sum + event.amount, 0)
  const estimated = projection.total12Months - recorded - announced
  const sources = Object.entries(projection.events.reduce<Record<string, number>>((result, event) => {
    result[event.ticker] = (result[event.ticker] ?? 0) + event.amount
    return result
  }, {})).sort((a, b) => b[1] - a[1])
  const alerts = data.memberAlerts.filter((alert) => /dividend|配息|股利/i.test(`${alert.alert_type} ${alert.title}`))
  const today = new Date()
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const upcoming = projection.events.filter((event) => event.paymentDate && event.status !== 'recorded' &&
    event.paymentDate >= todayDate && new Date(`${event.paymentDate}T00:00:00`).getTime() <= Date.now() + 30 * 86400000)

  function edit(event: CashflowEvent) {
    const saved = data.dividends.find((item) => item.id === event.id)
    setDraft({ id: saved?.id, ticker: event.ticker, monthKey: event.monthKey,
      expectedAmount: String(saved?.expected_amount ?? event.amount), expectedDate: saved?.expected_payment_date ?? event.paymentDate ?? '',
      actualAmount: saved?.actual_amount == null ? '' : String(saved.actual_amount), actualDate: saved?.actual_payment_date ?? '',
      status: event.status === 'recorded' ? 'recorded' : event.status === 'announced' ? 'announced' : 'expected' })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await saveDividendCalendarEvent(identity.id, {
        id: draft.id, ticker: draft.ticker, monthKey: draft.monthKey,
        expectedAmount: Number(draft.expectedAmount), expectedDate: draft.expectedDate || null,
        actualAmount: draft.status === 'recorded' ? Number(draft.actualAmount) : null,
        actualDate: draft.status === 'recorded' ? draft.actualDate || null : null,
        status: draft.status,
      })
      setDraft(emptyDraft())
      await reload()
      setMessage('配息紀錄已儲存。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '儲存配息失敗') }
    finally { setBusy(false) }
  }

  async function acknowledge(id: string) {
    try { await markAlertRead(identity.id, 'user_alerts', id); await reload() }
    catch (error) { setMessage(error instanceof Error ? error.message : '更新提醒失敗') }
  }

  return <section className="jh-feature-page"><FeatureHeader title="自動追蹤配息" subtitle="掌握下一筆配息、每月入帳節奏與配息來源。" />
    <div className="jh-feature-grid">
      <FeaturePanel number={1} title="持有標的清單" subtitle="股票、ETF 與其他收益資產"><div className="jh-list">
        {data.holdings.map((item) => <div key={item.ticker}><strong>{item.ticker}</strong><span>{item.name}</span><b>{money.format(holdingMarketValue(item))}</b></div>)}
        {data.assets.filter((item) => item.is_income_asset).map((item) => <div key={item.id}><strong>{item.asset_type}</strong><span>{item.asset_name}</span><b>{money.format(Number(item.current_value))}</b></div>)}
        {!data.holdings.length && !data.assets.some((item) => item.is_income_asset) && <Empty>尚未加入收益資產。</Empty>}
      </div><button className="jh-inline-link" onClick={() => onNavigate('assets')}>輸入或編輯資產 →</button></FeaturePanel>
      <FeaturePanel number={2} title="下一筆配息日期" subtitle="已公告日期優先，估算日期會標示"><div className="jh-big-stat"><span>{projection.nextEvent?.name ?? '尚無配息資料'}</span><strong>{projection.nextEvent?.paymentDate ? dateLabel(projection.nextEvent.paymentDate) : projection.nextEvent ? `${projection.nextEvent.monthKey}・日期待公告` : '—'}</strong><small>{projection.nextEvent ? `${money.format(projection.nextEvent.amount)}・${projection.nextEvent.statusLabel}` : '加入配息資產後會在此顯示'}</small></div></FeaturePanel>
      <FeaturePanel number={3} title="每月入帳月曆" subtitle="點選月份查看逐筆來源"><div className="jh-month-grid">{projection.months.map((item) => <button key={item.key} className={selectedKey === item.key ? 'active' : ''} onClick={() => setSelectedKey(item.key)}><span>{item.label}</span><strong>{money.format(item.total)}</strong></button>)}</div><div className="jh-list">{month.events.map((event) => <div key={event.id}><span>{event.name}・{event.statusLabel}</span><b>{money.format(event.amount)}</b><button className="jh-inline-link" onClick={() => edit(event)}>記錄</button></div>)}{!month.events.length && <Empty>這個月沒有預估配息。</Empty>}</div></FeaturePanel>
      <FeaturePanel number={4} title="配息金額追蹤" subtitle="區分已記錄、公告與預估"><SummaryStats items={[{ label: '已記錄', value: money.format(recorded), tone: 'jh-green' }, { label: '已公告', value: money.format(announced) }, { label: '預估', value: money.format(estimated) }]} /><MiniBars values={projection.months.map((item) => item.total)} labels={projection.months.map((item) => `${item.month}月`)} /></FeaturePanel>
      <FeaturePanel number={5} title="配息來源分布" subtitle="依未來十二個月預估收入排序"><div className="jh-list">{sources.slice(0, 7).map(([ticker, amount]) => <div key={ticker}><span>{ticker}</span><b>{money.format(amount)}</b></div>)}{!sources.length && <Empty>目前沒有可計算的來源。</Empty>}</div>{sources.length > 0 && <p className="jh-muted">最大來源占比 {Math.round(sources[0][1] / projection.total12Months * 100)}%；請定期核對配息是否過度集中。</p>}</FeaturePanel>
      <FeaturePanel number={6} title="提醒通知與紀錄" subtitle="站內提示與既有會員警訊"><div className="jh-list">{upcoming.slice(0, 3).map((event) => <div key={event.id}><span>{event.name} 預計 {dateLabel(event.paymentDate)}</span><b>{event.statusLabel}</b></div>)}{alerts.slice(0, 4).map((alert) => <div key={alert.id}><span>{alert.title ?? alert.message}</span><b>{alert.is_read ? '已讀' : '未讀'}</b>{!alert.is_read && <button className="jh-inline-link" onClick={() => void acknowledge(alert.id)}>標為已讀</button>}</div>)}{!upcoming.length && !alerts.length && <Empty>目前沒有近期配息提醒。</Empty>}</div><p className="jh-muted">此處顯示站內資料；自動寄送 Email 需受控後端與通知設定。</p></FeaturePanel>
    </div>
    <form className="jh-entry-form jh-feature-form" onSubmit={submit}><h2>{draft.id ? '編輯配息紀錄' : '新增／記錄配息'}</h2><label>標的代碼<input value={draft.ticker} onChange={(event) => setDraft({ ...draft, ticker: event.target.value })} required /></label><label>配息月份<input type="month" value={draft.monthKey} onChange={(event) => setDraft({ ...draft, monthKey: event.target.value })} required /></label><label>預估金額<input type="number" min="0" step="any" value={draft.expectedAmount} onChange={(event) => setDraft({ ...draft, expectedAmount: event.target.value })} required /></label><label>預計發放日<input type="date" value={draft.expectedDate} onChange={(event) => setDraft({ ...draft, expectedDate: event.target.value })} /></label><label>狀態<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft['status'] })}><option value="expected">預估</option><option value="announced">已公告</option><option value="recorded">已入帳</option></select></label>{draft.status === 'recorded' && <><label>實際入帳金額<input type="number" min="0" step="any" value={draft.actualAmount} onChange={(event) => setDraft({ ...draft, actualAmount: event.target.value })} required /></label><label>實際入帳日<input type="date" value={draft.actualDate} onChange={(event) => setDraft({ ...draft, actualDate: event.target.value })} required /></label></>}<div className="jh-form-actions"><button className="primary-button" disabled={busy}>儲存紀錄</button>{draft.id && <button type="button" className="ghost-button" onClick={() => setDraft(emptyDraft())}>取消編輯</button>}</div></form>
    {message && <p className="form-message" role="status">{message}</p>}
  </section>
}
