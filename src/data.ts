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
  AiStressSnapshot,
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
  const [profileResult, portfolioResult, assetsResult, goalResult, gpsResult, dividendsResult, aiStressResult] =
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
        .select('id,target_amount,current_assets,monthly_expense,target_age,target_year,expected_return,expected_yield,inflation_rate,retirement_years,is_active')
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
      client
        .from('retirement_ai_stress_snapshots')
        .select(
          'id,generated_at,scenario_label,stress_loss_pct,assets_before,assets_after,dividend_drop_pct,monthly_investment_income_before,monthly_investment_income_after,monthly_fixed_income,monthly_expense,monthly_income_after,monthly_gap_after,source,analysis',
        )
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const firstError = [
    profileResult.error,
    portfolioResult.error,
    assetsResult.error,
    goalResult.error,
    gpsResult.error,
    dividendsResult.error,
    aiStressResult.error,
  ].find(Boolean)
  if (firstError) throw firstError

  const profile = profileResult.data as UserProfile | null
  const portfolio = portfolioResult.data as Portfolio | null
  const assets = (assetsResult.data ?? []) as UserAsset[]
  const goal = goalResult.data as RetirementGoal | null
  const gps = gpsResult.data as RetirementGps | null
  const dividends = (dividendsResult.data ?? []) as DividendItem[]
  const aiStress = aiStressResult.data as AiStressSnapshot | null
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
    aiStress,
    holdings,
    quotes,
    metrics,
    targetAmount,
    monthlyExpense,
  }
}

export type RetirementGoalInput = {
  currentAge: number
  targetAge: number
  targetAmount: number
  monthlyExpense: number
  expectedReturn: number
  expectedYield: number
  inflationRate: number
  retirementYears: number
}

export async function saveRetirementGoal(userId: string, existing: RetirementGoal | null, input: RetirementGoalInput) {
  const numericFields = [input.targetAmount, input.monthlyExpense, input.expectedReturn, input.expectedYield, input.inflationRate]
  if (numericFields.some((value) => !Number.isFinite(value))) throw new Error('請輸入有效數字。')
  if (!Number.isInteger(input.currentAge) || input.currentAge < 1 || input.currentAge > 100 ||
      !Number.isInteger(input.targetAge) || input.targetAge < input.currentAge || input.targetAge > 100) {
    throw new Error('目標退休年齡須介於目前年齡與 100 歲之間。')
  }
  if (!Number.isInteger(input.retirementYears) || input.retirementYears < 1 || input.retirementYears > 80 ||
      input.targetAmount <= 0 || input.monthlyExpense <= 0 ||
      input.expectedReturn < 0 || input.expectedReturn > 15 || input.expectedYield < 0 || input.expectedYield > 15 ||
      input.inflationRate < 0 || input.inflationRate > 8) {
    throw new Error('請檢查目標、生活費及模擬假設的範圍。')
  }

  const client = requireSupabase()
  const profileResult = await client.from('user_profiles').update({ current_age: input.currentAge }).eq('id', userId).select('id').single()
  if (profileResult.error) throw profileResult.error

  const values = {
    target_amount: input.targetAmount,
    monthly_expense: input.monthlyExpense,
    annual_expense: input.monthlyExpense * 12,
    target_age: input.targetAge,
    target_year: new Date().getFullYear() + input.targetAge - input.currentAge,
    expected_return: input.expectedReturn,
    expected_yield: input.expectedYield,
    inflation_rate: input.inflationRate,
    retirement_years: input.retirementYears,
  }
  const result = existing
    ? await client.from('retirement_goals').update(values).eq('id', existing.id).eq('user_id', userId).select('id').single()
    : await client.from('retirement_goals').insert({ ...values, user_id: userId, goal_name: '我的退休目標', is_active: true }).select('id').single()
  if (result.error) throw result.error
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

