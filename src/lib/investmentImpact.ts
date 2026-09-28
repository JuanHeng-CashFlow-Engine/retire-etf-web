export type ImpactAsset = {id:string;name:string;value:number;annualIncome:number;cash:boolean}
export type ImpactSummary = {assets:number;investmentIncome:number;gap:number;concentration:number;months:number|null;loss:number}
export type InvestmentDecisionLevel='acceptable'|'attention'|'unsafe'
export type InvestmentDecision={
  level:InvestmentDecisionLevel;label:'可接受'|'需要注意'|'可能影響退休安全';reasons:string[];
  beforeSuccess:number|null;afterSuccess:number|null;successDelta:number|null;
  beforeCashMonths:number|null;afterCashMonths:number|null;
  beforeStressGap:number;afterStressGap:number;stressIncomeCutPct:number
}
export function impactSummary(rows:ImpactAsset[],fixed:number,expense:number,loss=0):ImpactSummary {
  if(!rows.length || rows.some(r=>![r.value,r.annualIncome].every(Number.isFinite)||r.value<0||r.annualIncome<0)||![fixed,expense,loss].every(Number.isFinite)||fixed<0||expense<=0)throw new Error('請先核對資產、收入與生活費。')
  const assets=rows.reduce((s,r)=>s+r.value,0),investmentIncome=rows.reduce((s,r)=>s+r.annualIncome/12,0),gap=expense-fixed-investmentIncome
  return {assets,investmentIncome,gap,concentration:assets?Math.max(...rows.filter(r=>!r.cash).map(r=>r.value),0)/assets*100:0,months:gap>0?assets/gap:null,loss}
}
export function buyImpact(rows:ImpactAsset[],source:string,target:string,name:string,amount:number,yieldPct:number) {
  if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(yieldPct)||yieldPct<0||yieldPct>100)throw new Error('請輸入有效投入金額與年配息率。')
  const from=rows.find(r=>r.id===source)
  if(source!=='external'&&(!from||amount>from.value))throw new Error('投入金額超過選定資金來源。')
  if(source===target)throw new Error('資金來源與買入標的不可相同。')
  const next=rows.map(r=>r.id===source?{...r,value:r.value-amount,annualIncome:r.value?r.annualIncome*(1-amount/r.value):0}:{...r})
  const to=next.find(r=>r.id===target)
  if(to){to.value+=amount;to.annualIncome+=amount*yieldPct/100}else next.push({id:target,name,value:amount,annualIncome:amount*yieldPct/100,cash:false})
  return next
}
export function shockImpact(rows:ImpactAsset[],shocks:Record<string,{price:number;income:number}>) {
  return rows.map(r=>{const s=shocks[r.id]??{price:0,income:0};if(![s.price,s.income].every(Number.isFinite)||s.price < -100||s.price>100||s.income < -100||s.income>100)throw new Error('變動假設需介於 -100% 與 100%。');return {...r,value:r.value*(1+s.price/100),annualIncome:r.annualIncome*(1+s.income/100)}})
}
export function monthsText(months:number|null){if(months===null)return '目前收入可覆蓋支出';const n=Math.round(months);return `約 ${Math.floor(n/12)} 年 ${n%12} 個月`}

export function portfolioVolatility(rows:ImpactAsset[],marketVolatility=15){
  const total=rows.reduce((n,r)=>n+r.value,0),risky=rows.filter(r=>!r.cash).reduce((n,r)=>n+r.value,0)
  if(total<=0||!Number.isFinite(marketVolatility)||marketVolatility<0)throw new Error('無法估算投組風險。')
  const concentration=impactSummary(rows,0,1).concentration
  return Math.max(2,marketVolatility*(0.35+0.65*risky/total)*(1+Math.max(0,concentration-20)/100))
}

function cashMonths(rows:ImpactAsset[],gap:number){
  const cash=rows.filter(r=>r.cash).reduce((n,r)=>n+r.value,0)
  return gap>0?cash/gap:null
}

export function investmentDecision(beforeRows:ImpactAsset[],afterRows:ImpactAsset[],fixed:number,expense:number,beforeSuccess:number|null,afterSuccess:number|null,stressDropPct:number):InvestmentDecision{
  if(!Number.isFinite(stressDropPct)||stressDropPct<0||stressDropPct>100)throw new Error('壓力跌幅需介於 0% 與 100%。')
  const before=impactSummary(beforeRows,fixed,expense),after=impactSummary(afterRows,fixed,expense)
  const beforeCashMonths=cashMonths(beforeRows,before.gap),afterCashMonths=cashMonths(afterRows,after.gap)
  const stressIncomeCutPct=Math.min(50,stressDropPct/2)
  const beforeStressGap=expense-fixed-before.investmentIncome*(1-stressIncomeCutPct/100)
  const afterStressGap=expense-fixed-after.investmentIncome*(1-stressIncomeCutPct/100)
  const successDelta=beforeSuccess==null||afterSuccess==null?null:afterSuccess-beforeSuccess
  const cashWorsened=beforeCashMonths!=null&&afterCashMonths!=null&&afterCashMonths<beforeCashMonths-.1
  const concentrationWorsened=after.concentration>before.concentration+.1
  const unsafe=(successDelta!=null&&successDelta < -5)||(cashWorsened&&afterCashMonths!<6)||(concentrationWorsened&&after.concentration>30)||afterStressGap>beforeStressGap+5000
  const attention=!unsafe&&((successDelta!=null&&successDelta < -2)||(cashWorsened&&afterCashMonths!<12)||(concentrationWorsened&&after.concentration>20)||afterStressGap>beforeStressGap+1||(afterSuccess!=null&&afterSuccess<70))
  const level:InvestmentDecisionLevel=unsafe?'unsafe':attention?'attention':'acceptable'
  const reasons:string[]=[]
  if(successDelta!=null)reasons.push(`退休成功率${successDelta>=0?'增加':'下降'} ${Math.abs(successDelta).toFixed(1)} 個百分點`)
  reasons.push(`每月投資收入${after.investmentIncome>=before.investmentIncome?'增加':'減少'} ${Math.abs(after.investmentIncome-before.investmentIncome).toLocaleString('zh-TW',{maximumFractionDigits:0})} 元`)
  reasons.push(`最大單一資產占比由 ${before.concentration.toFixed(1)}% 變為 ${after.concentration.toFixed(1)}%`)
  if(beforeCashMonths==null&&afterCashMonths==null)reasons.push('目前收入可覆蓋生活費，沒有現金缺口月數')
  else reasons.push(`現金安全月數由 ${beforeCashMonths==null?'收入可覆蓋':`${Math.floor(beforeCashMonths)} 個月`} 變為 ${afterCashMonths==null?'收入可覆蓋':`${Math.floor(afterCashMonths)} 個月`}`)
  reasons.push(`壓力情境月缺口由 ${Math.max(0,beforeStressGap).toLocaleString('zh-TW',{maximumFractionDigits:0})} 元變為 ${Math.max(0,afterStressGap).toLocaleString('zh-TW',{maximumFractionDigits:0})} 元`)
  return {level,label:level==='unsafe'?'可能影響退休安全':level==='attention'?'需要注意':'可接受',reasons,beforeSuccess,afterSuccess,successDelta,beforeCashMonths,afterCashMonths,beforeStressGap,afterStressGap,stressIncomeCutPct}
}

