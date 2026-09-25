import { useEffect, useState } from 'react'
import type { RetirementOverview } from '../data'
import { memberState } from '../lib/insights'
import { scenarioInput, runScenario } from '../lib/proAnalysis'
import type { RetirementPlanInput, RetirementPlanResult } from '../lib/retirementPlan'
import { loadProRecords, saveProRecord, type ProRecord } from '../proRecords'
import { money } from '../lib/format'
import { FeatureHeader } from './shared'

type SavedScenario = { version: 1; asOf: string; input: RetirementPlanInput; result: RetirementPlanResult }
export function ScenariosPage({data,userId}: {data:RetirementOverview;userId:string}) {
  const [input,setInput] = useState(() => scenarioInput(data))
  const [name,setName] = useState('我的退休情境')
  const [result,setResult] = useState<RetirementPlanResult|null>(null)
  const [records,setRecords] = useState<ProRecord<SavedScenario>[]>([])
  const [selected,setSelected] = useState<string[]>([])
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(false)
  const allowed = memberState(data) !== 'free'
  useEffect(() => { let live=true; loadProRecords<SavedScenario>(userId,'scenario').then(rows=>{if(live){setRecords(rows);setSelected(rows.slice(0,3).map(r=>r.id))}}).catch(e=>{if(live)setMessage(e.message)}); return ()=>{live=false} },[userId])
  function run() { if(!input)return;try{setResult(runScenario(input));setMessage('模擬完成；目前結果尚未保存。')}catch(e){setMessage((e as Error).message)} }
  async function save() { if(!allowed || !input || !result || !name.trim())return;setBusy(true);try { const record=await saveProRecord<SavedScenario>(userId,'scenario',name,{version:1,asOf:new Date().toISOString(),input,result});setRecords(old=>[record,...old]);setSelected(old=>[record.id,...old].slice(0,4));setMessage('情境與當時假設已保存，可跨裝置比較。') }catch(e){setMessage((e as Error).message)}finally{setBusy(false)} }
  const fields: {key:keyof RetirementPlanInput;label:string;min:number;max:number;step:number}[]=[
    {key:'currentAssets',label:'目前資產',min:0,max:1e12,step:1000},{key:'targetAssets',label:'目標資產',min:1,max:1e12,step:1000},{key:'monthlyContribution',label:'每月投入',min:0,max:1e8,step:1000},{key:'monthlyExpense',label:'每月生活費',min:1,max:1e8,step:1000},
    {key:'annualReturn',label:'年化總報酬（%）',min:-99,max:100,step:0.5},{key:'annualVolatility',label:'年化波動（%）',min:0,max:100,step:0.5},{key:'inflationRate',label:'通膨（%）',min:0,max:30,step:0.5},{key:'yearsUntilRetirement',label:'距離退休年數',min:0,max:80,step:1},{key:'retirementYears',label:'退休生活年數',min:1,max:80,step:1},{key:'simulations',label:'模擬次數',min:500,max:10000,step:500}]
  const comparisons = records.filter(r=>selected.includes(r.id))
  return <section className="page-section"><FeatureHeader title="進階退休情境比較" subtitle="保存不同假設，並列比較成功率、資產路徑與風險。" />
    {!allowed && <p className="error-banner">目前帳號為免費會員；進階情境操作與保存需有效試用或 Pro 資格。</p>}
    {message && <p role="status" className="form-message">{message}</p>}
    {!input ? <p>請先補齊年齡、退休目標、生活費與資產價格。</p> : <><fieldset disabled={!allowed || busy} className="pro-fieldset"><legend>情境假設</legend><div className="jh-entry-form"><label>情境名稱<input value={name} maxLength={100} onChange={e=>setName(e.target.value)} /></label>{fields.map(f=><label key={f.key}>{f.label}<input type="number" min={f.min} max={f.max} step={f.step} value={Number(input[f.key])} onChange={e=>{setInput({...input,[f.key]:Number(e.target.value)});setResult(null)}} /></label>)}</div><p>固定收入沿用目前設定的起迄月份；總報酬已含配息，不另重複加計。各情境使用相同亂數種子。</p><div className="jh-form-actions"><button className="primary-button" onClick={run}>執行蒙地卡羅模擬</button><button className="ghost-button" disabled={!result || !name.trim()} onClick={()=>void save()}>保存這個情境</button><button className="ghost-button" onClick={()=>{setInput(scenarioInput(data));setResult(null)}}>帶入目前退休設定</button></div></fieldset>
    {result && <div className="jh-operational-summary"><div>成功率<strong>{result.successProbability.toFixed(1)}%</strong></div><div>耗盡率<strong>{result.depletionProbability.toFixed(1)}%</strong></div><div>退休目標達成率<strong>{result.targetReachedProbability.toFixed(1)}%</strong></div><div>退休時月生活費<strong>{money.format(result.monthlyExpenseAtRetirement)}</strong></div></div>}</>}
    <h2>歷史情境（最多並列四組）</h2><div className="pro-scenario-list">{records.map(r=><label key={r.id}><input type="checkbox" checked={selected.includes(r.id)} disabled={!selected.includes(r.id)&&selected.length>=4} onChange={e=>setSelected(old=>e.target.checked?[...old,r.id]:old.filter(id=>id!==r.id))}/>{r.name} · {new Date(r.created_at).toLocaleDateString('zh-TW')}<button className="text-button" onClick={()=>{setInput(r.payload.input);setName(`${r.name}（副本）`);setResult(null)}}>複製假設</button></label>)}</div>
    {!records.length && <p>尚未保存情境；保存後會顯示在這裡。</p>}
    {comparisons.length>0 && <><div className="table-wrap"><table><thead><tr><th>指標</th>{comparisons.map(r=><th key={r.id}>{r.name}</th>)}</tr></thead><tbody>{[['成功率', (s:SavedScenario)=>`${s.result.successProbability.toFixed(1)}%`],['資產', (s:SavedScenario)=>money.format(s.input.currentAssets)],['每月生活費',(s:SavedScenario)=>money.format(s.input.monthlyExpense)],['報酬／波動',(s:SavedScenario)=>`${s.input.annualReturn}%／${s.input.annualVolatility}%`],['退休等待／年限',(s:SavedScenario)=>`${s.input.yearsUntilRetirement}／${s.input.retirementYears} 年`],['模擬次數',(s:SavedScenario)=>String(s.result.simulations)]].map(([label,fn])=><tr key={String(label)}><td>{String(label)}</td>{comparisons.map(r=><td key={r.id}>{(fn as (s:SavedScenario)=>string)(r.payload)}</td>)}</tr>)}</tbody></table></div><h3>資產路徑（第 10／50／90 百分位）</h3><div className="table-wrap"><table><thead><tr><th>經過年數</th>{comparisons.map(r=><th key={r.id}>{r.name}</th>)}</tr></thead><tbody>{Array.from(new Set(comparisons.flatMap(r=>r.payload.result.path.map(p=>p.yearOffset)))).sort((a,b)=>a-b).map(year=><tr key={year}><td>{year}</td>{comparisons.map(r=>{const p=r.payload.result.path.find(p=>p.yearOffset===year);return <td key={r.id}>{p?`${money.format(p.p10)} / ${money.format(p.p50)} / ${money.format(p.p90)}`:'—'}</td>})}</tr>)}</tbody></table></div></>}
    <p className="chart-note">每份情境保留當時資料；固定分布模型未包含所有市場風險，模擬成功率不等於保證。</p>
  </section>
}
