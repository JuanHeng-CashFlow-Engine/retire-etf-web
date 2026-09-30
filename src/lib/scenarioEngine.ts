export type ShockAxis = 'market_value' | 'investment_income'
export type ScenarioShock = { axis: ShockAxis; changePct: number; source: string }

export function shockMatrix(shocks: ScenarioShock[]): Record<ShockAxis, ScenarioShock> {
  const matrix = {} as Record<ShockAxis, ScenarioShock>
  for (const shock of shocks) {
    if (!Number.isFinite(shock.changePct) || shock.changePct < -100 || shock.changePct > 100) throw new Error('情境變動需介於 -100% 與 100%。')
    if (matrix[shock.axis]) throw new Error(`同一情境不可重複套用 ${shock.axis} 衝擊。`)
    matrix[shock.axis] = shock
  }
  return matrix
}

export function applyShock(value: number, shock?: ScenarioShock) {
  if (!Number.isFinite(value) || value < 0) throw new Error('情境基礎金額必須是非負有效數字。')
  return shock ? value * (1 + shock.changePct / 100) : value
}

