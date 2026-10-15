type Json = Record<string, unknown>
type StageRow = {
  source: string
  source_key: string
  ticker: string
  name: string
  declared_on: string | null
  ex_date: string | null
  payment_date: string | null
  cash_amount: number | null
  currency: string
  confidence: 'high' | 'medium' | 'low'
  review_status: 'pending' | 'official_complete'
  quality_reason: string
  source_url: string
  payload_hash: string
  raw_data: Json
  retrieved_at: string
  last_seen_at: string
}

type QuoteRow = {
  ticker: string
  price: number | string | null
  price_updated_at: string | null
  last_updated_at: string | null
}

const TWSE_COMPANY_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap45_L'
const TWSE_ETF_URL = 'https://www.twse.com.tw/rwd/zh/ETF/etfDiv'
const TPEX_ETF_URL = 'https://info.tpex.org.tw/api/etfProduct'

function adminKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || '' } catch { return '' }
}

function adminHeaders(key: string, extra: Record<string, string> = {}) {
  return {
    apikey: key,
    ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }),
    'Content-Type': 'application/json',
    ...extra,
  }
}

function finite(value: unknown): number | null {
  const parsed = Number(String(value ?? '').replaceAll(',', '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function isoDate(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const roc = raw.match(/^(\d{3})[年\/-]?(\d{1,2})[月\/-]?(\d{1,2})日?$/)
  if (roc) return `${Number(roc[1]) + 1911}-${roc[2].padStart(2, '0')}-${roc[3].padStart(2, '0')}`
  const compact = raw.match(/^(\d{3,4})(\d{2})(\d{2})$/)
  if (compact) return `${compact[1].length === 3 ? Number(compact[1]) + 1911 : compact[1]}-${compact[2]}-${compact[3]}`
  const normalized = raw.replaceAll('.', '-').replaceAll('/', '-')
  const parsed = new Date(`${normalized}T00:00:00+08:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

async function hash(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { Accept: 'application/json', 'User-Agent': 'JuanHeng-Retirement-DataSync/1.0', ...(init?.headers || {}) } })
  if (!response.ok) throw new Error(`${new URL(url).hostname} HTTP ${response.status}`)
  return await response.json()
}

async function rest(base: string, key: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${base}/rest/v1/${path}`, { ...init, headers: adminHeaders(key, init.headers as Record<string, string> || {}) })
  if (!response.ok) throw new Error(`Supabase ${path.split('?')[0]} HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function verifyToken(base: string, key: string, token: string) {
  const response = await fetch(`${base}/rest/v1/rpc/verify_market_sync_token`, {
    method: 'POST', headers: adminHeaders(key), body: JSON.stringify({ p_token: token }),
  })
  return response.ok && await response.json() === true
}

async function companyRows(now: string): Promise<StageRow[]> {
  const payload = await fetchJson(TWSE_COMPANY_URL) as Json[]
  const rows: StageRow[] = []
  for (const raw of payload) {
    const ticker = String(raw['公司代號'] ?? '').trim()
    const period = String(raw['股利所屬期間'] ?? '').trim()
    const term = String(raw['期別'] ?? '').trim()
    const amount = [
      raw['股東配發-盈餘分配之現金股利(元/股)'],
      raw['股東配發-法定盈餘公積發放之現金(元/股)'],
      raw['股東配發-資本公積發放之現金(元/股)'],
    ].map(finite).reduce<number>((sum, value) => sum + (value ?? 0), 0)
    if (!ticker || !period || amount <= 0) continue
    rows.push({
      source: 'twse_company_dividend', source_key: `${ticker}|${period}|${term || '1'}`, ticker,
      name: String(raw['公司名稱'] ?? ''), declared_on: isoDate(raw['董事會（擬議）股利分派日']),
      ex_date: null, payment_date: null, cash_amount: amount, currency: 'TWD', confidence: 'medium',
      review_status: 'pending', quality_reason: '官方公司股利決議資料未包含除息日與發放日，僅進入待核對區。',
      source_url: TWSE_COMPANY_URL, payload_hash: await hash(raw), raw_data: raw, retrieved_at: now, last_seen_at: now,
    })
  }
  return rows
}

async function twseEtfRows(ticker: string, now: string): Promise<StageRow[]> {
  const today = new Date()
  const start = `${today.getUTCFullYear() - 2}0101`
  const end = `${today.getUTCFullYear()}1231`
  const url = `${TWSE_ETF_URL}?stkNo=${encodeURIComponent(ticker)}&startDate=${start}&endDate=${end}&response=json`
  const payload = await fetchJson(url) as { status?: string; fields?: string[]; data?: unknown[][] }
  if (payload.status !== 'ok' || !Array.isArray(payload.data) || !Array.isArray(payload.fields)) return []
  const index = (needle: string) => payload.fields!.findIndex((field) => field.includes(needle))
  const codeIndex = index('證券代號'), nameIndex = index('證券簡稱'), exIndex = index('除息交易日')
  const paymentIndex = index('收益分配發放日'), amountIndex = index('收益分配金額')
  if ([codeIndex, exIndex, paymentIndex, amountIndex].some((value) => value < 0)) return []
  const rows: StageRow[] = []
  for (const values of payload.data) {
    const code = String(values[codeIndex] ?? ticker).trim()
    const exDate = isoDate(values[exIndex]), paymentDate = isoDate(values[paymentIndex]), amount = finite(values[amountIndex])
    if (!code || !exDate || !paymentDate || amount == null || amount < 0) continue
    const raw = Object.fromEntries(payload.fields.map((field, itemIndex) => [field, values[itemIndex]])) as Json
    rows.push({
      source: 'twse_etf_distribution', source_key: `${code}|${exDate}`, ticker: code,
      name: nameIndex >= 0 ? String(values[nameIndex] ?? '') : '', declared_on: null, ex_date: exDate,
      payment_date: paymentDate, cash_amount: amount, currency: 'TWD', confidence: 'high',
      review_status: 'official_complete', quality_reason: '證交所 ETF 收益分配資料包含代號、除息日、發放日與每單位金額。',
      source_url: url, payload_hash: await hash(raw), raw_data: raw, retrieved_at: now, last_seen_at: now,
    })
  }
  return rows
}

async function tpexEtfRows(ticker: string, now: string): Promise<StageRow[]> {
  const payload = await fetchJson(TPEX_ETF_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ lang: 'zh-tw', query: ticker }),
  }) as Json
  if (!Array.isArray(payload.dividend)) return []
  const name = String(payload.shortName ?? payload.name ?? '')
  const currency = String(payload.currency ?? 'TWD')
  const rows: StageRow[] = []
  for (const item of payload.dividend as Json[]) {
    const paymentDate = isoDate(item.date), amount = finite(item.count)
    if (!paymentDate || amount == null || amount < 0) continue
    rows.push({
      source: 'tpex_etf_product', source_key: `${ticker}|${paymentDate}`, ticker, name,
      declared_on: null, ex_date: null, payment_date: paymentDate, cash_amount: amount, currency,
      confidence: 'medium', review_status: 'pending',
      quality_reason: '櫃買中心 ETF 商品服務僅提供近期發放日與金額，缺少除息日，保留待核對且不自動更新殖利率。',
      source_url: TPEX_ETF_URL, payload_hash: await hash(item), raw_data: item, retrieved_at: now, last_seen_at: now,
    })
  }
  return rows
}

async function upsertStages(base: string, key: string, rows: StageRow[]) {
  for (let offset = 0; offset < rows.length; offset += 250) {
    await rest(base, key, 'market_dividend_staging?on_conflict=source,source_key', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(offset, offset + 250)),
    })
  }
}

async function promoteComplete(base: string, key: string, rows: StageRow[]) {
  const complete = rows.filter((row) => row.review_status === 'official_complete' && row.ex_date && row.payment_date && row.cash_amount != null)
  if (!complete.length) return 0
  const payload = complete.map((row) => ({
    ticker: row.ticker, ex_date: row.ex_date, payment_date: row.payment_date, dividend: row.cash_amount,
    dividend_type: 'cash', source: row.source, source_record_key: row.source_key, source_url: row.source_url,
    retrieved_at: row.retrieved_at, payload_hash: row.payload_hash, verification_status: 'official_complete',
  }))
  await rest(base, key, 'dividend_history?on_conflict=source,source_record_key', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(payload),
  })
  return complete.length
}

function ageDays(value: string | null, now: Date) {
  if (!value) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return (now.getTime() - parsed) / 86_400_000
}

async function updateDividendSnapshots(base: string, key: string, rows: StageRow[], quotes: QuoteRow[], now: string) {
  const byTicker = new Map<string, StageRow[]>()
  for (const row of rows) {
    if (row.review_status !== 'official_complete' || !row.payment_date || row.cash_amount == null) continue
    const list = byTicker.get(row.ticker) ?? []
    list.push(row)
    byTicker.set(row.ticker, list)
  }

  let updated = 0
  const current = new Date(now)
  for (const quote of quotes) {
    const code = quote.ticker.toUpperCase().replace(/\.(TW|TWO)$/i, '')
    const events = (byTicker.get(code) ?? []).sort((a, b) => String(b.payment_date).localeCompare(String(a.payment_date)))
    if (!events.length) continue

    const trailingStart = new Date(current)
    trailingStart.setUTCFullYear(trailingStart.getUTCFullYear() - 1)
    const trailing = events.filter((row) => {
      const parsed = Date.parse(`${row.payment_date}T00:00:00+08:00`)
      return Number.isFinite(parsed) && parsed >= trailingStart.getTime() && parsed <= current.getTime()
    })
    const price = Number(quote.price)
    const priceAge = ageDays(quote.price_updated_at ?? quote.last_updated_at, current)
    const priceUsable = Number.isFinite(price) && price > 0 && priceAge != null && priceAge >= -1 && priceAge <= 7
    const annualDividend = trailing.reduce((sum, row) => sum + Number(row.cash_amount ?? 0), 0)
    const payload: Record<string, unknown> = {
      dividend_months: [...new Set(events.map((row) => Number(String(row.payment_date).slice(5, 7))).filter((month) => month >= 1 && month <= 12))].sort((a, b) => a - b),
      frequency: trailing.length ? `${trailing.length} 次／近 12 個月` : '近 12 個月無已發放紀錄',
      last_dividend_amount: events[0]?.cash_amount ?? null,
      previous_dividend_amount: events[1]?.cash_amount ?? null,
      dividend_change_pct: 0,
      dividend_updated_at: now,
      dividend_data_source: 'TWSE ETF 收益分配官方資料',
      dividend_status: priceUsable && annualDividend > 0 ? 'official' : 'warning',
      warning_message: priceUsable && annualDividend > 0
        ? '近 12 個月官方已發放金額除以七天內價格快照；未來配息仍可能變動。'
        : '官方配息紀錄已更新；價格快照超過七天或缺少，殖利率維持原值並等待行情更新。',
      updated_at: now,
    }
    if (priceUsable && annualDividend > 0) payload.yield = annualDividend / price * 100
    await rest(base, key, `etf_prices?ticker=eq.${encodeURIComponent(quote.ticker)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload),
    })
    updated += 1
  }
  return updated
}

async function runSync(base: string, key: string) {
  const now = new Date().toISOString()
  const run = await rest(base, key, 'market_data_sync_runs?select=id', {
    method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ provider: 'TWSE+TPEx', status: 'running', started_at: now }),
  }) as { id: number }[]
  const runId = run[0]?.id
  let fetched = 0, promoted = 0
  const errors: string[] = []
  try {
    const company = await companyRows(now)
    fetched += company.length
    const quotes = await rest(base, key, 'etf_prices?select=ticker,price,price_updated_at,last_updated_at&order=ticker&limit=500') as QuoteRow[]
    const trackedMap = new Map<string, { code: string; market: 'TWSE' | 'TPEX' }>()
    for (const item of quotes) {
      const raw = String(item.ticker).toUpperCase(), code = raw.replace(/\.(TW|TWO)$/i, '')
      if (!/^00\d{2,4}[A-Z]?$/.test(code)) continue
      const market = raw.endsWith('.TWO') ? 'TPEX' : 'TWSE'
      trackedMap.set(`${code}|${market}`, { code, market })
    }
    const tracked = [...trackedMap.values()]
    const marketRows: StageRow[] = []
    for (let offset = 0; offset < tracked.length; offset += 8) {
      const group = tracked.slice(offset, offset + 8)
      const settled = await Promise.allSettled(group.map((item) => item.market === 'TPEX' ? tpexEtfRows(item.code, now) : twseEtfRows(item.code, now)))
      for (const item of settled) item.status === 'fulfilled' ? marketRows.push(...item.value) : errors.push(String(item.reason).slice(0, 240))
    }
    const rows = [...company, ...marketRows]
    fetched += marketRows.length
    await upsertStages(base, key, rows)
    promoted = await promoteComplete(base, key, marketRows)
    const dividendSnapshotsUpdated = await updateDividendSnapshots(base, key, marketRows, quotes, now)
    const status = errors.length ? 'partial' : 'succeeded'
    await rest(base, key, `market_data_sync_runs?id=eq.${runId}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status, fetched_count: fetched, staged_count: rows.length, promoted_count: promoted, completed_at: new Date().toISOString(), details: { errors: errors.slice(0, 20), tracked_etfs: tracked.length, dividend_snapshots_updated: dividendSnapshotsUpdated } }),
    })
    return { ok: true, status, fetched, staged: rows.length, promoted, dividend_snapshots_updated: dividendSnapshotsUpdated, tracked_etfs: tracked.length, errors: errors.slice(0, 5) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (runId) await rest(base, key, `market_data_sync_runs?id=eq.${runId}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', fetched_count: fetched, promoted_count: promoted, completed_at: new Date().toISOString(), details: { error: message } }) }).catch(() => null)
    throw error
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 })
  const base = Deno.env.get('SUPABASE_URL') || ''
  const key = adminKey()
  if (!base || !key) return Response.json({ error: 'server configuration unavailable' }, { status: 503 })
  if (!await verifyToken(base, key, req.headers.get('x-cron-token') || '')) return Response.json({ error: 'unauthorized' }, { status: 401 })
  try { return Response.json(await runSync(base, key)) }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'sync failed' }, { status: 502 }) }
})
