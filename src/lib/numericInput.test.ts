import { describe, expect, it } from 'vitest'
import { formatNumericInput, normalizeNumericInput, numericInputError, parseNumericInput } from './numericInput'

describe('numeric input helpers', () => {
  it('keeps blank values blank and removes grouping separators', () => {
    expect(normalizeNumericInput('')).toBe('')
    expect(normalizeNumericInput('1,234,567')).toBe('1234567')
    expect(parseNumericInput('')).toBeNull()
  })

  it('formats thousands without changing decimal precision', () => {
    expect(formatNumericInput('6000')).toBe('6,000')
    expect(formatNumericInput('1234.50')).toBe('1,234.50')
  })

  it('uses consistent required and range messages', () => {
    expect(numericInputError('', { required: true, label: '投入金額' })).toBe('請輸入投入金額')
    expect(numericInputError('-1', { min: 0, label: '投入金額' })).toBe('投入金額不得小於 0')
    expect(numericInputError('101', { max: 100, label: '跌幅' })).toBe('跌幅不得大於 100')
  })
})
