export function LegalPage({ onBack }: { onBack: () => void }) {
  return <main className="jh-legal-page">
    <header className="jh-plan-nav"><button className="ghost-button" onClick={onBack}>← 返回</button><span>涓恆退休金流續航儀</span><span /></header>
    <section className="jh-legal-hero">
      <p className="eyebrow">服務定位與使用條款摘要</p>
      <h1>退休現金流模擬與統計工具</h1>
      <p>本服務協助整理使用者輸入的資產、收入與支出，呈現退休現金流、壓力情境與統計結果。</p>
    </section>
    <section className="jh-legal-content">
      <article><h2>不是個別證券買賣建議</h2><p>本服務不提供代客操作、保證獲利、個別證券推介或買進、賣出、持有指示。頁面上的風險提示、技術指標、回測與情境差異，僅供財務規劃與研究參考，投資決定及損益由使用者自行承擔。</p></article>
      <article><h2>資料與模型限制</h2><p>公開行情可能延遲、缺漏或修正；配息、報酬、波動、通膨與新聞衝擊可能包含歷史資料或模型假設。每項結果應連同資料時間、來源與資料性質閱讀。回測不代表未來績效。</p></article>
      <article><h2>兩種續航概念</h2><p><strong>靜態缺口續航</strong>是假設目前資產持續填補當前月缺口的簡化估算，不含未來報酬與支出變化。<strong>退休成功率</strong>則是依報酬、波動、通膨與年限進行的長期模擬機率，兩者都不是保證。</p></article>
      <article><h2>Pro 服務範圍</h2><p>Pro 訂閱費用對應持續監控、歷史快照、情境保存、站內提醒與統計軟體功能，不代表取得個別證券推薦或投資顧問服務。</p></article>
      <article><h2>使用者責任</h2><p>請核對持股、價格、配息、生活費與固定收入。涉及交易、稅務、法律或重大退休決策時，應另洽具適當資格的專業人士。</p></article>
      <article><h2>資料管理</h2><p>會員可在「隱私與資料」查看保存範圍、調整匿名分析同意、匯出資料及申請刪除帳號。付款由第三方金流頁面處理，本站不保存信用卡號。</p></article>
    </section>
    <p className="jh-legal-updated">版本：2026-10-16 · 正式商業上線前仍需完成台灣法規專業審閱。</p>
  </main>
}

export function ComplianceFooter({ onOpen }: { onOpen: () => void }) {
  return <footer className="jh-compliance-footer">
    <p><strong>財務規劃工具：</strong>結果為資料整理、統計與情境模擬，不構成個別證券買賣建議。</p>
    <button className="text-button" onClick={onOpen}>查看服務定位與模型限制</button>
  </footer>
}
