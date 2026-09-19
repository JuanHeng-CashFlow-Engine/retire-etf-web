import { FormEvent, useState } from 'react'
import type { RetirementOverview } from './data'
import { money, number } from './lib/format'
import { quickStressScenario, type StressInput, type StressResult } from './lib/stress'
import { holdingMarketValue } from './lib/metrics'

export function StressPage({ data }: { data: RetirementOverview }) {
  const incompleteHoldings = data.holdings.some((holding) => holding.shares > 0 && holding.price <= 0)
  const [form, setForm] = useState<StressInput>({
    assets: incompleteHoldings ? 0 : data.metrics.totalAssets,
    exposed: incompleteHoldings ? 0 : data.holdings.reduce((sum, item) => sum + holdingMarketValue(item), 0),
    monthlyExpense: data.monthlyExpense,
    cash: data.assets.filter((item) => item.asset_type === 'cash').reduce((sum, item) => sum + Number(item.current_value || 0), 0),
    cashInAssets: true,
    marketDropPct: 20,
    dividendIncome: Math.max(0, data.metrics.monthlyIncome - data.fixedMonthlyIncome),
    dividendDropPct: 20,
    externalIncome: data.fixedMonthlyIncome,
  })
  const [cashKnown, setCashKnown] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [result, setResult] = useState<StressResult | null>(null)
  const [message, setMessage] = useState('')

  function update(field: keyof StressInput, value: number | boolean) {
    setForm((previous) => ({ ...previous, [field]: value }))
    setResult(null)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setResult(null)
    if (!reviewed) { setMessage('請先核對並勾選確認，再進行試算。'); return }
    try { setResult(quickStressScenario({ ...form, cash: cashKnown ? form.cash : 0 })) }
    catch (error) { setMessage(error instanceof Error ? error.message : '本次情境尚未完成。') }
  }

  return <section className="page-section stress-page">
    <p className="eyebrow">唯讀單次衝擊試算</p>
    <h1>♢ 如果市場大跌怎麼辦？</h1>
    <p className="lead">先看答案，再看原因，最後核對數據。這是您選擇的假設，不是行情預測，不會修改正式資產或自動交易。</p>
    {incompleteHoldings && <div className="error-banner">部分持股缺少價格，因此沒有自動帶入資產總額；請先核對資料，或手動輸入本次要試算的總額。</div>}
    <form className="stress-form" onSubmit={submit}>
      <h2>1. 設定市場與生活費</h2>
      <div className="stress-fields">
        <label>本次退休資產總額（新台幣）<input type="number" min="0" step="any" value={form.assets} onChange={(event) => update('assets', Number(event.target.value))} required /></label>
        <label>其中，這次套用跌幅的資產<input type="number" min="0" step="any" value={form.exposed} onChange={(event) => update('exposed', Number(event.target.value))} required /></label>
        <label>假設這部分市場下跌（%）<input type="number" min="0" max="100" step="5" value={form.marketDropPct} onChange={(event) => update('marketDropPct', Number(event.target.value))} required /></label>
        <label>假設未來配息下降（%）<input type="number" min="0" max="100" step="5" value={form.dividendDropPct} onChange={(event) => update('dividendDropPct', Number(event.target.value))} required /></label>
        <label>每月生活費（元）<input type="number" min="0" step="any" value={form.monthlyExpense} onChange={(event) => update('monthlyExpense', Number(event.target.value))} required /></label>
        <label>本次假設每月投資配息（元）<input type="number" min="0" step="any" value={form.dividendIncome} onChange={(event) => update('dividendIncome', Number(event.target.value))} required /></label>
        <label>已起領其他固定收入（元／月）<input type="number" min="0" step="any" value={form.externalIncome} onChange={(event) => update('externalIncome', Number(event.target.value))} required /></label>
        <label className="stress-checkbox"><input type="checkbox" checked={cashKnown} onChange={(event) => { setCashKnown(event.target.checked); setResult(null) }} />我已核對可動用現金</label>
        <label>可動用現金（元）<input type="number" min="0" step="any" value={form.cash} disabled={!cashKnown} onChange={(event) => update('cash', Number(event.target.value))} required /></label>
        <label className="stress-checkbox"><input type="checkbox" checked={form.cashInAssets} onChange={(event) => update('cashInAssets', event.target.checked)} />資產總額已包含這筆現金</label>
      </div>
      <p className="chart-note">可先不填已核對現金，此時不顯示現金安全墊。基金、債券、保險與其他資產需逐筆核對後再手動加入曝險額；未核對的配息可留 0。</p>
      <label className="stress-checkbox stress-review"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />我已核對總額、曝險範圍與現金是否重複計入，了解收入與跌幅只是本次情境假設</label>
      <button className="primary-button">計算市場大跌後的結果</button>
    </form>
    {message && <div className="error-banner" role="alert">{message}</div>}
    {!result && <p className="chart-note">請先填入資料並按「計算」。試算不會自動儲存或修改您的持股。</p>}
    {result && <>
      <div className="stress-answer-grid"><article><span>下跌後資產</span><strong>{money.format(result.assetsAfter)}</strong><small>本次市場損失 {money.format(result.marketLoss)}</small></article><article><span>每月收入情境</span><strong>{money.format(result.monthlyIncomeAfter)}</strong><small>配息減少 {money.format(result.monthlyIncomeBefore - result.monthlyIncomeAfter)}</small></article><article className={result.monthlyGapAfter < 0 ? 'red' : 'green'}><span>每月預估餘額／缺口</span><strong>{money.format(result.monthlyGapAfter)}</strong><small>{result.monthlyGapAfter < 0 ? '本情境現金流不足' : '本情境未顯示缺口'}</small></article></div>
      <div className={result.monthlyGapAfter < 0 ? 'stress-warning' : 'stress-info'}>{result.monthlyGapAfter < 0 ? `依本次假設，每月可能不足 ${money.format(-result.monthlyGapAfter)}。這不代表退休資產已耗盡，也不代表應立即賣出。` : '本次假設未顯示每月缺口；不代表未來收入已獲保證。'}</div>
      <article className="stress-detail"><h2>2. 再看原因</h2><p>只有您指定的 {money.format(form.exposed)} 曝險資產套用 {number.format(form.marketDropPct)}% 跌幅；其餘資產在本次情境暫不變動。配息另假設下降 {number.format(form.dividendDropPct)}%；股價下跌不代表配息必然同比例下降。</p>
        <p>{cashKnown ? result.cashBufferMonths == null ? '🛟 本情境沒有每月現金缺口；因此不以月數表示現金安全墊。' : `🛟 現金安全墊：${number.format(result.cashBufferMonths)} 個月；只衡量本次現金缺口，不是整體退休資產的可支撐年限。` : '可動用現金尚未核對，因此不顯示現金安全墊。'}</p>
      </article>
      <article className="stress-detail"><h2>3. 最後看數據與下一步</h2><div className="table-wrap"><table><thead><tr><th>項目</th><th>原情境</th><th>大跌情境</th><th>差額</th></tr></thead><tbody>
        <tr><td>資產總額</td><td>{money.format(result.assetsBefore)}</td><td>{money.format(result.assetsAfter)}</td><td>{money.format(-result.marketLoss)}</td></tr>
        <tr><td>每月收入</td><td>{money.format(result.monthlyIncomeBefore)}</td><td>{money.format(result.monthlyIncomeAfter)}</td><td>{money.format(result.monthlyIncomeAfter - result.monthlyIncomeBefore)}</td></tr>
        <tr><td>每月餘額／缺口</td><td>{money.format(result.monthlyGapBefore)}</td><td>{money.format(result.monthlyGapAfter)}</td><td>{money.format(result.monthlyGapAfter - result.monthlyGapBefore)}</td></tr>
      </tbody></table></div><p className="chart-note">先核對必要支出、可動用現金與已起領固定收入，再比較不同情境。單次衝擊未納入稅費、匯率、年金起領、提領順序或市場復原路徑；配息不能與總報酬重複計算。</p></article>
    </>}
  </section>
}

