import { requireSupabase } from './lib/supabase'
import { cleanTicker, sameTicker, tickerCandidates, tickerCode } from './lib/ticker'
import type { MarketQuote } from './types'
import { assessFreshness, resolveMarketPrice, type PriceCandidate } from './lib/dataQuality'

export function marketQuoteReview(quote:MarketQuote,now=new Date()){
  const freshness=assessFreshness(quote.last_updated_at,now)
  const ageDays=freshness.ageDays
  const danger=String(quote.dividend_status||'').toLowerCase()==='danger'
  const stale=freshness.stale
  const issues:string[]=[]
  if(freshness.futureDated)issues.push('資料日期晚於目前日期，可能是同步時鐘或來源時間有誤')
  else if(ageDays==null)issues.push('缺少配息資料更新時間')
  else if(stale)issues.push(`配息快照已 ${Math.floor(ageDays)} 天未更新`)
  if(danger)issues.push('資料列本身標為警示／需人工核對')
  const usable=issues.length===0
  const reason=usable?'配息快照在 7 天內，仍須核對公司或基金官方公告。':`${issues.join('；')}。系統不會自動帶入，請查閱官方公告後在下方手動輸入。`
  return {usable,ageDays,reason,issues}
}

export function marketSourceLabel(source:string|null|undefined){
  const key=String(source||'').trim()
  if(!key)return '資料庫來源未標示'
  if(key==='smart_sync_yfinance')return 'Yahoo Finance 歷史資料同步（資料庫快照）'
  if(key==='smart_sync_no_dividend')return 'Yahoo Finance 同步，未取得近兩年現金股利'
  if(key==='manual_payment_months_verified')return '人工核對配息月份'
  if(key==='manual_yield_override')return '人工輸入殖利率'
  if(key==='manual')return '人工維護'
  if(key.includes('TWSE'))return '臺灣證券交易所公開資料快照'
  if(key.includes('TPEx'))return '證券櫃檯買賣中心公開資料快照'
  return key
}

export async function loadMarketQuotes(tickers: string[]): Promise<MarketQuote[]> {
  if (!tickers.length) return []
  const { data, error } = await requireSupabase().from('etf_prices')
    .select('ticker,name,price,yield,dividend_months,dividend_status,dividend_change_pct,warning_message,data_source,last_updated_at')
    .in('ticker', [...new Set(tickers.flatMap(tickerCandidates))])
  if (error) throw new Error('市場資料暫時無法讀取，請稍後重試。')
  return (data ?? []) as MarketQuote[]
}

export async function lookupMarketQuote(input: string): Promise<MarketQuote> {
  const ticker = cleanTicker(input)
  if (!/^\d{4,6}[A-Z]?$/.test(tickerCode(ticker))) throw new Error('請輸入有效的股票／ETF 代號，例如 0050、2330 或 00981A。')
  const quotes = await loadMarketQuotes([ticker])
  const quote = quotes.find((row) => cleanTicker(row.ticker) === ticker)
    ?? quotes.find((row) => sameTicker(row.ticker, ticker))
  if (!quote || !Number.isFinite(Number(quote.price)) || Number(quote.price) <= 0) {
    throw new Error(`${tickerCode(ticker)} 尚無可用行情，請核對代號或稍後重試。`)
  }
  if (quote.name?.trim()) return quote
  const { data, error } = await requireSupabase().from('stock_mapping')
    .select('ticker,name').in('ticker', tickerCandidates(ticker)).limit(4)
  if (error) throw new Error('標的名稱暫時無法讀取，請稍後重試。')
  const mapping = data?.find((row) => sameTicker(row.ticker, ticker))
  return { ...quote, name: mapping?.name || tickerCode(ticker) }
}

export type LivePrice={symbol:string;price:number;currency:string;market_time:string;source:string}
export function latestPrice(reports:{market_snapshots?:LivePrice[]}[],target:string):LivePrice|null{
  return reports.flatMap(r=>r.market_snapshots??[]).filter(q=>tickerCode(q.symbol)===tickerCode(target)&&q.currency==="TWD"&&Number.isFinite(q.price)&&q.price>0&&Number.isFinite(Date.parse(q.market_time))).sort((a,b)=>Date.parse(b.market_time)-Date.parse(a.market_time))[0]??null
}

export function bestAvailablePrice(live:LivePrice|null,quote:MarketQuote|null,now=new Date()){
  const primary:PriceCandidate|null=live?{price:live.price,asOf:live.market_time,source:live.source,tier:'主要行情'}:null
  const quotePrice=Number(quote?.price)
  const fallback:PriceCandidate|null=quote&&Number.isFinite(quotePrice)&&quotePrice>0?{price:quotePrice,asOf:quote.last_updated_at,source:quote.data_source||'etf_prices 最近快照',tier:'備援快照'}:null
  return resolveMarketPrice({primary,fallback,now})
}

