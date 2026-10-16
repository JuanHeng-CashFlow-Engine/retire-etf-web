export type NumericRules = {
  required?: boolean
  min?: number
  max?: number
  integer?: boolean
  label?: string
}

export function normalizeNumericInput(value: string, allowNegative = false): string | null {
  const normalized = value.replace(/[,_\s]/g, '').replace(/，/g, '')
  if (normalized === '') return ''
  const pattern = allowNegative ? /^-?(?:\d+\.?\d*|\.\d*)$/ : /^(?:\d+\.?\d*|\.\d*)$/
  if (!pattern.test(normalized)) return null
  return normalized
}

export function parseNumericInput(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

export function numericOrNaN(value: string): number {
  return parseNumericInput(value) ?? Number.NaN
}

export function formatNumericInput(value: string | number): string {
  const raw = String(value ?? '').replace(/,/g, '').trim()
  if (!raw || raw === '-' || raw.endsWith('.')) return raw
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return raw
  const decimals = raw.includes('.') ? raw.split('.')[1].length : 0
  return new Intl.NumberFormat('zh-TW', {
    useGrouping: true,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(parsed)
}

export function numericInputError(value: string, rules: NumericRules = {}): string {
  const label = rules.label || '數值'
  const parsed = parseNumericInput(value)
  if (parsed == null) return rules.required ? `請輸入${label}` : ''
  if (rules.integer && !Number.isInteger(parsed)) return `${label}請輸入整數`
  if (rules.min != null && parsed < rules.min) return `${label}不得小於 ${formatNumericInput(rules.min)}`
  if (rules.max != null && parsed > rules.max) return `${label}不得大於 ${formatNumericInput(rules.max)}`
  return ''
}

