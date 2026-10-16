export type EtfCashflowProfile = 'conservative' | 'balanced' | 'income'

export type EtfAllocation = {
  id: string
  label: string
  purpose: string
  selectionGuide: string
  weightPct: number
  planningYieldPct: number
  payoutStressPct: number
  amount: number
  monthlyIncome: number
  stressedMonthlyIncome: number
}
export type EtfCashflowPlan = {
  status: 'on-track' | 'shortfall' | 'unrealistic'
  requiredYieldPct: number
  planningYieldPct: number
  estimatedMonthlyIncome: number
  stressedMonthlyIncome: number
  monthlyShortfall: number
  capitalNeeded: number
  additionalCapitalNeeded: number
  suggestedBuffer: number
  allocations: EtfAllocation[]
  headline: string
  guidance: string
}
type Bucket = Omit<EtfAllocation, 'amount' | 'monthlyIncome' | 'stressedMonthlyIncome'>

const templates: Record<EtfCashflowProfile, Bucket[]> = {
  conservative: [
    { id: 'bond', label: '短天期／投資級債券 ETF', purpose: '降低整體波動，建立較穩定的收益底座。', selectionGuide: '看存續期間、信用評等、幣別避險、費用率與成交價差。', weightPct: 50, planningYieldPct: 3, payoutStressPct: 10 },
    { id: 'dividend', label: '分散型股利 ETF', purpose: '提供主要股利來源，但不把單一產業或單一配息月份當核心。', selectionGuide: '看成分分散度、配息來源、至少三年配息紀錄、費用率與規模。', weightPct: 30, planningYieldPct: 5, payoutStressPct: 30 },
    { id: 'broad', label: '大型市值／全球大盤 ETF', purpose: '保留長期成長性，降低只追逐高配息造成的本金侵蝕風險。', selectionGuide: '看指數涵蓋範圍、追蹤誤差、費用率、流動性與匯率風險。', weightPct: 20, planningYieldPct: 2, payoutStressPct: 35 },
  ],
  balanced: [
    { id: 'bond', label: '短天期／投資級債券 ETF', purpose: '平衡股市波動並提供收益底座。', selectionGuide: '看存續期間、信用評等、幣別避險、費用率與成交價差。', weightPct: 30, planningYieldPct: 3, payoutStressPct: 10 },
    { id: 'dividend', label: '分散型股利 ETF', purpose: '作為主要現金流來源，同時控制產業集中。', selectionGuide: '看成分分散度、配息來源、至少三年配息紀錄、費用率與規模。', weightPct: 45, planningYieldPct: 5, payoutStressPct: 30 },
    { id: 'broad', label: '大型市值／全球大盤 ETF', purpose: '保留資本成長，避免退休組合只剩高股息因子。', selectionGuide: '看指數涵蓋範圍、追蹤誤差、費用率、流動性與匯率風險。', weightPct: 25, planningYieldPct: 2, payoutStressPct: 35 },
  ],
  income: [
    { id: 'bond', label: '短天期／投資級債券 ETF', purpose: '保留部分防守部位，避免全部曝險於股票配息。', selectionGuide: '看存續期間、信用評等、幣別避險、費用率與成交價差。', weightPct: 20, planningYieldPct: 3, payoutStressPct: 10 },
    { id: 'dividend', label: '分散型股利 ETF', purpose: '作為主要配息來源，但仍需分散發行人、產業與配息月份。', selectionGuide: '看成分分散度、配息來源、至少三年配息紀錄、費用率與規模。', weightPct: 55, planningYieldPct: 5, payoutStressPct: 30 },
    { id: 'broad', label: '大型市值／全球大盤 ETF', purpose: '保留少量長期成長來源。', selectionGuide: '看指數涵蓋範圍、追蹤誤差、費用率、流動性與匯率風險。', weightPct: 10, planningYieldPct: 2, payoutStressPct: 35 },
    { id: 'option-income', label: '收益增強／選擇權收益 ETF', purpose: '只作小比例收益增強，不作唯一生活費來源。', selectionGuide: '看總報酬、淨值侵蝕、配息組成、選擇權策略、費用率與多空市場表現。', weightPct: 15, planningYieldPct: 7, payoutStressPct: 45 },
  ],
}

export function planEtfCashflow(principal: number, monthlyTarget: number, profile: EtfCashflowProfile): EtfCashflowPlan {
  if (!Number.isFinite(principal) || principal <= 0) throw new Error('可投入金額必須大於 0。')
  if (!Number.isFinite(monthlyTarget) || monthlyTarget < 0) throw new Error('每月現金流目標不可小於 0。')
  const template = templates[profile]
  const allocations = template.map((bucket) => {
    const amount = principal * bucket.weightPct / 100
    const monthlyIncome = amount * bucket.planningYieldPct / 100 / 12
    return { ...bucket, amount, monthlyIncome, stressedMonthlyIncome: monthlyIncome * (1 - bucket.payoutStressPct / 100) }
  })
  const estimatedMonthlyIncome = allocations.reduce((sum, item) => sum + item.monthlyIncome, 0)
  const stressedMonthlyIncome = allocations.reduce((sum, item) => sum + item.stressedMonthlyIncome, 0)
  const planningYieldPct = estimatedMonthlyIncome * 12 / principal * 100
  const requiredYieldPct = monthlyTarget * 12 / principal * 100
  const capitalNeeded = monthlyTarget === 0 ? 0 : monthlyTarget * 12 / (planningYieldPct / 100)
  const additionalCapitalNeeded = Math.max(0, capitalNeeded - principal)
  const monthlyShortfall = Math.max(0, monthlyTarget - estimatedMonthlyIncome)
  const status = requiredYieldPct > 7 ? 'unrealistic' : monthlyShortfall > 1 ? 'shortfall' : 'on-track'
  const headline = status === 'on-track'
    ? '以這組規劃假設，月均現金流可覆蓋目標'
    : status === 'unrealistic'
      ? '目標需要過高配息率，不建議靠追逐高配息硬湊'
      : '目前本金尚不足以在這個風險配置下覆蓋目標'
  const guidance = status === 'on-track'
    ? '先保留現金緩衝，再逐檔核對配息來源、資料日期與總報酬。'
    : `可考慮增加約 ${(Math.ceil(additionalCapitalNeeded / 10000) * 10000).toLocaleString('zh-TW')} 元本金、降低每月目標，或延後開始提領；不要把配息率等同保證報酬。`
  return {
    status,
    requiredYieldPct,
    planningYieldPct,
    estimatedMonthlyIncome,
    stressedMonthlyIncome,
    monthlyShortfall,
    capitalNeeded,
    additionalCapitalNeeded,
    suggestedBuffer: monthlyTarget * 6,
    allocations,
    headline,
    guidance,
  }
}
