import { requireSupabase } from './lib/supabase'
import { cleanTicker, sameTicker, tickerCandidates, tickerCode } from './lib/ticker'
import type { MarketQuote } from './types'

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
