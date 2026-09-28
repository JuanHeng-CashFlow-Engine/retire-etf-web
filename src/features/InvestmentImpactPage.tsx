import { useEffect, useMemo, useRef, useState } from 'react'
import type { RetirementOverview } from '../data'
import { lookupMarketQuote, marketQuoteReview, latestPrice, type LivePrice } from '../marketData'
import type { MarketQuote } from '../types'
import { money, unitPrice } from '../lib/format'
import { memberState } from '../lib/insights'
import { requireSupabase } from '../lib/supabase'
import { tickerCode } from '../lib/ticker'
import { buyImpact, impactSummary, investmentDecision, monthsText, portfolioVolatility, shockImpact, type ImpactAsset, type ImpactSummary, type InvestmentDecision } from '../lib/investmentImpact'
import { runScenario, scenarioInput } from '../lib/proAnalysis'
import { estimateStaticRunway, runwayLabel } from '../lib/runway'
import { ScenariosPage } from './ScenariosPage'
import { ProRiskPage } from './ProRiskPage'
import { NewsRetirementScenario } from './NewsRetirementScenario'
import { FeatureHeader } from './shared'

const cards=[
  {title:'退休投資決策中心',icon:'🧭',subtitle:'想買股票／ETF／基金時，3 分鐘看懂會不會讓退休計畫變差。',action:'開始 3 分鐘決策試算 →'},
  {title:'新聞對我的退休影響',icon:'📰',subtitle:'今天的重要市場消息，會不會影響我的持股與退休生活？',action:'查看新聞與退休影響 →'},
  {title:'投資策略退休比較',icon:'📊',subtitle:'報酬高不一定適合退休，看看大跌時哪種策略比較撐得住。',action:'比較投資策略 →'},
  {title:'我的投組退休風險',icon:'🛡',subtitle:'看懂目前投組的市場壓力、每月缺口與靜態續航。',action:'查看完整分析 →'},
]
type Report={market_snapshots?:LivePrice[];generated_at?:string;analysis?:{summary?:string;reasons?:string[];notes?:string[];daily?:{trend?:string;rsi14?:number};weekly?:{trend?:string};method?:string;trades?:number;win_rate?:number;profit_factor?:number;cagr?:number;max_drawdown?:number;drawdown_method?:string;strategy?:string;news?:{title?:string;link?:string;url?:string}[]};error?:string}
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
function cashMonthsText(value:number|null){return value===null?'目前收入可覆蓋支出':`${Math.floor(value)} 個月`}
function Comparison({before,after,decision}:{before:ImpactSummary;after:ImpactSummary;decision?:InvestmentDecision|null}){
  return <><div className="table-wrap"><table><thead><tr><th>對我的退休影響</th><th>變動前</th><th>變動後</th></tr></thead><tbody>
    {decision&&<tr><th>退休成功率</th><td>{decision.beforeSuccess==null?'待補齊退休設定':`${decision.beforeSuccess.toFixed(1)}%`}</td><td>{decision.afterSuccess==null?'待補齊退休設定':`${decision.afterSuccess.toFixed(1)}%`}</td></tr>}
    <tr><th>資產</th><td>{money.format(before.assets)}</td><td>{money.format(after.assets)}</td></tr>
    <tr><th>每月投資收入</th><td>{unitPrice.format(before.investmentIncome)}</td><td>{unitPrice.format(after.investmentIncome)}（差額 {unitPrice.format((Math.round(after.investmentIncome*100)-Math.round(before.investmentIncome*100))/100)}）</td></tr>
    <tr><th>每月缺口（負值代表結餘）</th><td>{money.format(before.gap)}</td><td>{money.format(after.gap)}</td></tr>
    {decision&&<><tr><th>現金安全月數</th><td>{cashMonthsText(decision.beforeCashMonths)}</td><td>{cashMonthsText(decision.afterCashMonths)}</td></tr><tr><th>假設壓力情境月缺口</th><td>{money.format(Math.max(0,decision.beforeStressGap))}</td><td>{money.format(Math.max(0,decision.afterStressGap))}</td></tr></>}
    <tr><th>最大單一投資占總資產</th><td>{before.concentration.toFixed(1)}%</td><td>{after.concentration.toFixed(1)}%（{after.concentration>before.concentration?'提高':after.concentration<before.concentration?'降低':'相同'}）</td></tr>
    <tr><th>靜態缺口續航</th><td>{monthsText(before.months)}</td><td>{monthsText(after.months)}{before.months!==null&&after.months!==null&&`（差額 ${Math.round(after.months-before.months)} 個月）`}</td></tr>
  </tbody></table></div><p className="chart-note">退休成功率沿用目前退休年齡、生活費、固定收入、通膨與報酬假設，以買前／買後資產及投組風險分別試算。現金安全月數只計現金部位；靜態缺口續航未計未來報酬與支出變化。投資收入採年配息平均，不代表每月實際入帳。</p></>
}
export function InvestmentImpactPage({data,userId,reload,onPro}:{data:RetirementOverview;userId?:string;reload:()=>Promise<void>;onPro?:()=>void}){
  const [selected,setSelected]=useState<number|null>(null),[target,setTarget]=useState(''),[source,setSource]=useState(''),[amount,setAmount]=useState(200000),[yieldPct,setYield]=useState(''),[drop,setDrop]=useState(20)
  const [longTerm,setLongTerm]=useState(false)
  const [quote,setQuote]=useState<MarketQuote|null>(null),[quoteMessage,setQuoteMessage]=useState('')
  const [reports,setReports]=useState<Report[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[result,setResult]=useState<ImpactAsset[]|null>(null),[stressLoss,setStressLoss]=useState<number|null>(null),[decision,setDecision]=useState<InvestmentDecision|null>(null)
  const [shocks,setShocks]=useState<Record<string,{price:number;income:number}>>({}),[strategies,setStrategies]=useState<{name:string;drawdown:number;incomeCut:number;source:string}[]>([])
  const [strategyName,setStrategyName]=useState('策略 A'),[historicalDrop,setHistoricalDrop]=useState(20),[incomeCut,setIncomeCut]=useState(0),[news,setNews]=useState('')
  const resultRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{if(result)resultRef.current?.scrollIntoView({behavior:'smooth',block:'start'})},[result])
  const rows=useMemo(()=>assetRows(data),[data]),allowed=!!userId&&memberState(data)!=='free'
  useEffect(()=>{if(!source)setSource(rows.find(r=>r.cash&&r.value>=amount)?.id??'external')},[rows,source,amount])
  const valid=rows.length>0&&data.monthlyExpense>0&&!data.holdings.some(h=>h.shares>0&&h.price<=0)
  const before=valid?impactSummary(rows,data.fixedMonthlyIncome,data.monthlyExpense):null
  const after=result&&before?impactSummary(result,data.fixedMonthlyIncome,data.monthlyExpense):null
  const livePrice=latestPrice(reports,target)
  const quoteReview=quote?marketQuoteReview(quote):null
  function open(i:number){setLongTerm(false);setQuote(null);setQuoteMessage('');setSelected(i);setResult(null);setReports([]);setMessage('');setStressLoss(null);setDecision(null)}
  function runInvestmentDecision(){
    try{
      if(!yieldPct.trim()||!Number.isFinite(Number(yieldPct)))throw new Error('請先核對並輸入年配息率；不配息商品請明確輸入 0。')
      if(!target.trim())throw new Error('請輸入標的代號或基金名稱。')
      if(!Number.isFinite(drop)||drop<0||drop>100)throw new Error('跌幅需介於 0% 與 100%。')
      const existing=data.assets.find(a=>(a.asset_code&&tickerCode(a.asset_code)===tickerCode(target))||a.asset_name===target.trim())
      const id=existing?`asset:${existing.id}`:`stock:${tickerCode(target)}`
      const next=buyImpact(rows,source||'external',id,target.trim(),amount,Number(yieldPct))
      const plan=scenarioInput(data)
      const beforeSuccess=plan?runScenario({...plan,currentAssets:impactSummary(rows,data.fixedMonthlyIncome,data.monthlyExpense).assets,annualVolatility:portfolioVolatility(rows)}).successProbability:null
      const afterSuccess=plan?runScenario({...plan,currentAssets:impactSummary(next,data.fixedMonthlyIncome,data.monthlyExpense).assets,annualVolatility:portfolioVolatility(next)}).successProbability:null
      setResult(next)
      setStressLoss((next.filter(r=>!r.cash).reduce((s,r)=>s+r.value,0)-rows.filter(r=>!r.cash).reduce((s,r)=>s+r.value,0))*drop/100)
      setDecision(investmentDecision(rows,next,data.fixedMonthlyIncome,data.monthlyExpense,beforeSuccess,afterSuccess,drop))
      setMessage('決策試算完成，未修改正式資產。')
    }catch(e){setResult(null);setDecision(null);setMessage((e as Error).message)}
  }
  async function loadResearch(){
    if(!allowed||busy)return
    if(selected!==1&&!target.trim()){setMessage('請先輸入股票／ETF 代號。共同基金若無公開行情，可使用下方手動試算。');return}
    if(selected===1&&!news.trim()){setMessage('請輸入新聞主題或持股代號。');return}
    setResult(null);setDecision(null);setBusy(true);setMessage('正在取得研究資料…');setReports([]);setQuote(null);setQuoteMessage('')
    if(selected===0){try{const q=await lookupMarketQuote(target);setQuote(q);setQuoteMessage('已取得資料，請核對後按帶入。')}catch(e){setQuoteMessage((e as Error).message+' 配息率請手動核對；未以 0 取代。')}}
    try{const response=selected===0?await Promise.all([research(1,target),research(2,target)]):[await research(selected===1?3:4,selected===1?news:target)];setReports(response);setMessage('研究資料已載入，請核對來源及情境假設。')}
    catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
  }
  const handoffRead=useRef(false)
  useEffect(()=>{
    if(handoffRead.current||!userId||!allowed||new URLSearchParams(location.search).get('analysis_handoff')!=='1')return
    handoffRead.current=true
    try{
      const raw=sessionStorage.getItem('juanheng-retirement-handoff-v1')
      if(!raw||raw.length>500000)throw new Error('找不到可帶入的分析，請在同一分頁由理財機器人重新帶回。')
      const h=JSON.parse(raw)
      if(h.version!==1||h.userId!==userId||![1,2,3,4].includes(h.module)||!Number.isFinite(h.createdAt)||Date.now()-h.createdAt>1800000||h.createdAt>Date.now()+60000)throw new Error('分析已過期或不屬於目前帳號，請重新分析並帶回。')
      const a=h.report?.analysis
      if(!a||typeof a!=='object')throw new Error('分析格式不完整。')
      const text=(v:unknown)=>typeof v==='string'?v.slice(0,8000):undefined
      const list=(v:unknown)=>Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,30):undefined
      const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:undefined
      const report:Report={generated_at:text(h.report.generated_at),analysis:{trades:finite(a.trades),win_rate:finite(a.win_rate),profit_factor:finite(a.profit_factor),cagr:finite(a.cagr),summary:text(a.summary),method:text(a.method),strategy:text(a.strategy),reasons:list(a.reasons),notes:list(a.notes),max_drawdown:typeof a.max_drawdown==='number'&&a.max_drawdown>=-1&&a.max_drawdown<=0?a.max_drawdown:undefined,drawdown_method:text(a.drawdown_method),news:Array.isArray(a.news)?a.news.slice(0,20).map((n:{title?:unknown;link?:unknown;url?:unknown})=>({title:text(n.title),link:text(n.link),url:text(n.url)})):undefined}}
      setSelected(h.module===3?1:h.module===4?2:0);setTarget(text(h.target)?.slice(0,120)||'');setNews(text(h.news)||text(h.target)||'');setReports([report]);setResult(null)
      if(h.module===4&&report.analysis?.drawdown_method==='daily_mark_to_market'&&Number.isFinite(report.analysis.max_drawdown)){setHistoricalDrop(Number((Math.abs(report.analysis.max_drawdown!)*100).toFixed(2)));setStrategyName(report.analysis.strategy||'帶入的回測策略')}
      setMessage(`已帶入理財機器人模組 ${h.module} 的分析（${new Date(h.createdAt).toLocaleString('zh-TW')}）。請核對下方資料與假設，再執行退休試算；尚未修改持股。`)
      sessionStorage.removeItem('juanheng-retirement-handoff-v1')
      const url=new URL(location.href);url.searchParams.delete('analysis_handoff');history.replaceState(null,'',url)
    }catch(e){setMessage((e as Error).message);setSelected(0)}
  },[userId,allowed])
  const snapshot=data.aiStress
  const snapshotRunway=snapshot?estimateStaticRunway({assets:Number(snapshot.assets_after),currentMonthlyGap:Number(snapshot.monthly_gap_after),futureMonthlyGap:Number(snapshot.monthly_gap_future_after),futureStartDate:snapshot.future_fixed_income_start,asOfDate:snapshot.generated_at}):null
  if(selected===2&&longTerm&&userId)return <><button className="ghost-button" onClick={()=>setLongTerm(false)}>← 返回策略壓力比較</button><p className="form-message">以整體退休資產進行前瞻情境比較。請先保存目前投組假設，再複製建立策略 A／B；沿用相同生活費、年限與固定收入，只調整經核對的報酬與波動。此處不是歷史投組回測。</p><ScenariosPage data={data} userId={userId}/></>
  if(selected===3&&userId)return <><div className="impact-back"><button className="ghost-button" onClick={()=>setSelected(null)}>← 退休投資決策中心</button></div><ProRiskPage data={data} userId={userId} reload={reload}/></>
  return <section className="page-section investment-impact"><FeatureHeader title={selected===null?'退休投資決策中心':cards[selected].title} subtitle={selected===null?'買之前先比較退休成功率、現金流、集中度與現金安全月數。':cards[selected].subtitle}/>
    {selected===null?<div className="impact-cards">{cards.map((c,i)=><article className="jh-panel" key={c.title}><span className="impact-icon">{c.icon}</span><h2>{c.title}</h2><p>{c.subtitle}</p>{i===3&&(snapshot?<div className="impact-snapshot"><small>最近分析：{new Date(snapshot.generated_at).toLocaleString('zh-TW')}</small><p>市場壓力：−{Number(snapshot.stress_loss_pct).toFixed(1)}%</p><p>壓力後資產：{money.format(Number(snapshot.assets_after))}</p><p>每月缺口：{money.format(Math.max(0,-Number(snapshot.monthly_gap_after)))}</p><p>靜態續航：{snapshotRunway?runwayLabel(snapshotRunway):'待計算'}</p></div>:<p>尚無已保存分析；進入後可讀取目前持股。</p>)}<button className="primary-button" onClick={()=>open(i)}>{c.action}</button></article>)}</div>:<>
    <button className="ghost-button" onClick={()=>setSelected(null)}>← 返回四個情境</button>
    {!allowed&&<p className="error-banner">研究分析需要登入且具有效 Pro／試用資格。{onPro&&<button className="text-button" onClick={onPro}>前往 Pro 登入</button>}</p>}
    {selected===3?<p>請登入 Pro 會員後查看自己的完整投組分析。</p>:<>
    <fieldset className="pro-fieldset" disabled={busy||!allowed}><legend>{selected===0?'1. 找到標的，查看技術健康與風險':selected===1?'1. 查看重要市場消息':'1. 查看策略歷史資料'}</legend>
    <label>{selected===1?'新聞主題／持股代號':'股票／ETF 代號'}<input value={selected===1?news:target} onChange={e=>{selected===1?setNews(e.target.value):setTarget(e.target.value);setYield('');setDecision(null);setQuote(null);setQuoteMessage('');setReports([]);setResult(null)}} placeholder={selected===1?'例如：美國公債殖利率':'例如：00878、2330、NVDA'} maxLength={120}/></label><button className="primary-button" onClick={()=>void loadResearch()}>{busy?'取得中…':selected===0?'查看投資研究與技術風險':selected===1?'取得相關新聞':'取得歷史回測'}</button></fieldset>
    {selected===0&&<p className="form-message">3 分鐘完成：① 輸入標的、查看持股健康與風險 → ② 核對資金來源、投入金額與配息率 → ③ 取得「可接受／需要注意／可能影響退休安全」結論。只查看研究不會修改資產。</p>}
    {message&&<p role="status" className="form-message">{message}</p>}
    {reports.map((r,i)=><article className="jh-panel" key={i}><h3>{selected===0?(i===0?'投資前研究':'技術健康與風險'):selected===1?'市場新聞':'策略歷史資料'}</h3><p>{r.analysis?.summary||r.analysis?.strategy||'請核對以下研究資料。'}</p>{r.analysis?.news?.map((n,j)=>{const url=n.link||n.url;return <p key={j}>{url&&/^https?:\/\//.test(url)?<a href={url} target="_blank" rel="noreferrer">{n.title||'新聞來源'}</a>:n.title}</p>})}{selected===2&&<><h3>5 年規則回測結果</h3><div className="table-wrap"><table><thead><tr><th>交易次數</th><th>勝率</th><th>獲利因子</th><th>最大回撤</th><th>CAGR</th></tr></thead><tbody><tr><td>{r.analysis?.trades??'未提供'}</td><td>{r.analysis?.win_rate!=null?`${(r.analysis.win_rate*100).toFixed(2)}%`:'未提供'}</td><td>{r.analysis?.profit_factor?.toFixed(2)??'未提供'}</td><td>{r.analysis?.max_drawdown!=null?`${(r.analysis.max_drawdown*100).toFixed(2)}%`:'未提供'}</td><td>{r.analysis?.cagr!=null?`${(r.analysis.cagr*100).toFixed(2)}%`:'未提供'}</td></tr></tbody></table></div><p>回撤可用作退休壓力假設；勝率不是退休成功率，CAGR 不會直接當成未來報酬。請核對實際執行策略與方法，輸入的策略文字不代表服務已執行該策略。</p></>}<p>{r.analysis?.method}</p>{selected===0&&<><ul>{r.analysis?.reasons?.map((reason,k)=><li key={k}>{reason}</li>)}</ul>{r.analysis?.daily&&<p>日線趨勢：{r.analysis.daily.trend||'資料不足'}；週線趨勢：{r.analysis.weekly?.trend||'資料不足'}；RSI：{Number.isFinite(r.analysis.daily.rsi14)?r.analysis.daily.rsi14!.toFixed(1):'資料不足'}。</p>}{r.analysis?.notes?.map((note,k)=><p className="chart-note" key={k}>{note}</p>)}</>}<small>分析產生時間：{r.generated_at?new Date(r.generated_at).toLocaleString('zh-TW'):'來源未標示'} · 量化規則研究，不是生成式 AI</small>{selected===2&&r.analysis?.drawdown_method==='daily_mark_to_market'&&Number.isFinite(r.analysis.max_drawdown)&&<p>歷史最大回撤：{(r.analysis.max_drawdown!*100).toFixed(1)}% <button className="text-button" onClick={()=>{setHistoricalDrop(Math.abs(r.analysis!.max_drawdown!)*100);setStrategyName(r.analysis?.strategy||target)}}>帶入比較假設</button></p>}</article>)}
    {selected===0&&<article className="jh-panel"><h3>標的行情與配息資料</h3>{livePrice?<><p>查詢行情：{livePrice.symbol} · 價格 {unitPrice.format(livePrice.price)}</p><p>行情來源：{livePrice.source} · 市場報價時間：{new Date(livePrice.market_time).toLocaleString('zh-TW')}。公開行情可能延遲，非交易所即時報價。</p><p>預計投入 {money.format(amount)}，約可買 {(amount/livePrice.price).toFixed(2)} 股（未計費用與交易單位）。</p></>:<p className="error-banner">尚未取得本標的新台幣行情；下列資料庫價格僅供歷史參考。</p>}<p>{quoteMessage||'查看研究時會一併查詢資料庫行情。海外標的或基金無資料時，保留手動試算。'}</p>{quote&&<><p>{quote.name}（{quote.ticker}） · 資料庫歷史價格 {unitPrice.format(Number(quote.price))} · 資料庫年配息率 {quote.yield==null?'待確認':`${Number(quote.yield).toFixed(2)}%`}</p><p>配息資料來源：{quote.data_source||'資料庫未標示'} · 更新：{quote.last_updated_at||'未標示'} · 配息狀態：{quote.dividend_status==='danger'?'警示／需人工核對':quote.dividend_status||'待核對'}</p>{quoteReview&&<p className={quoteReview.usable?'form-message':'error-banner'}>{quoteReview.reason}{quote.warning_message?` ${quote.warning_message}`:''}</p>}<button className="primary-button" disabled={!quoteReview?.usable||quote.yield==null||!Number.isFinite(Number(quote.yield))||Number(quote.yield)<0||Number(quote.yield)>100} onClick={()=>{setYield(String(quote.yield));setResult(null);setMessage('已帶入資料庫配息率，請核對資料日期及假設後試算。')}}>核對後帶入配息率</button><p>行情更新不代表配息資料已更新。歷史配息率不代表未來配息；資料過期或有警示時，請核對公告後在下方輸入，系統不會當成 0%。</p></>}</article>}
    {!valid&&<p className="error-banner">請先補齊資產價格與每月生活費，再試算退休影響。</p>}
    {selected===0&&<fieldset className="pro-fieldset" disabled={!valid||!allowed}><legend>2. 輸入想買的金額</legend><div className="jh-entry-form"><label>資金來源<select value={source} onChange={e=>{setSource(e.target.value);setResult(null);setDecision(null)}}><option value="external">新增外部資金（不含在目前資產）</option>{rows.map(r=><option value={r.id} key={r.id}>{r.name}：{money.format(r.value)}</option>)}</select></label><label>投入金額（新台幣）<input type="number" min={1} value={amount} onChange={e=>{setAmount(Number(e.target.value));setResult(null);setDecision(null)}}/></label><label>假設年配息率（%）<input type="number" min={0} max={100} step="any" placeholder="核對後輸入；不配息請填 0" value={yieldPct} onChange={e=>{setYield(e.target.value);setResult(null);setDecision(null)}}/></label><label>市場壓力跌幅（%）<input type="number" min={0} max={100} value={drop} onChange={e=>{setDrop(Number(e.target.value));setResult(null);setDecision(null)}}/></label></div><p>預設示範投入 20 萬元。使用既有現金會反映現金安全月數；新增外部資金才會增加總資產。基金可輸入名稱手動試算，配息率請依資料來源核對。</p><button className="primary-button" onClick={runInvestmentDecision}>產生買前／買後退休決策</button></fieldset>}
    {selected===1&&allowed&&valid&&<div onChange={()=>{setResult(null);setMessage('假設已變更，請重新核對並分析。')}}><NewsRetirementScenario rows={rows} onApply={(next,description)=>{try{setShocks(next);setResult(shockImpact(rows,next));setMessage(description+' 已套用到下方逐筆部位，結果如下；未修改正式資產。')}catch(e){setMessage((e as Error).message)}}}/></div>}
    {selected===1&&<fieldset className="pro-fieldset" disabled={!valid||!allowed}><legend>進階：逐筆微調事件假設</legend><p>利率變化不能直接等同價格跌幅。請依新聞及持有資產特性設定變動；正數增加、負數減少。未設定部位維持不變。</p><div className="table-wrap"><table><thead><tr><th>我的部位</th><th>市值</th><th>價格變動 %</th><th>配息金額變動 %</th><th>原估計月配息</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.name}</td><td>{money.format(r.value)}</td>{(['price','income'] as const).map(k=><td key={k}><input aria-label={`${r.name}${k==='price'?'價格':'配息'}變動`} type="number" min={-100} max={100} value={shocks[r.id]?.[k]??0} onChange={e=>{setShocks({...shocks,[r.id]:{price:shocks[r.id]?.price??0,income:shocks[r.id]?.income??0,[k]:Number(e.target.value)}});setResult(null)}}/></td>)}<td>{unitPrice.format(r.annualIncome/12)}{r.annualIncome===0&&<small>（目前未計配息；請核對資料）</small>}</td></tr>)}</tbody></table></div><p>配息變動比例套用於「原配息金額」，不是市值。價格變動不會自動改變配息；原配息為 0 的部位，即使設定 −4%，計算仍為 0。</p><button className="primary-button" onClick={()=>{try{setResult(shockImpact(rows,shocks));setMessage('依核對後的假設試算，並非新聞影響預測。')}catch(e){setMessage((e as Error).message)}}}>試算新聞對退休的影響</button></fieldset>}
    {selected===2&&<fieldset className="pro-fieldset" disabled={!valid||!allowed}><legend>2. 將策略差異放進退休情境</legend><div className="jh-entry-form"><label>比較名稱<input value={strategyName} onChange={e=>setStrategyName(e.target.value)} maxLength={80}/></label><label>壓力跌幅（%）<input type="number" min={0} max={100} value={historicalDrop} onChange={e=>setHistoricalDrop(Number(e.target.value))}/></label><label>配息下降（%）<input type="number" min={0} max={100} value={incomeCut} onChange={e=>setIncomeCut(Number(e.target.value))}/></label></div><p>將選定跌幅套用目前非現金部位，現金不跌。單一標的回測不代表整個投組；以下是退休壓力比較，不是策略推薦。可加入「目前投組」、策略 A 與策略 B。</p><button className="primary-button" disabled={strategies.length>=4} onClick={()=>{if(!strategyName.trim()||![historicalDrop,incomeCut].every(n=>Number.isFinite(n)&&n>=0&&n<=100)){setMessage('請核對比較名稱與 0～100% 跌幅。');return}setStrategies([...strategies,{name:strategyName,drawdown:historicalDrop,incomeCut,source:reports[0]?.analysis?.drawdown_method==='daily_mark_to_market'&&Math.abs(Math.abs(reports[0].analysis.max_drawdown??NaN)*100-historicalDrop)<.001?`${target} 歷史回撤套用假設`:'手動壓力假設'}])}}>加入比較（最多四組）</button></fieldset>}
    {selected===2&&allowed&&userId&&<article className="jh-panel"><h3>比較策略對整體退休計畫的影響</h3><p>沿用目前全部退休資產、固定收入起領月份、生活費與退休年限，比較不同總報酬與波動假設的成功率及資產路徑。總報酬須包含配息並扣除估計成本，避免重複計入。</p><button className="primary-button" onClick={()=>setLongTerm(true)}>帶入退休設定，比較目前投組與策略 A／B</button></article>}
    {selected===2&&before&&strategies.length>0&&<div className="table-wrap"><table><thead><tr><th>比較指標</th>{strategies.map((s,i)=><th key={i}>{s.name}<button className="text-button" onClick={()=>setStrategies(strategies.filter((_,j)=>i!==j))}>移除</button></th>)}</tr></thead><tbody><tr><th>跌幅來源</th>{strategies.map((s,i)=><td key={i}>{s.source}：−{s.drawdown.toFixed(1)}%</td>)}</tr><tr><th>壓力後資產</th>{strategies.map((s,i)=><td key={i}>{money.format(rows.reduce((n,r)=>n+r.value*(r.cash?1:1-s.drawdown/100),0))}</td>)}</tr><tr><th>壓力後靜態續航</th>{strategies.map((s,i)=>{const shocked=shockImpact(rows,Object.fromEntries(rows.map(r=>[r.id,{price:r.cash?0:-s.drawdown,income:r.cash?0:-s.incomeCut}])));return <td key={i}>{monthsText(impactSummary(shocked,data.fixedMonthlyIncome,data.monthlyExpense).months)}</td>})}</tr></tbody></table></div>}
    {before&&after&&<><div ref={resultRef} style={{scrollMarginTop:24}}><h2>買下去，退休計畫會發生什麼變化？</h2>{selected===1&&<p>{message}</p>}{selected===0&&decision&&<article className={`decision-banner decision-${decision.level}`}><small>本次決策結果</small><h2>{decision.label}</h2><ul>{decision.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul><p>這是情境試算結果，請依資料日期、交易成本與個人承受能力決定是否執行。</p></article>}{selected===0&&<div className="impact-cards"><article className="jh-panel"><h3>退休成功率</h3><strong>{decision?.beforeSuccess==null?'待補齊設定':`${decision.beforeSuccess.toFixed(1)}% → ${decision.afterSuccess!.toFixed(1)}%`}</strong><p>0.0% 是目前假設與有限次模擬的顯示結果，不代表現實中必然失敗；新增少量資產後也可能仍顯示 0.0%。</p></article><article className="jh-panel"><h3>每月退休現金流</h3><strong>{money.format(-before.gap)} → {money.format(-after.gap)}</strong><p>正值為結餘，負值為缺口。此次使用年配息率 {yieldPct}%；新增部位月配息＝{money.format(amount)} × {yieldPct}% ÷ 12。</p></article><article className="jh-panel"><h3>現金安全月數</h3><strong>{decision?`${cashMonthsText(decision.beforeCashMonths)} → ${cashMonthsText(decision.afterCashMonths)}`:'待計算'}</strong><p>只計現金部位可填補月缺口的時間，整月顯示可能相同。{decision&&`精確比較：${decision.beforeCashMonths?.toFixed(2)??'收入足夠'} → ${decision.afterCashMonths?.toFixed(2)??'收入足夠'} 個月。`}</p></article><article className="jh-panel"><h3>資產集中度</h3><strong>{before.concentration.toFixed(1)}% → {after.concentration.toFixed(1)}%</strong><p>最大單一非現金部位占總資產</p></article><article className="jh-panel"><h3>假設壓力情境月缺口</h3><strong>{decision?`${money.format(Math.max(0,decision.beforeStressGap))} → ${money.format(Math.max(0,decision.afterStressGap))}`:'待計算'}</strong><p>市場跌 {drop}%、配息同步減少 {decision?.stressIncomeCutPct.toFixed(1)??0}%</p></article><article className="jh-panel"><h3>大跌時額外承受損失</h3><strong>{money.format(stressLoss??0)}</strong><p>買入後新增的壓力損失</p></article></div>}</div><Comparison before={before} after={after} decision={selected===0?decision:null}/>{selected===1&&<><h3>每月配息變動明細</h3><p>逐筆公式：原年度配息 ÷ 12 × 配息變動比例。金額顯示至小數兩位；前後差額按顯示精度計算。</p><div className="table-wrap"><table><thead><tr><th>部位</th><th>原月配息</th><th>套用變動</th><th>情境後月配息</th><th>每月差額</th></tr></thead><tbody>{rows.filter(r=>(shocks[r.id]?.income??0)!==0).map(r=>{const next=result!.find(n=>n.id===r.id)!;return <tr key={r.id}><td>{r.name}{r.annualIncome===0&&<p className="error-banner">目前配息基數為 0：未計入收入影響，請至資產設定核對是否缺少配息資料。</p>}</td><td>{unitPrice.format(r.annualIncome/12)}</td><td>{shocks[r.id].income}%</td><td>{unitPrice.format(next.annualIncome/12)}</td><td>{unitPrice.format((next.annualIncome-r.annualIncome)/12)}</td></tr>})}</tbody></table></div>{!rows.some(r=>(shocks[r.id]?.income??0)!==0)&&<p>本次未設定配息變動，因此月投資收入維持不變。</p>}</>}{selected===0&&<><p>市場下跌 {drop}% 時，額外承受損失：{money.format(stressLoss??0)}（負值代表損失減少）。</p><h3>投資前後資產配置</h3><div className="table-wrap"><table><thead><tr><th>資產</th><th>投資前</th><th>投資後</th></tr></thead><tbody>{result!.map(r=><tr key={r.id}><td>{r.name}</td><td>{money.format(rows.find(a=>a.id===r.id)?.value??0)}／{before.assets?((rows.find(a=>a.id===r.id)?.value??0)/before.assets*100).toFixed(1):'0'}%</td><td>{money.format(r.value)}／{after.assets?(r.value/after.assets*100).toFixed(1):'0'}%</td></tr>)}</tbody></table></div></>}</>}
    </>}</>}
  </section>
}
