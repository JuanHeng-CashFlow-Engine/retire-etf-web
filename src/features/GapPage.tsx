import { useMemo, useState } from 'react'
import { markAlertRead, type RetirementOverview } from '../data'
import { buildCashflowProjection } from '../lib/cashflow'
import { money } from '../lib/format'
import type { ClaimsIdentity } from '../types'
import { Empty, FeatureHeader, FeaturePanel, MiniBars, SummaryStats } from './shared'

export function GapPage({ data, identity, reload, onNavigate }: { data: RetirementOverview; identity: ClaimsIdentity; reload: () => Promise<void>; onNavigate: (page: string) => void }) {
  const projection = useMemo(() => buildCashflowProjection({ startDate: new Date(), monthlyExpense: data.monthlyExpense, calendar: data.dividends, holdings: data.holdings, assets: data.assets, fixedIncomes: data.fixedIncomes }), [data])
  const [selectedKey, setSelectedKey] = useState(projection.months[0].key)
  const [message, setMessage] = useState('')
  const month = projection.months.find((item) => item.key === selectedKey) ?? projection.months[0]
  const deficits = projection.months.filter((item) => item.gap < 0)
  const worst = deficits.length ? deficits.reduce((a, b) => a.gap < b.gap ? a : b) : null
  const totalDeficit = deficits.reduce((sum, item) => sum - item.gap, 0)
  const savedAlerts = data.cashflowAlerts.filter((item) => item.alert_year * 100 + item.alert_month >= projection.months[0].year * 100 + projection.months[0].month)
  const estimatedCount = projection.events.filter((item) => item.status === 'estimated').length

  async function acknowledge(id: string) {
    try { await markAlertRead(identity.id, 'cashflow_alerts', id); await reload() }
    catch (error) { setMessage(error instanceof Error ? error.message : '更新提醒失敗') }
  }

  return <section className="jh-feature-page">
    <FeatureHeader title="現金流缺口預警" subtitle="比較未來十二個月的配息、固定收入與生活費，提早安排不足月份。" />
    <div className="jh-feature-grid">
      <FeaturePanel number={1} title="每月收支總覽" subtitle="目前月平均估算"><SummaryStats items={[{ label: '月平均配息與收益', value: money.format(data.metrics.monthlyIncome - data.fixedMonthlyIncome) }, { label: '本月固定收入', value: money.format(data.fixedMonthlyIncome) }, { label: '每月生活費', value: money.format(data.monthlyExpense), tone: 'jh-red' }]} /><p className="jh-muted">本月平均差額：{money.format(data.metrics.monthlyGap)}。配息入帳月份可能不同，因此請看逐月預測。</p></FeaturePanel>
      <FeaturePanel number={2} title="缺口月份標示" subtitle="點選月份檢查來源"><div className="jh-month-grid">{projection.months.map((item) => <button key={item.key} className={`${item.level} ${selectedKey === item.key ? 'active' : ''}`} onClick={() => setSelectedKey(item.key)}><span>{item.label}</span><strong>{item.gap >= 0 ? '✓' : money.format(item.gap)}</strong></button>)}</div><p className="jh-muted">{month.label}：預估收入 {money.format(month.total)}，生活費 {money.format(data.monthlyExpense)}，差額 {money.format(month.gap)}。</p><div className="jh-list">{month.events.map((event) => <div key={event.id}><span>{event.name} · {event.statusLabel}</span><b>{money.format(event.amount)}</b></div>)}{!month.events.length && <Empty>目前沒有已知的入帳來源。</Empty>}</div></FeaturePanel>
      <FeaturePanel number={3} title="缺口金額大小" subtitle="辨識最需要準備的月份"><SummaryStats items={[{ label: '最大單月缺口', value: worst ? money.format(-worst.gap) : '無', tone: worst ? 'jh-red' : 'jh-green' }, { label: '發生月份', value: worst?.label ?? '—' }, { label: '十二個月缺口合計', value: money.format(totalDeficit), tone: totalDeficit ? 'jh-red' : 'jh-green' }]} /><MiniBars values={projection.months.map((item) => item.gap)} labels={projection.months.map((item) => `${item.month}月`)} negative /></FeaturePanel>
      <FeaturePanel number={4} title="缺口原因分析" subtitle="按已保存資料辨識可核對項目"><div className="jh-list"><div><span>低於生活費月份</span><b>{deficits.length}／12 個月</b></div><div><span>僅有預估的配息筆數</span><b>{estimatedCount} 筆</b></div><div><span>已設定固定收入</span><b>{data.fixedIncomes.length} 筆</b></div><div><span>每月生活費</span><b>{money.format(data.monthlyExpense)}</b></div></div><p className="jh-muted">不足可能來自入帳時間差、收入未設定或支出高於收入；本頁不把時間差判定成配息下修。</p></FeaturePanel>
      <FeaturePanel number={5} title="補位來源建議" subtitle="在缺口前核對可動用資金"><div className="jh-advice">{worst ? `先為 ${worst.label} 約 ${money.format(-worst.gap)} 的缺口準備現金，再核對固定收入起領時間與配息公告。` : '未來十二個月的已知收入已覆蓋目前生活費；仍需定期核對預估金額。'}</div><button className="jh-inline-link" onClick={() => onNavigate('income')}>編輯勞保、勞退與其他固定收入 →</button><button className="jh-inline-link" onClick={() => onNavigate('assets')}>核對現金資產 →</button></FeaturePanel>
      <FeaturePanel number={6} title="預警通知與待辦" subtitle="站內警訊與可執行檢查"><div className="jh-list">{savedAlerts.slice(0, 5).map((alert) => <div key={alert.id}><span>{alert.alert_year}/{alert.alert_month} · {alert.message ?? '現金流缺口'}</span><b>{alert.is_read ? '已讀' : '未讀'}</b>{!alert.is_read && <button className="jh-inline-link" onClick={() => void acknowledge(alert.id)}>標為已讀</button>}</div>)}{!savedAlerts.length && <Empty>目前沒有後端保存的現金流警訊；上方逐月預測仍可供檢查。</Empty>}</div><p className="jh-muted">可先在最早缺口月前核對生活費、收入日期與可用現金。自動寄送通知需後端排程。</p></FeaturePanel>
    </div>{message && <p className="form-message" role="status">{message}</p>}
  </section>
}
