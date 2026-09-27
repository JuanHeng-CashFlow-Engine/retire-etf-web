export type RateValidationInput={ticker:string;startDate:string;endDate:string;duration:number}

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

export function calculateRateValidation(fromYield:number,toYield:number,duration:number,startPrice:number,endPrice:number){
  if(![fromYield,toYield,duration,startPrice,endPrice].every(Number.isFinite)||duration<=0||duration>50||startPrice<=0||endPrice<=0)throw new Error('歷史驗證資料不完整。')
  const yieldChangeBps=(toYield-fromYield)*100
  const estimatedPriceChangePct=-duration*(toYield-fromYield)
  const actualPriceChangePct=(endPrice/startPrice-1)*100
  const errorPctPoints=actualPriceChangePct-estimatedPriceChangePct
  const directionMatch=Math.abs(estimatedPriceChangePct)<0.01||Math.abs(actualPriceChangePct)<0.01?null:Math.sign(estimatedPriceChangePct)===Math.sign(actualPriceChangePct)
  return {yieldChangeBps,estimatedPriceChangePct,actualPriceChangePct,errorPctPoints,directionMatch}
}

