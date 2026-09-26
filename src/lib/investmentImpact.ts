export type ImpactAsset = {id:string;name:string;value:number;annualIncome:number;cash:boolean}
export type ImpactSummary = {assets:number;investmentIncome:number;gap:number;concentration:number;months:number|null;loss:number}
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
