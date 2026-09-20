import { type FormEvent, useMemo, useState } from 'react'
import { brandLogoUrl } from './brandAssets'
import { GuestAssetsPage } from './GuestAssetsPage'
import { GatewayPage, features } from './Experience'
import { DividendsPage } from './features/DividendsPage'
import { GapPage } from './features/GapPage'
import { MarketPage } from './features/MarketPage'
import { SuccessPage } from './features/SuccessPage'
import { ReportPage } from './features/ReportPage'
import { StressPage } from './StressPage'
import { buildGuestOverview, readGuestDraft, writeGuestDraft, type GuestDraft } from './guestData'
import { money } from './lib/format'
import type { RetirementGoalInput } from './data'
import type { FixedIncome } from './types'

type GuestPage = 'guide' | 'assets' | 'goal' | 'income' | 'home' | 'dividends' | 'gap' | 'market' | 'success' | 'report' | 'stress'
const guestIdentity = { id: 'guest', email: '免登入免費版' }
const nav: { id: GuestPage; label: string; icon: string }[] = [
  { id: 'guide', label: '開始退休健檢', icon: '◈' },
  { id: 'assets', label: '輸入資產', icon: '▥' },
  { id: 'goal', label: '設定生活費與目標', icon: '◎' },
  { id: 'income', label: '填入固定收入', icon: '◉' },
  { id: 'home', label: '查看退休結果', icon: '⌂' },
  ...features.filter((feature) => feature.id !== 'guide').map((feature) => ({ id: feature.id as GuestPage, label: feature.title, icon: feature.icon })),
]
const defaultGoal: RetirementGoalInput = {
  currentAge: 55, targetAge: 65, targetAmount: 20_000_000,
  monthlyExpense: 50_000, monthlyContribution: 0, expectedReturn: 5,
  expectedYield: 5, inflationRate: 2, retirementYears: 30,
}

function GuestGoal({ draft, update }: { draft: GuestDraft; update: (next: GuestDraft) => void }) {
  const [form, setForm] = useState<RetirementGoalInput>(draft.goal ?? defaultGoal)
  const [saved, setSaved] = useState(false)
  const fields: { key: keyof RetirementGoalInput; label: string; min: number; max?: number }[] = [
    { key: 'currentAge', label: '目前年齡', min: 18, max: 100 }, { key: 'targetAge', label: '預計退休年齡', min: form.currentAge, max: 110 },
    { key: 'targetAmount', label: '退休目標資產（元）', min: 0 }, { key: 'monthlyExpense', label: '每月生活費（元）', min: 0 },
    { key: 'monthlyContribution', label: '每月新增投入（元）', min: 0 }, { key: 'expectedReturn', label: '預期年化報酬率（%）', min: -50, max: 50 },
    { key: 'expectedYield', label: '預期年化配息率（%）', min: 0, max: 50 }, { key: 'inflationRate', label: '預估通膨率（%）', min: 0, max: 20 },
    { key: 'retirementYears', label: '退休後規劃年數', min: 1, max: 60 },
  ]
  return <section className="page-section jh-operational-page"><p className="eyebrow">免費版 / 第二步</p><h1>設定生活費與退休目標</h1><p className="lead">這些數字會用於現金流缺口與退休成功率情境試算。</p><form className="jh-entry-form" onSubmit={(event) => { event.preventDefault(); update({ ...draft, goal: form }); setSaved(true) }}><h2>退休計畫假設</h2>{fields.map(({ key, label, min, max }) => <label key={key}>{label}<input type="number" min={min} max={max} step="any" value={form[key]} onChange={(event) => { setForm({ ...form, [key]: Number(event.target.value) }); setSaved(false) }} required /></label>)}<div className="jh-form-actions"><button className="primary-button">保存本次試算設定</button></div></form>{saved && <p className="form-message" role="status">已更新本次瀏覽的退休計畫。</p>}</section>
}

function GuestIncome({ draft, update }: { draft: GuestDraft; update: (next: GuestDraft) => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<FixedIncome['category']>('labor_insurance')
  const [amount, setAmount] = useState('')
  const [start, setStart] = useState(new Date().toISOString().slice(0, 7))
  const [end, setEnd] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    update({ ...draft, incomes: [...draft.incomes, { id: crypto.randomUUID(), name: name.trim(), category,
      monthly_amount: Number(amount), start_month: `${start}-01`, end_month: end ? `${end}-01` : null }] })
    setName(''); setAmount(''); setEnd('')
  }
  return <section className="page-section jh-operational-page"><p className="eyebrow">免費版 / 第三步</p><h1>填入固定收入</h1><p className="lead">輸入已起領或預計起領的勞保、勞退、年金與租金。</p><form className="jh-entry-form" onSubmit={submit}><h2>新增固定收入</h2><label>收入類別<select value={category} onChange={(event) => setCategory(event.target.value as FixedIncome['category'])}><option value="labor_insurance">勞保年金</option><option value="labor_pension">勞退月領</option><option value="annuity">其他年金</option><option value="rent">租金收入</option><option value="other">其他收入</option></select></label><label>名稱<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>每月金額（元）<input type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label>開始月份<input type="month" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label>結束月份（可不填）<input type="month" min={start} value={end} onChange={(event) => setEnd(event.target.value)} /></label><div className="jh-form-actions"><button className="primary-button">加入固定收入</button></div></form><div className="table-wrap"><table><thead><tr><th>來源</th><th>每月金額</th><th>起領期間</th><th /></tr></thead><tbody>{draft.incomes.map((income) => <tr key={income.id}><td>{income.name}</td><td>{money.format(Number(income.monthly_amount))}</td><td>{income.start_month.slice(0, 7)} 至 {income.end_month?.slice(0, 7) ?? '持續'}</td><td><button className="text-button danger" onClick={() => update({ ...draft, incomes: draft.incomes.filter((item) => item.id !== income.id) })}>移除</button></td></tr>)}{!draft.incomes.length && <tr><td colSpan={4} className="empty">尚未輸入固定收入。</td></tr>}</tbody></table></div></section>
}

export function GuestWorkspace({ onHome, onPro }: { onHome: () => void; onPro: () => void }) {
  const [page, setPage] = useState<GuestPage>('guide')
  const [draft, setDraft] = useState(readGuestDraft)
  const data = useMemo(() => buildGuestOverview(draft), [draft])
  const update = (next: GuestDraft) => { setDraft(next); writeGuestDraft(next) }
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
      {page === 'assets' && <GuestAssetsPage draft={draft} update={update} />}
      {page === 'goal' && <GuestGoal draft={draft} update={update} />}
      {page === 'income' && <GuestIncome draft={draft} update={update} />}
      {page === 'home' && <section className="page-section jh-operational-page"><p className="eyebrow">免費版 / 第四步</p><h1>查看退休結果</h1><p className="lead">根據本次輸入的資產、配息、固定收入與生活費估算。</p><div className="jh-operational-summary"><div><span>資產總額</span><strong>{money.format(data.metrics.totalAssets)}</strong></div><div><span>每月估算收入</span><strong>{money.format(data.metrics.monthlyIncome)}</strong></div><div><span>每月生活費</span><strong>{draft.goal ? money.format(data.monthlyExpense) : '待設定'}</strong></div><div><span>每月餘額／缺口</span><strong>{draft.goal ? money.format(data.metrics.monthlyGap) : '待設定'}</strong></div></div><div className="jh-form-actions"><button className="primary-button" onClick={() => setPage('report')}>查看健檢報告</button><button className="ghost-button" onClick={() => setPage('gap')}>檢查現金流缺口</button></div></section>}
      {page === 'dividends' && <DividendsPage data={data} identity={guestIdentity} reload={reload} onNavigate={navigate} onGuestSave={saveDividend} />}
      {page === 'gap' && <GapPage data={data} identity={guestIdentity} reload={reload} onNavigate={navigate} />}
      {page === 'market' && <MarketPage data={data} onNavigate={navigate} />}
      {page === 'success' && <SuccessPage data={data} onNavigate={navigate} />}
      {page === 'report' && <ReportPage data={data} identity={guestIdentity} reload={reload} onNavigate={navigate} />}
      {page === 'stress' && <StressPage data={data} />}
    </div></main>
  </div>
}
