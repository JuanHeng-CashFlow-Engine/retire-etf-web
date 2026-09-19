import type { RetirementOverview } from '../data'
import { money } from './format'
import { fixedIncomeRange } from './fixedIncome'
import { holdingMarketValue } from './metrics'
import { simulateRetirementPlan, type RetirementPlanResult } from './retirementPlan'
import { tickerCode } from './ticker'

export type InsightAlert = { type: string; severity: 'warning' | 'danger'; title: string; message: string; impact_amount: number | null }

export function memberState(data: RetirementOverview, now = new Date()): 'free' | 'trial' | 'pro' {
  const subscription = data.subscription
  const valid = (value: string | null | undefined) => value == null || new Date(value).getTime() >= now.getTime()
  if (subscription && ['active', 'paid'].includes(subscription.status) && valid(subscription.current_period_end)) return 'pro'
  if (subscription?.status === 'trialing' && subscription.trial_end_at && valid(subscription.trial_end_at)) return 'trial'
  if (data.profile?.trial_ends_at && valid(data.profile.trial_ends_at)) return 'trial'
  return 'free'
}

export function assetConcentration(data: RetirementOverview) {
  const grouped = new Map<string, { name: string; value: number; kind: 'market' | 'other' }>()
  data.holdings.forEach((item) => {
    const key = `market:${tickerCode(item.ticker)}`
    const current = grouped.get(key)
    grouped.set(key, { name: current?.name ?? item.name, value: Math.max(current?.value ?? 0, holdingMarketValue(item)), kind: 'market' })
  })
  data.assets.forEach((item) => grouped.set(`asset:${item.id}`, { name: item.asset_name, value: Number(item.current_value) || 0, kind: 'other' }))
  const rows = [...grouped.values()].filter((item) => item.value > 0).sort((a, b) => b.value - a.value)
  const total = rows.reduce((sum, item) => sum + item.value, 0)
  return { rows, total, top: rows[0] ?? null, topPct: total > 0 ? (rows[0]?.value ?? 0) / total * 100 : 0 }
}

export function buildAlerts(data: RetirementOverview, success: number | null): InsightAlert[] {
  const alerts: InsightAlert[] = []
  if (data.monthlyExpense > 0 && data.metrics.monthlyGap < 0) alerts.push({
    type: 'cashflow_gap', severity: 'warning', title: '退休現金流不足',
    message: `月平均收入約 ${money.format(data.metrics.monthlyIncome)}，生活費 ${money.format(data.monthlyExpense)}，每月約差 ${money.format(-data.metrics.monthlyGap)}。`,
    impact_amount: -data.metrics.monthlyGap,
  })
  if (success != null && success < 70) alerts.push({
    type: 'low_success', severity: 'danger', title: '退休資產續航成功率偏低',
    message: `目前情境模擬成功率約 ${success.toFixed(1)}%，低於 70% 警戒線。`, impact_amount: null,
  })
  const concentration = assetConcentration(data)
  if (concentration.top && concentration.topPct >= 30) alerts.push({
    type: 'concentration', severity: 'danger', title: '單一資產集中度偏高',
    message: `${concentration.top.name} 約占退休總資產 ${concentration.topPct.toFixed(1)}%。`, impact_amount: null,
  })
  for (const quote of data.quotes) {
    const change = Number(quote.dividend_change_pct)
    if (!Number.isFinite(change) || change > -20) continue
    const holding = data.holdings.find((item) => item.ticker === quote.ticker || item.ticker.split('.')[0] === quote.ticker.split('.')[0])
    const annualLoss = holding ? holdingMarketValue(holding) * holding.annualYield / 100 * Math.abs(change) / 100 : null
    alerts.push({ type: 'dividend_review', severity: 'warning', title: `${quote.ticker} 配息資料需要核對`,
      message: `市場主檔顯示變動 ${change.toFixed(1)}%，仍需以可比較的官方每單位配息證據確認。${annualLoss == null ? '' : `若變動成立，按目前持有量估算年收入可能減少約 ${money.format(annualLoss)}。`}`,
      impact_amount: annualLoss })
  }
  return alerts.sort((a, b) => Number(b.severity === 'danger') - Number(a.severity === 'danger'))
}

export function buildRecommendations(data: RetirementOverview, success: number | null): string[] {
  const recommendations: string[] = []
  if (data.monthlyExpense > 0 && data.metrics.coveragePct < 100) recommendations.push('優先核對每月現金流缺口與可動用資金，再評估調整支出或收入來源。')
  if (success != null && success < 80) recommendations.push('用情境試算比較增加投入、延後退休或降低生活費的影響。')
  if (assetConcentration(data).topPct >= 30) recommendations.push('檢查單一資產集中度，避免退休資產過度依賴單一標的。')
  if (!recommendations.length) recommendations.push('維持定期核對資產、生活費與配息資料。')
  return recommendations
}

export function healthScore(data: RetirementOverview, success: number | null, forecastComplete = false): number | null {
  if (!forecastComplete || success == null || !data.goal || data.monthlyExpense <= 0) return null
  const cap = (value: number) => Math.min(100, Math.max(0, value))
  const concentrationScore = cap((60 - assetConcentration(data).topPct) / 40 * 100)
  const cash = data.assets.filter((item) => item.asset_type === 'cash').reduce((sum, item) => sum + (Number(item.current_value) || 0), 0)
  const reliableGap = Math.max(data.monthlyExpense - data.fixedMonthlyIncome, 0)
  const cashMonths = reliableGap === 0 ? 12 : cash / reliableGap
  const reserveScore = cap(cashMonths / 12 * 100)
  return Math.round((cap(success) * .35 + cap(data.metrics.coveragePct) * .25 + reserveScore * .2 + concentrationScore * .15 + cap(data.metrics.progressPct) * .05) * 10) / 10
}

export function simulateOverview(data: RetirementOverview, overrides: { monthlyContribution?: number; monthlyExpense?: number; annualReturn?: number } = {}, simulations = 3000): RetirementPlanResult | null {
  if (!data.goal || data.monthlyExpense <= 0 || data.targetAmount <= 0 || data.holdings.some((item) => item.shares > 0 && item.price <= 0)) return null
  const currentAge = Number(data.profile?.current_age)
  const targetAge = Number(data.goal.target_age)
  if (!Number.isInteger(currentAge) || !Number.isInteger(targetAge) || targetAge < currentAge) return null
  try {
    return simulateRetirementPlan({
      currentAssets: data.metrics.totalAssets,
      monthlyContribution: overrides.monthlyContribution ?? (Number(data.profile?.monthly_contribution) || 0) + data.assets.reduce((sum, asset) => sum + (Number(asset.monthly_contribution) || 0), 0),
      targetAssets: data.targetAmount,
      annualReturn: overrides.annualReturn ?? Number(data.goal.expected_return),
      annualVolatility: 15,
      yearsUntilRetirement: targetAge - currentAge,
      retirementYears: Number(data.goal.retirement_years) || 30,
      monthlyExpense: overrides.monthlyExpense ?? data.monthlyExpense,
      inflationRate: Number(data.goal.inflation_rate) || 0,
      fixedIncomes: data.fixedIncomes.filter((income) => !income.end_month || income.end_month.slice(0, 7) >= new Date().toISOString().slice(0, 7)).map((income) => fixedIncomeRange(income, new Date())),
      simulations,
      seed: 42,
    })
  } catch { return null }
}
