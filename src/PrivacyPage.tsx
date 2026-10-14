import { useState } from 'react'
import { deleteMyAccount, exportMyRetirementData } from './billing'
import type { ClaimsIdentity } from './types'

export function PrivacyPage({ identity, onBack, onDeleted }: { identity: ClaimsIdentity; onBack: () => void; onDeleted: () => void }) {
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function exportData() {
    setBusy(true); setMessage('')
    try { await exportMyRetirementData(identity.id, identity.email); setMessage('資料匯出檔已建立。') }
    catch (error) { setMessage(error instanceof Error ? error.message : '匯出失敗。') }
    finally { setBusy(false) }
  }
  async function remove() {
    if (confirmation !== '刪除我的帳號') return
    setBusy(true); setMessage('')
    try { await deleteMyAccount(); onDeleted() }
    catch (error) { setMessage(error instanceof Error ? error.message : '刪除失敗。'); setBusy(false) }
  }
  return <section className="page-section jh-privacy-page"><button className="ghost-button" onClick={onBack}>← 返回方案與帳號</button><p className="eyebrow">隱私與資料生命週期</p><h1>你的退休資料，由你管理</h1>
    <div className="jh-privacy-grid"><article><h2>我們保存什麼</h2><p>帳號、退休目標、資產、固定收入、配息紀錄、分析情境、月報快照及通知偏好。</p></article><article><h2>AI 會讀什麼</h2><p>只有在你執行相關分析時，才會讀取該次分析需要的持股與退休現金流資料；網站不宣稱將會員資料用於模型訓練。</p></article><article><h2>匯出資料</h2><p>下載目前帳號可讀取的退休資料 JSON 檔。</p><button className="primary-button" disabled={busy} onClick={() => void exportData()}>匯出我的資料</button></article><article className="danger-zone"><h2>刪除帳號與資料</h2><p>刪除後，與帳號連結的退休資料會依資料庫外鍵一併刪除，無法復原。</p><label>輸入「刪除我的帳號」確認<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button disabled={busy || confirmation !== '刪除我的帳號'} onClick={() => void remove()}>永久刪除帳號</button></article></div>
    {message && <p className="form-message" role="status">{message}</p>}
  </section>
}

