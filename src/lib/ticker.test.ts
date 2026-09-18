import { describe, expect, it } from 'vitest'
import { cleanTicker, sameTicker, tickerCandidates, tickerCode } from './ticker'

describe('Taiwan ticker normalization', () => {
  it('finds both listed and OTC candidates for a bare numeric code', () => {
    expect(tickerCandidates('2884')).toEqual(['2884.TW', '2884.TWO', '2884'])
  })

  it('keeps an explicit market suffix as the first choice', () => {
    expect(tickerCandidates('6488.two')[0]).toBe('6488.TWO')
  })

  it('matches legacy bare codes with canonical market tickers', () => {
    expect(tickerCode('2884.TW')).toBe('2884')
    expect(sameTicker('2884', '2884.TW')).toBe(true)
    expect(sameTicker('2884', '2885.TW')).toBe(false)
  })

  it('normalizes whitespace and casing', () => {
    expect(cleanTicker('  abc.tw ')).toBe('ABC.TW')
  })
})


