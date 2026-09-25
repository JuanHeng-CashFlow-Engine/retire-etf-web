import { useEffect, useMemo, useState } from 'react'
import type { RetirementOverview } from '../data'
import { memberState } from '../lib/insights'
import { portfolioRows, rebalance } from '../lib/proAnalysis'
import { requireSupabase } from '../lib/supabase'
import { money } from '../lib/format'
import { loadProRecords, saveProRecord, type ProRecord } from '../proRecords'
import { StressPage } from '../StressPage'
import { FeatureHeader } from './shared'
import type { AiStressSnapshot } from '../types'

type Analysis = {title?:string;summary?:string;method?:string;error?:string;strongest_correlations?:{a:string;b:string;corr:number;samples?:number;start?:string;end?:string}[];weaknesses?:{title:string;detail:string;severity:string}[];rebalance_plan?:{action:string;asset:string;from_weight?:number;to_weight?:number;reason:string}[];hedge_plan?:{step:string;action:string;detail:string}[]}
type Response = {engine?:string;analysis?:Analysis;answer?:string;error?:string;retirement_impact?:AiStressSnapshot & {error?:string};market_snapshots?:{symbol:string;market_time?:string;source?:string}[]}
type Saved = {response:Response;asOf:string;portfolio:ReturnType<typeof portfolioRows>;risk:string;drop:number}

export function ProRiskPage({data,userId,reload}: {data:RetirementOverview;userId:string;reload:()=>Promise<void>}) {
  const rows=useMemo(()=>portfolioRows(data),[data])
  const total=rows.reduce((s,r)=>s+r.value,0)
  const [risk,setRisk]=useState('穩健平衡型')
  const drop=20
  const [response,setResponse]=useState<Response|null>(null)
  const [history,setHistory]=useState<ProRecord<Saved>[]>([])
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [targets,setTargets]=useState<Record<string,number>>({})
  const [budget,setBudget]=useState(0)
  const [plan,setPlan]=useState<ReturnType<typeof rebalance>|null>(null)
  const [asOf,setAsOf]=useState('')
  const allowed=memberState(data)!=='free'
  const incomplete=data.holdings.some(h=>h.shares>0&&h.price<=0)
  useEffect(()=>{let active=true;loadProRecords<Saved>(userId,'analysis').then(r=>{if(active)setHistory(r)}).catch(e=>{if(active)setMessage(e.message)});return()=>{active=false}},[userId])
  useEffect(()=>{setTargets({});setPlan(null)},[rows])
  async function analyze() {
    if(!allowed || incomplete || !rows.length)return
    setBusy(true);setMessage('正在分析目前帳號的持股與資產…');setResponse(null)
    const captured=rows.map(r=>({...r})), date=new Date().toISOString()
    const prompt=`【理財機器人提示詞 5：投資組合風險管理】\n「分析我的投資組合：\n${captured.map(r=>`${r.name}${r.ticker?` (${r.ticker})`:''}: ${Math.round(r.value)}`).join('\n')}\n個人風險承受度為 [${risk}]。\n找出弱點、曝險過度與隱藏相關性，提出符合風險承受度的再平衡方案，以及因應 [市場下跌${drop}%] 的避險策略。」`
    try {
      const result=await requireSupabase().functions.invoke<Response>('financial-analysis-auth',{body:{module:5,prompt,locale:'zh-TW',requested_at:date}})
      if(result.error)throw new Error(result.error.message)
      if(!result.data || result.data.error || result.data.analysis?.error || (!result.data.analysis?.title && !result.data.answer))throw new Error(result.data?.error || result.data?.analysis?.error || '分析服務沒有回傳結果。')
      setResponse(result.data);setAsOf(date)
      try {const record=await saveProRecord<Saved>(userId,'analysis',`${risk}／下跌${drop}%`,{response:result.data,asOf:date,portfolio:captured,risk,drop});setHistory(old=>[record,...old]);setMessage('分析完成並保存；下方可查看風險、相關性與退休現金流。')}
      catch(e){setMessage(`分析完成，但歷史保存失敗：${(e as Error).message}`)}
    }catch(e){setMessage(`分析未完成：${(e as Error).message}`)}finally{setBusy(false)}
  }
  const a=response?.analysis
  const impact=response?.retirement_impact
  const impactValid=impact&&!impact.error&&['assets_before','assets_after','monthly_expense','monthly_gap_after','monthly_gap_future_after'].every(key=>Number.isFinite(Number(impact[key as keyof AiStressSnapshot])))
  const stressData=response?{...data,aiStress:impactValid?impact:null}:data
  const correlations=(a?.strongest_correlations || []).filter(c=>Number.isFinite(c.corr)&&c.corr>=-1&&c.corr<=1)
  const symbols=Array.from(new Set(correlations.flatMap(c=>[c.a,c.b])))
  function currentTargets(){const next:Record<string,number>={};let used=0;rows.forEach((r,i)=>{next[r.id]=i===rows.length-1?Number((100-used).toFixed(4)):Number((r.value/total*100).toFixed(4));used+=next[r.id]});setTargets(next);setPlan(null)}
  return <section className="page-section"><FeatureHeader title="AI 投資組合風險分析" subtitle="讀取退休資產，串接 AI 分析、相關性、配置調整與退休現金流。" />
    {!allowed&&<p className="error-banner">目前帳號為免費會員。AI 分析需有效試用或 Pro 資格；點選 Pro 入口不會自動變更會員資格。</p>}
    <h2>已讀取我的退休資產</h2><p>{rows.length} 筆 · {money.format(total)}。以本次已載入的市值為準。</p>
    <div className="table-wrap"><table><thead><tr><th>資產</th><th>代號</th><th>市值</th><th>占比</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.ticker||'—'}</td><td>{money.format(r.value)}</td><td>{(r.value/total*100).toFixed(2)}%</td></tr>)}</tbody></table></div>
    <fieldset disabled={busy||!allowed} className="pro-fieldset"><legend>分析設定</legend><div className="jh-form-actions"><label>風險承受度<select value={risk} onChange={e=>setRisk(e.target.value)}><option>保守防禦型</option><option>穩健平衡型</option><option>積極成長型</option></select></label><p>基準市場情境 −20%<br/><small>其他跌幅可在下方壓力試算調整。</small></p><button className="primary-button" disabled={!rows.length||incomplete} onClick={()=>void analyze()}>使用目前持股執行分析</button></div><p className="chart-note">目前服務使用量化規則引擎，並非生成式 AI。按下分析會送出上方資產名稱、代號、市值與風險設定。不同資產依服務規則套用衝擊，並非一律下跌 20%；投資收入下降假設為 20%。</p></fieldset>
    {incomplete&&<p className="error-banner">部分持股缺少價格，請先更新資產資料後分析。</p>}{message&&<p role="status" className="form-message">{message}</p>}
    <label>歷史分析<select defaultValue="" onChange={e=>{const r=history.find(r=>r.id===e.target.value);if(r){setResponse(r.payload.response);setAsOf(r.payload.asOf);setMessage(`正在查看 ${r.name} 的歷史結果；下方再平衡表仍採目前資產。`)}}}><option value="" disabled>選擇保存的分析</option>{history.map(r=><option key={r.id} value={r.id}>{new Date(r.created_at).toLocaleString('zh-TW')} · {r.name}</option>)}</select></label>
    {response&&<article className="jh-panel"><h2>{a?.title||'分析結果'}</h2><p>分析時間：{new Date(asOf).toLocaleString('zh-TW')} · 引擎：{response.engine||'服務未標示'}</p><p>{a?.summary}</p>{response.answer&&<pre className="pro-answer">{response.answer}</pre>}{a?.weaknesses?.map((w,i)=><p key={i}><strong>{w.severity} · {w.title}</strong>：{w.detail}</p>)}<p>{a?.method}</p>
      <h3>歷史報酬相關性</h3><p className="chart-note">僅顯示服務回傳的配對；「—」代表沒有資料，不能當作零相關。這不是未來相關性的保證。</p>{symbols.length?<div className="table-wrap"><table><thead><tr><th>標的</th>{symbols.map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{symbols.map(s=><tr key={s}><th>{s}</th>{symbols.map(t=>{const c=correlations.find(c=>c.a===s&&c.b===t||c.a===t&&c.b===s);return <td key={t} className={c&&c.corr>=0.7?'jh-red':''}>{s===t?'1.00':c?c.corr.toFixed(2):'—'}</td>})}</tr>)}</tbody></table></div>:<p>本次服務沒有提供可驗證的相關性配對。</p>}
      {correlations.map((c,i)=><p className="chart-note" key={i}>{c.a}／{c.b}：{c.samples!=null?`${c.samples} 筆共同樣本，${c.start} 至 ${c.end}`:'舊紀錄未保存樣本期間'}{c.corr<0?'；負相關代表歷史報酬較常反向變動。':''}</p>)}
      <h3>配置調整方向</h3><p className="chart-note">以下是逐項規則建議，不是一份占比合計 100% 的交易清單；請在下方金額試算核對完整配置。</p>{a?.rebalance_plan?.map((p,i)=><p key={i}><strong>{p.action} {p.asset}</strong>{Number.isFinite(p.from_weight)&&Number.isFinite(p.to_weight)?`：${(p.from_weight!*100).toFixed(1)}% → ${(p.to_weight!*100).toFixed(1)}%`:''} · {p.reason}</p>)}{a?.hedge_plan?.map((p,i)=><p key={i}><strong>{p.step} · {p.action}</strong>：{p.detail}</p>)}
      <details><summary>查看原始分析與行情來源</summary><pre className="pro-answer">{JSON.stringify(response,null,2)}</pre></details></article>}
    <h2>再平衡金額試算</h2><p>填寫各資產目標占比，合計 100%。正數是補足金額，負數是減少金額；未含稅費、交易單位與價格變動。</p>
    <fieldset className="pro-fieldset" disabled={!allowed}><button className="ghost-button" onClick={currentTargets}>帶入目前占比</button><label>新增資金（元）<input type="number" min={0} value={budget} onChange={e=>{setBudget(Number(e.target.value));setPlan(null)}} /></label><div className="table-wrap"><table><thead><tr><th>資產</th><th>目標占比 %</th><th>目標金額</th><th>調整金額</th></tr></thead><tbody>{rows.map(r=>{const p=plan?.find(p=>p.id===r.id);return <tr key={r.id}><td>{r.name}</td><td><input aria-label={`${r.name}目標占比`} type="number" min={0} max={100} step={0.1} value={targets[r.id]??''} onChange={e=>{setTargets({...targets,[r.id]:Number(e.target.value)});setPlan(null)}} /></td><td>{p?money.format(p.target):'—'}</td><td>{p?money.format(p.adjustment):'—'}</td></tr>})}</tbody></table></div><button className="primary-button" disabled={!rows.length} onClick={()=>{try{setPlan(rebalance(rows,targets,budget));setMessage('再平衡試算完成。')}catch(e){setMessage((e as Error).message)}}}>計算調整金額</button></fieldset>
    <h2>壓力結果 → 退休現金流與續航年數</h2><button className="ghost-button" disabled={busy} onClick={()=>void reload()}>重新載入資產與最新壓力快照</button><p className="chart-note">{response?'下方採這份分析回傳的退休影響。':'下方採後端最近保存的壓力快照，請核對日期。'}{response&&!impactValid&&` 本份分析未取得退休影響：${impact?.error||'服務未提供完整數值'}。`}</p><StressPage data={stressData}/>
  </section>
}


