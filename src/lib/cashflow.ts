import { holdingMarketValue, type PortfolioHolding } from './metrics'
import type { DividendItem, FixedIncome, UserAsset } from '../types'
import { fixedIncomeForMonth } from './fixedIncome'
import { tickerCode } from './ticker'

export type CashflowLevel = 'red' | 'yellow' | 'green'
export type CashflowStatus = 'recorded' | 'announced' | 'estimated'

export type CashflowEvent = {
  id: string
  ticker: string
  name: string
  monthKey: string
  paymentDate: string | null
  amount: number
  status: CashflowStatus
  statusLabel: string
  source: string
}

export type CashflowMonth = {
  key: string
  year: number
  month: number
  label: string
  total: number
  coveragePct: number
  gap: number
  level: CashflowLevel
  levelLabel: string
  events: CashflowEvent[]
}

const numeric = (value: unknown) => Number(value ?? 0) || 0

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthParts(date: Date, offset: number) {
  const shifted = new Date(date.getFullYear(), date.getMonth() + offset, 1)
  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1 }
}

function monthsFrom(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(Number).filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))]
}

function statusOf(item: DividendItem): { status: CashflowStatus; label: string } {
  const raw = item.status.toLowerCase()
  if (item.actual_amount != null || item.actual_payment_date || /actual|recorded|paid|入帳/.test(raw)) {
    return { status: 'recorded', label: '已記錄入帳' }
  }
  if (/announced|confirmed|公告|確認/.test(raw)) {
    return { status: 'announced', label: '已公告待入帳' }
  }
  return { status: 'estimated', label: '預估／待確認' }
}

function levelFor(total: number, monthlyExpense: number): Pick<CashflowMonth, 'coveragePct' | 'gap' | 'level' | 'levelLabel'> {
  if (monthlyExpense <= 0) {
    return { coveragePct: 0, gap: total, level: 'yellow', levelLabel: '待設定生活費' }
  }
  const coveragePct = (total / monthlyExpense) * 100
  if (coveragePct >= 100) {
    return { coveragePct, gap: total - monthlyExpense, level: 'green', levelLabel: '達到生活費' }
  }
  if (coveragePct >= 50) {
    return { coveragePct, gap: total - monthlyExpense, level: 'yellow', levelLabel: '需留意缺口' }
  }
  return { coveragePct, gap: total - monthlyExpense, level: 'red', levelLabel: '嚴重不足' }
}

export function buildCashflowProjection(input: {
  startDate: Date
  monthlyExpense: number
  calendar: DividendItem[]
  holdings: PortfolioHolding[]
  assets: UserAsset[]
  fixedIncomes?: FixedIncome[]
}) {
  const monthShells = Array.from({ length: 12 }, (_, offset) => monthParts(input.startDate, offset))
  const allowedKeys = new Set(monthShells.map(({ year, month }) => monthKey(year, month)))
  const events: CashflowEvent[] = []
  const occupied = new Set<string>()
  const identity = (ticker: string, key: string) => `${tickerCode(ticker)}|${key}`

  for (const item of input.calendar) {
    const dated = item.actual_payment_date ?? item.expected_payment_date
    const parsed = dated ? new Date(`${dated}T00:00:00`) : null
    const year = parsed && !Number.isNaN(parsed.valueOf()) ? parsed.getFullYear() : item.dividend_year
    const month = parsed && !Number.isNaN(parsed.valueOf()) ? parsed.getMonth() + 1 : item.dividend_month
    const key = monthKey(year, month)
    if (!allowedKeys.has(key)) continue
    const status = statusOf(item)
    events.push({
      id: item.id,
      ticker: item.ticker,
      name: item.ticker,
      monthKey: key,
      paymentDate: dated,
      amount: numeric(item.actual_amount ?? item.expected_amount),
      status: status.status,
      statusLabel: status.label,
      source: status.status === 'estimated' ? '配息行事曆預估' : '已保存配息資料',
    })
    occupied.add(identity(item.ticker, key))
  }

  const groupedHoldings = new Map<string, { ticker: string; name: string; annualAmount: number; dividendMonths: number[] }>()
  for (const holding of input.holdings) {
    const key = tickerCode(holding.ticker)
    const previous = groupedHoldings.get(key)
    groupedHoldings.set(key, {
      ticker: previous?.ticker ?? holding.ticker,
      name: previous?.name ?? holding.name,
      annualAmount: Math.max(previous?.annualAmount ?? 0, holdingMarketValue(holding) * (holding.annualYield / 100)),
      dividendMonths: [...new Set([...(previous?.dividendMonths ?? []), ...(holding.dividendMonths ?? [])])],
    })
  }

  for (const holding of groupedHoldings.values()) {
    const dividendMonths = holding.dividendMonths ?? []
    if (!dividendMonths.length) continue
    const estimatedAmount = holding.annualAmount / dividendMonths.length
    for (const shell of monthShells.filter(({ month }) => dividendMonths.includes(month))) {
      const key = monthKey(shell.year, shell.month)
      if (occupied.has(identity(holding.ticker, key))) continue
      events.push({
        id: `holding-${holding.ticker}-${key}`,
        ticker: holding.ticker,
        name: holding.name,
        monthKey: key,
        paymentDate: null,
        amount: estimatedAmount,
        status: 'estimated',
        statusLabel: '預估／待確認',
        source: '歷史配息月份與殖利率推估',
      })
    }
  }

  for (const asset of input.assets) {
    const dividendMonths = monthsFrom(asset.dividend_months)
    if (!asset.is_income_asset || !dividendMonths.length) continue
    const ticker = asset.asset_code || asset.asset_name
    const annualAmount = numeric(asset.current_value) * (numeric(asset.annual_yield) / 100)
    const estimatedAmount = annualAmount / dividendMonths.length
    for (const shell of monthShells.filter(({ month }) => dividendMonths.includes(month))) {
      const key = monthKey(shell.year, shell.month)
      if (occupied.has(identity(ticker, key))) continue
      events.push({
        id: `asset-${asset.id}-${key}`,
        ticker,
        name: asset.asset_name,
        monthKey: key,
        paymentDate: null,
        amount: estimatedAmount,
        status: 'estimated',
        statusLabel: '預估／待確認',
        source: '資產殖利率與配息月份推估',
      })
    }
  }

  for (const shell of monthShells) {
    const key = monthKey(shell.year, shell.month)
    for (const income of input.fixedIncomes ?? []) {
      if (fixedIncomeForMonth([income], key) <= 0) continue
      events.push({
        id: `fixed-${income.id}-${key}`,
        ticker: income.category,
        name: income.name,
        monthKey: key,
        paymentDate: null,
        amount: Number(income.monthly_amount),
        status: 'estimated',
        statusLabel: '固定收入設定',
        source: '會員固定收入設定',
      })
    }
  }

  const months: CashflowMonth[] = monthShells.map(({ year, month }) => {
    const key = monthKey(year, month)
    const monthEvents = events
      .filter((event) => event.monthKey === key)
      .sort((a, b) => (a.paymentDate ?? '9999-12-31').localeCompare(b.paymentDate ?? '9999-12-31'))
    const total = monthEvents.reduce((sum, event) => sum + event.amount, 0)
    return {
      key,
      year,
      month,
      label: `${year}/${String(month).padStart(2, '0')}`,
      total,
      events: monthEvents,
      ...levelFor(total, input.monthlyExpense),
    }
  })

  const today = `${input.startDate.getFullYear()}-${String(input.startDate.getMonth() + 1).padStart(2, '0')}-${String(input.startDate.getDate()).padStart(2, '0')}`
  const nextEvent = [...events]
    .filter((event) => event.amount > 0 && event.source !== '會員固定收入設定' && event.status !== 'recorded' && (!event.paymentDate || event.paymentDate >= today))
    .sort((a, b) => (a.paymentDate ?? `${a.monthKey}-28`).localeCompare(b.paymentDate ?? `${b.monthKey}-28`))[0] ?? null

  return {
    months,
    events,
    nextEvent,
    total12Months: months.reduce((sum, month) => sum + month.total, 0),
    insufficientMonths: months.filter((month) => month.level !== 'green').length,
  }
}

