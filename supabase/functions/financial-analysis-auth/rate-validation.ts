export type RateValidationInput={ticker:string;startDate:string;endDate:string;duration:number}
export type ValidationSample='calibration'|'holdout'
export type RateValidationCase=RateValidationInput&{
  id:string;eventName:string;regime:'升息'|'降息';sample:ValidationSample;
  durationAsOf:string;durationSource:string;durationSourceUrl:string
}

const ISHARES='https://www.ishares.com/us/products/'
export const RATE_VALIDATION_CASES:RateValidationCase[]=[
  {id:'hike-2022-tlt',eventName:'2022 快速升息',regime:'升息',sample:'calibration',ticker:'TLT',startDate:'2022-03-16',endDate:'2022-10-24',duration:18.10,durationAsOf:'2022-03',durationSource:'iShares TLT 官方基金資料',durationSourceUrl:`${ISHARES}239454/ishares-20-year-treasury-bond-etf`},
  {id:'hike-2022-ief',eventName:'2022 快速升息',regime:'升息',sample:'calibration',ticker:'IEF',startDate:'2022-03-16',endDate:'2022-10-24',duration:7.65,durationAsOf:'2022-03',durationSource:'iShares IEF 官方基金資料',durationSourceUrl:`${ISHARES}239456/ishares-7-10-year-treasury-bond-etf`},
  {id:'hike-2022-shy',eventName:'2022 快速升息',regime:'升息',sample:'calibration',ticker:'SHY',startDate:'2022-03-16',endDate:'2022-10-24',duration:1.86,durationAsOf:'2022-03',durationSource:'iShares SHY 官方基金資料',durationSourceUrl:`${ISHARES}239452/ishares-1-3-year-treasury-bond-etf`},
  {id:'hike-2022-lqd',eventName:'2022 快速升息',regime:'升息',sample:'calibration',ticker:'LQD',startDate:'2022-03-16',endDate:'2022-10-24',duration:8.66,durationAsOf:'2022-03',durationSource:'iShares LQD 官方基金資料',durationSourceUrl:`${ISHARES}239566/ishares-iboxx-investment-grade-corporate-bond-etf`},
  {id:'hike-2023-tlt',eventName:'2023 殖利率再上行',regime:'升息',sample:'calibration',ticker:'TLT',startDate:'2023-07-03',endDate:'2023-10-19',duration:16.50,durationAsOf:'2023-07',durationSource:'iShares TLT 官方基金資料',durationSourceUrl:`${ISHARES}239454/ishares-20-year-treasury-bond-etf`},
  {id:'hike-2023-ief',eventName:'2023 殖利率再上行',regime:'升息',sample:'calibration',ticker:'IEF',startDate:'2023-07-03',endDate:'2023-10-19',duration:7.30,durationAsOf:'2023-07',durationSource:'iShares IEF 官方基金資料',durationSourceUrl:`${ISHARES}239456/ishares-7-10-year-treasury-bond-etf`},
  {id:'hike-2023-shy',eventName:'2023 殖利率再上行',regime:'升息',sample:'calibration',ticker:'SHY',startDate:'2023-07-03',endDate:'2023-10-19',duration:1.82,durationAsOf:'2023-07',durationSource:'iShares SHY 官方基金資料',durationSourceUrl:`${ISHARES}239452/ishares-1-3-year-treasury-bond-etf`},
  {id:'hike-2023-lqd',eventName:'2023 殖利率再上行',regime:'升息',sample:'calibration',ticker:'LQD',startDate:'2023-07-03',endDate:'2023-10-19',duration:8.13,durationAsOf:'2023-07',durationSource:'iShares LQD 官方基金資料',durationSourceUrl:`${ISHARES}239566/ishares-iboxx-investment-grade-corporate-bond-etf`},
  {id:'cut-2023-tlt',eventName:'2023 年底殖利率回落',regime:'降息',sample:'holdout',ticker:'TLT',startDate:'2023-10-19',endDate:'2023-12-27',duration:16.36,durationAsOf:'2023-10',durationSource:'iShares TLT 官方基金資料',durationSourceUrl:`${ISHARES}239454/ishares-20-year-treasury-bond-etf`},
  {id:'cut-2023-ief',eventName:'2023 年底殖利率回落',regime:'降息',sample:'holdout',ticker:'IEF',startDate:'2023-10-19',endDate:'2023-12-27',duration:7.22,durationAsOf:'2023-10',durationSource:'iShares IEF 官方基金資料',durationSourceUrl:`${ISHARES}239456/ishares-7-10-year-treasury-bond-etf`},
  {id:'cut-2023-shy',eventName:'2023 年底殖利率回落',regime:'降息',sample:'holdout',ticker:'SHY',startDate:'2023-10-19',endDate:'2023-12-27',duration:1.79,durationAsOf:'2023-10',durationSource:'iShares SHY 官方基金資料',durationSourceUrl:`${ISHARES}239452/ishares-1-3-year-treasury-bond-etf`},
  {id:'cut-2023-lqd',eventName:'2023 年底殖利率回落',regime:'降息',sample:'holdout',ticker:'LQD',startDate:'2023-10-19',endDate:'2023-12-27',duration:8.05,durationAsOf:'2023-10',durationSource:'iShares LQD 官方基金資料',durationSourceUrl:`${ISHARES}239566/ishares-iboxx-investment-grade-corporate-bond-etf`},
  {id:'cut-2024-tlt',eventName:'2024 首次降息前後',regime:'降息',sample:'holdout',ticker:'TLT',startDate:'2024-04-25',endDate:'2024-09-18',duration:16.12,durationAsOf:'2024-04',durationSource:'iShares TLT 官方基金資料',durationSourceUrl:`${ISHARES}239454/ishares-20-year-treasury-bond-etf`},
  {id:'cut-2024-ief',eventName:'2024 首次降息前後',regime:'降息',sample:'holdout',ticker:'IEF',startDate:'2024-04-25',endDate:'2024-09-18',duration:7.16,durationAsOf:'2024-04',durationSource:'iShares IEF 官方基金資料',durationSourceUrl:`${ISHARES}239456/ishares-7-10-year-treasury-bond-etf`},
  {id:'cut-2024-shy',eventName:'2024 首次降息前後',regime:'降息',sample:'holdout',ticker:'SHY',startDate:'2024-04-25',endDate:'2024-09-18',duration:1.76,durationAsOf:'2024-04',durationSource:'iShares SHY 官方基金資料',durationSourceUrl:`${ISHARES}239452/ishares-1-3-year-treasury-bond-etf`},
  {id:'cut-2024-lqd',eventName:'2024 首次降息前後',regime:'降息',sample:'holdout',ticker:'LQD',startDate:'2024-04-25',endDate:'2024-09-18',duration:7.95,durationAsOf:'2024-04',durationSource:'iShares LQD 官方基金資料',durationSourceUrl:`${ISHARES}239566/ishares-iboxx-investment-grade-corporate-bond-etf`},
]

export function validateRateValidationInput(value:unknown):RateValidationInput{
  const v=(value&&typeof value==='object'?value:{}) as Record<string,unknown>
  const ticker=String(v.ticker??'').trim().toUpperCase()
  const startDate=String(v.startDate??''),endDate=String(v.endDate??''),duration=Number(v.duration)
  if(!/^[A-Z0-9.^-]{1,16}$/.test(ticker))throw new Error('請輸入可辨識的歷史驗證標的代號。')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate))throw new Error('歷史驗證日期格式不正確。')
  const start=Date.parse(`${startDate}T00:00:00Z`),end=Date.parse(`${endDate}T00:00:00Z`)
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error('歷史驗證結束日必須晚於開始日。')
  if(end-start>366*24*60*60*1000)throw new Error('單次歷史驗證期間不可超過一年。')
  if(end>Date.now()+24*60*60*1000)throw new Error('歷史驗證不可使用未來日期。')
  if(!Number.isFinite(duration)||duration<=0||duration>50)throw new Error('請輸入大於 0 且不超過 50 年的修正存續期間。')
  return {ticker,startDate,endDate,duration}
}

export function calculateRateValidation(fromYield:number,toYield:number,duration:number,startPrice:number,endPrice:number,startAdjusted=startPrice,endAdjusted=endPrice){
  if(![fromYield,toYield,duration,startPrice,endPrice,startAdjusted,endAdjusted].every(Number.isFinite)||duration<=0||duration>50||Math.min(startPrice,endPrice,startAdjusted,endAdjusted)<=0)throw new Error('歷史驗證資料不完整。')
  const yieldChangeBps=(toYield-fromYield)*100
  const estimatedPriceChangePct=-duration*(toYield-fromYield)
  const actualPriceChangePct=(endPrice/startPrice-1)*100
  const actualTotalReturnPct=(endAdjusted/startAdjusted-1)*100
  const errorPctPoints=actualTotalReturnPct-estimatedPriceChangePct
  const directionMatch=Math.abs(estimatedPriceChangePct)<0.01||Math.abs(actualTotalReturnPct)<0.01?null:Math.sign(estimatedPriceChangePct)===Math.sign(actualTotalReturnPct)
  return {yieldChangeBps,estimatedPriceChangePct,actualPriceChangePct,actualTotalReturnPct,errorPctPoints,directionMatch}
}

export type ValidationAggregateInput={sample:ValidationSample;errorPctPoints:number;directionMatch:boolean|null}
export function aggregateRateValidation(rows:ValidationAggregateInput[],maeThreshold=5,directionThreshold=0.75){
  const summarize=(sample:ValidationSample)=>{
    const selected=rows.filter(r=>r.sample===sample),directional=selected.filter(r=>r.directionMatch!==null)
    const mae=selected.length?selected.reduce((n,r)=>n+Math.abs(r.errorPctPoints),0)/selected.length:0
    const directionHitRate=directional.length?directional.filter(r=>r.directionMatch).length/directional.length:0
    return {count:selected.length,mae,directionHitRate}
  }
  const calibration=summarize('calibration'),holdout=summarize('holdout')
  return {calibration,holdout,thresholds:{maePctPoints:maeThreshold,directionHitRate:directionThreshold},pass:holdout.count>0&&holdout.mae<=maeThreshold&&holdout.directionHitRate>=directionThreshold}
}

