import { calculateRetirementMetrics, type PortfolioHolding } from './lib/metrics'
import { requireSupabase } from './lib/supabase'
import { cleanTicker, sameTicker, tickerCandidates, tickerCode } from './lib/ticker'
import type {
  DividendItem,
  MarketQuote,
  Portfolio,
  RetirementGoal,
  RetirementGps,
  UserAsset,
  UserProfile,
} from './types'

const asNumber = (value: unknown) => Number(value ?? 0) || 0

function tickersFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(String).map((value) => value.trim()).filter(Boolean)
}

function sharesFrom(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).map(([ticker, shares]) => [ticker, Math.max(asNumber(shares), 0)]),
  )
}

function monthsFrom(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(Number).filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))]
}

export type RetirementOverview = Awaited<ReturnType<typeof loadRetirementOverview>>

export async function loadRetirementOverview(userId: string) {
  const client = requireSupabase()
  const [profileResult, portfolioResult, assetsResult, goalResult, gpsResult, dividendsResult] =
    await Promise.all([
      client
        .from('user_profiles')
        .select('current_age,monthly_expense,monthly_contribution')
        .eq('id', userId)
        .maybeSingle(),
      client
        .from('user_portfolios')
        .select('id,user_id,selected_tickers,shares_map')
        .eq('user_id', userId)
        .maybeSingle(),
      client
        .from('user_assets')
        .select(
          'id,asset_type,asset_name,asset_code,current_value,annual_yield,dividend_months,is_income_asset,data_date,import_source',
        )
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('current_value', { ascending: false }),
      client
        .from('retirement_goals')
        .select('id,target_amount,current_assets,monthly_expense,target_age,target_year,is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from('retirement_gps')
        .select('progress_pct,success_probability,gps_status,gps_message,snapshot_date')
        .eq('user_id', userId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from('dividend_calendar')
        .select(
          'id,ticker,dividend_year,dividend_month,expected_amount,expected_payment_date,actual_amount,actual_payment_date,status',
        )
        .eq('user_id', userId)
        .order('expected_payment_date', { ascending: true, nullsFirst: false })
        .limit(250),
    ])

  const firstError = [
    profileResult.error,
    portfolioResult.error,
    assetsResult.error,
    goalResult.error,
    gpsResult.error,
    dividendsResult.error,
  ].find(Boolean)
  if (firstError) throw firstError

  const profile = profileResult.data as UserProfile | null
  const portfolio = portfolioResult.data as Portfolio | null
  const assets = (assetsResult.data ?? []) as UserAsset[]
  const goal = goalResult.data as RetirementGoal | null
  const gps = gpsResult.data as RetirementGps | null
  const dividends = (dividendsResult.data ?? []) as DividendItem[]
  const selectedTickers = tickersFrom(portfolio?.selected_tickers)
  const sharesMap = sharesFrom(portfolio?.shares_map)

  let quotes: MarketQuote[] = []
  if (selectedTickers.length) {
    const quoteCandidates = [...new Set(selectedTickers.flatMap(tickerCandidates))]
    const quoteResult = await client
      .from('etf_prices')
      .select('ticker,name,price,yield,dividend_months,dividend_status,data_source,last_updated_at')
      .in('ticker', quoteCandidates)
    if (quoteResult.error) throw quoteResult.error
    quotes = (quoteResult.data ?? []) as MarketQuote[]
  }

  const quoteMap = new Map(quotes.map((quote) => [quote.ticker, quote]))
  const quoteCodeMap = new Map(quotes.map((quote) => [tickerCode(quote.ticker), quote]))
  const holdings: PortfolioHolding[] = selectedTickers.map((ticker) => {
    const quote = quoteMap.get(cleanTicker(ticker)) ?? quoteCodeMap.get(tickerCode(ticker))
    return {
      ticker,
      name: quote?.name || ticker,
      shares: sharesMap[ticker] ?? 0,
      price: asNumber(quote?.price),
      annualYield: asNumber(quote?.yield),
      dividendMonths: monthsFrom(quote?.dividend_months),
    }
  })

  const monthlyExpense = asNumber(goal?.monthly_expense ?? profile?.monthly_expense)
  const targetAmount = asNumber(goal?.target_amount)
  const metrics = calculateRetirementMetrics(
    holdings,
    assets.map((asset) => ({
      currentValue: asNumber(asset.current_value),
      annualYield: asset.is_income_asset ? asNumber(asset.annual_yield) : 0,
    })),
    targetAmount,
    monthlyExpense,
  )

  return {
    profile,
    portfolio,
    assets,
    goal,
    gps,
    dividends,
    holdings,
    quotes,
    metrics,
    targetAmount,
    monthlyExpense,
  }
}

export async function saveHolding(
  userId: string,
  portfolio: Portfolio | null,
  tickerInput: string,
  shares: number,
) {
  const client = requireSupabase()
  const rawTicker = cleanTicker(tickerInput)
  if (!rawTicker || shares < 0) throw new Error('請輸入有效的股票代號與張數。')

  const lookupResult = await client
    .from('stock_mapping')
    .select('ticker,name')
    .in('ticker', tickerCandidates(rawTicker))
    .limit(4)
  if (lookupResult.error) throw lookupResult.error

  const marketRows = (lookupResult.data ?? []) as Array<{ ticker: string; name: string }>
  const lookup = marketRows.find((row) => cleanTicker(row.ticker) === rawTicker)
    ?? marketRows.find((row) => sameTicker(row.ticker, rawTicker))
  const ticker = lookup?.ticker ? cleanTicker(lookup.ticker) : rawTicker

  // 市場主檔缺少標的時仍保存會員自己的投資組合；絕不由前端寫入共用市場表。
  const selected = new Set(
    tickersFrom(portfolio?.selected_tickers).filter((item) => !sameTicker(item, ticker)),
  )
  selected.add(ticker)
  const sharesMap = sharesFrom(portfolio?.shares_map)
  Object.keys(sharesMap).filter((item) => sameTicker(item, ticker)).forEach((item) => delete sharesMap[item])
  sharesMap[ticker] = shares

  const result = await client.from('user_portfolios').upsert(
    {
      user_id: userId,
      selected_tickers: [...selected],
      shares_map: sharesMap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (result.error) throw result.error

  return { foundInMarketMaster: Boolean(lookup), marketName: lookup?.name }
}

export async function removeHolding(userId: string, portfolio: Portfolio, ticker: string) {
  const client = requireSupabase()
  const selected = tickersFrom(portfolio.selected_tickers).filter((item) => !sameTicker(item, ticker))
  const sharesMap = sharesFrom(portfolio.shares_map)
  Object.keys(sharesMap).filter((item) => sameTicker(item, ticker)).forEach((item) => delete sharesMap[item])
  const result = await client
    .from('user_portfolios')
    .update({ selected_tickers: selected, shares_map: sharesMap, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (result.error) throw result.error
}

