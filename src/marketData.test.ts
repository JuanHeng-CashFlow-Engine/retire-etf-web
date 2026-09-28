import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lookupMarketQuote, marketQuoteReview } from './marketData'

const mock = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), in: vi.fn() }))
vi.mock('./lib/supabase', () => ({ requireSupabase: () => ({ from: mock.from }) }))

beforeEach(() => {
  vi.resetAllMocks()
  mock.from.mockReturnValue({ select: mock.select })
  mock.select.mockReturnValue({ in: mock.in })
})

describe('shared market lookup', () => {
  it('looks up plain codes across Taiwan suffixes and preserves market fields', async () => {
    const quote = { ticker: '00981A.TW', name: '主動統一台股增長', price: 30, yield: 3, dividend_months: [3, 6] }
    mock.in.mockResolvedValue({ data: [quote], error: null })
    expect(await lookupMarketQuote(' 00981a ')).toEqual(quote)
    expect(mock.in).toHaveBeenCalledWith('ticker', ['00981A.TW', '00981A.TWO', '00981A'])
  })

  it('does not invent a price when no quote exists', async () => {
    mock.in.mockResolvedValue({ data: [], error: null })
    await expect(lookupMarketQuote('9999')).rejects.toThrow('尚無可用行情')
  })

  it('reports lookup failures and rejects invalid input before querying', async () => {
    await expect(lookupMarketQuote('invalid')).rejects.toThrow('有效的股票')
    expect(mock.from).not.toHaveBeenCalled()
    mock.in.mockResolvedValue({ data: null, error: { message: 'network error' } })
    await expect(lookupMarketQuote('0050')).rejects.toThrow('暫時無法讀取')
  })

  it('blocks stale or warning quotes from automatic assumption entry',()=>{
    const base={ticker:'2330.TW',name:'台積電',price:2475,yield:1.13,dividend_months:[],data_source:'fixture'}
    expect(marketQuoteReview({...base,dividend_status:null,last_updated_at:'2026-09-26T00:00:00Z'},new Date('2026-09-28T00:00:00Z')).usable).toBe(true)
    expect(marketQuoteReview({...base,dividend_status:null,last_updated_at:'2026-09-02T00:00:00Z'},new Date('2026-09-28T00:00:00Z')).reason).toContain('26 天')
    expect(marketQuoteReview({...base,dividend_status:'danger',last_updated_at:'2026-09-28T00:00:00Z'},new Date('2026-09-28T00:00:00Z')).usable).toBe(false)
  })
})

