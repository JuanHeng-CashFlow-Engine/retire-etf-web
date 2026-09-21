import type { RetirementOverview, RetirementGoalInput } from './data'
import { fixedIncomeForMonth, monthKey } from './lib/fixedIncome'
import { calculateRetirementMetrics } from './lib/metrics'
import { sameTicker, tickerCode } from './lib/ticker'
import type { DividendItem, FixedIncome, MarketQuote, UserAsset } from './types'

export type GuestDraft = {
  assets: UserAsset[]
  incomes: FixedIncome[]
  dividends: DividendItem[]
  goal: RetirementGoalInput | null
}

export type GuestDraftUpdate = (next: GuestDraft | ((current: GuestDraft) => GuestDraft)) => void

export function upsertGuestHolding(draft: GuestDraft, quote: MarketQuote, lots: number, editId?: string): GuestDraft {
  if (!Number.isFinite(lots) || lots <= 0 || !Number.isFinite(Number(quote.price)) || Number(quote.price) <= 0) {
    throw new Error('請核對持有張數與市場價格。')
  }
  const isMarket = (asset: UserAsset) => ['stock', 'etf'].includes(asset.asset_type)
  const existing = draft.assets.find((asset) => isMarket(asset) && sameTicker(asset.asset_code, quote.ticker))
  const editing = draft.assets.find((asset) => asset.id === editId)
  const previous = existing ?? (editing && sameTicker(editing.asset_code, quote.ticker) ? editing : undefined)
  const yieldRate = Number(quote.yield)
  const asset: UserAsset = {
    ...previous,
    id: existing?.id ?? editId ?? crypto.randomUUID(),
    asset_type: previous?.asset_type ?? (tickerCode(quote.ticker).startsWith('00') ? 'etf' : 'stock'),
    asset_name: quote.name || tickerCode(quote.ticker), asset_code: tickerCode(quote.ticker),
    current_value: lots * 1000 * Number(quote.price), quantity: lots, quantity_unit: '張', unit_price: Number(quote.price),
    annual_yield: Number.isFinite(yieldRate) && yieldRate >= 0 ? yieldRate : 0,
    dividend_months: Array.isArray(quote.dividend_months) ? quote.dividend_months : [],
    is_income_asset: Number.isFinite(yieldRate) && yieldRate > 0, market_quote: quote,
  }
  return { ...draft, assets: [...draft.assets.filter((item) => item.id !== editId &&
    !(isMarket(item) && sameTicker(item.asset_code, quote.ticker))), asset] }
}

const storageKey = 'juanheng-free-checkup-v1'
export const emptyGuestDraft = (): GuestDraft => ({ assets: [], incomes: [], dividends: [], goal: null })

export function readGuestDraft(): GuestDraft {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Partial<GuestDraft> | null
    return saved && Array.isArray(saved.assets) && Array.isArray(saved.incomes) && Array.isArray(saved.dividends)
      ? { assets: saved.assets, incomes: saved.incomes, dividends: saved.dividends, goal: saved.goal ?? null }
      : emptyGuestDraft()
  } catch { return emptyGuestDraft() }
}

export function writeGuestDraft(draft: GuestDraft) {
  try { sessionStorage.setItem(storageKey, JSON.stringify(draft)) } catch { /* Private browsing can disable storage. */ }
}

export function buildGuestOverview(draft: GuestDraft): RetirementOverview {
  const targetAmount = Math.max(0, Number(draft.goal?.targetAmount) || 0)
  const monthlyExpense = Math.max(0, Number(draft.goal?.monthlyExpense) || 0)
  const assets = draft.assets.filter((asset) => Number(asset.current_value) >= 0)
  const investmentMetrics = calculateRetirementMetrics([], assets.map((asset) => ({
    currentValue: Number(asset.current_value) || 0,
    annualYield: asset.is_income_asset ? Number(asset.annual_yield) || 0 : 0,
  })), targetAmount, monthlyExpense)
  const fixedMonthlyIncome = fixedIncomeForMonth(draft.incomes, monthKey(new Date()))
  const monthlyIncome = investmentMetrics.monthlyIncome + fixedMonthlyIncome
  const goal = draft.goal ? {
    id: 'guest-goal', target_amount: targetAmount, current_assets: investmentMetrics.totalAssets,
    monthly_expense: monthlyExpense, target_age: draft.goal.targetAge,
    target_year: new Date().getFullYear() + draft.goal.targetAge - draft.goal.currentAge,
    expected_return: draft.goal.expectedReturn, expected_yield: draft.goal.expectedYield,
    inflation_rate: draft.goal.inflationRate, retirement_years: draft.goal.retirementYears, is_active: true,
  } : null
  return {
    profile: draft.goal ? {
      current_age: draft.goal.currentAge, monthly_expense: monthlyExpense,
      monthly_contribution: draft.goal.monthlyContribution,
    } : null,
    portfolio: null, assets, goal, gps: null, gpsHistory: [], dividends: draft.dividends, aiStress: null,
    fixedIncomes: draft.incomes, fixedIncomeSetupRequired: false, fixedMonthlyIncome,
    monthlyReports: [], snapshotsV3: [], snapshotSetupRequired: false, memberAlerts: [],
    cashflowAlerts: [], subscription: null, holdings: [], quotes: assets.flatMap((asset) => asset.market_quote ? [asset.market_quote] : []),
    metrics: { ...investmentMetrics, monthlyIncome, monthlyGap: monthlyIncome - monthlyExpense,
      coveragePct: monthlyExpense > 0 ? monthlyIncome / monthlyExpense * 100 : 0 },
    targetAmount, monthlyExpense,
  }
}
