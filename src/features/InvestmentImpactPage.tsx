import { useMemo, useState } from 'react'
import type { RetirementOverview } from '../data'
import { money } from '../lib/format'
import { memberState } from '../lib/insights'
import { requireSupabase } from '../lib/supabase'
import { tickerCode } from '../lib/ticker'
import { buyImpact, impactSummary, monthsText, shockImpact, type ImpactAsset, type ImpactSummary } from '../lib/investmentImpact'
import { estimateStaticRunway, runwayLabel } from '../lib/runway'
import { ProRiskPage } from './ProRiskPage'
import { FeatureHeader } from './shared'

const cards=[
  {title:'投資前退休影響試算',icon:'①',subtitle:'股票／ETF／基金買之前，先看看會不會影響退休。',action:'開始投資前試算 →'},
  {title:'新聞對我的退休影響',icon:'📰',subtitle:'今天的重要市場消息，會不會影響我的持股與退休生活？',action:'查看新聞與退休影響 →'},
  {title:'投資策略退休比較',icon:'📊',subtitle:'報酬高不一定適合退休，看看大跌時哪種策略比較撐得住。',action:'比較投資策略 →'},
  {title:'我的投組退休風險',icon:'🛡',subtitle:'看懂目前投組的市場壓力、每月缺口與靜態續航。',action:'查看完整分析 →'},
]
type Report={generated_at?:string;analysis?:{summary?:string;method?:string;max_drawdown?:number;drawdown_method?:string;strategy?:string;news?:{title?:string;link?:string;url?:string}[]};error?:string}
async function research(module:number,prompt:string):Promise<Report>{
  const {data,error}=await requireSupabase().functions.invoke<Report>('financial-analysis-auth',{body:{module,prompt,locale:'zh-TW'}})
  if(error)throw new Error('分析服務未完成，請確認 Pro 資格與登入狀態後重試。')
  if(!data||data.error)throw new Error(data?.error||'服務未提供資料。')
  return data
}
function assetRows(data:RetirementOverview):ImpactAsset[]{
  const rows=new Map<string,ImpactAsset>()
  for(const h of data.holdings){const id=`stock:${tickerCode(h.ticker)}`;const value=h.shares*1000*h.price;if(value>(rows.get(id)?.value??0))rows.set(id,{id,name:`${h.name} (${h.ticker})`,value,annualIncome:value*Number(h.annualYield||0)/100,cash:false})}
  return [...rows.values(),...data.assets.map(a=>({id:`asset:${a.id}`,name:a.asset_name,value:Number(a.current_value),annualIncome:a.is_income_asset?Number(a.current_value)*Number(a.annual_yield)/100:0,cash:a.asset_type==='cash'}))]
}
function Comparison({before,after}:{before:ImpactSummary;after:ImpactSummary}){
  return <><div className="table-wrap"><table><thead><tr><th>對我的退休影響</th><th>變動前</th><th>變動後</th></tr></thead><tbody>
    <tr><th>資產</th><td>{money.format(before.assets)}</td><td>{money.format(after.assets)}</td></tr>
    <tr><th>每月投資收入</th><td>{money.format(before.investmentIncome)}</td><td>{money.format(after.investmentIncome)}（差額 {money.format(after.investmentIncome-before.investmentIncome)}）</td></tr>
    <tr><th>每月缺口（負值代表結餘）</th><td>{money.format(before.gap)}</td><td>{money.format(after.gap)}</td></tr>
    <tr><th>最大單一投資占總資產</th><td>{before.concentration.toFixed(1)}%</td><td>{after.concentration.toFixed(1)}%（{after.concentration>before.concentration?'提高':after.concentration<before.concentration?'降低':'相同'}）</td></tr>
    <tr><th>靜態缺口續航</th><td>{monthsText(before.months)}</td><td>{monthsText(after.months)}{before.months!==null&&after.months!==null&&`（差額 ${Math.round(after.months-before.months)} 個月）`}</td></tr>
  </tbody></table></div><p className="chart-note">固定目前已起領收入與生活費，以資產除以每月缺口；未計未來起領收入、通膨、報酬、稅費或匯率。這是單次靜態比較，與長期退休模擬不同。投資收入採年配息平均，不代表每月實際入帳。</p></>
}
export function InvestmentImpactPage({data,userId,reload,onPro}:{data:RetirementOverview;userId?:string;reload:()=>Promise<void>;onPro?:()=>void}){
  const [selected,setSelected]=useState<number|null>(null),[target,setTarget]=useState(''),[source,setSource]=useState('external'),[amount,setAmount]=useState(100000),[yieldPct,setYield]=useState(0),[drop,setDrop]=useState(20)
  const [reports,setReports]=useState<Report[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[result,setResult]=useState<ImpactAsset[]|null>(null),[stressLoss,setStressLoss]=useState<number|null>(null)
  const [shocks,setShocks]=useState<Record<string,{price:number;income:number}>>({}),[strategies,setStrategies]=useState<{name:string;drawdown:number;incomeCut:number;source:string}[]>([])
  const [strategyName,setStrategyName]=useState('策略 A'),[historicalDrop,setHistoricalDrop]=useState(20),[incomeCut,setIncomeCut]=useState(0),[news,setNews]=useState('')
  const rows=useMemo(()=>assetRows(data),[data]),allowed=!!userId&&memberState(data)!=='free'
  const valid=rows.length>0&&data.monthlyExpense>0&&!data.holdings.some(h=>h.shares>0&&h.price<=0)
  const before=valid?impactSummary(rows,data.fixedMonthlyIncome,data.monthlyExpense):null
  const after=result&&before?impactSummary(result,data.fixedMonthlyIncome,data.monthlyExpense):null
  function open(i:number){setSelected(i);setResult(null);setReports([]);setMessage('');setStressLoss(null)}
  async function loadResearch(){
    if(!allowed||busy)return
    if(selected!==1&&!target.trim()){setMessage('請先輸入股票／ETF 代號。共同基金若無公開行情，可使用下方手動試算。');return}
    if(selected===1&&!news.trim()){setMessage('請輸入新聞主題或持股代號。');return}
    setBusy(true);setMessage('正在取得研究資料…');setReports([])
    try{const response=selected===0?await Promise.all([research(1,target),research(2,target)]):[await research(selected===1?3:4,selected===1?news:target)];setReports(response);setMessage('研究資料已載入，請核對來源及情境假設。')}
    catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
  }
  const snapshot=data.aiStress
  const snapshotRunway=snapshot?estimateStaticRunway({assets:Number(snapshot.assets_after),currentMonthlyGap:Number(snapshot.monthly_gap_after),futureMonthlyGap:Number(snapshot.monthly_gap_future_after),futureStartDate:snapshot.future_fixed_income_start,asOfDate:snapshot.generated_at}):null
  if(selected===3&&userId)return <><div className="impact-back"><button className="ghost-button" onClick={()=>setSelected(null)}>← 投資對退休的影響</button></div><ProRiskPage data={data} userId={userId} reload={reload}/></>
  return <section className="page-section investment-impact"><FeatureHeader title={selected===null?'投資對退休的影響':cards[selected].title} subtitle={selected===null?'從投資前、新聞、策略到投組風險，看清楚對退休生活的影響。':cards[selected].subtitle}/>
    {selected===null?<div className="impact-cards">{cards.map((c,i)=><article className="jh-panel" key={c.title}><span className="impact-icon">{c.icon}</span><h2>{c.title}</h2><p>{c.subtitle}</p>{i===3&&(snapshot?<div className="impact-snapshot"><small>最近分析：{new Date(snapshot.generated_at).toLocaleString('zh-TW')}</small><p>市場壓力：−{Number(snapshot.stress_loss_pct).toFixed(1)}%</p><p>壓力後資產：{money.format(Number(snapshot.assets_after))}</p><p>每月缺口：{money.format(Math.max(0,-Number(snapshot.monthly_gap_after)))}</p><p>靜態續航：{snapshotRunway?runwayLabel(snapshotRunway):'待計算'}</p></div>:<p>尚無已保存分析；進入後可讀取目前持股。</p>)}<button className="primary-button" onClick={()=>open(i)}>{c.action}</button></article>)}</div>:<>
    <button className="ghost-button" onClick={()=>setSelected(null)}>← 返回四個情境</button>
    {!allowed&&<p className="error-banner">研究分析需要登入且具有效 Pro／試用資格。{onPro&&<button className="text-button" onClick={onPro}>前往 Pro 登入</button>}</p>}
    {selected===3?<p>請登入 Pro 會員後查看自己的完整投組分析。</p>:<>
    <fieldset className="pro-fieldset" disabled={busy||!allowed}><legend>{selected===0?'1. 找到標的，查看技術健康與風險':selected===1?'1. 查看重要市場消息':'1. 查看策略歷史資料'}</legend>
    <label>{selected===1?'新聞主題／持股代號':'股票／ETF 代號'}<input value={selected===1?news:target} onChange={e=>{selected===1?setNews(e.target.value):setTarget(e.target.value);setReports([]);setResult(null)}} placeholder={selected===1?'例如：美國公債殖利率':'例如：00878、2330、NVDA'} maxLength={120}/></label><button className="primary-button" onClick={()=>void loadResearch()}>{busy?'取得中…':selected===0?'查看投資研究與技術風險':selected===1?'取得相關新聞':'取得歷史回測'}</button></fieldset>
    {message&&<p role="status" className="form-message">{message}</p>}
    {reports.map((r,i)=><article className="jh-panel" key={i}><h3>{selected===0?(i===0?'投資前研究':'技術健康與風險'):selected===1?'市場新聞':'策略歷史資料'}</h3><p>{r.analysis?.summary||r.analysis?.strategy||'請核對以下研究資料。'}</p>{r.analysis?.news?.map((n,j)=>{const url=n.link||n.url;return <p key={j}>{url&&/^https?:\/\//.test(url)?<a href={url} target="_blank" rel="noreferrer">{n.title||'新聞來源'}</a>:n.title}</p>})}<p>{r.analysis?.method}</p><small>資料時間：{r.generated_at?new Date(r.generated_at).toLocaleString('zh-TW'):'來源未標示'} · 量化規則研究，不是生成式 AI</small>{selected===2&&r.analysis?.drawdown_method==='daily_mark_to_market'&&Number.isFinite(r.analysis.max_drawdown)&&<p>歷史最大回撤：{(r.analysis.max_drawdown!*100).toFixed(1)}% <button className="text-button" onClick={()=>{setHistoricalDrop(Math.abs(r.analysis!.max_drawdown!)*100);setStrategyName(r.analysis?.strategy||target)}}>帶入比較假設</button></p>}</article>)}
    {!valid&&<p className="error-banner">請先補齊資產價格與每月生活費，再試算退休影響。</p>}
    {selected===0&&<fieldset className="pro-fieldset" disabled={!valid||!allowed}><legend>2. 輸入預計投入金額</legend><div className="jh-entry-form"><label>資金來源<select value={source} onChange={e=>{setSource(e.target.value);setResult(null)}}><option value="external">新增外部資金（不含在目前資產）</option>{rows.map(r=><option value={r.id} key={r.id}>{r.name}：{money.format(r.value)}</option>)}</select></label><label>投入金額（新台幣）<input type="number" min={1} value={amount} onChange={e=>{setAmount(Number(e.target.value));setResult(null)}}/></label><label>假設年配息率（%）<input type="number" min={0} max={100} value={yieldPct} onChange={e=>{setYield(Number(e.target.value));setResult(null)}}/></label><label>非現金投資壓力跌幅（%）<input type="number" min={0} max={100} value={drop} onChange={e=>{setDrop(Number(e.target.value));setResult(null)}}/></label></div><p>使用既有資金會扣除來源部位與其配息；新增外部資金才會增加總資產。基金可在上方輸入名稱手動試算；配息率為你核對的假設。</p><button className="primary-button" onClick={()=>{try{if(!target.trim())throw new Error('請輸入標的代號或基金名稱。');if(!Number.isFinite(drop)||drop<0||drop>100)throw new Error('跌幅需介於 0% 與 100%。');const existing=data.assets.find(a=>a.asset_code&&tickerCode(a.asset_code)===tickerCode(target)||a.asset_name===target.trim());const id=existing?`asset:${existing.id}`:`stock:${tickerCode(target)}`;const next=buyImpact(rows,source,id,target.trim(),amount,yieldPct);setResult(next);setStressLoss((next.filter(r=>!r.cash).reduce((s,r)=>s+r.value,0)-rows.filter(r=>!r.cash).reduce((s,r)=>s+r.value,0))*drop/100);setMessage('試算完成，未修改正式資產。')}catch(e){setMessage((e as Error).message)}}}>試算對退休的影響</button></fieldset>}
    {selected===1&&<fieldset className="pro-fieldset" disabled={!valid||!allowed}><legend>2. 核對新聞對各部位的影響假設</legend><p>利率變化不能直接等同價格跌幅。請依新聞及持有資產特性設定變動；正數增加、負數減少。未設定部位維持不變。</p><div className="table-wrap"><table><thead><tr><th>我的部位</th><th>市值</th><th>價格變動 %</th><th>配息金額變動 %</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.name}</td><td>{money.format(r.value)}</td>{(['price','income'] as const).map(k=><td key={k}><input aria-label={`${r.name}${k==='price'?'價格':'配息'}變動`} type="number" min={-100} max={100} value={shocks[r.id]?.[k]??0} onChange={e=>{setShocks({...shocks,[r.id]:{price:shocks[r.id]?.price??0,income:shocks[r.id]?.income??0,[k]:Number(e.target.value)}});setResult(null)}}/></td>)}</tr>)}</tbody></table></div><button className="primary-button" onClick={()=>{try{setResult(shockImpact(rows,shocks));setMessage('依核對後的假設試算，並非新聞影響預測。')}catch(e){setMessage((e as Error).message)}}}>試算新聞對退休的影響</button></fieldset>}
    {selected===2&&<fieldset className="pro-fieldset" disabled={!valid||!allowed}><legend>2. 將策略差異放進退休情境</legend><div className="jh-entry-form"><label>比較名稱<input value={strategyName} onChange={e=>setStrategyName(e.target.value)} maxLength={80}/></label><label>壓力跌幅（%）<input type="number" min={0} max={100} value={historicalDrop} onChange={e=>setHistoricalDrop(Number(e.target.value))}/></label><label>配息下降（%）<input type="number" min={0} max={100} value={incomeCut} onChange={e=>setIncomeCut(Number(e.target.value))}/></label></div><p>將選定跌幅套用目前非現金部位，現金不跌。單一標的回測不代表整個投組；以下是退休壓力比較，不是策略推薦。可加入「目前投組」、策略 A 與策略 B。</p><button className="primary-button" disabled={strategies.length>=4} onClick={()=>{if(!strategyName.trim()||![historicalDrop,incomeCut].every(n=>Number.isFinite(n)&&n>=0&&n<=100)){setMessage('請核對比較名稱與 0～100% 跌幅。');return}setStrategies([...strategies,{name:strategyName,drawdown:historicalDrop,incomeCut,source:reports[0]?.analysis?.drawdown_method==='daily_mark_to_market'&&Math.abs(Math.abs(reports[0].analysis.max_drawdown??NaN)*100-historicalDrop)<.001?`${target} 歷史回撤套用假設`:'手動壓力假設'}])}}>加入比較（最多四組）</button></fieldset>}
    {selected===2&&before&&strategies.length>0&&<div className="table-wrap"><table><thead><tr><th>比較指標</th>{strategies.map((s,i)=><th key={i}>{s.name}<button className="text-button" onClick={()=>setStrategies(strategies.filter((_,j)=>i!==j))}>移除</button></th>)}</tr></thead><tbody><tr><th>跌幅來源</th>{strategies.map((s,i)=><td key={i}>{s.source}：−{s.drawdown.toFixed(1)}%</td>)}</tr><tr><th>壓力後資產</th>{strategies.map((s,i)=><td key={i}>{money.format(rows.reduce((n,r)=>n+r.value*(r.cash?1:1-s.drawdown/100),0))}</td>)}</tr><tr><th>壓力後靜態續航</th>{strategies.map((s,i)=>{const shocked=shockImpact(rows,Object.fromEntries(rows.map(r=>[r.id,{price:r.cash?0:-s.drawdown,income:r.cash?0:-s.incomeCut}])));return <td key={i}>{monthsText(impactSummary(shocked,data.fixedMonthlyIncome,data.monthlyExpense).months)}</td>})}</tr></tbody></table></div>}
    {before&&after&&<><h2>對我的退休影響</h2><Comparison before={before} after={after}/>{selected===0&&<><p>市場下跌 {drop}% 時，額外承受損失：{money.format(stressLoss??0)}（負值代表損失減少）。</p><h3>投資前後資產配置</h3><div className="table-wrap"><table><thead><tr><th>資產</th><th>投資前</th><th>投資後</th></tr></thead><tbody>{result!.map(r=><tr key={r.id}><td>{r.name}</td><td>{money.format(rows.find(a=>a.id===r.id)?.value??0)}</td><td>{money.format(r.value)}／{after.assets?(r.value/after.assets*100).toFixed(1):'0'}%</td></tr>)}</tbody></table></div></>}</>}
    </>}</>}
  </section>
}
