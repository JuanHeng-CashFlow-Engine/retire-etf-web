import { useState } from 'react'
import type { RetirementOverview } from '../data'
import { money } from '../lib/format'
import { FeatureHeader } from './shared'
const numeric = (v: unknown): number | null => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v)
export function TrendsPage({data}: {data:RetirementOverview}) {
  const rows=[...data.snapshotsV3.map(s=>({id:`v3:${s.id}`,date:s.as_of,created:s.created_at,source:'V3',assets:s.payload.metrics.total_assets,income:s.payload.metrics.coverage_pct!=null&&s.payload.metrics.monthly_expense!=null?s.payload.metrics.coverage_pct*s.payload.metrics.monthly_expense/100:null,expense:s.payload.metrics.monthly_expense,success:s.payload.metrics.success_probability,score:s.payload.metrics.health_score})),...data.monthlyReports.map(s=>({id:`legacy:${s.id}`,date:s.report_month.slice(0,10),created:s.created_at,source:'舊版',assets:numeric(s.total_assets),income:numeric(s.monthly_expense)!=null&&numeric(s.coverage_pct)!=null?Number(s.monthly_expense)*Number(s.coverage_pct)/100:null,expense:numeric(s.monthly_expense),success:numeric(s.monte_carlo_success_pct),score:numeric(s.health_score)}))].sort((a,b)=>a.date.localeCompare(b.date)||a.created.localeCompare(b.created))
  const monthly=Array.from(rows.reduce((m,r)=>m.set(r.date.slice(0,7),r),new Map<string,typeof rows[number]>()).values())
  const [metric,setMetric]=useState<'assets'|'income'|'expense'|'success'|'score'>('assets')
  const [before,setBefore]=useState(''),[after,setAfter]=useState('')
  const a=rows.find(r=>r.id===before)??rows.at(-2),b=rows.find(r=>r.id===after)??rows.at(-1)
  const max=Math.max(1,...monthly.map(r=>Math.abs(r[metric]??0)))
  const display=(n:number|null|undefined,pct=false)=>n==null||!Number.isFinite(n)?'—':pct?`${n.toFixed(1)}%`:money.format(n)
  return <section className="page-section"><FeatureHeader title="月報趨勢與歷史快照" subtitle="比較保存當時的資產、收入、支出與成功率；不使用今天的資料改寫歷史。"/>
    {!rows.length?<p>尚無已保存月報。請到「每月退休健檢報告」保存第一份快照。</p>:<><label>趨勢指標<select value={metric} onChange={e=>setMetric(e.target.value as typeof metric)}><option value="assets">總資產</option><option value="income">月平均收入</option><option value="expense">每月生活費</option><option value="success">退休成功率</option><option value="score">健檢分數</option></select></label><p className="chart-note">每月採該月最後一份保存紀錄；空白月份不補值。舊版與 V3 的評分假設可能不同。</p><div className="pro-trend" role="img" aria-label="月報歷史指標長條圖">{monthly.map(r=><div key={r.id}><span>{r.date.slice(0,7)} · {r.source}</span><i style={{width:`${Math.abs(r[metric]??0)/max*60}%`}}/><b>{metric==='score'?(r.score==null?'—':`${r.score.toFixed(1)} / 100`):display(r[metric],metric==='success')}</b></div>)}</div>
    <h2>兩份快照比較</h2><div className="jh-form-actions"><label>比較基準<select value={a?.id||''} onChange={e=>setBefore(e.target.value)}>{rows.map(r=><option key={r.id} value={r.id}>{r.date} · {r.source} · {r.created.slice(11,19)}</option>)}</select></label><label>比較對象<select value={b?.id||''} onChange={e=>setAfter(e.target.value)}>{rows.map(r=><option key={r.id} value={r.id}>{r.date} · {r.source} · {r.created.slice(11,19)}</option>)}</select></label></div>
    <div className="table-wrap"><table><thead><tr><th>指標</th><th>基準</th><th>對象</th><th>變化</th></tr></thead><tbody>{(['assets','income','expense','success','score'] as const).map((k,i)=><tr key={k}><td>{['總資產','月平均收入','每月生活費','退休成功率','健檢分數'][i]}</td><td>{k==='score'?a?.[k]?.toFixed(1)??'—':display(a?.[k],k==='success')}</td><td>{k==='score'?b?.[k]?.toFixed(1)??'—':display(b?.[k],k==='success')}</td><td>{a?.[k]!=null&&b?.[k]!=null?(k==='success'?`${(b[k]!-a[k]!).toFixed(1)} 個百分點`:k==='score'?`${(b[k]!-a[k]!).toFixed(1)} 分`:money.format(b[k]!-a[k]!)):'—'}</td></tr>)}</tbody></table></div></>}
  </section>
}

