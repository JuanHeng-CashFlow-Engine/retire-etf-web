import type { RetirementOverview, RetirementGoalInput } from './data'
import { fixedIncomeForMonth, monthKey } from './lib/fixedIncome'
import { calculateRetirementMetrics } from './lib/metrics'
import type { DividendItem, FixedIncome, UserAsset } from './types'

export type GuestDraft = {
  assets: UserAsset[]
  incomes: FixedIncome[]
  dividends: DividendItem[]
  goal: RetirementGoalInput | null
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
    portfolio: null, assets, goal, gps: null, gpsHistory: [], dividends: draft.dividends,
    fixedIncomes: draft.incomes, fixedIncomeSetupRequired: false, fixedMonthlyIncome,
    monthlyReports: [], snapshotsV3: [], snapshotSetupRequired: false, memberAlerts: [],
    cashflowAlerts: [], subscription: null, holdings: [], quotes: [],
    metrics: { ...investmentMetrics, monthlyIncome, monthlyGap: monthlyIncome - monthlyExpense,
      coveragePct: monthlyExpense > 0 ? monthlyIncome / monthlyExpense * 100 : 0 },
    targetAmount, monthlyExpense,
  }
}
