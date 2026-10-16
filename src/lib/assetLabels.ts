export const assetTypeLabels: Record<string, string> = {
  stock: '股票',
  etf: 'ETF',
  fund: '基金',
  cash: '現金',
  bond: '債券／定存',
  insurance: '保單／年金',
  other: '其他資產',
}
export function assetTypeLabel(type: string) {
  return assetTypeLabels[type] ?? '其他資產'
}
