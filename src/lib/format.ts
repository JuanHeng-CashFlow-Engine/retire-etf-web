export const money = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  maximumFractionDigits: 0,
})

export const unitPrice = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const number = new Intl.NumberFormat('zh-TW', {
  maximumFractionDigits: 2,
})

export function dateLabel(value?: string | null) {
  if (!value) return '日期待確認'
  return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' }).format(
    new Date(`${value}T00:00:00`),
  )
}

