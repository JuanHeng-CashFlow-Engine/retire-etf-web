import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { brandLogoUrl } from './brandAssets'
import { GoalPage } from './GoalPage'
import { StressPage } from './StressPage'
import { FixedIncomePage } from './FixedIncomePage'
import { GatewayPage, LandingPage, features } from './Experience'
import { DividendsPage } from './features/DividendsPage'
import { GapPage } from './features/GapPage'
import { MarketPage } from './features/MarketPage'
import { SuccessPage } from './features/SuccessPage'
import { ReportPage } from './features/ReportPage'
import { memberState } from './lib/insights'
import { loadRetirementOverview, removeHolding, saveHolding, saveUserAsset, removeUserAsset, type RetirementOverview } from './data'
import { dateLabel, money, number, unitPrice } from './lib/format'
import { buildCashflowProjection } from './lib/cashflow'
import { holdingMarketValue } from './lib/metrics'
import { isSupabaseConfigured, requireSupabase, supabase } from './lib/supabase'
import type { ClaimsIdentity } from './types'

type Page = 'guide' | 'dividends' | 'gap' | 'market' | 'success' | 'report' | 'home' | 'cashflow' | 'stress' | 'goal' | 'assets' | 'income'

const navItems: { id: Page; icon: string; label: string }[] = [
  { id: 'guide', icon: '◈', label: '開始退休健檢' },
  ...features.filter((item) => item.id !== 'guide').map((item) => ({ id: item.id as Page, icon: item.icon, label: item.title })),
  { id: 'home', icon: '⌂', label: '我的退休今天安全嗎？' },
  { id: 'cashflow', icon: '▦', label: '下一筆錢何時進來？' },
  { id: 'stress', icon: '♢', label: '如果市場大跌怎麼辦？' },
  { id: 'goal', icon: '◎', label: '距離退休還有多遠？' },
  { id: 'assets', icon: '▥', label: '我的錢放得安全嗎？' },
  { id: 'income', icon: '◉', label: '固定收入設定' },
]

function asIdentity(claims: Record<string, unknown>): ClaimsIdentity | null {
  const id = typeof claims.sub === 'string' ? claims.sub : ''
  const email = typeof claims.email === 'string' ? claims.email : '會員'
  return id ? { id, email } : null
}

function AuthPage({ onAuthenticated, plan, onBack }: { onAuthenticated: () => Promise<void>; plan: 'free' | 'pro'; onBack: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!isSupabaseConfigured) { setMessage('尚未設定 Supabase 公開連線資訊，請先在 .env.local 填入 URL 與 publishable key。'); return }
    setBusy(true)
    setMessage('')
    const client = requireSupabase()
    const result =
      mode === 'login'
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
            },
          })
    setBusy(false)
    if (result.error) {
      setMessage(result.error.message)
      return
    }
    if (mode === 'signup' && !result.data.session) {
      setMessage('註冊成功，請先到信箱完成驗證。')
      return
    }
    await onAuthenticated()
  }

  return (
    <main className="auth-page">
      <button className="jh-auth-back" onClick={onBack}>← 返回首頁</button>
      <section className="auth-brand" aria-label="品牌介紹">
        <img src={brandLogoUrl} alt="JuanHeng CashFlow Engine" />
        <div>
          <p className="eyebrow">今天開始，讓未來更安心</p>
          <h1>看見現在，<br /><span>規劃更好的退休未來</span></h1>
          <p>看懂每月現金流、退休目標與市場波動。<br />為下一段生活做好準備。</p>
        </div>
      </section>
      <section className="auth-columns">
        <div className="quick-preview">
          <p className="eyebrow">免登入快速了解</p>
          <h2>先看懂，再做決定</h2>
          <div className="preview-stats">
            <span><strong>1</strong> 份退休計畫</span>
            <span><strong>12</strong> 個月現金流</span>
            <span><strong>5</strong> 大追蹤功能</span>
          </div>
          <p>從資產與生活費開始，逐步看見配息、缺口、風險與退休續航力。</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <p className="eyebrow">{plan === 'pro' ? 'Pro 版功能導覽入口' : '免費版入口'} · 涓恆退休金流續航儀</p>
          <h2>{mode === 'login' ? '歡迎回來' : '建立會員帳號'}</h2>
          <p className="jh-auth-plan-note">{plan === 'pro' ? '登入後依既有訂閱或試用紀錄開啟進階功能；此入口不會自動變更會員方案。' : '建立帳號後可保存資產、退休目標與個人試算。'}</p>
          {!isSupabaseConfigured && <p className="form-message" role="status">預覽模式：尚未設定 Supabase 公開連線資訊。</p>}
          <div className="auth-tabs" role="tablist">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>登入</button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>註冊</button>
          </div>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>密碼<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="primary-button" disabled={busy || !isSupabaseConfigured}>{busy ? '處理中…' : mode === 'login' ? '登入' : '建立帳號'}</button>
        </form>
      </section>
    </main>
  )
}

function Ring({ value, label }: { value: number | null; label: string }) {
  const shown = value == null ? 0 : Math.max(0, Math.min(value, 100))
  return (
    <div className="ring" style={{ '--ring': `${shown * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{value == null ? '—' : `${Math.round(shown)}%`}</strong><span>{label}</span></div>
    </div>
  )
}

function Dashboard({ data, onNavigate }: { data: RetirementOverview; onNavigate: (page: Page) => void }) {
  const { metrics, goal, gps, dividends } = data
  const riskLabel = metrics.monthlyGap >= 0 ? '現金流有餘裕' : '每月現金流不足'
  const score = gps?.success_probability == null ? null : Number(gps.success_probability)

  return (
    <>
      <section className="hero-panel">
        <div className="hero-ring"><Ring value={score} label={score == null ? '待完成模擬' : '舊版快照續航率'} /></div>
        <div className="hero-copy">
          <p className="eyebrow">已保存的退休情境快照</p>
          <h1>{score == null ? '資料已連線，等待完成模擬' : score >= 70 ? '退休計畫大致在軌道上' : '退休計畫需要調整'}</h1>
          <p>{gps?.gps_message || '目前先用已核對資產、生活費與退休目標呈現，不把資料完整度誤當健康分數。'}</p>
          {gps && <p className="snapshot-note">快照日期：{dateLabel(gps.snapshot_date)}。這是舊版保存的模擬比例，不是最新 React 試算、統一健康分數或退休保證。</p>}
          <button className="ghost-button" onClick={() => onNavigate('goal')}>查看退休目標 →</button>
        </div>
      </section>

      <section className="metric-grid">
        <button className="metric-card green" onClick={() => onNavigate('cashflow')}>
          <span>每月夠不夠？</span><strong>{money.format(metrics.monthlyGap)}</strong><small>{riskLabel}</small>
        </button>
        <button className="metric-card blue" onClick={() => onNavigate('assets')}>
          <span>目前資產</span><strong>{money.format(metrics.totalAssets)}</strong><small>持股與其他資產合計</small>
        </button>
        <button className="metric-card gold" onClick={() => onNavigate('goal')}>
          <span>退休目標達成率</span><strong>{number.format(metrics.progressPct)}%</strong><small>目標 {money.format(data.targetAmount)}</small>
        </button>
        <button className={`metric-card ${metrics.monthlyGap < 0 ? 'red' : 'green'}`} onClick={() => onNavigate('report')}>
          <span>最需留意</span><strong>{metrics.monthlyGap < 0 ? '現金流缺口' : '資料狀態正常'}</strong><small>{metrics.monthlyGap < 0 ? '需增加收入或調整支出' : '持續每月核對'}</small>
        </button>
      </section>

      <section className="recommendation"><span>💡 涓恆今天的建議</span><strong>{goal ? '已讀取正式退休目標；下一步核對未來 12 個月現金流。' : '尚未設定退休目標，先建立目標金額與退休年齡。'}</strong></section>

      <section className="dashboard-grid">
        <article className="content-card cashflow-card">
          <header><div><p className="eyebrow">現金流預警</p><h2>這個月錢夠不夠？</h2></div><button onClick={() => onNavigate('cashflow')}>查看詳情</button></header>
          <div className="cashflow-bars">
            <div><span>每月預估收入</span><strong>{money.format(metrics.monthlyIncome)}</strong><i style={{ width: `${Math.min(metrics.coveragePct, 100)}%` }} /></div>
            <div><span>每月生活費</span><strong>{money.format(data.monthlyExpense)}</strong><i className="expense" style={{ width: '100%' }} /></div>
          </div>
          <div className={`gap-banner ${metrics.monthlyGap < 0 ? 'negative' : ''}`}>每月差額 <strong>{money.format(metrics.monthlyGap)}</strong></div>
        </article>
        <article className="content-card">
          <header><div><p className="eyebrow">近期配息</p><h2>下一筆錢何時進來？</h2></div><button onClick={() => onNavigate('cashflow')}>查看行事曆</button></header>
          <div className="dividend-list">
            {dividends.slice(0, 5).map((item) => {
              const amount = Number(item.actual_amount ?? item.expected_amount ?? 0)
              const paymentDate = item.actual_payment_date ?? item.expected_payment_date
              return <div key={item.id}><strong>{item.ticker}</strong><span>{dateLabel(paymentDate)}</span><b>{money.format(amount)}</b><em className={item.status.includes('actual') || item.status.includes('recorded') ? 'ok' : 'estimate'}>{item.status}</em></div>
            })}
            {!dividends.length && <p className="empty">目前沒有已建立的配息行事曆。</p>}
          </div>
        </article>
      </section>
    </>
  )
}

function CashflowPage({ data }: { data: RetirementOverview }) {
  const projection = useMemo(
    () => buildCashflowProjection({
      startDate: new Date(),
      monthlyExpense: data.monthlyExpense,
      calendar: data.dividends,
      holdings: data.holdings,
      assets: data.assets,
      fixedIncomes: data.fixedIncomes,
    }),
    [data],
  )
  const initialMonth = projection.nextEvent?.monthKey ?? projection.months[0].key
  const [selectedKey, setSelectedKey] = useState(initialMonth)
  const selectedMonth = projection.months.find((month) => month.key === selectedKey) ?? projection.months[0]
  const maxTotal = Math.max(...projection.months.map((month) => month.total), data.monthlyExpense, 1)
  const recordedTotal = projection.events.filter((event) => event.status === 'recorded').reduce((sum, event) => sum + event.amount, 0)
  const announcedTotal = projection.events.filter((event) => event.status === 'announced').reduce((sum, event) => sum + event.amount, 0)
  const estimatedTotal = projection.events.filter((event) => event.status === 'estimated').reduce((sum, event) => sum + event.amount, 0)
  const next = projection.nextEvent

  return (
    <section className="page-section cashflow-page">
      <p className="eyebrow">未來 12 個月現金流</p>
      <h1>▦ 下一筆錢何時進來？</h1>
      <p className="lead">已公告不等於已入帳；預估資料會等待市場公告更新，無需手動補齊共用市場資料。</p>

      <div className="next-money-panel">
        <div>
          <span>下一筆配息</span>
          <strong>{next ? next.name : '目前沒有可預估項目'}</strong>
          <small>{next ? (next.paymentDate ? dateLabel(next.paymentDate) : `${next.monthKey.replace('-', '/')}・日期待市場公告`) : '請先建立持股或收益型資產'}</small>
        </div>
        <div className="next-amount"><span>預估金額</span><strong>{money.format(next?.amount ?? 0)}</strong><em className={`status-${next?.status ?? 'estimated'}`}>{next?.statusLabel ?? '尚無資料'}</em></div>
      </div>

      <div className="cashflow-summary-grid">
        <article><span>未來 12 個月合計</span><strong>{money.format(projection.total12Months)}</strong><small>已載入與合理預估</small></article>
        <article><span>已記錄入帳</span><strong className="green-text">{money.format(recordedTotal)}</strong><small>依個人入帳紀錄</small></article>
        <article><span>已公告待入帳</span><strong className="blue-text">{money.format(announcedTotal)}</strong><small>不是實際入帳</small></article>
        <article><span>預估／待確認</span><strong className="gold-text">{money.format(estimatedTotal)}</strong><small>不列為確定收入</small></article>
      </div>

      <article className="projection-card">
        <header>
          <div><p className="eyebrow">智慧型月份燈號</p><h2>每月總金額與生活費覆蓋</h2></div>
          <div className="traffic-legend"><span className="green-dot">達到生活費</span><span className="yellow-dot">需留意</span><span className="red-dot">嚴重不足</span></div>
        </header>
        <div className="projection-chart" role="list" aria-label="未來十二個月配息長條圖">
          {projection.months.map((month) => {
            const height = Math.max((month.total / maxTotal) * 100, month.total > 0 ? 7 : 2)
            return (
              <button key={month.key} className={`projection-month ${month.level} ${selectedKey === month.key ? 'selected' : ''}`} onClick={() => setSelectedKey(month.key)} role="listitem" aria-label={`${month.label}，${month.levelLabel}，總額 ${money.format(month.total)}`}>
                <b>{money.format(month.total)}</b>
                <span className="bar-zone"><i style={{ height: `${height}%` }} /></span>
                <strong>{month.label}</strong>
                <em>{month.levelLabel}</em>
              </button>
            )
          })}
        </div>
        <p className="chart-note">燈號標準：低於生活費 50% 為紅燈、50% 至未滿 100% 為黃燈、達到 100% 為綠燈。生活費基準為 {money.format(data.monthlyExpense)}。</p>
      </article>

      <article className="month-detail-card">
        <header>
          <div><p className="eyebrow">查看月份</p><h2>{selectedMonth.label}</h2></div>
          <div className={`month-light ${selectedMonth.level}`}><span />{selectedMonth.levelLabel}</div>
        </header>
        <div className="month-selector" aria-label="選擇月份">
          {projection.months.map((month) => <button key={month.key} className={selectedKey === month.key ? 'active' : ''} onClick={() => setSelectedKey(month.key)}>{month.label}</button>)}
        </div>
        <div className="selected-month-total"><span>本月預估總額</span><strong>{money.format(selectedMonth.total)}</strong><small>與生活費差額 {money.format(selectedMonth.gap)}</small></div>
        <div className="table-wrap cashflow-table">
          <table>
            <thead><tr><th>標的</th><th>預計／實際日期</th><th>金額</th><th>狀態</th><th>資料來源</th></tr></thead>
            <tbody>
              {selectedMonth.events.map((event) => <tr key={event.id}><td><strong>{event.name}</strong><small>{event.ticker}</small></td><td>{event.paymentDate ? dateLabel(event.paymentDate) : '日期待確認'}</td><td><strong>{money.format(event.amount)}</strong></td><td><span className={`status-chip ${event.status}`}>{event.statusLabel}</span></td><td>{event.source}</td></tr>)}
              {!selectedMonth.events.length && <tr><td colSpan={5} className="empty">本月目前沒有配息資料；金額為 0，不代表資料錯誤。</td></tr>}
            </tbody>
            <tfoot><tr><td>本月合計</td><td>{selectedMonth.events.length} 筆</td><td>{money.format(selectedMonth.total)}</td><td /><td /></tr></tfoot>
          </table>
        </div>
      </article>
    </section>
  )
}

function PortfolioPage({ identity, data, reload }: { identity: ClaimsIdentity; data: RetirementOverview; reload: () => Promise<void> }) {
  const [ticker, setTicker] = useState('')
  const [shares, setShares] = useState('0')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [assetName, setAssetName] = useState('')
  const [assetType, setAssetType] = useState('cash')
  const [assetValue, setAssetValue] = useState('')
  const [assetYield, setAssetYield] = useState('0')
  const [assetMonths, setAssetMonths] = useState('')
  const [assetId, setAssetId] = useState<string | undefined>()
  const [assetProvider, setAssetProvider] = useState('')
  const [assetContribution, setAssetContribution] = useState('0')
  const [assetReturn, setAssetReturn] = useState('0')
  const [assetNotes, setAssetNotes] = useState('')

  async function submitAsset(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await saveUserAsset(identity.id, { id: assetId, name: assetName, type: assetType, value: Number(assetValue), annualYield: Number(assetYield), dividendMonths: assetMonths.split(',').map((part) => part.trim()).filter(Boolean).map(Number), monthlyContribution: Number(assetContribution), expectedReturn: Number(assetReturn), provider: assetProvider, notes: assetNotes })
      setAssetId(undefined)
      setAssetName('')
      setAssetValue('')
      setAssetMonths('')
      setAssetProvider('')
      setAssetContribution('0')
      setAssetReturn('0')
      setAssetNotes('')
      setMessage('已保存其他資產。')
      await reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存資產失敗')
    } finally { setBusy(false) }
  }

  async function removeAsset(id: string) {
    setBusy(true)
    setMessage('')
    try { await removeUserAsset(identity.id, id); await reload() }
    catch (error) { setMessage(error instanceof Error ? error.message : '移除資產失敗') }
    finally { setBusy(false) }
  }

  function editAsset(asset: RetirementOverview['assets'][number]) {
    setAssetId(asset.id)
    setAssetName(asset.asset_name)
    setAssetType(asset.asset_type)
    setAssetValue(String(asset.current_value))
    setAssetYield(String(asset.annual_yield))
    setAssetMonths(Array.isArray(asset.dividend_months) ? asset.dividend_months.join(',') : '')
    setAssetProvider(asset.provider ?? '')
    setAssetContribution(String(asset.monthly_contribution ?? 0))
    setAssetReturn(String(asset.expected_return ?? 0))
    setAssetNotes(asset.notes ?? '')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const result = await saveHolding(identity.id, data.portfolio, ticker, Number(shares))
      setMessage(result.foundInMarketMaster ? `已更新 ${result.marketName || ticker}。` : `已保存 ${ticker.toUpperCase()}；市場主檔尚無資料，系統不會由會員端改寫共用資料。`)
      setTicker('')
      await reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失敗')
    } finally {
      setBusy(false)
    }
  }

  async function remove(tickerToRemove: string) {
    if (!data.portfolio) return
    setBusy(true)
    try {
      await removeHolding(identity.id, data.portfolio, tickerToRemove)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page-section">
      <p className="eyebrow">退休健檢 / 第一步</p>
      <h1>輸入資產</h1>
      <p className="lead">沿用「我的錢放得安全嗎？」的投資組合資料，並把現金、基金、債券等其他資產放進同一份退休試算。</p>
      <h2>股票與 ETF</h2>
      <form className="holding-form" onSubmit={submit}>
        <label>股票／ETF 代號<input value={ticker} onChange={(event) => setTicker(event.target.value)} placeholder="例如 0050.TW" required /></label>
        <label>張數／單位數<input type="number" min="0" step="0.01" value={shares} onChange={(event) => setShares(event.target.value)} required /></label>
        <button className="primary-button" disabled={busy}>加入或更新</button>
      </form>
      {message && <p className="form-message" role="status">{message}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>標的</th><th>張數</th><th>價格</th><th>市值</th><th>殖利率</th><th>資料狀態</th><th /></tr></thead>
          <tbody>
            {data.holdings.map((holding) => <tr key={holding.ticker}><td><strong>{holding.name}</strong><small>{holding.ticker}</small></td><td>{number.format(holding.shares)}</td><td>{unitPrice.format(holding.price)}</td><td>{money.format(holdingMarketValue(holding))}</td><td>{number.format(holding.annualYield)}%</td><td>{holding.price > 0 ? '市場資料已載入' : '等待市場資料'}</td><td><button className="text-button danger" disabled={busy} onClick={() => void remove(holding.ticker)}>移除</button></td></tr>)}
            {!data.holdings.length && <tr><td colSpan={7} className="empty">尚未建立持股。</td></tr>}
          </tbody>
          <tfoot><tr><td>合計</td><td>{number.format(data.holdings.reduce((sum, row) => sum + row.shares, 0))}</td><td /><td>{money.format(data.metrics.stockValue)}</td><td /><td /><td /></tr></tfoot>
        </table>
      </div>
      <h2 className="jh-assets-subheading">其他資產</h2>
      <form className="jh-asset-form" onSubmit={submitAsset}>
        <label>資產類別<select value={assetType} onChange={(event) => setAssetType(event.target.value)}><option value="cash">現金</option><option value="fund">基金</option><option value="bond">債券</option><option value="insurance">保險</option><option value="other">其他</option></select></label>
        <label>資產名稱<input value={assetName} onChange={(event) => setAssetName(event.target.value)} placeholder="例如退休準備金" required /></label>
        <label>目前金額（元）<input type="number" min="0" step="any" value={assetValue} onChange={(event) => setAssetValue(event.target.value)} required /></label>
        <label>預估年收益率（%）<input type="number" min="0" max="30" step="any" value={assetYield} onChange={(event) => setAssetYield(event.target.value)} required /></label>
        <label>每月投入（元）<input type="number" min="0" step="any" value={assetContribution} onChange={(event) => setAssetContribution(event.target.value)} required /></label>
        <label>年化報酬假設（%）<input type="number" min="-20" max="30" step="any" value={assetReturn} onChange={(event) => setAssetReturn(event.target.value)} required /></label>
        <label>機構／來源<input value={assetProvider} onChange={(event) => setAssetProvider(event.target.value)} /></label>
        <label>備註<input value={assetNotes} onChange={(event) => setAssetNotes(event.target.value)} /></label>
        <label>收益月份（可選）<input value={assetMonths} onChange={(event) => setAssetMonths(event.target.value)} placeholder="例如 3,6,9,12" /></label>
        <button className="primary-button" disabled={busy}>{assetId ? '更新資產' : '新增資產'}</button>
        {assetId && <button type="button" className="ghost-button" onClick={() => { setAssetId(undefined); setAssetName(''); setAssetValue('') }}>取消編輯</button>}
      </form>
      <div className="table-wrap"><table><thead><tr><th>名稱</th><th>類別</th><th>目前金額</th><th>年收益率</th><th /></tr></thead><tbody>{data.assets.map((asset) => <tr key={asset.id}><td>{asset.asset_name}</td><td>{asset.asset_type}</td><td>{money.format(Number(asset.current_value))}</td><td>{Number(asset.annual_yield)}%</td><td><button className="text-button" disabled={busy} onClick={() => editAsset(asset)}>編輯</button><button className="text-button danger" disabled={busy} onClick={() => void removeAsset(asset.id)}>移除</button></td></tr>)}{!data.assets.length && <tr><td colSpan={5} className="empty">尚未建立其他資產。</td></tr>}</tbody></table></div>
      <p className="chart-note">收益月份用於未來十二個月現金流推估；未填月份的年收益率只會換算月平均，不會虛構入帳日期。資產估值與收益率由您提供。</p>
    </section>
  )
}

function AppShell({ identity, initialPage, onHome }: { identity: ClaimsIdentity; initialPage: Page; onHome: () => void }) {
  const [page, setPage] = useState<Page>(initialPage)
  const [data, setData] = useState<RetirementOverview | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setData(await loadRetirementOverview(identity.id)) }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : '資料讀取失敗') }
    finally { setLoading(false) }
  }, [identity.id])

  useEffect(() => { void reload() }, [reload])

  async function signOut() { await requireSupabase().auth.signOut(); onHome() }

  return (
    <div className="app-shell">
      <aside>
        <button className="sidebar-home" onClick={onHome} aria-label="返回首頁"><img className="sidebar-logo" src={brandLogoUrl} alt="涓恆退休金流續航儀" /></button>
        <nav>{navItems.map((item) => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="sidebar-footer"><span>{identity.email} · {data ? ({ free: '免費版', trial: '試用版', pro: 'Pro 版' }[memberState(data)]) : '載入中'}</span><button onClick={signOut}>登出</button></div>
      </aside>
      <main className="workspace">
        <header className="masthead"><div className="masthead-brand"><img src={brandLogoUrl} alt="" /><div><strong>{navItems.find((item) => item.id === page)?.label}</strong><span>看見現在，規劃更好的退休未來</span></div></div><div className="member-pill">● {identity.email}</div></header>
        <div className="content">
          {loading && <div className="loading">正在透過 RLS 載入您的資料…</div>}
          {error && <div className="error-banner">{error}<button onClick={() => void reload()}>重試</button></div>}
          {!loading && data && page === 'guide' && <GatewayPage onBack={onHome} onStep={(step) => setPage((['assets', 'goal', 'income', 'home', 'report'] as Page[])[step])} onFeature={(target) => setPage(target)} />}
          {!loading && data && page === 'dividends' && <DividendsPage data={data} identity={identity} reload={reload} onNavigate={(target) => setPage(target as Page)} />}
          {!loading && data && page === 'gap' && <GapPage data={data} identity={identity} reload={reload} onNavigate={(target) => setPage(target as Page)} />}
          {!loading && data && page === 'market' && <MarketPage data={data} onNavigate={(target) => setPage(target as Page)} />}
          {!loading && data && page === 'success' && <SuccessPage data={data} onNavigate={(target) => setPage(target as Page)} />}
          {!loading && data && page === 'report' && <ReportPage data={data} identity={identity} reload={reload} onNavigate={(target) => setPage(target as Page)} />}
          {!loading && data && page === 'home' && <Dashboard data={data} onNavigate={setPage} />}
          {!loading && data && page === 'cashflow' && <CashflowPage data={data} />}
          {!loading && data && page === 'stress' && <StressPage data={data} />}
          {!loading && data && page === 'goal' && <GoalPage identity={identity} data={data} reload={reload} />}
          {!loading && data && page === 'assets' && <PortfolioPage identity={identity} data={data} reload={reload} />}
          {!loading && data && page === 'income' && <FixedIncomePage identity={identity} data={data} reload={reload} />}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const [identity, setIdentity] = useState<ClaimsIdentity | null | undefined>(undefined)
  const [publicPage, setPublicPage] = useState<'landing' | 'guide' | 'auth' | 'workspace'>('landing')
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'pro'>('free')
  const [initialPage, setInitialPage] = useState<Page>('guide')

  const refreshIdentity = useCallback(async () => {
    if (!supabase) { setIdentity(null); return }
    const { data, error } = await supabase.auth.getClaims()
    setIdentity(error || !data?.claims ? null : asIdentity(data.claims as Record<string, unknown>))
  }, [])

  useEffect(() => {
    if (!supabase) { setIdentity(null); return }
    void refreshIdentity()
    const { data } = supabase.auth.onAuthStateChange(() => { void refreshIdentity() })
    return () => data.subscription.unsubscribe()
  }, [refreshIdentity])

  const content = useMemo(() => {
    const openGuide = () => { setInitialPage('guide'); setPublicPage(identity ? 'workspace' : 'guide') }
    const openMember = (plan: 'free' | 'pro') => { setSelectedPlan(plan); setInitialPage('guide'); setPublicPage(identity ? 'workspace' : 'auth') }
    if (publicPage === 'landing') return <LandingPage onGuide={openGuide} onLogin={() => openMember('free')} onPlan={openMember} />
    if (publicPage === 'guide') return <GatewayPage onBack={() => setPublicPage('landing')} onStep={(step) => { setInitialPage((['assets', 'goal', 'income', 'home', 'report'] as Page[])[step]); setPublicPage(identity ? 'workspace' : 'auth') }} onFeature={(target) => { setInitialPage(target); setPublicPage(identity ? 'workspace' : 'auth') }} />
    if (identity === undefined) return <div className="boot-screen">正在確認安全登入狀態…</div>
    if (identity) return <AppShell key={initialPage} identity={identity} initialPage={initialPage} onHome={() => setPublicPage('landing')} />
    return <AuthPage onAuthenticated={async () => { await refreshIdentity(); setPublicPage('workspace') }} plan={selectedPlan} onBack={() => setPublicPage('landing')} />
  }, [identity, refreshIdentity, publicPage, selectedPlan, initialPage])

  return content
}

