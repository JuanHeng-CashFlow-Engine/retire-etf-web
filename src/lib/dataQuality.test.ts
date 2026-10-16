import { describe, expect, it } from 'vitest'
import { assessFreshness, resolveMarketPrice, summarizeMarketTrust, validateMarketQuote } from './dataQuality'

describe('data quality and market fallback', () => {
  const now = new Date('2026-10-15T12:00:00Z')

  it('treats missing, stale and future-dated records as untrusted', () => {
    expect(assessFreshness(null, now).stale).toBe(true)
    expect(assessFreshness('2026-10-01T00:00:00Z', now).stale).toBe(true)
    expect(assessFreshness('2026-10-20T00:00:00Z', now).futureDated).toBe(true)
  })

  it('uses a fresh primary quote and falls back to a recent database snapshot', () => {
    const fallback = { price: 42, asOf: '2026-10-12T00:00:00Z', source: 'etf_prices', tier: '備援快照' as const }
    expect(resolveMarketPrice({ primary: { price: 44, asOf: '2026-10-15T05:00:00Z', source: 'Yahoo', tier: '主要行情' }, fallback, now })?.price).toBe(44)
    expect(resolveMarketPrice({ primary: { price: 44, asOf: '2026-10-01T05:00:00Z', source: 'Yahoo', tier: '主要行情' }, fallback, now })?.price).toBe(42)
    expect(resolveMarketPrice({ primary: null, fallback: { ...fallback, asOf: '2026-09-01T00:00:00Z' }, now })).toBeNull()
  })

  it('lowers portfolio confidence when any quote is stale or warned', () => {
    const result = summarizeMarketTrust([
      { ticker: '0050.TW', name: '0050', price: 100, yield: 2, dividend_months: [], dividend_status: null, data_source: 'primary', last_updated_at: '2026-10-14T00:00:00Z' },
      { ticker: '00878.TW', name: '00878', price: 20, yield: 5, dividend_months: [], dividend_status: 'danger', data_source: 'backup', last_updated_at: '2026-10-14T00:00:00Z' },
    ], now)
    expect(result.confidence).toBe('低')
    expect(result.sources).toEqual(['primary', 'backup'])
    expect(result.reason).toContain('人工核對')
  })

  it('validates price and dividend timestamps, values, status and sources independently', () => {
    const valid = validateMarketQuote({ ticker: '0050.TW', name: '0050', price: 100, yield: 2.5, dividend_months: [1, 7], dividend_status: 'official', data_source: 'TWSE', dividend_data_source: 'TWSE dividend', price_updated_at: '2026-10-15T00:00:00Z', dividend_updated_at: '2026-10-14T00:00:00Z', last_updated_at: null }, now)
    expect(valid.usablePrice).toBe(true)
    expect(valid.usableDividend).toBe(true)

    const invalid = validateMarketQuote({ ticker: '0050.TW', name: '0050', price: 0, yield: 120, dividend_months: [], dividend_status: 'warning', data_source: null, dividend_data_source: null, price_updated_at: '2026-11-01T00:00:00Z', dividend_updated_at: null, last_updated_at: null }, now)
    expect(invalid.usablePrice).toBe(false)
    expect(invalid.usableDividend).toBe(false)
    expect(invalid.issues).toEqual(expect.arrayContaining(['行情缺少資料來源', '行情價格不是有效正數', '配息缺少更新時間', '配息缺少資料來源', '配息或相依價格仍需人工核對']))
  })
})

