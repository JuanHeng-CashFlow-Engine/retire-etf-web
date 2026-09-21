import { useMemo, useState } from 'react'
import { saveRetirementSnapshot, type RetirementOverview } from '../data'
import { buildCashflowProjection } from '../lib/cashflow'
import { buildAlerts, buildRecommendations, healthScore, memberState, simulateOverview } from '../lib/insights'
import { money } from '../lib/format'
import type { ClaimsIdentity, RetirementSnapshotPayload } from '../types'
import { Empty, FeatureHeader, FeaturePanel, SummaryStats } from './shared'

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => typeof item === 'string' ? item : typeof item === 'object' && item !== null ? String((item as { message?: unknown }).message ?? (item as { title?: unknown }).title ?? '') : '').filter(Boolean)
}

function localDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function ReportPage({ data, identity, reload, onNavigate }: { data: RetirementOverview; identity: ClaimsIdentity; reload: () => Promise<void>; onNavigate: (page: string) => void }) {
  const [selectedId, setSelectedId] = useState('current')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const simulation = useMemo(() => simulateOverview(data), [data])
  const success = simulation?.successProbability ?? null
  const alerts = buildAlerts(data, success)
  const recommendations = buildRecommendations(data, success)
  const projection = useMemo(() => buildCashflowProjection({ startDate: new Date(), monthlyExpense: data.monthlyExpense, calendar: data.dividends, holdings: data.holdings, assets: data.assets, fixedIncomes: data.fixedIncomes }), [data])
  const hasCashRecord = data.assets.some((item) => item.asset_type === 'cash')
  const estimatedEvents = projection.events.filter((event) => event.status === 'estimated').length
  const forecastComplete = Boolean(data.goal && data.monthlyExpense > 0 && projection.months.length === 12 && hasCashRecord && !data.holdings.some((item) => item.shares > 0 && item.price <= 0))
  const score = healthScore(data, success, forecastComplete)
  const snapshot = selectedId.startsWith('v3:') ? data.snapshotsV3.find((item) => item.id === selectedId.slice(3)) ?? null : null
  const legacy = selectedId.startsWith('legacy:') ? data.monthlyReports.find((item) => item.id === selectedId.slice(7)) ?? null : null
  const payload = snapshot?.payload
  const state = memberState(data)
  const savedAlerts = payload ? asList(payload.alerts) : legacy ? asList(legacy.alerts) : alerts.map((item) => item.message)
  const savedRecommendations = payload ? asList(payload.recommendations) : legacy ? asList(legacy.recommendations) : recommendations
  const totalAssets = payload ? payload.metrics.total_assets : legacy ? Number(legacy.total_assets) : data.metrics.totalAssets
  const targetAssets = payload ? payload.metrics.target_assets : legacy ? Number(legacy.target_assets) : data.targetAmount
  const monthlyExpense = payload ? payload.metrics.monthly_expense : legacy ? Number(legacy.monthly_expense) : data.monthlyExpense
  const coverage = payload ? payload.metrics.coverage_pct : legacy ? Number(legacy.coverage_pct) : data.metrics.coveragePct
  const annualDividend = payload ? payload.metrics.annual_dividend : legacy ? Number(legacy.annual_dividend) : data.metrics.annualDividend
  const shownSuccess = payload ? payload.metrics.success_probability : legacy ? Number(legacy.monte_carlo_success_pct) : success
  const shownScore = payload ? payload.metrics.health_score : legacy ? Number(legacy.health_score) : score
  const estimatedIncome = monthlyExpense != null && coverage != null ? monthlyExpense * coverage / 100 : null
  const latestAssets = data.snapshotsV3[0]?.payload.metrics.total_assets ?? data.monthlyReports[0]?.total_assets ?? null
  const missing = payload?.missing ?? [...(!data.goal ? ['退休目標'] : []), ...(data.monthlyExpense <= 0 ? ['每月生活費'] : []), ...(!hasCashRecord ? ['現金餘額（沒有現金也請填 0）'] : []), ...(data.holdings.some((item) => item.shares > 0 && item.price <= 0) ? ['持股價格'] : []), ...(projection.months.length !== 12 ? ['十二個月現金流'] : []), ...(success == null ? ['退休模擬所需的年齡與目標設定'] : [])]

  async function save() {
    if (state === 'free') { setMessage('此帳號目前為免費版；保存月報需有效試用或 Pro 訂閱。'); return }
    if (data.snapshotSetupRequired) { setMessage('請先套用 retirement_snapshots_v3 資料庫遷移，再保存新版快照。'); return }
    const asOf = localDate()
    const cash = data.assets.filter((item) => item.asset_type === 'cash').reduce((sum, item) => sum + (Number(item.current_value) || 0), 0)
    const reliableGap = Math.max(data.monthlyExpense - data.fixedMonthlyIncome, 0)
    const missingItems = [...(!data.goal ? ['retirement_goal'] : []), ...(data.monthlyExpense <= 0 ? ['monthly_expense'] : []), ...(!hasCashRecord ? ['cash_reserve'] : []), ...(data.holdings.some((item) => item.shares > 0 && item.price <= 0) ? ['market_prices'] : []), ...(projection.months.length !== 12 ? ['forecast_months'] : []), ...(success == null ? ['simulation'] : [])]
    const report: RetirementSnapshotPayload = {
      schema_version: 1, as_of: asOf,
      metrics: { total_assets: data.metrics.totalAssets, target_assets: data.targetAmount || null, monthly_expense: data.monthlyExpense || null, annual_dividend: data.metrics.annualDividend, cash_reserve: hasCashRecord ? cash : null, cash_months: hasCashRecord ? (reliableGap === 0 ? 12 : cash / reliableGap) : null, success_probability: success, health_score: score, coverage_pct: data.monthlyExpense > 0 ? data.metrics.coveragePct : null },
      assumptions: { health_score_basis: 'estimate', estimated_income_events: estimatedEvents, simulations: simulation?.simulations ?? null, expected_return_pct: data.goal ? Number(data.goal.expected_return) : null, retirement_years: data.goal?.retirement_years ?? null },
      sources: { holdings: 'user_portfolios + etf_prices', assets: 'user_assets', fixed_income: 'retirement_fixed_incomes', cashflow: 'dividend_calendar + estimates' },
      missing: missingItems, complete: missingItems.length === 0, alerts, recommendations,
    }
    setBusy(true); setMessage('')
    try { await saveRetirementSnapshot(identity.id, report); await reload(); setMessage(report.complete ? '本月退休健檢快照已保存。' : '快照已保存，並保留待核對項目；系統沒有把缺少資料判定為安全。') }
    catch (error) { setMessage(error instanceof Error ? error.message : '儲存月報失敗') }
    finally { setBusy(false) }
  }

  const isSaved = Boolean(snapshot || legacy)
  const progress = totalAssets != null && targetAssets ? totalAssets / targetAssets * 100 : null
  return <section className="jh-feature-page"><FeatureHeader title="每月退休健檢報告" subtitle="把資產、現金流、風險與下一步整理成可追溯、不可覆寫的月度快照。" />
    <div className="jh-report-toolbar"><label>檢視月份 <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="current">目前資料預覽（尚未保存）</option>{data.snapshotsV3.map((item) => <option key={item.id} value={`v3:${item.id}`}>{item.as_of} V3 快照</option>)}{data.monthlyReports.map((item) => <option key={item.id} value={`legacy:${item.id}`}>{item.report_month.slice(0, 7)} 舊版月報</option>)}</select></label><button className="jh-gold" onClick={() => void save()} disabled={busy || state === 'free' || data.snapshotSetupRequired}>{busy ? '儲存中…' : '保存本月快照'}</button><span>{state === 'pro' ? 'Pro 會員' : state === 'trial' ? '試用會員' : '免費會員：可檢視即時摘要'}</span></div>
    {message && <p className="form-message" role="status">{message}</p>}
    {missing.length > 0 && <p className="error-banner">尚需補齊：{missing.join('、')}。相關分數會顯示為待核對。</p>}
    <div className="jh-feature-grid">
      <FeaturePanel number={1} title="資產現況總覽" subtitle={snapshot ? `快照建立於 ${snapshot.created_at.slice(0, 10)}` : legacy ? `舊版月報 ${legacy.report_month.slice(0, 7)}` : '目前已載入的資產'}><div className="jh-big-stat"><strong>{totalAssets == null ? '待核對' : money.format(totalAssets)}</strong><small>退休目標 {targetAssets == null ? '待設定' : money.format(targetAssets)} · 達成率 {progress == null ? '待設定' : `${progress.toFixed(1)}%`}</small></div>{!isSaved && latestAssets != null && <p className="jh-muted">相較最近快照：{money.format(data.metrics.totalAssets - Number(latestAssets))}</p>}</FeaturePanel>
      <FeaturePanel number={2} title="本月現金流結果" subtitle="月平均估算"><SummaryStats items={[{ label: '月平均收入', value: estimatedIncome == null ? '待核對' : money.format(estimatedIncome) }, { label: '月支出', value: monthlyExpense == null ? '待核對' : money.format(monthlyExpense) }, { label: '月差額', value: estimatedIncome == null || monthlyExpense == null ? '待核對' : money.format(estimatedIncome - monthlyExpense), tone: estimatedIncome != null && monthlyExpense != null && estimatedIncome < monthlyExpense ? 'jh-red' : 'jh-green' }]} />{!isSaved && <p className="jh-muted">未來十二個月中，有 {projection.insufficientMonths} 個月的已知及預估收入低於生活費。</p>}</FeaturePanel>
      <FeaturePanel number={3} title="配息與固定收入" subtitle="估算與已確認資料分開呈現"><div className="jh-list"><div><span>年度投資收益</span><b>{annualDividend == null ? '待證據核對' : money.format(annualDividend)}</b></div>{!isSaved && <div><span>本月已設定固定收入</span><b>{money.format(data.fixedMonthlyIncome)}</b></div>}<div><span>收入覆蓋率</span><b>{coverage == null ? '待核對' : `${coverage.toFixed(1)}%`}</b></div></div></FeaturePanel>
      <FeaturePanel number={4} title="風險與警訊" subtitle="缺資料會顯示未知，不視為安全"><div className="jh-list">{savedAlerts.map((alert, index) => <div key={index}><span>{alert}</span><b>留意</b></div>)}{!savedAlerts.length && missing.length === 0 && <Empty>目前沒有達到系統規則的風險警訊。</Empty>}{!savedAlerts.length && missing.length > 0 && <Empty>資料尚未完整，無法判定沒有風險。</Empty>}</div></FeaturePanel>
      <FeaturePanel number={5} title="成功率與續航力" subtitle="依資產、生活費及收入假設計算"><SummaryStats items={[{ label: '退休成功率', value: shownSuccess == null || !Number.isFinite(shownSuccess) ? '待模擬' : `${shownSuccess.toFixed(1)}%` }, { label: '健檢分數（估算）', value: shownScore == null || !Number.isFinite(shownScore) ? '待核對' : `${shownScore.toFixed(1)} / 100` }]} /><p className="jh-muted">分數依模擬、收入覆蓋、現金安全墊、分散度與目標進度加權，包含預估配息及設定的固定收入；不需等待未來配息入帳，成功率不是退休保證。</p></FeaturePanel>
      <FeaturePanel number={6} title="本月建議事項" subtitle="優先處理可控制的設定與風險"><div className="jh-list">{savedRecommendations.map((item, index) => <div key={index}><span>{item}</span><b>{index === 0 ? '優先' : '檢查'}</b></div>)}</div><button className="jh-inline-link" onClick={() => onNavigate('gap')}>核對現金流缺口 →</button><button className="jh-inline-link" onClick={() => onNavigate('assets')}>更新資產資料 →</button></FeaturePanel>
    </div></section>
}
