import { requireSupabase } from './lib/supabase'
import { cleanTicker, sameTicker, tickerCandidates, tickerCode } from './lib/ticker'
import type { MarketQuote } from './types'

export function marketQuoteReview(quote:MarketQuote,now=new Date()){
  const updated=quote.last_updated_at?new Date(quote.last_updated_at):null
  const ageDays=updated&&Number.isFinite(updated.getTime())?Math.max(0,(now.getTime()-updated.getTime())/86400000):null
  const danger=String(quote.dividend_status||'').toLowerCase()==='danger'
  const stale=ageDays==null||ageDays>7
  const usable=!danger&&!stale
  const reason=danger?'資料狀態為警示，請查閱官方公告後手動輸入。':ageDays==null?'缺少更新時間，請查閱官方來源後手動輸入。':stale?`資料已 ${Math.floor(ageDays)} 天未更新，請查閱最新行情及配息後手動輸入。`:'資料日期在 7 天內，仍請核對來源。'
  return {usable,ageDays,reason}
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

