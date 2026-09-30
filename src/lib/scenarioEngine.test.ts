import { describe, expect, it } from 'vitest'
import { applyShock, shockMatrix } from './scenarioEngine'

describe('scenario engine', () => {
  it('applies one normalized shock per risk axis', () => {
    const matrix = shockMatrix([{ axis: 'market_value', changePct: -20, source: 'user' }, { axis: 'investment_income', changePct: -10, source: 'user' }])
    expect(applyShock(100, matrix.market_value)).toBe(80)
    expect(applyShock(100, matrix.investment_income)).toBe(90)
  })
  it('rejects duplicate risk shocks instead of double counting', () => {
    expect(() => shockMatrix([{ axis: 'market_value', changePct: -10, source: 'news' }, { axis: 'market_value', changePct: -20, source: 'market' }])).toThrow('重複套用')
  })
})

