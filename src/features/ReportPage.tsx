import { useMemo, useState } from 'react'
import { saveMonthlyReportSnapshot, type RetirementOverview } from '../data'
import { buildCashflowProjection } from '../lib/cashflow'
import { monthKey } from '../lib/fixedIncome'
import { buildAlerts, buildRecommendations, healthScore, memberState, simulateOverview } from '../lib/insights'
import { money } from '../lib/format'
import type { ClaimsIdentity, MonthlyReport } from '../types'
import { Empty, FeatureHeader, FeaturePanel, SummaryStats } from './shared'

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => typeof item === 'string' ? item : typeof item === 'object' && item !== null ? String((item as { message?: unknown }).message ?? (item as { title?: unknown }).title ?? '') : '').filter(Boolean)
}

export function ReportPage({ data, identity, reload, onNavigate }: { data: RetirementOverview; identity: ClaimsIdentity; reload: () => Promise<void>; onNavigate: (page: string) => void }) {
  const [selectedId, setSelectedId] = useState('current')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const simulation = useMemo(() => simulateOverview(data), [data])
  const success = simulation?.successProbability ?? null
  const score = healthScore(data, success)
  const alerts = buildAlerts(data, success)
  const recommendations = buildRecommendations(data, success)
  const projection = useMemo(() => buildCashflowProjection({ startDate: new Date(), monthlyExpense: data.monthlyExpense, calendar: data.dividends, holdings: data.holdings, assets: data.assets, fixedIncomes: data.fixedIncomes }), [data])
  const selected = data.monthlyReports.find((item) => item.id === selectedId) ?? null
  const state = memberState(data)
  const savedAlerts = selected ? asList(selected.alerts) : alerts.map((item) => item.message)
  const savedRecommendations = selected ? asList(selected.recommendations) : recommendations
  const totalAssets = selected ? Number(selected.total_assets) : data.metrics.totalAssets
  const monthlyExpense = selected ? Number(selected.monthly_expense) : data.monthlyExpense
  const coverage = selected ? Number(selected.coverage_pct) : data.metrics.coveragePct
  const annualDividend = selected ? Number(selected.annual_dividend) : data.metrics.annualDividend
  const shownSuccess = selected ? Number(selected.monte_carlo_success_pct) : success
  const shownScore = selected ? Number(selected.health_score) : score
  const estimatedIncome = selected ? monthlyExpense * coverage / 100 : data.metrics.monthlyIncome
  const latest = data.monthlyReports[0]

  async function save() {
    if (state === 'free') { setMessage('此帳號目前為免費版；保存月報需有效試用或 Pro 訂閱。'); return }
    if (success == null || score == null) { setMessage('請先完成退休目標、生活費及資產價格設定。'); return }
    setBusy(true)
    setMessage('')
    try {
      await saveMonthlyReportSnapshot(identity.id, { reportMonth: `${monthKey(new Date())}-01`, healthScore: score, totalAssets: data.metrics.totalAssets, targetAssets: data.targetAmount, progressPct: data.metrics.progressPct, annualDividend: data.metrics.annualDividend, monthlyExpense: data.monthlyExpense, coveragePct: data.metrics.coveragePct, successPct: success, alerts, recommendations })
      await reload()
      setMessage('本月退休健檢報告已保存。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '儲存月報失敗') }
    finally { setBusy(false) }
  }

  return <section className="jh-feature-page"><FeatureHeader title="每月退休健檢報告" subtitle="把資產、現金流、風險與下一步整理成每月可回看的紀錄。" />
    <div className="jh-report-toolbar"><label>檢視月份 <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="current">目前資料預覽（尚未保存）</option>{data.monthlyReports.map((item: MonthlyReport) => <option key={item.id} value={item.id}>{item.report_month.slice(0, 7)} 已保存</option>)}</select></label><button className="jh-gold" onClick={() => void save()} disabled={busy || state === 'free' || score == null}>{busy ? '儲存中…' : '保存本月報告'}</button><span>{state === 'pro' ? 'Pro 會員' : state === 'trial' ? '試用會員' : '免費會員：可檢視即時摘要'}</span></div>
    {message && <p className="form-message" role="status">{message}</p>}
    <div className="jh-feature-grid">
      <FeaturePanel number={1} title="資產現況總覽" subtitle={selected ? `保存於 ${selected.created_at.slice(0, 10)}` : '目前已載入的資產'}><div className="jh-big-stat"><strong>{money.format(totalAssets)}</strong><small>退休目標 {money.format(selected ? Number(selected.target_assets) : data.targetAmount)} · 達成率 {Number(selected ? selected.progress_pct : data.metrics.progressPct).toFixed(1)}%</small></div>{!selected && latest && <p className="jh-muted">相較上次月報：{money.format(totalAssets - Number(latest.total_assets))}</p>}</FeaturePanel>
      <FeaturePanel number={2} title="本月現金流結果" subtitle="月平均估算"><SummaryStats items={[{ label: '月平均收入', value: money.format(estimatedIncome) }, { label: '月支出', value: money.format(monthlyExpense) }, { label: '月差額', value: money.format(estimatedIncome - monthlyExpense), tone: estimatedIncome < monthlyExpense ? 'jh-red' : 'jh-green' }]} />{!selected && <p className="jh-muted">未來十二個月中，有 {projection.insufficientMonths} 個月的已知收入低於生活費。</p>}</FeaturePanel>
      <FeaturePanel number={3} title="配息與固定收入" subtitle="避免混淆投資收益與已起領收入"><div className="jh-list"><div><span>年度投資收益估算</span><b>{money.format(annualDividend)}</b></div>{!selected && <div><span>本月已設定固定收入</span><b>{money.format(data.fixedMonthlyIncome)}</b></div>}<div><span>收入覆蓋率</span><b>{coverage.toFixed(1)}%</b></div></div>{selected && <p className="jh-muted">舊版月報未分開保存固定收入；此處僅呈現已存的年度收益與覆蓋率。</p>}</FeaturePanel>
      <FeaturePanel number={4} title="風險與警訊" subtitle="根據保存內容或目前資料"><div className="jh-list">{savedAlerts.map((alert, index) => <div key={index}><span>{alert}</span><b>留意</b></div>)}{!savedAlerts.length && <Empty>目前沒有達到系統規則的風險警訊。</Empty>}</div></FeaturePanel>
      <FeaturePanel number={5} title="成功率與續航力" subtitle="情境模擬與健檢分數"><SummaryStats items={[{ label: '退休成功率', value: shownSuccess == null || !Number.isFinite(shownSuccess) ? '待模擬' : `${shownSuccess.toFixed(1)}%` }, { label: '健檢分數', value: shownScore == null || !Number.isFinite(shownScore) ? '待設定' : `${shownScore.toFixed(1)} / 100` }]} /><p className="jh-muted">分數依目標進度、模擬、收入覆蓋、分散度與配息狀態加權；成功率不是退休保證。</p></FeaturePanel>
      <FeaturePanel number={6} title="本月建議事項" subtitle="優先處理可控制的設定與風險"><div className="jh-list">{savedRecommendations.map((item, index) => <div key={index}><span>{item}</span><b>{index === 0 ? '優先' : '檢查'}</b></div>)}</div><button className="jh-inline-link" onClick={() => onNavigate('gap')}>核對現金流缺口 →</button><button className="jh-inline-link" onClick={() => onNavigate('assets')}>更新資產資料 →</button></FeaturePanel>
    </div></section>
}
