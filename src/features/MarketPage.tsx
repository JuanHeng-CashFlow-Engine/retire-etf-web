import { useMemo, useState } from 'react'
import type { RetirementOverview } from '../data'
import { assetConcentration } from '../lib/insights'
import { money } from '../lib/format'
import { holdingMarketValue } from '../lib/metrics'
import { quickStressScenario } from '../lib/stress'
import { Empty, FeatureHeader, FeaturePanel, MiniBars, SummaryStats } from './shared'

export function MarketPage({ data, onNavigate }: { data: RetirementOverview; onNavigate: (page: string) => void }) {
  const [drop, setDrop] = useState(30)
  const [dividendDrop, setDividendDrop] = useState(20)
  const cash = data.assets.filter((item) => item.asset_type === 'cash').reduce((sum, item) => sum + Number(item.current_value || 0), 0)
  const exposed = data.holdings.reduce((sum, item) => sum + holdingMarketValue(item), 0) + data.assets.filter((item) => item.asset_type === 'fund').reduce((sum, item) => sum + Number(item.current_value || 0), 0)
  const dividendIncome = Math.max(0, data.metrics.monthlyIncome - data.fixedMonthlyIncome)
  const result = useMemo(() => quickStressScenario({ assets: data.metrics.totalAssets, exposed, monthlyExpense: data.monthlyExpense, cash, cashInAssets: true, marketDropPct: drop, dividendIncome, dividendDropPct: dividendDrop, externalIncome: data.fixedMonthlyIncome }), [data, exposed, cash, drop, dividendDrop, dividendIncome])
  const concentration = assetConcentration(data)
  const riskRows = concentration.rows.filter((item) => data.holdings.some((holding) => holding.name === item.name) || data.assets.some((asset) => asset.asset_name === item.name && asset.asset_type === 'fund')).slice(0, 5)
  const comparison = [0, 10, 20, 30, 40].map((pct) => data.metrics.totalAssets - exposed * pct / 100)

  return <section className="jh-feature-page"><FeatureHeader title="市場大跌追蹤" subtitle="設定資產價格與配息下降情境，估算退休資產及現金流承受力。" />
    <div className="jh-feature-grid">
      <FeaturePanel number={1} title="壓力情境設定" subtitle="價格與配息跌幅可分別調整"><div className="jh-drop-options">{[10, 20, 30, 40].map((value) => <button key={value} className={drop === value ? 'active' : ''} onClick={() => setDrop(value)}>下跌 {value}%</button>)}</div><label className="jh-feature-control">市場跌幅 <input type="range" min="0" max="80" value={drop} onChange={(event) => setDrop(Number(event.target.value))} />{drop}%</label><label className="jh-feature-control">配息減少 <input type="range" min="0" max="100" value={dividendDrop} onChange={(event) => setDividendDrop(Number(event.target.value))} />{dividendDrop}%</label><p className="jh-muted">價格下跌不一定使配息等比例減少；兩個假設分開計算。</p></FeaturePanel>
      <FeaturePanel number={2} title="資產下跌後總值" subtitle="以股票、ETF 與基金為曝險部位"><SummaryStats items={[{ label: '目前總資產', value: money.format(result.assetsBefore) }, { label: '曝險資產', value: money.format(exposed) }, { label: '情境後資產', value: money.format(result.assetsAfter), tone: 'jh-red' }]} /><MiniBars values={comparison} labels={['目前', '-10%', '-20%', '-30%', '-40%']} /></FeaturePanel>
      <FeaturePanel number={3} title="現金流影響" subtitle="固定收入維持原設定，配息按情境調整"><SummaryStats items={[{ label: '原月平均收入', value: money.format(result.monthlyIncomeBefore) }, { label: '情境後月收入', value: money.format(result.monthlyIncomeAfter), tone: 'jh-red' }, { label: '情境後月差額', value: money.format(result.monthlyGapAfter), tone: result.monthlyGapAfter < 0 ? 'jh-red' : 'jh-green' }]} /><p className="jh-muted">此處是月平均收入試算；配息實際入帳仍按月分布。</p></FeaturePanel>
      <FeaturePanel number={4} title="可支撐月數／年數" subtitle="可動用現金相對於情境後月缺口"><div className="jh-big-stat"><strong>{result.cashBufferMonths == null ? '目前無月缺口' : `${result.cashBufferMonths.toFixed(1)} 個月`}</strong><small>{result.cashBufferMonths == null ? '月平均收入覆蓋目前生活費' : `約 ${(result.cashBufferMonths / 12).toFixed(1)} 年；現金 ${money.format(cash)} ÷ 每月缺口 ${money.format(-result.monthlyGapAfter)}`}</small></div><p className="jh-muted">只計算已登錄的現金資產；不含出售投資資產、稅費與未登錄存款。</p></FeaturePanel>
      <FeaturePanel number={5} title="高風險部位辨識" subtitle="依目前曝險市值與集中度排序"><div className="jh-list">{riskRows.map((item) => <div key={item.name}><span>{item.name}</span><b>{money.format(item.value)}</b></div>)}{!riskRows.length && <Empty>尚未輸入有價格的股票、ETF 或基金。</Empty>}</div><p className="jh-muted">最大單一資產占總資產 {concentration.topPct.toFixed(1)}%。曝險部位只是情境假設，不是個別商品的風險評等。</p></FeaturePanel>
      <FeaturePanel number={6} title="應對建議" subtitle="根據本次情境核對可執行事項"><div className="jh-list"><div><span>現金安全墊</span><b>{result.cashBufferMonths != null && result.cashBufferMonths < 6 ? '優先補足' : '持續核對'}</b></div><div><span>單一資產集中度</span><b>{concentration.topPct >= 40 ? '需要檢查' : '持續觀察'}</b></div><div><span>必要生活費</span><b>{money.format(data.monthlyExpense)}</b></div></div><button className="jh-inline-link" onClick={() => onNavigate('stress')}>開啟詳細壓力試算 →</button><p className="jh-muted">本情境是敏感度分析，並非市場預測或投資建議。</p></FeaturePanel>
    </div></section>
}
