export type ClaimsIdentity = {
  id: string
  email: string
}

export type UserProfile = {
  current_age: number | null
  monthly_expense: number | string
  monthly_contribution: number | string
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
  data_source: string | null
  last_updated_at: string | null
}

export type UserAsset = {
  id: string
  asset_type: string
  asset_name: string
  asset_code: string
  current_value: number | string
  annual_yield: number | string
  dividend_months: unknown
  is_income_asset: boolean
  data_date: string
  import_source: string
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
  progress_pct: number | string
  success_probability: number | string | null
  gps_status: string
  gps_message: string
  snapshot_date: string
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



export type AiStressSnapshot = {
  id: string
  generated_at: string
  scenario_label: string
  stress_loss_pct: number | string
  assets_before: number | string
  assets_after: number | string
  dividend_drop_pct: number | string
  monthly_investment_income_before: number | string
  monthly_investment_income_after: number | string
  monthly_fixed_income: number | string
  monthly_expense: number | string
  monthly_income_after: number | string
  monthly_gap_after: number | string
  source: string
  analysis: unknown
}
