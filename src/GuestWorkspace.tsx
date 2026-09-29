import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { brandLogoUrl } from './brandAssets'
import { GuestAssetsPage } from './GuestAssetsPage'
import { GatewayPage } from './Experience'
import { DividendsPage } from './features/DividendsPage'
import { GapPage } from './features/GapPage'
import { MarketPage } from './features/MarketPage'
import { SuccessPage } from './features/SuccessPage'
import { ReportPage } from './features/ReportPage'
import { StressPage } from './StressPage'
import { InvestmentImpactPage } from './features/InvestmentImpactPage'
import { buildGuestOverview, readGuestDraft, writeGuestDraft, type GuestDraft, type GuestDraftUpdate } from './guestData'
import { money } from './lib/format'
import type { RetirementGoalInput } from './data'
import type { FixedIncome } from './types'

type GuestPage = 'guide' | 'assets' | 'goal' | 'income' | 'home' | 'dividends' | 'gap' | 'market' | 'success' | 'report' | 'stress' | 'investment'
const guestIdentity = { id: 'guest', email: '免登入免費版' }
const nav: { id: GuestPage; label: string; icon: string }[] = [
  { id: 'home', label: '我的退休今天安全嗎？', icon: '⌂' },
  { id: 'dividends', label: '下一筆錢何時進來？', icon: '▦' },
  { id: 'investment', label: '投資對退休的影響', icon: '🧭' },
  { id: 'stress', label: '如果市場大跌怎麼辦？', icon: '♢' },
  { id: 'goal', label: '距離退休還有多遠？', icon: '◎' },
  { id: 'assets', label: '我的錢放得安全嗎？', icon: '▥' },
  { id: 'report', label: '這個月發生什麼變化？', icon: '▤' },
]
const defaultGoal: RetirementGoalInput = {
  currentAge: 55, targetAge: 65, targetAmount: 20_000_000,
  monthlyExpense: 50_000, monthlyContribution: 0, expectedReturn: 5,
  expectedYield: 5, inflationRate: 2, retirementYears: 30,
}

function ProUpgrade({ monthlyGap, onPro }: { monthlyGap: number; onPro: () => void }) {
  const lead = monthlyGap < 0
    ? `你目前每月約有 ${money.format(Math.abs(monthlyGap))} 缺口。本次免費版已完成試算；Pro 版可跨次保存資料，並持續更新缺口變化。`
    : `你目前每月約有 ${money.format(monthlyGap)} 結餘。本次免費版已完成試算；Pro 版可跨次保存資料，並持續更新市場與配息變化的影響。`
  return <section className="jh-pro-upgrade" aria-labelledby="guest-pro-title"><div className="jh-pro-upgrade-copy"><p className="eyebrow">免費試算完成後，下一步</p><h2 id="guest-pro-title">從本次試算，進階為可保存與持續更新的追蹤</h2><p>{lead}</p></div><div className="jh-pro-comparison"><div><strong>本次免費版</strong><span>免登入完成本次退休現金流試算</span><span>資料僅保存在這個瀏覽器分頁</span><span>根據本次輸入試算未來 12 個月缺口</span><span>不持續追蹤，需自行重新檢查</span></div><div className="pro"><strong>Pro 版</strong><span>跨次保存資產、收入與退休設定</span><span>重新計算並持續更新配息與未來 12 個月缺口</span><span>市場大跌、投資決策與投組壓力情境分析</span><span>歷史快照、情境比較與每月健檢報告</span></div></div><div className="jh-pro-upgrade-action"><div><b>適合希望持續掌握退休變化的人</b><small>登入後依帳號既有的 Pro 或試用資格開啟功能；登入本身不會自動訂閱或收費。</small></div><button className="jh-gold large" onClick={onPro}>查看 Pro 版／登入 <span>→</span></button></div></section>
}

function GuestGoal({ draft, update, onNext }: { draft: GuestDraft; update: (next: GuestDraft) => void; onNext: () => void }) {
  const [form, setForm] = useState<RetirementGoalInput>(draft.goal ?? defaultGoal)
  const [saved, setSaved] = useState(false)
  const fields: { key: keyof RetirementGoalInput; label: string; min: number; max?: number }[] = [
    { key: 'currentAge', label: '目前年齡', min: 18, max: 100 }, { key: 'targetAge', label: '預計退休年齡', min: form.currentAge, max: 110 },
    { key: 'targetAmount', label: '退休目標資產（元）', min: 0 }, { key: 'monthlyExpense', label: '每月生活費（元）', min: 0 },
    { key: 'monthlyContribution', label: '每月新增投入（元）', min: 0 }, { key: 'expectedReturn', label: '預期年化報酬率（%）', min: -50, max: 50 },
    { key: 'expectedYield', label: '預期年化配息率（%）', min: 0, max: 50 }, { key: 'inflationRate', label: '預估通膨率（%）', min: 0, max: 20 },
    { key: 'retirementYears', label: '退休後規劃年數', min: 1, max: 60 },
  ]
  return <section className="page-section jh-operational-page"><p className="eyebrow">退休現金流檢查 / 第一步</p><h1>先填每月生活費</h1><p className="lead">這些數字會用於現金流缺口與退休成功率情境試算。</p><form className="jh-entry-form" onSubmit={(event) => { event.preventDefault(); update({ ...draft, goal: form }); setSaved(true); onNext() }}><h2>退休計畫假設</h2>{fields.map(({ key, label, min, max }) => <label key={key}>{label}<input type="number" min={min} max={max} step="any" value={form[key]} onChange={(event) => { setForm({ ...form, [key]: Number(event.target.value) }); setSaved(false) }} required /></label>)}<div className="jh-form-actions"><button className="primary-button">保存並填入固定收入 →</button></div></form>{saved && <p className="form-message" role="status">已更新本次瀏覽的退休計畫。</p>}</section>
}

function GuestIncome({ draft, update, onNext }: { draft: GuestDraft; update: (next: GuestDraft) => void; onNext: () => void }) {
  const [category, setCategory] = useState<FixedIncome['category']>('labor_insurance')
  const [amount, setAmount] = useState('')
  const [start, setStart] = useState(new Date().toISOString().slice(0, 7))
  const [end, setEnd] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const categoryNames: Record<FixedIncome['category'], string> = { labor_insurance: '勞保年金', labor_pension: '勞退月領', annuity: '其他年金', rent: '租金收入', other: '其他固定收入' }
    update({ ...draft, incomes: [...draft.incomes, { id: crypto.randomUUID(), name: categoryNames[category], category,
      monthly_amount: Number(amount), start_month: `${start}-01`, end_month: end ? `${end}-01` : null }] })
    setAmount(''); setEnd('')
  }
  return <section className="page-section jh-operational-page"><p className="eyebrow">退休現金流檢查 / 第二步</p><h1>填入固定收入</h1><p className="lead">輸入已起領或預計起領的勞保、勞退、年金與租金；沒有固定收入也可以直接下一步。</p><form className="jh-entry-form" onSubmit={submit}><h2>新增固定收入</h2><label>收入類別<select value={category} onChange={(event) => setCategory(event.target.value as FixedIncome['category'])}><option value="labor_insurance">勞保年金</option><option value="labor_pension">勞退月領</option><option value="annuity">其他年金</option><option value="rent">租金收入</option><option value="other">其他收入</option></select></label><label>每月金額（元）<input type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label>開始月份<input type="month" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label>結束月份（可不填）<input type="month" min={start} value={end} onChange={(event) => setEnd(event.target.value)} /></label><div className="jh-form-actions"><button className="primary-button">加入固定收入</button></div></form><div className="table-wrap"><table><thead><tr><th>來源</th><th>每月金額</th><th>起領期間</th><th /></tr></thead><tbody>{draft.incomes.map((income) => <tr key={income.id}><td>{income.name}</td><td>{money.format(Number(income.monthly_amount))}</td><td>{income.start_month.slice(0, 7)} 至 {income.end_month?.slice(0, 7) ?? '持續'}</td><td><button className="text-button danger" onClick={() => update({ ...draft, incomes: draft.incomes.filter((item) => item.id !== income.id) })}>移除</button></td></tr>)}{!draft.incomes.length && <tr><td colSpan={4} className="empty">尚未輸入固定收入。</td></tr>}</tbody></table></div><div className="jh-form-actions"><button className="primary-button" onClick={onNext}>下一步：輸入資產與投資配息 →</button></div></section>
}

export function GuestWorkspace({ initialPage = 'guide', onHome, onPro }: { initialPage?: 'guide' | 'goal'; onHome: () => void; onPro: () => void }) {
  const [page, setPage] = useState<GuestPage>(initialPage)
  const [draft, setDraft] = useState(readGuestDraft)
  const data = useMemo(() => buildGuestOverview(draft), [draft])
  const update: GuestDraftUpdate = setDraft
  const monthlyDeficit = Math.max(0, -data.metrics.monthlyGap)
  const cashAssets = data.assets.filter((asset) => asset.asset_type === 'cash').reduce((sum, asset) => sum + Number(asset.current_value || 0), 0)
  const cashRunway = monthlyDeficit > 0 ? cashAssets / monthlyDeficit : null
  const staticRunway = monthlyDeficit > 0 ? data.metrics.totalAssets / monthlyDeficit : null
  const runwayText = (months: number | null) => months == null ? '目前每月無缺口' : `${Math.floor(months / 12)} 年 ${Math.floor(months % 12)} 個月`
  useEffect(() => { writeGuestDraft(draft) }, [draft])
  const navigate = (target: string) => setPage(target === 'cashflow' ? 'gap' : target === 'stress' ? 'stress' : target as GuestPage)
  const reload = async () => {}
  const saveDividend = async (form: { id?: string; ticker: string; monthKey: string; expectedAmount: string; expectedDate: string; actualAmount: string; actualDate: string; status: 'expected' | 'announced' | 'recorded' }) => {
    const [year, month] = form.monthKey.split('-').map(Number)
    const item = { id: form.id || crypto.randomUUID(), ticker: form.ticker.trim(), dividend_year: year, dividend_month: month,
      expected_amount: Number(form.expectedAmount), expected_payment_date: form.expectedDate || null,
      actual_amount: form.status === 'recorded' ? Number(form.actualAmount) : null,
      actual_payment_date: form.status === 'recorded' ? form.actualDate || null : null, status: form.status }
    update({ ...draft, dividends: form.id ? draft.dividends.map((existing) => existing.id === form.id ? item : existing) : [...draft.dividends, item] })
  }
  return <div className="app-shell guest-shell"><aside><button className="sidebar-home" onClick={onHome} aria-label="返回首頁"><img className="sidebar-logo" src={brandLogoUrl} alt="涓恆退休金流續航儀" /></button><nav>{nav.map((item) => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav><div className="sidebar-footer"><span>免費版 · 免登入</span><button onClick={onPro}>Pro 版登入</button></div></aside>
    <main className="workspace"><header className="masthead"><div className="masthead-brand"><img src={brandLogoUrl} alt="" /><div><strong>{nav.find((item) => item.id === page)?.label ?? '退休健檢'}</strong><span>免登入試算 · 資料僅保存在本次瀏覽</span></div></div><div className="member-pill">免費版</div></header><div className="content">
      {page === 'guide' && <GatewayPage onBack={onHome} onStep={(step) => setPage((['assets', 'goal', 'income', 'home', 'report'] as GuestPage[])[step])} onFeature={(target) => setPage(target)} startLabel="開始免費健檢" />}
      {page === 'assets' && <GuestAssetsPage draft={draft} update={update} onNext={() => setPage('home')} />}
      {page === 'goal' && <GuestGoal draft={draft} update={update} onNext={() => setPage('income')} />}
      {page === 'income' && <GuestIncome draft={draft} update={update} onNext={() => setPage('assets')} />}
      {page === 'home' && <section className="page-section jh-operational-page"><p className="eyebrow">退休現金流檢查 / 結果</p><h1>我的每月退休現金流夠不夠？</h1><p className="lead">根據本次輸入的生活費、固定收入、資產與投資配息估算。</p><div className="jh-operational-summary"><div><span>每月生活費</span><strong>{draft.goal ? money.format(data.monthlyExpense) : '待設定'}</strong></div><div><span>固定收入＋投資配息</span><strong>{money.format(data.metrics.monthlyIncome)}</strong></div><div><span>每月餘額／缺口</span><strong>{draft.goal ? money.format(data.metrics.monthlyGap) : '待設定'}</strong></div><div><span>現金能填補缺口多久</span><strong>{draft.goal ? runwayText(cashRunway) : '待設定'}</strong></div><div><span>靜態總資產續航</span><strong>{draft.goal ? runwayText(staticRunway) : '待設定'}</strong></div></div><p className="chart-note">靜態續航以目前缺口直接估算，尚未計入未來報酬、通膨、稅費與支出變化；長期退休試算會再納入這些假設。</p><div className="jh-form-actions jh-result-actions"><button className="primary-button" onClick={() => setPage('success')}>查看本次長期退休續航試算 →</button><button className="ghost-button" onClick={() => setPage('gap')}>查看本次未來 12 個月缺口</button><button className="ghost-button" onClick={() => setPage('report')}>查看本次健檢摘要</button></div></section>}
      {page === 'dividends' && <DividendsPage data={data} identity={guestIdentity} reload={reload} onNavigate={navigate} onGuestSave={saveDividend} />}
      {page === 'gap' && <GapPage data={data} identity={guestIdentity} reload={reload} onNavigate={navigate} />}
      {page === 'market' && <MarketPage data={data} onNavigate={navigate} />}
      {page === 'success' && <SuccessPage data={data} onNavigate={navigate} />}
      {page === 'report' && <ReportPage data={data} identity={guestIdentity} reload={reload} onNavigate={navigate} />}
      {page === 'stress' && <StressPage data={data} />}
      {page === 'investment' && <InvestmentImpactPage data={data} reload={reload} onPro={onPro} />}
      {(page === 'home' || page === 'report') && <ProUpgrade monthlyGap={data.metrics.monthlyGap} onPro={onPro} />}
      {page !== 'investment' && <div className="jh-form-actions impact-tools"><button className="ghost-button" onClick={()=>setPage('guide')}>退休健檢步驟</button><button className="ghost-button" onClick={()=>setPage('income')}>固定收入設定</button><button className="ghost-button" onClick={()=>setPage('gap')}>現金流缺口試算</button><button className="ghost-button" onClick={()=>setPage('success')}>退休成功率試算</button></div>}
    </div></main>
  </div>
}
