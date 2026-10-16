import { useMemo, useState } from 'react'
import type { RetirementOverview } from '../data'
import { money, unitPrice } from '../lib/format'
import { planEtfCashflow, type EtfCashflowProfile } from '../lib/etfCashflowPlanner'

const profileLabels: Record<EtfCashflowProfile, { label: string; note: string }> = {
  conservative: { label: '穩健防守', note: '較高債券比重，優先降低波動' },
  balanced: { label: '平衡配置', note: '兼顧現金流、分散與長期成長' },
  income: { label: '收益優先', note: '提高收益資產比重，可承受較大波動' },
}
export function EtfCashflowPlanner({ data, allowed, onReviewProduct, onPro }: {
  data: RetirementOverview
  allowed: boolean
  onReviewProduct: () => void
  onPro?: () => void
}) {
  const accountGap = Math.max(0, -data.metrics.monthlyGap)
  const initialTarget = Math.max(1_000, Math.round((accountGap || data.monthlyExpense || 20_000) / 1_000) * 1_000)
  const [principal, setPrincipal] = useState(2_000_000)
  const [monthlyTarget, setMonthlyTarget] = useState(initialTarget)
  const [profile, setProfile] = useState<EtfCashflowProfile>('balanced')
  const calculation = useMemo(() => {
    try { return { plan: planEtfCashflow(principal, monthlyTarget, profile), error: '' } }
    catch (error) { return { plan: null, error: (error as Error).message } }
  }, [principal, monthlyTarget, profile])
  const plan = calculation.plan

  return <div className="etf-cashflow-planner">
    {!allowed && <p className="error-banner">ETF 現金流規劃器需要登入且具有效 Pro／試用資格。{onPro && <button className="text-button" onClick={onPro}>前往 Pro 登入</button>}</p>}
    <article className="jh-panel etf-planner-intro">
      <div><p className="eyebrow">從生活費反推，不先追熱門代號</p><h2>本金能支撐多少月均現金流？</h2><p>輸入可投入金額與每月希望新增的現金流，先反推必要年化配息率，再查看適合核對的 ETF 類型。配息不等於報酬，也不保證每月固定入帳。</p></div>
      <dl><div><dt>帳戶目前每月生活費</dt><dd>{money.format(data.monthlyExpense)}</dd></div><div><dt>目前每月餘額／缺口</dt><dd className={data.metrics.monthlyGap < 0 ? 'jh-red' : 'jh-green'}>{money.format(data.metrics.monthlyGap)}</dd></div></dl>
    </article>

    <fieldset className="pro-fieldset" disabled={!allowed}>
      <legend>1. 設定這次現金流目標</legend>
      <div className="jh-entry-form">
        <label>可投入金額（新台幣）<input type="number" min={1} step={10_000} value={principal} onChange={(event) => setPrincipal(Number(event.target.value))} /></label>
        <label>每月希望新增的 ETF 現金流<input type="number" min={0} step={1_000} value={monthlyTarget} onChange={(event) => setMonthlyTarget(Number(event.target.value))} /></label>
        <label>配置取向<select value={profile} onChange={(event) => setProfile(event.target.value as EtfCashflowProfile)}>{Object.entries(profileLabels).map(([value, item]) => <option key={value} value={value}>{item.label}｜{item.note}</option>)}</select></label>
      </div>
      {accountGap > 0 && <button className="text-button" type="button" onClick={() => setMonthlyTarget(Math.round(accountGap))}>帶入目前缺口 {money.format(accountGap)}</button>}
      <p className="chart-note">試算使用長期規劃假設，不是即時殖利率：債券型 3%、分散股利型 5%、大盤型 2%、收益增強型 7%。實際商品必須再核對最新公開說明書、配息來源與資料日期。</p>
      {calculation.error && <p className="error-banner" role="alert">{calculation.error}</p>}
    </fieldset>

    {plan && <>
      <article className={`decision-banner etf-plan-${plan.status}`} aria-live="polite">
        <small>規劃結果</small><h2>{plan.headline}</h2><p>{plan.guidance}</p>
      </article>
      <section className="etf-plan-metrics" aria-label="ETF 現金流規劃摘要">
        <article><span>目標所需年化配息率</span><strong>{plan.requiredYieldPct.toFixed(2)}%</strong><small>每月目標 × 12 ÷ 投入金額</small></article>
        <article><span>參考配置規劃配息率</span><strong>{plan.planningYieldPct.toFixed(2)}%</strong><small>採各類型規劃假設加權</small></article>
        <article><span>參考月均現金流</span><strong>{unitPrice.format(plan.estimatedMonthlyIncome)}</strong><small>不是每月實際入帳承諾</small></article>
        <article><span>配息壓力情境</span><strong>{unitPrice.format(plan.stressedMonthlyIncome)}</strong><small>各類型套用 10%～45% 減配</small></article>
      </section>

      <article className="jh-panel">
        <h2>2. 建議核對的 ETF 商品類型</h2>
        <p>以下是類型與比例方向，不是特定代號的買進指示。先用小於或等於此比例篩選候選商品，再到「退休投資決策」逐檔核對。</p>
        <div className="table-wrap"><table><thead><tr><th>商品類型</th><th>配置</th><th>金額</th><th>規劃配息率</th><th>月均現金流</th><th>壓力月均</th></tr></thead><tbody>{plan.allocations.map((item) => <tr key={item.id}><td><strong>{item.label}</strong><small>{item.purpose}</small></td><td>{item.weightPct}%</td><td>{money.format(item.amount)}</td><td>{item.planningYieldPct.toFixed(1)}%</td><td>{unitPrice.format(item.monthlyIncome)}</td><td>{unitPrice.format(item.stressedMonthlyIncome)}</td></tr>)}</tbody></table></div>
        <div className="etf-selection-guides">{plan.allocations.map((item) => <section key={item.id}><h3>{item.label}</h3><p>{item.selectionGuide}</p></section>)}</div>
      </article>

      <article className="jh-panel etf-plan-actions">
        <h2>3. 把「月均配息」變成可用的每月生活費</h2>
        <div className="etf-action-grid"><div><span>建議另備 6 個月現金緩衝</span><strong>{money.format(plan.suggestedBuffer)}</strong><p>ETF 配息月份與金額不固定，先用現金帳戶平滑每月支出。</p></div><div><span>若維持本配置，目標所需本金</span><strong>{money.format(plan.capitalNeeded)}</strong><p>{plan.additionalCapitalNeeded > 0 ? `距離參考本金仍差 ${money.format(plan.additionalCapitalNeeded)}。` : '目前本金在規劃假設下可覆蓋月均目標。'}</p></div></div>
        <ul><li>不要只比較「配息率」，同時看總報酬、淨值與配息來源。</li><li>確認配息頻率與月份，季配或半年配不等於每月會收到錢。</li><li>同類 ETF 也要分散指數、產業、發行人與幣別風險。</li><li>逐檔輸入最新配息率與投入金額，再檢查退休成功率及現金安全月數。</li></ul>
        <button className="primary-button" onClick={onReviewProduct}>前往退休投資決策，核對實際 ETF →</button>
      </article>
      <p className="chart-note">本工具為退休現金流情境規劃，不構成個別投資建議。規劃配息率只是比較基準，未納入稅費、交易成本、匯率、配息變動、資本利得或本金損失。</p>
    </>}
  </div>
}
