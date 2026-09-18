import { useMemo, useState } from 'react'
import type { RetirementOverview } from '../data'
import { assetConcentration, memberState, simulateOverview } from '../lib/insights'
import { money } from '../lib/format'
import { Empty, FeatureHeader, FeaturePanel, MiniBars, SummaryStats } from './shared'

export function SuccessPage({ data, onNavigate }: { data: RetirementOverview; onNavigate: (page: string) => void }) {
  const [extraContribution, setExtraContribution] = useState(5000)
  const [expenseReduction, setExpenseReduction] = useState(5000)
  const baseline = useMemo(() => simulateOverview(data), [data])
  const monthlyContribution = (Number(data.profile?.monthly_contribution) || 0) + data.assets.reduce((sum, item) => sum + (Number(item.monthly_contribution) || 0), 0)
  const moreSavings = useMemo(() => simulateOverview(data, { monthlyContribution: monthlyContribution + extraContribution }), [data, monthlyContribution, extraContribution])
  const lessExpense = useMemo(() => simulateOverview(data, { monthlyExpense: Math.max(1, data.monthlyExpense - expenseReduction) }), [data, expenseReduction])
  const latestSaved = data.monthlyReports[0]?.monte_carlo_success_pct ?? data.gps?.success_probability ?? null
  const saved = [...data.monthlyReports.map((item) => ({ key: item.report_month.slice(0, 7), value: Number(item.monte_carlo_success_pct) })), ...data.gpsHistory.map((item) => ({ key: item.snapshot_date.slice(0, 10), value: Number(item.success_probability) }))].filter((item) => Number.isFinite(item.value)).sort((a, b) => a.key.localeCompare(b.key))
  const trend = saved.filter((item, index) => saved.findIndex((other) => other.key === item.key) === index).slice(-6)
  const success = baseline?.successProbability ?? null
  const concentration = assetConcentration(data)
  const state = memberState(data)
  const values = [success, moreSavings?.successProbability, lessExpense?.successProbability]

  return <section className="jh-feature-page"><FeatureHeader title="退休成功率變化" subtitle="查看保存的歷史結果，並用目前設定比較可調整的退休情境。" />
    <div className="jh-feature-grid">
      <FeaturePanel number={1} title="目前成功率" subtitle="目前資料重新模擬，非歷史快照"><div className="jh-big-stat"><strong>{success == null ? '待完成設定' : `${success.toFixed(1)}%`}</strong><small>{success == null ? '請先設定資產價格、生活費、年齡與退休目標' : `${baseline?.simulations.toLocaleString()} 次蒙地卡羅模擬；固定收入按起迄月份計入`}</small></div><p className="jh-muted">最近保存的結果：{latestSaved == null ? '尚無' : `${Number(latestSaved).toFixed(1)}%`}。兩次模擬的假設可能不同。</p></FeaturePanel>
      <FeaturePanel number={2} title="成功率趨勢" subtitle="只顯示真正保存過的歷史紀錄">{trend.length ? <><MiniBars values={trend.map((item) => item.value)} labels={trend.map((item) => item.key.slice(5))} /><div className="jh-list">{trend.map((item) => <div key={item.key}><span>{item.key}</span><b>{item.value.toFixed(1)}%</b></div>)}</div></> : <Empty>目前沒有已保存的模擬或月報歷史。</Empty>}</FeaturePanel>
      <FeaturePanel number={3} title="影響因素分析" subtitle="目前情境使用的主要參數"><div className="jh-list"><div><span>目前資產</span><b>{money.format(data.metrics.totalAssets)}</b></div><div><span>每月投入</span><b>{money.format(monthlyContribution)}</b></div><div><span>每月生活費</span><b>{money.format(data.monthlyExpense)}</b></div><div><span>退休年齡／年限</span><b>{data.goal ? `${data.goal.target_age} 歲／${data.goal.retirement_years} 年` : '未設定'}</b></div><div><span>年化報酬假設</span><b>{data.goal ? `${data.goal.expected_return}%` : '未設定'}</b></div><div><span>最大單一資產占比</span><b>{concentration.topPct.toFixed(1)}%</b></div></div></FeaturePanel>
      <FeaturePanel number={4} title="情境比較" subtitle="修改投入與生活費後立即重新計算">{state === 'free' ? <div className="jh-advice">免費會員可查看目前模擬；調整情境比較提供試用及 Pro 會員。<button className="jh-inline-link" onClick={() => onNavigate('goal')}>查看退休目標 →</button></div> : <><label className="jh-feature-control">每月增加投入 <input type="number" min="0" step="1000" value={extraContribution} onChange={(event) => setExtraContribution(Math.max(0, Number(event.target.value) || 0))} />元</label><label className="jh-feature-control">每月減少生活費 <input type="number" min="0" step="1000" value={expenseReduction} onChange={(event) => setExpenseReduction(Math.max(0, Number(event.target.value) || 0))} />元</label><SummaryStats items={[{ label: '目前', value: success == null ? '—' : `${success.toFixed(1)}%` }, { label: '增加投入後', value: moreSavings ? `${moreSavings.successProbability.toFixed(1)}%` : '—' }, { label: '降低支出後', value: lessExpense ? `${lessExpense.successProbability.toFixed(1)}%` : '—' }]} /><MiniBars values={values.map((item) => item ?? 0)} labels={['目前', '增加投入', '降低支出']} /></>}</FeaturePanel>
      <FeaturePanel number={5} title="安全區間燈號" subtitle="按目前模擬成功率分類"><div className="jh-big-stat"><strong className={success == null ? '' : success >= 70 ? 'jh-green' : success >= 50 ? '' : 'jh-red'}>{success == null ? '待設定' : success >= 70 ? '安全' : success >= 50 ? '注意' : '警戒'}</strong><small>安全 ≥70%；注意 50–70%；警戒 &lt;50%。這只是情境標示。</small></div><p className="jh-muted">模擬依固定報酬與波動假設計算，不能保證實際退休結果。</p></FeaturePanel>
      <FeaturePanel number={6} title="改善建議" subtitle="檢視可調整的假設與行動"><div className="jh-list"><div><span>核對每月生活費與固定收入</span><b>{data.metrics.monthlyGap < 0 ? '優先' : '每月'}</b></div><div><span>分散單一資產集中度</span><b>{concentration.topPct >= 40 ? '優先' : '持續'}</b></div><div><span>比較提高投入或退休年齡</span><b>試算</b></div></div><button className="jh-inline-link" onClick={() => onNavigate('goal')}>調整退休目標 →</button></FeaturePanel>
    </div></section>
}
