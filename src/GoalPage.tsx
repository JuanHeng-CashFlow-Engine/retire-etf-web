import { type CSSProperties, FormEvent, useMemo, useState } from 'react'
import { saveRetirementGoal, type RetirementGoalInput, type RetirementOverview } from './data'
import { money, number } from './lib/format'
import { simulateRetirementPlan, type RetirementPathPoint } from './lib/retirementPlan'
import type { ClaimsIdentity } from './types'

function initialForm(data: RetirementOverview): RetirementGoalInput {
  const currentAge = Number(data.profile?.current_age) || 55
  return {
    currentAge,
    targetAge: Math.max(currentAge, Number(data.goal?.target_age) || 65),
    targetAmount: Number(data.goal?.target_amount) || 20_000_000,
    monthlyExpense: Number(data.goal?.monthly_expense) || Number(data.profile?.monthly_expense) || 50_000,
    expectedReturn: Number(data.goal?.expected_return ?? 5),
    expectedYield: Number(data.goal?.expected_yield ?? 5),
    inflationRate: Number(data.goal?.inflation_rate ?? 2),
    retirementYears: Number(data.goal?.retirement_years) || 30,
  }
}

function TimelineChart({ path, retirementOffset, riskOffset, currentYear }: {
  path: RetirementPathPoint[]
  retirementOffset: number
  riskOffset: number | null
  currentYear: number
}) {
  const width = 900
  const height = 300
  const left = 58
  const right = 18
  const top = 18
  const bottom = 42
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const lastYear = path.at(-1)?.yearOffset ?? 1
  const ceiling = Math.max(...path.map((point) => point.p90), 1) * 1.08
  const x = (point: RetirementPathPoint) => left + point.yearOffset / lastYear * plotWidth
  const y = (value: number) => top + (1 - value / ceiling) * plotHeight
  const line = (key: 'p10' | 'p50' | 'p90') => path.map((point) => `${x(point)},${y(point[key])}`).join(' ')
  const band = [...path.map((point) => `${x(point)},${y(point.p90)}`), ...[...path].reverse().map((point) => `${x(point)},${y(point.p10)}`)].join(' ')
  const retirementX = left + retirementOffset / lastYear * plotWidth
  const riskX = riskOffset == null ? null : left + riskOffset / lastYear * plotWidth
  const axisYears = [0, lastYear].filter((value, index, values) => values.indexOf(value) === index)

  return <div className="timeline-scroll"><svg className="retirement-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="從現在到退休期末的資產模擬時間軸，顯示第十、五十、九十百分位路徑">
    {riskX != null && <rect x={riskX} y={top} width={width - right - riskX} height={plotHeight} fill="rgba(255,100,100,.13)" />}
    {[0, .5, 1].map((portion) => <g key={portion}><line x1={left} x2={width - right} y1={y(ceiling * portion)} y2={y(ceiling * portion)} stroke="rgba(180,205,235,.16)" /><text x={left - 8} y={y(ceiling * portion) + 4} textAnchor="end" fill="#9fadc0" fontSize="12">{number.format(Math.round(ceiling * portion / 10_000))}萬</text></g>)}
    <polygon points={band} fill="rgba(127,196,255,.17)" />
    <polyline points={line('p90')} fill="none" stroke="#7fc4ff" strokeWidth="2" />
    <polyline points={line('p10')} fill="none" stroke="#ff817d" strokeWidth="2" />
    <polyline points={line('p50')} fill="none" stroke="#75dfac" strokeWidth="3" />
    <line x1={retirementX} x2={retirementX} y1={top} y2={top + plotHeight} stroke="#f3d27e" strokeDasharray="6 5" strokeWidth="2" />
    <text x={retirementX + (retirementOffset > lastYear / 2 ? -6 : 6)} y={top + 16} textAnchor={retirementOffset > lastYear / 2 ? 'end' : 'start'} fill="#f3d27e" fontSize="13">{currentYear + retirementOffset} 退休</text>
    {axisYears.map((offset) => <text key={offset} x={left + offset / lastYear * plotWidth} y={height - 12} textAnchor={offset === 0 ? 'start' : 'end'} fill="#c5d1dd" fontSize="13">{currentYear + offset}</text>)}
  </svg></div>
}

export function GoalPage({ identity, data, reload }: { identity: ClaimsIdentity; data: RetirementOverview; reload: () => Promise<void> }) {
  const [form, setForm] = useState(() => initialForm(data))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const currentYear = new Date().getFullYear()
  const savedAge = Number(data.profile?.current_age)
  const savedTargetAge = Number(data.goal?.target_age)
  const savedTargetYear = Number(data.goal?.target_year)
  const plannedRetirementYear = savedAge > 0 && savedTargetAge >= savedAge
    ? currentYear + savedTargetAge - savedAge
    : savedTargetYear >= currentYear ? savedTargetYear : Number.NaN
  const missingPrices = data.holdings.filter((holding) => holding.shares > 0 && holding.price <= 0)
  const plan = useMemo(() => {
    if (!data.goal || Number(data.goal.target_amount) <= 0 || missingPrices.length) return null
    if (!Number.isInteger(plannedRetirementYear) || plannedRetirementYear < currentYear || plannedRetirementYear > currentYear + 100) return null
    try {
      return simulateRetirementPlan({
        currentAssets: data.metrics.totalAssets,
        monthlyContribution: Number(data.profile?.monthly_contribution) || 0,
        targetAssets: Number(data.goal.target_amount),
        annualReturn: Number(data.goal.expected_return ?? 5),
        annualVolatility: 15,
        yearsUntilRetirement: plannedRetirementYear - currentYear,
        retirementYears: Number(data.goal.retirement_years) || 30,
        monthlyExpense: Number(data.goal.monthly_expense),
        inflationRate: Number(data.goal.inflation_rate ?? 2),
      })
    } catch { return null }
  }, [data, currentYear, missingPrices.length, plannedRetirementYear])
  const retirementOffset = plan ? plannedRetirementYear - currentYear : 0
  const progress = data.targetAmount > 0 ? Math.min(100, data.metrics.totalAssets / data.targetAmount * 100) : 0
  const riskTone = plan && plan.depletionProbability >= 30 ? 'red' : plan && plan.depletionProbability >= 10 ? 'yellow' : 'green'

  function update(field: keyof RetirementGoalInput, value: string) {
    setForm((previous) => ({ ...previous, [field]: Number(value) }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await saveRetirementGoal(identity.id, data.goal, form)
      await reload()
      setMessage('退休目標已儲存；下方情境已依新設定重算。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '退休目標儲存失敗。')
    } finally { setBusy(false) }
  }

  return <section className="page-section goal-page">
    <p className="eyebrow">退休目標與風險時間軸</p>
    <h1>◎ 距離退休還有多遠？</h1>
    <p className="lead">先設定目標，再從現在模擬至退休期末。這是規劃情境，不是保證報酬或健康分數。</p>
    <form className="goal-form" onSubmit={submit}>
      <label>退休資產目標<input type="number" min="1" step="any" value={form.targetAmount} onChange={(event) => update('targetAmount', event.target.value)} required /></label>
      <label>退休後每月支出<input type="number" min="1" step="any" value={form.monthlyExpense} onChange={(event) => update('monthlyExpense', event.target.value)} required /></label>
      <label>目前年齡<input type="number" min="1" max="100" step="1" value={form.currentAge} onChange={(event) => update('currentAge', event.target.value)} required /></label>
      <label>目標退休年齡<input type="number" min={form.currentAge} max="100" step="1" value={form.targetAge} onChange={(event) => update('targetAge', event.target.value)} required /></label>
      <label>預期年化報酬率（%）<input type="number" min="0" max="15" step="any" value={form.expectedReturn} onChange={(event) => update('expectedReturn', event.target.value)} required /></label>
      <label>預期股息殖利率（%）<input type="number" min="0" max="15" step="any" value={form.expectedYield} onChange={(event) => update('expectedYield', event.target.value)} required /></label>
      <label>通膨率（%）<input type="number" min="0" max="8" step="any" value={form.inflationRate} onChange={(event) => update('inflationRate', event.target.value)} required /></label>
      <label>退休後生活年數<input type="number" min="1" max="80" step="1" value={form.retirementYears} onChange={(event) => update('retirementYears', event.target.value)} required /></label>
      <button className="primary-button" disabled={busy}>{busy ? '儲存中…' : '儲存退休目標'}</button>
    </form>
    {message && <p className="form-message" role="status">{message}</p>}
    {missingPrices.length > 0 && <div className="error-banner">{missingPrices.length} 筆持股尚無市場價格，資產總額不完整；先到「我的錢放得安全嗎？」核對，暫不顯示可能誤導的風險比例。</div>}
    {!data.goal && <div className="migration-card"><strong>尚未有已保存退休目標</strong><span>儲存後才會顯示達成率、資產耗盡風險與時間軸；表單預設值不是您的正式設定。</span></div>}
    {data.goal && !plan && !missingPrices.length && <div className="error-banner">退休年齡、目標或生活費資料不足，請核對設定後再顯示模擬。</div>}
    {plan && <>
      <article className="goal-progress-panel">
        <div className="goal-ring" style={{ '--progress': `${progress}%` } as CSSProperties}><div><strong>{number.format(progress)}%</strong><span>目標達成率</span></div></div>
        <div><h2>退休目標追蹤</h2><dl><div><dt>目前資產</dt><dd>{money.format(data.metrics.totalAssets)}</dd></div><div><dt>退休目標</dt><dd>{money.format(data.targetAmount)}</dd></div><div><dt>距離差額</dt><dd>{money.format(Math.max(0, data.targetAmount - data.metrics.totalAssets))}</dd></div></dl></div>
      </article>
      <div className="goal-risk-grid">
        <article className={riskTone}><span>資產耗盡風險</span><strong>{number.format(plan.depletionProbability)}%</strong><small>模擬期間曾耗盡資產的路徑比例</small></article>
        <article><span>規劃期仍有資產</span><strong>{number.format(plan.successProbability)}%</strong><small>蒙地卡羅情境比例，非退休保證</small></article>
        <article><span>退休時達標機率</span><strong>{number.format(plan.targetReachedProbability)}%</strong><small>退休年度資產達到目標的路徑比例</small></article>
      </div>
      <article className="goal-timeline-panel"><header><div><p className="eyebrow">退休時間軸</p><h2>從現在模擬到終點</h2></div><span>{currentYear} → {currentYear + retirementOffset} → {currentYear + retirementOffset + (Number(data.goal?.retirement_years) || 30)}</span></header>
        <TimelineChart path={plan.path} retirementOffset={retirementOffset} riskOffset={plan.riskStartYearOffset} currentYear={currentYear} />
        <div className="timeline-legend"><span className="p90">P90 較樂觀</span><span className="p50">P50 中位數</span><span className="p10">P10 較保守</span><span className="risk">紅色區為較保守路徑可能耗盡區間</span></div>
        <p className="chart-note">{plan.riskStartYearOffset == null ? '本次較保守 P10 路徑在模擬終點前未歸零；仍不代表未來一定安全。' : `較保守 P10 路徑約從 ${currentYear + plan.riskStartYearOffset} 年進入可能耗盡區間，建議比較延後退休、增加投入或降低支出。`}</p>
        <p className="chart-note">以目前持股和其他資產市值、每月投入 {money.format(Number(data.profile?.monthly_contribution) || 0)}、年化報酬 {number.format(Number(data.goal?.expected_return ?? 5))}%、年化波動 15%、通膨 {number.format(Number(data.goal?.inflation_rate ?? 2))}% 執行 {number.format(plan.simulations)} 次前端情境模擬。與舊版採相同兩階段計算，但隨機數產生器不同，結果不會逐位相同；未確認配息不額外加入資產。圖形每年取 P10–P90 範圍，中線為 P50。</p>
      </article>
    </>}
  </section>
}

