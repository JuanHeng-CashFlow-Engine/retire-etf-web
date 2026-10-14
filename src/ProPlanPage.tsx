import { useState } from 'react'
import { openBillingPortal, openSubscriptionCheckout, startProTrial } from './billing'
import { memberState } from './lib/insights'
import type { RetirementOverview } from './data'
import type { ClaimsIdentity } from './types'

const benefits = [
  ['每月自動建立退休快照', '比較資產、配息、缺口與靜態續航的變化。'],
  ['持續追蹤退休警訊', '站內提醒配息、現金流缺口與需要核對的風險。'],
  ['保存分析與情境', '跨裝置查看投資決策、壓力測試與成功率歷史。'],
  ['每月只看一個優先行動', '把大量數字整理成目前最需要處理的一件事。'],
]

export function ProPlanPage({ identity, data, onLogin, onBack, onReload, onPrivacy }: {
  identity: ClaimsIdentity | null
  data?: RetirementOverview | null
  onLogin: () => void
  onBack: () => void
  onReload?: () => Promise<void>
  onPrivacy?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(() => {
    const result = new URLSearchParams(location.search).get('billing')
    return result === 'success' ? '付款已完成，正在同步 Pro 資格；若狀態尚未更新，請稍後重新整理。' : result === 'cancelled' ? '已取消付款，帳號方案沒有變更。' : ''
  })
  const state = data ? memberState(data) : 'free'
  const subscription = data?.subscription
  const trialEnd = subscription?.trial_end_at ?? data?.profile?.trial_ends_at ?? null

  async function trial() {
    if (!identity) { onLogin(); return }
    setBusy(true); setMessage('')
    try { await startProTrial(); setMessage('7 天 Pro 試用已啟用。'); await onReload?.() }
    catch (error) { setMessage(error instanceof Error ? error.message : '試用啟用失敗。') }
    finally { setBusy(false) }
  }
  async function checkout() {
    if (!identity) { onLogin(); return }
    setBusy(true); setMessage('')
    try { await openSubscriptionCheckout() }
    catch (error) { setMessage(error instanceof Error ? error.message : '無法開啟訂閱服務。'); setBusy(false) }
  }
  async function portal() {
    setBusy(true); setMessage('')
    try { await openBillingPortal() }
    catch (error) { setMessage(error instanceof Error ? error.message : '無法開啟方案管理。'); setBusy(false) }
  }

  return <main className="jh-plan-page">
    <header className="jh-plan-nav"><button className="ghost-button" onClick={onBack}>← 返回</button><span>涓恆退休金流續航儀</span>{identity && onPrivacy ? <button className="ghost-button" onClick={onPrivacy}>隱私與資料</button> : <span />}</header>
    <section className="jh-plan-hero"><p className="eyebrow">PRO 持續監控方案</p><h1>持續監控我的退休風險，<br />而不是只算一次</h1><p>免費版完成一次健檢；Pro 每月保存、比較並提醒退休計畫發生了什麼變化。</p></section>
    <section className="jh-plan-content">
      <div className="jh-plan-benefits">{benefits.map(([title, description], index) => <article key={title}><b>{String(index + 1).padStart(2, '0')}</b><div><h2>{title}</h2><p>{description}</p></div></article>)}</div>
      <aside className="jh-price-card">
        <p className="eyebrow">PRO 月繳</p><h2><span>NT$</span>99<small>／月</small></h2><p>先試用 7 天；試用不會自動扣款。</p>
        {state === 'pro' ? <><strong className="jh-plan-status">目前為 Pro 會員</strong><button className="jh-gold large" disabled={busy} onClick={() => void portal()}>管理訂閱與付款</button></>
          : state === 'trial' ? <><strong className="jh-plan-status">試用中{trialEnd ? `，至 ${new Date(trialEnd).toLocaleDateString('zh-TW')}` : ''}</strong><button className="jh-gold large" disabled={busy} onClick={() => void checkout()}>試用後繼續使用 Pro</button></>
          : <><button className="jh-gold large" disabled={busy} onClick={() => void trial()}>{identity ? '開始 7 天免費試用' : '登入後開始免費試用'}</button><button className="jh-outline large" disabled={busy} onClick={() => void checkout()}>{identity ? '直接訂閱 Pro' : '登入後訂閱 Pro'}</button></>}
        <small>付款由 Stripe 安全頁面處理；網站不保存信用卡號。可隨時在付款管理頁取消。</small>
        {message && <p className="form-message" role="status">{message}</p>}
      </aside>
    </section>
    <section className="jh-plan-scope"><h2>目前服務範圍</h2><div><p><strong>已提供</strong>站內通知、月報快照、歷史比較、投資與壓力情境。</p><p><strong>資料來源</strong>帳戶資料與資料庫行情為基礎；公開行情過期或警示時停止自動帶入，要求人工核對。</p><p><strong>尚未提供</strong>Email 與手機推播，因此不會把站內通知描述成外部即時通知。</p></div></section>
  </main>
}

