import { describe, expect, it } from 'vitest'
import { friendlySourceLabel } from './sourceLabels'

describe('friendlySourceLabel', () => {
  it('replaces internal table names with user-facing Chinese labels', () => {
    expect(friendlySourceLabel('user_assets、user_portfolios + etf_prices')).toBe('其他資產紀錄、股票與 ETF 持股 + 市場價格與配息快照')
  })

  it('does not expose an unknown internal identifier', () => {
    expect(friendlySourceLabel('retirement_ai_engine_v2')).toBe('系統保存資料')
  })

  it('keeps an already friendly source label', () => {
    expect(friendlySourceLabel('會員輸入與情境引擎')).toBe('會員輸入與情境引擎')
  })
})
