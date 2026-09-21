import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lookupMarketQuote } from './marketData'

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
})
