import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { brandLogoUrl } from './brandAssets'
import { loadRetirementOverview, removeHolding, saveHolding, type RetirementOverview } from './data'
import { dateLabel, money, number, unitPrice } from './lib/format'
import { buildCashflowProjection } from './lib/cashflow'
import { holdingMarketValue } from './lib/metrics'
import { isSupabaseConfigured, requireSupabase, supabase } from './lib/supabase'
import type { ClaimsIdentity } from './types'

type Page = 'home' | 'cashflow' | 'stress' | 'goal' | 'assets' | 'monthly'

const navItems: { id: Page; icon: string; label: string }[] = [
  { id: 'home', icon: '⌂', label: '我的退休今天安全嗎？' },
  { id: 'cashflow', icon: '▦', label: '下一筆錢何時進來？' },
  { id: 'stress', icon: '♢', label: '如果市場大跌怎麼辦？' },
  { id: 'goal', icon: '◎', label: '距離退休還有多遠？' },
  { id: 'assets', icon: '▥', label: '我的錢放得安全嗎？' },
  { id: 'monthly', icon: '▤', label: '這個月發生什麼變化？' },
]

function asIdentity(claims: Record<string, unknown>): ClaimsIdentity | null {
  const id = typeof claims.sub === 'string' ? claims.sub : ''
  const email = typeof claims.email === 'string' ? claims.email : '會員'
  return id ? { id, email } : null
}

function SetupNotice() {
  return (
    <main className="setup-page">
      <img className="setup-logo" src={brandLogoUrl} alt="涓恆退休金流續航儀" />
      <div>
        <p className="eyebrow">React 新版前端</p>
        <h1>尚未設定公開連線資訊</h1>
        <p>複製 <code>.env.example</code> 為 <code>.env.local</code>，填入 Supabase URL 與 publishable key 後重新啟動。</p>
        <p className="security-note">瀏覽器端只使用 publishable key；不得放入 secret 或 service_role key。</p>
      </div>
    </main>
  )
}

function AuthPage({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
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
      <section className="auth-brand" aria-label="品牌介紹">
        <img src={brandLogoUrl} alt="JuanHeng CashFlow Engine" />
        <div>
          <p className="eyebrow">今天開始，讓未來更安心</p>
          <h1>看見現在，<br /><span>規劃更好的退休未來</span></h1>
          <p>看懂每月現金流、退休目標與市場波動。<br />資料由同一套 Supabase 權限安全管理。</p>
        </div>
      </section>
      <section className="auth-columns">
        <div className="quick-preview">
          <p className="eyebrow">免登入快速了解</p>
          <h2>先看懂，再做決定</h2>
          <div className="preview-stats">
            <span><strong>1</strong> 統一資料來源</span>
            <span><strong>12</strong> 個月現金流</span>
            <span><strong>0</strong> 高權限金鑰</span>
          </div>
          <p>新版前端只讀取公開市場資料；會員資料由 JWT 與 RLS 限制為本人可見。</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <p className="eyebrow">登入涓恆退休金流續航儀</p>
          <h2>{mode === 'login' ? '歡迎回來' : '建立會員帳號'}</h2>
          <div className="auth-tabs" role="tablist">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>登入</button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>註冊</button>
          </div>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>密碼<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="primary-button" disabled={busy}>{busy ? '處理中…' : mode === 'login' ? '登入' : '建立帳號'}</button>
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
        <div className="hero-ring"><Ring value={score} label={score == null ? '待完成模擬' : '模擬成功率'} /></div>
        <div className="hero-copy">
          <p className="eyebrow">退休健康摘要</p>
          <h1>{score == null ? '資料已連線，等待完成模擬' : score >= 70 ? '退休計畫大致在軌道上' : '退休計畫需要調整'}</h1>
          <p>{gps?.gps_message || '目前先用已核對資產、生活費與退休目標呈現，不把資料完整度誤當健康分數。'}</p>
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
        <button className={`metric-card ${metrics.monthlyGap < 0 ? 'red' : 'green'}`} onClick={() => onNavigate('monthly')}>
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
      <p className="eyebrow">只寫入本人的 user_portfolios</p>
      <h1>我的投資組合</h1>
      <p className="lead">市場價格主檔維持唯讀；新增標的不會以高權限代替會員修改全站資料。</p>
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
    </section>
  )
}

function MigrationPlaceholder({ page }: { page: Exclude<Page, 'home' | 'assets'> }) {
  const item = navItems.find((entry) => entry.id === page)!
  return <section className="page-section"><p className="eyebrow">React 遷移中</p><h1>{item.icon} {item.label}</h1><p className="lead">這個頁面會沿用正式 Supabase 資料與既有計算規則。第一階段先完成登入、首頁摘要及投資組合的安全資料鏈路。</p><div className="migration-card"><strong>目前狀態</strong><span>Streamlit 舊版仍可正常使用；這裡尚未取代正式功能。</span></div></section>
}

function AppShell({ identity }: { identity: ClaimsIdentity }) {
  const [page, setPage] = useState<Page>('home')
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

  async function signOut() { await requireSupabase().auth.signOut() }

  return (
    <div className="app-shell">
      <aside>
        <img className="sidebar-logo" src={brandLogoUrl} alt="涓恆退休金流續航儀" />
        <nav>{navItems.map((item) => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="sidebar-footer"><span>{identity.email}</span><button onClick={signOut}>登出</button></div>
      </aside>
      <main className="workspace">
        <header className="masthead"><div className="masthead-brand"><img src={brandLogoUrl} alt="" /><div><strong>{navItems.find((item) => item.id === page)?.label}</strong><span>看見現在，規劃更好的退休未來</span></div></div><div className="member-pill">● {identity.email}</div></header>
        <div className="content">
          {loading && <div className="loading">正在透過 RLS 載入您的資料…</div>}
          {error && <div className="error-banner">{error}<button onClick={() => void reload()}>重試</button></div>}
          {!loading && data && page === 'home' && <Dashboard data={data} onNavigate={setPage} />}
          {!loading && data && page === 'cashflow' && <CashflowPage data={data} />}
          {!loading && data && page === 'assets' && <PortfolioPage identity={identity} data={data} reload={reload} />}
          {!loading && data && page !== 'home' && page !== 'cashflow' && page !== 'assets' && <MigrationPlaceholder page={page} />}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const [identity, setIdentity] = useState<ClaimsIdentity | null | undefined>(undefined)

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
    if (!isSupabaseConfigured) return <SetupNotice />
    if (identity === undefined) return <div className="boot-screen">正在確認安全登入狀態…</div>
    if (!identity) return <AuthPage onAuthenticated={refreshIdentity} />
    return <AppShell identity={identity} />
  }, [identity, refreshIdentity])

  return content
}

