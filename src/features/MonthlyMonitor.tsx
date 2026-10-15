import { useMemo } from 'react'
import type { RetirementOverview } from '../data'
import { buildCashflowProjection } from '../lib/cashflow'
import { summarizeMarketTrust } from '../lib/dataQuality'
import { money } from '../lib/format'
import { compareMonthlyReports, deriveMonthlyReportMetrics } from '../lib/monthlyReport'
import { ResultTrust } from './shared'

function signedMoney(value: number | null) {
  if (value == null) return '尚無上月資料'
  return `${value >= 0 ? '+' : '-'}${money.format(Math.abs(value))}`
}

function runwayText(months: number | null, covered: boolean) {
  if (covered) return '收入可覆蓋支出'
  if (months == null || !Number.isFinite(months)) return '待核對'
  const rounded = Math.max(0, Math.round(months))
  return `${Math.floor(rounded / 12)} 年 ${rounded % 12} 個月`
}

export function MonthlyMonitor({ data, onOpenReport }: { data: RetirementOverview; onOpenReport: () => void }) {
  const projection = useMemo(() => buildCashflowProjection({ startDate: new Date(), monthlyExpense: data.monthlyExpense, calendar: data.dividends, holdings: data.holdings, assets: data.assets, fixedIncomes: data.fixedIncomes }), [data])
  const current = deriveMonthlyReportMetrics({ totalAssets: data.metrics.totalAssets, annualDividend: data.metrics.annualDividend, monthlyExpense: data.monthlyExpense, coveragePct: data.monthlyExpense > 0 ? data.metrics.coveragePct : null })
  const previousRecord = useMemo(() => [
    ...data.snapshotsV3.map((item) => ({
      sortAt: item.created_at,
      metrics: deriveMonthlyReportMetrics({ totalAssets: item.payload.metrics.total_assets, annualDividend: item.payload.metrics.annual_dividend, monthlyExpense: item.payload.metrics.monthly_expense, coveragePct: item.payload.metrics.coverage_pct }),
    })),
    ...data.monthlyReports.map((item) => ({
      sortAt: item.created_at,
      metrics: deriveMonthlyReportMetrics({ totalAssets: Number(item.total_assets), annualDividend: Number(item.annual_dividend), monthlyExpense: Number(item.monthly_expense), coveragePct: Number(item.coverage_pct) }),
    })),
  ].sort((left, right) => right.sortAt.localeCompare(left.sortAt))[0] ?? null, [data.snapshotsV3, data.monthlyReports])
  const previous = previousRecord?.metrics ?? null
  const changes = compareMonthlyReports(current, previous)
  const marketTrust = summarizeMarketTrust(data.quotes)
  const missing = [!data.goal ? '退休目標' : '', data.monthlyExpense <= 0 ? '每月生活費' : '', data.holdings.some((item) => item.shares > 0 && item.price <= 0) ? '持股價格' : ''].filter(Boolean)
  const monthlyDividend = data.metrics.annualDividend / 12
  const monthlyDividendChange = changes?.annualDividend == null ? null : changes.annualDividend / 12
  const focus = missing.length
    ? `先補齊${missing[0]}，否則本月比較不完整。`
    : current.monthlyGap != null && current.monthlyGap < 0
      ? `目前每月缺口約 ${money.format(-current.monthlyGap)}；先核對支出、固定收入與配息。`
      : projection.events.some((event) => event.status === 'estimated')
        ? '本月仍有預估配息，請在公告或入帳後更新紀錄。'
        : '本月沒有達到缺口警示門檻，持續核對資產與生活費。'

  return <section className="jh-monthly-review jh-monthly-home" aria-labelledby="pro-monthly-monitor-title">
    <header><div><p className="eyebrow">Pro 核心：持續監控退休風險</p><h2 id="pro-monthly-monitor-title">本月退休月報</h2></div><button className="jh-gold" onClick={onOpenReport}>查看完整月報與歷史 →</button></header>
    <div className="jh-monthly-review-grid">
      <article><span>資產變多少</span><strong>{money.format(data.metrics.totalAssets)}</strong><small className={changes?.totalAssets != null && changes.totalAssets < 0 ? 'bad' : 'good'}>{signedMoney(changes?.totalAssets ?? null)}／較上次</small></article>
      <article><span>每月配息估計</span><strong>{money.format(monthlyDividend)}</strong><small className={monthlyDividendChange != null && monthlyDividendChange < 0 ? 'bad' : 'good'}>{signedMoney(monthlyDividendChange)}／較上次</small></article>
      <article><span>每月餘額／缺口</span><strong className={current.monthlyGap != null && current.monthlyGap < 0 ? 'bad' : 'good'}>{current.monthlyGap == null ? '待核對' : money.format(current.monthlyGap)}</strong><small>{changes?.monthlyGap == null ? '尚無上月資料' : `${changes.monthlyGap >= 0 ? '改善' : '惡化'} ${money.format(Math.abs(changes.monthlyGap))}`}</small></article>
      <article><span>靜態缺口續航</span><strong>{runwayText(current.staticRunwayMonths, current.incomeCoversExpense)}</strong><small>{changes?.staticRunwayMonths == null ? '尚無可比較資料' : `${changes.staticRunwayMonths >= 0 ? '增加' : '減少'} ${Math.abs(changes.staticRunwayMonths).toFixed(1)} 個月`}</small></article>
      <article className="focus"><span>本月最需要注意一件事</span><strong>{focus}</strong><small>與最近一次 V3 快照或舊版月報比較；空白月份不補值。</small></article>
    </div>
    <ResultTrust asOf={marketTrust.asOf ?? new Date()} sources={marketTrust.sources} basis="實際資料＋模型假設" confidence={missing.length ? '低' : marketTrust.confidence} reason={`${marketTrust.reason} 月配息、缺口與靜態續航包含殖利率及收入時程假設。`} />
  </section>
}

