import type { MarketQuote } from '../types'

export type Confidence = '高' | '中' | '低'

export type Freshness = {
  asOf: string | null
  ageDays: number | null
  stale: boolean
  futureDated: boolean
}

export type DataCheck = {
  state: 'fresh' | 'stale' | 'missing' | 'invalid' | 'future'
  asOf: string | null
  source: string | null
  issues: string[]
}

export type MarketQuoteValidation = {
  price: DataCheck
  dividend: DataCheck
  usablePrice: boolean
  usableDividend: boolean
  issues: string[]
}

export function assessFreshness(asOf: string | null | undefined, now = new Date(), maxAgeDays = 7): Freshness {
  const parsed = asOf ? new Date(asOf) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return { asOf: null, ageDays: null, stale: true, futureDated: false }
  const rawAge = (now.getTime() - parsed.getTime()) / 86_400_000
  const futureDated = rawAge < -1
  const ageDays = Math.max(0, rawAge)
  return { asOf: parsed.toISOString(), ageDays, stale: futureDated || ageDays > maxAgeDays, futureDated }
}

function checkTimestamp(asOf: string | null | undefined, source: string | null | undefined, now: Date, maxAgeDays: number, label: string): DataCheck {
  const freshness = assessFreshness(asOf, now, maxAgeDays)
  const issues: string[] = []
  let state: DataCheck['state'] = 'fresh'
  if (!freshness.asOf) {
    state = 'missing'
    issues.push(`${label}缺少更新時間`)
  } else if (freshness.futureDated) {
    state = 'future'
    issues.push(`${label}更新時間晚於目前時間`)
  } else if (freshness.stale) {
    state = 'stale'
    issues.push(`${label}已 ${Math.floor(freshness.ageDays ?? 0)} 天未更新`)
  }
  const cleanSource = source?.trim() || null
  if (!cleanSource) issues.push(`${label}缺少資料來源`)
  return { state, asOf: freshness.asOf, source: cleanSource, issues }
}

export function validateMarketQuote(quote: MarketQuote, now = new Date()): MarketQuoteValidation {
  const price = checkTimestamp(quote.price_updated_at ?? quote.last_updated_at, quote.data_source, now, 7, '行情')
  const dividend = checkTimestamp(quote.dividend_updated_at ?? quote.last_updated_at, quote.dividend_data_source ?? quote.data_source, now, 7, '配息')
  const priceValue = Number(quote.price)
  const yieldValue = Number(quote.yield)
  if (!Number.isFinite(priceValue) || priceValue <= 0) {
    price.state = 'invalid'
    price.issues.push('行情價格不是有效正數')
  }
  if (quote.yield == null || !Number.isFinite(yieldValue) || yieldValue < 0 || yieldValue > 100) {
    dividend.state = 'invalid'
    dividend.issues.push('配息率缺少或超出 0–100% 合理範圍')
  }
  const dividendStatus = String(quote.dividend_status || '').toLowerCase()
  if (['danger', 'warning', 'insufficient'].includes(dividendStatus)) dividend.issues.push('配息或相依價格仍需人工核對')
  const usablePrice = price.state === 'fresh' && price.issues.length === 0
  const usableDividend = dividend.state === 'fresh' && dividend.issues.length === 0
  return { price, dividend, usablePrice, usableDividend, issues: [...price.issues, ...dividend.issues] }
}

export function summarizeMarketTrust(quotes: MarketQuote[], now = new Date()) {
  const reviews = quotes.map((quote) => validateMarketQuote(quote, now))
  const dated = reviews.flatMap((item) => [item.price.asOf, item.dividend.asOf]).filter((value): value is string => Boolean(value)).sort()
  const sources = [...new Set(reviews.flatMap((item) => [item.price.source, item.dividend.source]).filter((value): value is string => Boolean(value)))]
  const issueCount = reviews.filter((item) => item.issues.length > 0).length
  const confidence: Confidence = !quotes.length || issueCount > 0 ? '低' : reviews.every((item) => item.usablePrice && item.usableDividend) ? '高' : '中'
  const issues = [...new Set(reviews.flatMap((item) => item.issues))]
  return {
    asOf: dated[0] ?? null,
    sources: sources.length ? sources : ['會員輸入／來源未標示'],
    confidence,
    reason: issues.length ? `${issues.join('；')}。共 ${issueCount} 筆資料需核對；相關結果不會視為即時或已確認資料。` : '所有已載入行情與配息資料均有來源，且更新時間在七天有效期內；未來行情、配息與報酬仍屬假設。',
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
