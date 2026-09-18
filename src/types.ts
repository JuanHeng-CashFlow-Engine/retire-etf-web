export type ClaimsIdentity = {
  id: string
  email: string
}

export type UserProfile = {
  current_age: number | null
  monthly_expense: number | string
  monthly_contribution: number | string
  trial_started_at?: string | null
  trial_ends_at?: string | null
}

export type Portfolio = {
  id: string
  user_id: string
  selected_tickers: unknown
  shares_map: unknown
}

export type MarketQuote = {
  ticker: string
  name: string
  price: number | string | null
  yield: number | string | null
  dividend_months: unknown
  dividend_status: string | null
  dividend_change_pct?: number | string | null
  warning_message?: string | null
  data_source: string | null
  last_updated_at: string | null
}

export type UserAsset = {
  id: string
  asset_type: string
  asset_name: string
  asset_code: string
  provider?: string | null
  current_value: number | string
  monthly_contribution?: number | string
  expected_return?: number | string
  annual_yield: number | string
  dividend_months: unknown
  is_income_asset: boolean
  notes?: string | null
}

export type RetirementGoal = {
  id: string
  target_amount: number | string
  current_assets: number | string
  monthly_expense: number | string
  target_age: number | null
  target_year: number | null
  expected_return: number | string
  expected_yield: number | string
  inflation_rate: number | string
  retirement_years: number | null
  is_active: boolean
}

export type RetirementGps = {
  id?: string
  current_assets?: number | string
  annual_dividend?: number | string
  monthly_cashflow?: number | string
  monthly_expense?: number | string
  progress_pct: number | string
  success_probability: number | string | null
  gps_status: string
  gps_message: string
  snapshot_date: string
}

export type FixedIncome = {
  id: string
  name: string
  category: 'labor_insurance' | 'labor_pension' | 'annuity' | 'rent' | 'other'
  monthly_amount: number | string
  start_month: string
  end_month: string | null
}

export type MonthlyReport = {
  id: string
  report_month: string
  health_score: number
  total_assets: number | string
  target_assets: number | string
  progress_pct: number | string
  annual_dividend: number | string
  monthly_expense: number | string
  coverage_pct: number | string
  monte_carlo_success_pct: number | string | null
  alerts: unknown
  recommendations: unknown
  created_at: string
}

export type MemberAlert = {
  id: string
  alert_type: string
  severity: string
  title: string | null
  message: string | null
  related_amount: number | string | null
  is_read: boolean
  created_at: string
}

export type CashflowAlert = {
  id: string
  alert_year: number
  alert_month: number
  expected_income: number | string
  monthly_expense: number | string
  cashflow_gap: number | string
  coverage_pct: number | string
  severity: string
  message: string | null
  is_read: boolean
  created_at: string
}

export type Subscription = {
  status: string
  trial_end_at: string | null
  current_period_end: string | null
  provider: string | null
}

export type DividendItem = {
  id: string
  ticker: string
  dividend_year: number
  dividend_month: number
  expected_amount: number | string
  expected_payment_date: string | null
  actual_amount: number | string | null
  actual_payment_date: string | null
  status: string
}

