import { calculateRetirementMetrics, type PortfolioHolding } from './lib/metrics'
import { fixedIncomeForMonth, monthKey } from './lib/fixedIncome'
import { requireSupabase } from './lib/supabase'
import { cleanTicker, sameTicker, tickerCandidates, tickerCode } from './lib/ticker'
import { loadMarketQuotes } from './marketData'
import type {
  DividendItem,
  FixedIncome,
  MonthlyReport,
  RetirementSnapshotPayload,
  RetirementSnapshotV3,
  MemberAlert,
  CashflowAlert,
  Subscription,
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
  const [profileResult, portfolioResult, assetsResult, goalResult, gpsResult, dividendsResult,
    fixedResult, reportsResult, snapshotsResult, memberAlertsResult, cashflowAlertsResult, subscriptionResult, aiStressResult] =
    await Promise.all([
      client
        .from('user_profiles')
        .select('current_age,monthly_expense,monthly_contribution,trial_started_at,trial_ends_at')
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
          'id,asset_type,asset_name,asset_code,provider,current_value,monthly_contribution,expected_return,annual_yield,dividend_months,is_income_asset,notes',
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
        .select('id,current_assets,annual_dividend,monthly_cashflow,monthly_expense,progress_pct,success_probability,gps_status,gps_message,snapshot_date')
        .eq('user_id', userId)
        .order('snapshot_date', { ascending: false })
        .limit(24),
      client
        .from('dividend_calendar')
        .select(
          'id,ticker,dividend_year,dividend_month,expected_amount,expected_payment_date,actual_amount,actual_payment_date,status',
        )
        .eq('user_id', userId)
        .order('expected_payment_date', { ascending: true, nullsFirst: false })
        .limit(250),
      client.from('retirement_fixed_incomes').select('id,name,category,monthly_amount,start_month,end_month').eq('user_id', userId).eq('is_active', true).order('start_month'),
      client.from('retirement_monthly_reports').select('id,report_month,health_score,total_assets,target_assets,progress_pct,annual_dividend,monthly_expense,coverage_pct,monte_carlo_success_pct,alerts,recommendations,created_at').eq('user_id', userId).order('report_month', { ascending: false }).limit(24),
      client.from('retirement_snapshots_v3').select('id,snapshot_month,as_of,payload,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(24),
      client.from('user_alerts').select('id,alert_type,severity,title,message,related_amount,is_read,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(40),
      client.from('cashflow_alerts').select('id,alert_year,alert_month,expected_income,monthly_expense,cashflow_gap,coverage_pct,severity,message,is_read,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(40),
      client.from('subscriptions').select('status,trial_end_at,current_period_end,provider').eq('user_id', userId).limit(1).maybeSingle(),
      client
        .from('retirement_ai_stress_snapshots')
        .select(
          'id,generated_at,scenario_label,stress_loss_pct,assets_before,assets_after,dividend_drop_pct,monthly_investment_income_before,monthly_investment_income_after,monthly_fixed_income,monthly_expense,monthly_income_after,monthly_gap_after,future_fixed_income_start,monthly_fixed_income_future,monthly_income_future_after,monthly_gap_future_after,fixed_income_duplicate_detected,fixed_income_warnings,source,analysis',
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
    reportsResult.error,
    memberAlertsResult.error,
    cashflowAlertsResult.error,
    subscriptionResult.error,
    aiStressResult.error,
  ].find(Boolean)
  if (firstError) throw firstError

  const fixedIncomeSetupRequired = Boolean(fixedResult.error &&
    ['42P01', 'PGRST205', 'PGRST116'].includes(fixedResult.error.code))
  if (fixedResult.error && !fixedIncomeSetupRequired) throw fixedResult.error
  const snapshotSetupRequired = Boolean(snapshotsResult.error &&
    ['42P01', 'PGRST205', 'PGRST116'].includes(snapshotsResult.error.code))
  if (snapshotsResult.error && !snapshotSetupRequired) throw snapshotsResult.error

  const profile = profileResult.data as UserProfile | null
  const portfolio = portfolioResult.data as Portfolio | null
  const assets = (assetsResult.data ?? []) as UserAsset[]
  const goal = goalResult.data as RetirementGoal | null
  const gpsHistory = (gpsResult.data ?? []) as RetirementGps[]
  const gps: RetirementGps | null = gpsHistory[0] ?? null
  const dividends = (dividendsResult.data ?? []) as DividendItem[]
  const fixedIncomes = (fixedResult.data ?? []) as FixedIncome[]
  const monthlyReports = (reportsResult.data ?? []) as MonthlyReport[]
  const snapshotsV3 = (snapshotsResult.data ?? []) as RetirementSnapshotV3[]
  const memberAlerts = (memberAlertsResult.data ?? []) as MemberAlert[]
  const cashflowAlerts = (cashflowAlertsResult.data ?? []) as CashflowAlert[]
  const subscription = subscriptionResult.data as Subscription | null
  const aiStress = aiStressResult.data as AiStressSnapshot | null
  const sharesMap = sharesFrom(portfolio?.shares_map)
  const selectedByCode = new Map<string, string>()
  for (const ticker of tickersFrom(portfolio?.selected_tickers)) {
    const code = tickerCode(ticker)
    const previous = selectedByCode.get(code)
    if (!previous || (sharesMap[ticker] ?? 0) > (sharesMap[previous] ?? 0)) selectedByCode.set(code, ticker)
  }
  const selectedTickers = [...selectedByCode.values()]

  const quotes = await loadMarketQuotes(selectedTickers)

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
  const investmentMetrics = calculateRetirementMetrics(
    holdings,
    assets.map((asset) => ({
      currentValue: asNumber(asset.current_value),
      annualYield: asset.is_income_asset ? asNumber(asset.annual_yield) : 0,
    })),
    targetAmount,
    monthlyExpense,
  )
  const fixedMonthlyIncome = fixedIncomeForMonth(fixedIncomes, monthKey(new Date()))
  const monthlyIncome = investmentMetrics.monthlyIncome + fixedMonthlyIncome
  const metrics = {
    ...investmentMetrics,
    monthlyIncome,
    monthlyGap: monthlyIncome - monthlyExpense,
    coveragePct: monthlyExpense > 0 ? monthlyIncome / monthlyExpense * 100 : 0,
  }

  return {
    profile,
    portfolio,
    assets,
    goal,
    gps: gps as RetirementGps | null,
    gpsHistory,
    dividends,
    fixedIncomes,
    fixedIncomeSetupRequired,
    fixedMonthlyIncome,
    monthlyReports,
    snapshotsV3,
    snapshotSetupRequired,
    memberAlerts,
    cashflowAlerts,
    subscription,
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
  monthlyContribution: number
  expectedReturn: number
  expectedYield: number
  inflationRate: number
  retirementYears: number
}

export async function saveRetirementGoal(userId: string, existing: RetirementGoal | null, input: RetirementGoalInput) {
  const numericFields = [input.targetAmount, input.monthlyExpense, input.monthlyContribution, input.expectedReturn, input.expectedYield, input.inflationRate]
  if (numericFields.some((value) => !Number.isFinite(value))) throw new Error('請輸入有效數字。')
  if (!Number.isInteger(input.currentAge) || input.currentAge < 1 || input.currentAge > 100 ||
      !Number.isInteger(input.targetAge) || input.targetAge < input.currentAge || input.targetAge > 100) {
    throw new Error('目標退休年齡須介於目前年齡與 100 歲之間。')
  }
  if (!Number.isInteger(input.retirementYears) || input.retirementYears < 1 || input.retirementYears > 80 ||
      input.targetAmount <= 0 || input.monthlyExpense <= 0 ||
      input.monthlyContribution < 0 ||
      input.expectedReturn < 0 || input.expectedReturn > 15 || input.expectedYield < 0 || input.expectedYield > 15 ||
      input.inflationRate < 0 || input.inflationRate > 8) {
    throw new Error('請檢查目標、生活費及模擬假設的範圍。')
  }

  const client = requireSupabase()
  const profileResult = await client.from('user_profiles').update({ current_age: input.currentAge, monthly_contribution: input.monthlyContribution }).eq('id', userId).select('id').single()
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

export async function saveUserAsset(userId: string, input: { id?: string; name: string; code?: string; type: string; value: number; annualYield: number; dividendMonths: number[]; monthlyContribution?: number; expectedReturn?: number; provider?: string; notes?: string }) {
  const name = input.name.trim()
  if (!name || !['cash', 'fund', 'bond', 'insurance', 'other'].includes(input.type) ||
      !Number.isFinite(input.value) || input.value < 0 ||
      !Number.isFinite(input.annualYield) || input.annualYield < 0 || input.annualYield > 30 ||
      !Number.isFinite(input.monthlyContribution ?? 0) || (input.monthlyContribution ?? 0) < 0 ||
      !Number.isFinite(input.expectedReturn ?? 0) || (input.expectedReturn ?? 0) < -20 || (input.expectedReturn ?? 0) > 30 ||
      input.dividendMonths.some((month) => !Number.isInteger(month) || month < 1 || month > 12)) {
    throw new Error('請輸入有效的資產名稱、金額、投入與收益率。')
  }
  const values = {
    asset_type: input.type,
    asset_name: name,
    asset_code: input.code?.trim() ?? '',
    provider: input.provider?.trim() ?? '',
    current_value: input.value,
    monthly_contribution: input.monthlyContribution ?? 0,
    expected_return: input.expectedReturn ?? 0,
    annual_yield: input.annualYield,
    dividend_months: [...new Set(input.dividendMonths)],
    is_income_asset: input.annualYield > 0,
    notes: input.notes?.trim() ?? '',
    is_active: true,
  }
  const client = requireSupabase()
  const result = input.id
    ? await client.from('user_assets').update(values).eq('id', input.id).eq('user_id', userId).select('id').single()
    : await client.from('user_assets').insert({ ...values, user_id: userId }).select('id').single()
  if (result.error) throw result.error
}

export async function removeUserAsset(userId: string, id: string) {
  const result = await requireSupabase().from('user_assets').update({ is_active: false }).eq('id', id).eq('user_id', userId).select('id').single()
  if (result.error) throw result.error
}

export async function saveFixedIncome(userId: string, input: { id?: string; name: string; category: FixedIncome['category']; monthlyAmount: number; startMonth: string; endMonth: string | null }) {
  const name = input.name.trim()
  if (!name || !Number.isFinite(input.monthlyAmount) || input.monthlyAmount < 0 ||
    !/^\d{4}-\d{2}$/.test(input.startMonth) ||
    (input.endMonth != null && (!/^\d{4}-\d{2}$/.test(input.endMonth) || input.endMonth < input.startMonth))) {
    throw new Error('請檢查固定收入名稱、金額與起迄月份。')
  }
  const values = {
    name,
    category: input.category,
    monthly_amount: input.monthlyAmount,
    start_month: `${input.startMonth}-01`,
    end_month: input.endMonth ? `${input.endMonth}-01` : null,
    is_active: true,
    updated_at: new Date().toISOString(),
  }
  const client = requireSupabase()
  const result = input.id
    ? await client.from('retirement_fixed_incomes').update(values).eq('id', input.id).eq('user_id', userId).select('id').single()
    : await client.from('retirement_fixed_incomes').insert({ ...values, user_id: userId }).select('id').single()
  if (result.error) throw result.error
}

export async function removeFixedIncome(userId: string, id: string) {
  const result = await requireSupabase().from('retirement_fixed_incomes').update({ is_active: false }).eq('id', id).eq('user_id', userId).select('id').single()
  if (result.error) throw result.error
}

export async function saveDividendCalendarEvent(userId: string, input: {
  id?: string
  ticker: string
  monthKey: string
  expectedAmount: number
  expectedDate: string | null
  actualAmount: number | null
  actualDate: string | null
  status: 'expected' | 'announced' | 'recorded'
}) {
  if (!input.ticker.trim() || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.monthKey) ||
    !Number.isFinite(input.expectedAmount) || input.expectedAmount < 0 ||
    (input.actualAmount != null && (!Number.isFinite(input.actualAmount) || input.actualAmount < 0)) ||
    (input.status === 'recorded' && (input.actualAmount == null || !input.actualDate))) {
    throw new Error('請核對配息標的、月份、金額與入帳日期。')
  }
  const values = {
    ticker: input.ticker.trim().toUpperCase(),
    dividend_year: Number(input.monthKey.slice(0, 4)),
    dividend_month: Number(input.monthKey.slice(5, 7)),
    expected_amount: input.expectedAmount,
    expected_payment_date: input.expectedDate,
    actual_amount: input.actualAmount,
    actual_payment_date: input.actualDate,
    status: input.status,
  }
  const client = requireSupabase()
  const result = input.id
    ? await client.from('dividend_calendar').update(values).eq('id', input.id).eq('user_id', userId).select('id').single()
    : await client.from('dividend_calendar').insert({ ...values, user_id: userId }).select('id').single()
  if (result.error) throw result.error
}

export async function markAlertRead(userId: string, table: 'user_alerts' | 'cashflow_alerts', id: string) {
  const result = await requireSupabase().from(table).update({ is_read: true }).eq('id', id).eq('user_id', userId).select('id').single()
  if (result.error) throw result.error
}

export async function saveRetirementSnapshot(userId: string, payload: RetirementSnapshotPayload) {
  if (payload.schema_version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(payload.as_of)) {
    throw new Error('快照日期或版本不正確。')
  }
  const result = await requireSupabase().from('retirement_snapshots_v3').insert({
    user_id: userId,
    snapshot_month: `${payload.as_of.slice(0, 7)}-01`,
    as_of: payload.as_of,
    payload,
  }).select('id').single()
  if (result.error) throw result.error
}
