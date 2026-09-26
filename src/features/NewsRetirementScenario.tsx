import { useState } from 'react'
import type { ImpactAsset } from '../lib/investmentImpact'
import { money } from '../lib/format'
export type NewsGroup='bond'|'dividend'|'growth'|'cash'|'other'
const labels:Record<NewsGroup,string>={bond:'債券部位',dividend:'高股息部位',growth:'成長型資產',cash:'現金',other:'其他／待分類'}
export function classifyNewsAsset(r:ImpactAsset):NewsGroup {
  if(r.cash)return 'cash'
  if(/債|bond|treasury/i.test(r.name))return 'bond'
  if(/高息|高股息|股利|dividend/i.test(r.name))return 'dividend'
  if(/成長|科技|growth|technology/i.test(r.name))return 'growth'
  return 'other'
}
export function ratePriceChange(from:number,to:number,duration:number){
  if(![from,to,duration].every(Number.isFinite)||from<0||to<0||duration<0||duration>50)throw new Error('請核對殖利率與 0～50 年修正存續期間。')
  const price=-duration*(to-from)
  if(price < -100 || price > 100)throw new Error('利率衝擊超出線性近似範圍，請調整情境。')
  return Math.round(price*10000)/10000
}
export function NewsRetirementScenario({rows,onApply}:{rows:ImpactAsset[];onApply:(shocks:Record<string,{price:number;income:number}>,description:string)=>void}){
 const [event,setEvent]=useState('rate'),[from,setFrom]=useState(4.2),[to,setTo]=useState(5),[duration,setDuration]=useState(5)
 const [groups,setGroups]=useState<Record<string,NewsGroup>>({}),[changes,setChanges]=useState<Record<string,{price:number;income:number}>>({}),[confirmed,setConfirmed]=useState(false),[error,setError]=useState('')
 const group=(r:ImpactAsset)=>groups[r.id]??classifyNewsAsset(r)
 const change=(g:NewsGroup)=>changes[g]??{price:0,income:0}
 const total=rows.reduce((n,r)=>n+r.value,0)
 function apply(){try{
   if(!confirmed)throw new Error('請先核對事件數值、分類與影響假設。')
   const bondPrice=event==='rate'?ratePriceChange(from,to,duration):change('bond').price
   const shocks=Object.fromEntries(rows.map(r=>{const g=group(r),c=change(g);return [r.id,{price:g==='bond'?bondPrice:c.price,income:c.income}]}))
   if(Object.values(shocks).some(c=>![c.price,c.income].every(n=>Number.isFinite(n)&&n>=-100&&n<=100)))throw new Error('價格與配息變動需介於 -100%～100%。')
   onApply(shocks,event==='rate'?`利率情境：${from}% → ${to}%（${((to-from)*100).toFixed(0)} bps）；債券修正存續期間假設 ${duration} 年，價格近似變動 ${bondPrice.toFixed(2)}%。`:'自訂市場事件：依已核對的分類價格與配息變動試算。');setError('')
 }catch(e){setError((e as Error).message)}}
 return <section className="jh-panel"><h2>把新聞連到我的退休資產</h2><p>先閱讀上方新聞來源，再核對事件。以下預填數字是可修改的示範假設，不代表新聞已證實的數值。</p>
 <div className="jh-entry-form"><label>事件類型<select value={event} onChange={e=>{setEvent(e.target.value);setConfirmed(false)}}><option value="rate">利率／公債殖利率變動</option><option value="custom">其他市場事件／配息變動</option></select></label>{event==='rate'&&<><label>事件前殖利率（%）<input type="number" step="0.01" value={from} onChange={e=>{setFrom(Number(e.target.value));setConfirmed(false)}}/></label><label>事件後殖利率（%）<input type="number" step="0.01" value={to} onChange={e=>{setTo(Number(e.target.value));setConfirmed(false)}}/></label><label>債券修正存續期間假設（年）<input type="number" step="0.1" min="0" max="50" value={duration} onChange={e=>{setDuration(Number(e.target.value));setConfirmed(false)}}/></label></>}</div>
 {event==='rate'&&<p>殖利率變化：{((to-from)*100).toFixed(0)} bps。債券價格近似變動＝−修正存續期間 × 殖利率百分點變化；不含凸性、信用利差及匯率，且假設各債券殖利率同幅變動。債券基金需核對實際存續期間。</p>}
 <h3>我的持股曝險</h3><p>名稱可辨識的部位先提供分類，其餘保留待分類；請核對基金內容，不會自動把所有股票當成成長股。</p>
 <div className="table-wrap"><table><thead><tr><th>資產</th><th>市值</th><th>情境分類</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.name}</td><td>{money.format(r.value)}</td><td><select aria-label={`${r.name}情境分類`} value={group(r)} onChange={e=>{setGroups({...groups,[r.id]:e.target.value as NewsGroup});setConfirmed(false)}}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></td></tr>)}</tbody></table></div>
 <h3>事件如何影響各類資產</h3><p>利率變化不會自動等於股票跌幅，也不會直接改變既有債券票息。除債券價格近似外，其餘預設不變；可依來源調整。這些是情境假設，不是預測。</p>
 <div className="table-wrap"><table><thead><tr><th>分類</th><th>目前部位／占比</th><th>價格變動 %</th><th>配息金額變動 %</th></tr></thead><tbody>{(Object.keys(labels) as NewsGroup[]).map(g=>{const value=rows.filter(r=>group(r)===g).reduce((n,r)=>n+r.value,0);return <tr key={g}><th>{labels[g]}</th><td>{money.format(value)}／{total?(value/total*100).toFixed(1):0}%</td>{(['price','income'] as const).map(k=><td key={k}>{g==='bond'&&k==='price'&&event==='rate'?<span>{(-duration*(to-from)).toFixed(2)}%（公式估算）</span>:<input aria-label={`${labels[g]}${k==='price'?'價格':'配息'}假設`} type="number" step="0.1" min="-100" max="100" value={change(g)[k]} onChange={e=>{setChanges({...changes,[g]:{...change(g),[k]:Number(e.target.value)}});setConfirmed(false)}}/>}</td>)}</tr>})}</tbody></table></div>
 <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>我已核對新聞事件、持股分類與假設，了解未調整的部位將維持不變。</label>
 {error&&<p role="alert" className="error-banner">{error}</p>}<button className="primary-button" disabled={!confirmed} onClick={apply}>分析這則事件對我的退休影響</button></section>
}
