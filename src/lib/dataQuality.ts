import type { MarketQuote } from '../types'

export type Confidence = '高' | '中' | '低'

export type Freshness = {
  asOf: string | null
  ageDays: number | null
  stale: boolean
  futureDated: boolean
}

export function assessFreshness(asOf: string | null | undefined, now = new Date(), maxAgeDays = 7): Freshness {
  const parsed = asOf ? new Date(asOf) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return { asOf: null, ageDays: null, stale: true, futureDated: false }
  const rawAge = (now.getTime() - parsed.getTime()) / 86_400_000
  const futureDated = rawAge < -1
  const ageDays = Math.max(0, rawAge)
  return { asOf: parsed.toISOString(), ageDays, stale: futureDated || ageDays > maxAgeDays, futureDated }
}

export function summarizeMarketTrust(quotes: MarketQuote[], now = new Date()) {
  const reviews = quotes.map((quote) => ({
    quote,
    freshness: assessFreshness(quote.last_updated_at, now),
    warned: String(quote.dividend_status || '').toLowerCase() === 'danger',
  }))
  const missing = reviews.filter((item) => item.freshness.ageDays == null).length
  const stale = reviews.filter((item) => item.freshness.stale).length
  const warned = reviews.filter((item) => item.warned).length
  const dated = reviews.map((item) => item.freshness.asOf).filter((value): value is string => Boolean(value)).sort()
  const sources = [...new Set(quotes.map((quote) => quote.data_source?.trim()).filter((value): value is string => Boolean(value)))]
  const confidence: Confidence = !quotes.length || missing > 0 || stale > 0 || warned > 0 ? '低' : reviews.every((item) => (item.freshness.ageDays ?? 99) <= 2) ? '高' : '中'
  const issues = [missing ? `${missing} 筆缺少更新時間` : '', stale ? `${stale} 筆資料過期` : '', warned ? `${warned} 筆配息需人工核對` : ''].filter(Boolean)
  return {
    asOf: dated[0] ?? null,
    sources: sources.length ? sources : ['會員輸入／來源未標示'],
    confidence,
    reason: issues.length ? `${issues.join('、')}；相關結果應先核對，不會視為即時或已確認資料。` : '所有已載入市場資料均在七天有效期內；未來行情、配息與報酬仍屬假設。',
  }
}

export type PriceCandidate = {
  price: number
  asOf: string | null
  source: string
  tier: '主要行情' | '備援快照'
}

export type ResolvedPrice = PriceCandidate & { ageDays: number; confidence: Confidence }

export function resolveMarketPrice(input: {
  primary?: PriceCandidate | null
  fallback?: PriceCandidate | null
  now?: Date
}): ResolvedPrice | null {
  const now = input.now ?? new Date()
  const candidates = [input.primary, input.fallback].filter((candidate): candidate is PriceCandidate => Boolean(candidate))
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.price) || candidate.price <= 0) continue
    const freshness = assessFreshness(candidate.asOf, now, candidate.tier === '主要行情' ? 4 : 7)
    if (freshness.stale || freshness.ageDays == null) continue
    return { ...candidate, ageDays: freshness.ageDays, confidence: candidate.tier === '主要行情' && freshness.ageDays <= 2 ? '高' : '中' }
  }
  return null
}

