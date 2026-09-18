import type { FixedIncome } from '../types'

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function fixedIncomeForMonth(incomes: FixedIncome[], key: string): number {
  return incomes.reduce((sum, income) => {
    const start = income.start_month.slice(0, 7)
    const end = income.end_month?.slice(0, 7)
    if (key < start || (end && key > end)) return sum
    return sum + Math.max(0, Number(income.monthly_amount) || 0)
  }, 0)
}

export function fixedIncomeRange(income: FixedIncome, startDate: Date): { monthlyAmount: number; startMonthOffset: number; endMonthOffset: number | null } {
  const offset = (value: string) => (Number(value.slice(0, 4)) - startDate.getFullYear()) * 12 + Number(value.slice(5, 7)) - (startDate.getMonth() + 1)
  return {
    monthlyAmount: Number(income.monthly_amount) || 0,
    startMonthOffset: Math.max(0, offset(income.start_month)),
    endMonthOffset: income.end_month == null ? null : offset(income.end_month),
  }
}
