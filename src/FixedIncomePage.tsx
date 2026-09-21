import { type FormEvent, useState } from 'react'
import { removeFixedIncome, saveFixedIncome, type RetirementOverview } from './data'
import { money } from './lib/format'
import { fixedIncomeForMonth, monthKey } from './lib/fixedIncome'
import type { ClaimsIdentity, FixedIncome } from './types'

const categories: Record<FixedIncome['category'], string> = {
  labor_insurance: '勞保年金',
  labor_pension: '勞退月領',
  annuity: '其他年金',
  rent: '租金收入',
  other: '其他固定收入',
}

type Draft = { id?: string; name: string; category: FixedIncome['category']; monthlyAmount: string; startMonth: string; endMonth: string }
const emptyDraft = (): Draft => ({ name: '', category: 'labor_insurance', monthlyAmount: '', startMonth: monthKey(new Date()), endMonth: '' })

export function FixedIncomePage({ identity, data, reload }: { identity: ClaimsIdentity; data: RetirementOverview; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await saveFixedIncome(identity.id, {
        id: draft.id, name: draft.name, category: draft.category,
        monthlyAmount: Number(draft.monthlyAmount), startMonth: draft.startMonth,
        endMonth: draft.endMonth || null,
      })
      setDraft(emptyDraft())
      await reload()
      setMessage('固定收入已儲存，十二個月現金流與退休模擬會使用這筆設定。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '儲存失敗') }
    finally { setBusy(false) }
  }

  async function remove(id: string) {
    setBusy(true)
    setMessage('')
    try { await removeFixedIncome(identity.id, id); await reload(); setMessage('已停用這筆固定收入。') }
    catch (error) { setMessage(error instanceof Error ? error.message : '停用失敗') }
    finally { setBusy(false) }
  }

  function edit(income: FixedIncome) {
    setDraft({ id: income.id, name: income.name, category: income.category,
      monthlyAmount: String(income.monthly_amount), startMonth: income.start_month.slice(0, 7),
      endMonth: income.end_month?.slice(0, 7) ?? '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <section className="page-section jh-operational-page">
    <p className="eyebrow">退休健檢 / 第三步</p>
    <h1>填入固定收入</h1>
    <p className="lead">記錄已起領或預計起領的勞保、勞退、年金與租金。請填寫實際起領月份；尚未核定的金額應視為情境假設。</p>
    {data.fixedIncomeSetupRequired && <div className="error-banner">固定收入資料表尚未建立。管理員需先套用 database/20260918_fixed_incomes.sql，之後才能儲存。</div>}
    <div className="jh-operational-summary"><div><span>本月已設定收入</span><strong>{money.format(fixedIncomeForMonth(data.fixedIncomes, monthKey(new Date())))}</strong></div><div><span>收入來源</span><strong>{data.fixedIncomes.length} 筆</strong></div></div>
    <form className="jh-entry-form" onSubmit={submit}>
      <h2>{draft.id ? '編輯固定收入' : '新增固定收入'}</h2>
      <label>收入類別<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as FixedIncome['category'] })}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>收入名稱<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如勞保老年年金" required /></label>
      <label>每月金額（元）<input type="number" min="0" step="any" value={draft.monthlyAmount} onChange={(event) => setDraft({ ...draft, monthlyAmount: event.target.value })} required /></label>
      <label>開始月份<input type="month" value={draft.startMonth} onChange={(event) => setDraft({ ...draft, startMonth: event.target.value })} required /></label>
      <label>結束月份（可不填）<input type="month" min={draft.startMonth} value={draft.endMonth} onChange={(event) => setDraft({ ...draft, endMonth: event.target.value })} /></label>
      <div className="jh-form-actions"><button className="primary-button" disabled={busy || data.fixedIncomeSetupRequired}>{busy ? '儲存中…' : draft.id ? '儲存修改' : '加入固定收入'}</button>{draft.id && <button type="button" className="ghost-button" onClick={() => setDraft(emptyDraft())}>取消編輯</button>}</div>
    </form>
    {message && <p className="form-message" role="status">{message}</p>}
    <div className="table-wrap"><table><thead><tr><th>來源</th><th>類別</th><th>每月金額</th><th>起領期間</th><th /></tr></thead><tbody>
      {data.fixedIncomes.map((income) => <tr key={income.id}><td>{income.name}</td><td>{categories[income.category]}</td><td>{money.format(Number(income.monthly_amount))}</td><td>{income.start_month.slice(0, 7)} 至 {income.end_month?.slice(0, 7) ?? '持續'}</td><td><button className="text-button" onClick={() => edit(income)}>編輯</button><button className="text-button danger" disabled={busy} onClick={() => void remove(income.id)}>停用</button></td></tr>)}
      {!data.fixedIncomes.length && <tr><td colSpan={5} className="empty">尚未設定固定收入。</td></tr>}
    </tbody></table></div>
  </section>
}
