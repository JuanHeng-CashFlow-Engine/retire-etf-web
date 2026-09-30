import { brandLogoUrl, landingReferenceUrl } from './brandAssets'

export type ExperiencePage = 'guide' | 'dividends' | 'gap' | 'market' | 'success' | 'report'
export const features: { id: ExperiencePage; icon: string; title: string; subtitle: string; freeDescription: string; proDescription: string }[] = [
  { id: 'dividends', icon: '▦', title: '配息與入帳月曆', subtitle: '本次輸入的配息時程', freeDescription: '免費版：本次瀏覽可輸入並查看已入帳、已公告與預估配息。', proDescription: 'Pro：跨次保存配息紀錄，提供持續追蹤與站內通知。' },
  { id: 'gap', icon: '⚠', title: '12 個月現金流缺口試算', subtitle: '本次預估不足月份', freeDescription: '免費版：依本次輸入比較未來十二個月收入與生活費。', proDescription: 'Pro：跨次保存資料，持續更新缺口並保留警訊。' },
  { id: 'market', icon: '◇', title: '市場大跌情境試算', subtitle: '本次套用單一預設情境', freeDescription: '免費版：套用預設大跌情境，查看資產、缺口與現金安全墊摘要。', proDescription: 'Pro：自訂跌幅與曝險、保存情境，查看原因、歷史比較及後續建議。' },
  { id: 'success', icon: '↗', title: '退休成功率試算', subtitle: '查看目前計畫穩定度', freeDescription: '免費版：依目前輸入重新試算退休成功率。', proDescription: 'Pro：保存歷史快照，進行情境調整與跨期比較。' },
  { id: 'report', icon: '▤', title: '本次退休健檢摘要', subtitle: '快速總覽目前退休狀態', freeDescription: '免費版：查看本次資產、現金流、風險與建議摘要。', proDescription: 'Pro：保存每月健檢快照，查看歷史報告與趨勢比較。' },
]

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`jh-brand ${compact ? 'compact' : ''}`}><img src={brandLogoUrl} alt="" /><div><strong>涓恆退休金流續航儀</strong><span>JuanHeng CashFlow Engine</span></div></div>
}

export function LandingPage({ onCashflow, onGuide, onPlan }: { onCashflow: () => void; onGuide: () => void; onPlan: (plan: 'free' | 'pro') => void }) {
  return <div className="jh-public">
    <div className="jh-reference-home">
      <header className="jh-reference-nav"><Brand /><div className="jh-nav-actions"><button className="jh-outline" onClick={() => onPlan('free')}>免費版</button><button className="jh-gold" onClick={() => onPlan('pro')}>♛ Pro 版</button></div></header>
      <div className="jh-reference-scene"><img src={landingReferenceUrl} alt="退休，不只看資產，更要看每月現金流" /><button className="jh-reference-hit jh-hit-start" aria-label="開始檢查我的退休現金流" onClick={onCashflow} /><button className="jh-reference-hit jh-hit-view" aria-label="查看功能" onClick={onGuide} /></div>
      <CashflowCta onStart={onCashflow} />
    </div>
    <div className="jh-responsive-home">
    <header className="jh-public-nav"><Brand /><div className="jh-nav-actions"><button className="jh-outline" onClick={() => onPlan('free')}>免費版</button><button className="jh-gold" onClick={() => onPlan('pro')}>♛ Pro 版</button></div></header>
    <main className="jh-landing-hero"><div className="jh-hero-side"><span>A BRIGHTER<br />TOMORROW<br />TOGETHER</span><i /><span>財富延續<br />生活更精彩</span></div><div className="jh-landing-copy"><p className="jh-kicker">退休後，生活仍要精彩</p><h1><em>退休，</em>不只看資產<br />更要看每月現金流</h1><p>用最直覺的方式掌握配息、缺口、風險與退休續航力。</p><div className="jh-hero-actions"><button className="jh-gold large" onClick={onCashflow}>開始檢查我的退休現金流 <span>→</span></button><button className="jh-outline large" onClick={onGuide}>查看功能</button></div></div><p className="jh-handwritten">退休後，<br />是另一段更精彩的旅程。</p></main>
    <CashflowCta onStart={onCashflow} />
    <footer className="jh-landing-footer"><div><b>▥</b><strong>掌握現金流</strong><span>看見每月收入與支出，<br />提早規劃退休生活。</span></div><div><b>♢</b><strong>發現風險缺口</strong><span>模擬市場變化，<br />找出潛在風險並提前因應。</span></div><div><b>◈</b><strong>量化退休續航力</strong><span>以數據看見你的<br />退休能走多遠。</span></div><div><b>♙</b><strong>打造理想生活</strong><span>不只是數字，<br />更是你想要的未來。</span></div></footer>
    </div>
  </div>
}

function CashflowCta({ onStart }: { onStart: () => void }) {
  return <section className="jh-cashflow-cta" aria-labelledby="cashflow-cta-title"><div><p>免費、免登入，約 3 分鐘</p><h2 id="cashflow-cta-title">看看我的每月退休現金流夠不夠</h2><div className="jh-cashflow-path"><span>每月生活費</span><i>→</i><span>固定收入</span><i>→</i><span>投資配息</span><i>→</i><span>每月缺口</span><i>→</i><span>現金能撐多久</span><i>→</i><span>長期退休續航力</span></div></div><button className="jh-gold large" onClick={onStart}>開始檢查我的退休現金流 <span>→</span></button></section>
}

export function GatewayPage({ onBack, onStep, onFeature, startLabel = '開始健檢' }: { onBack: () => void; onStep: (step: number) => void; onFeature: (page: ExperiencePage) => void; startLabel?: string }) {
  const steps = [
    ['輸入資產', '股票、ETF、基金、現金', '建立退休試算基礎。'],
    ['設定生活費', '每月支出與退休年限', '了解需要的現金流。'],
    ['填入固定收入', '勞保、勞退、年金、股息', '整理已起領與預期收入。'],
    ['查看退休結果', '每月現金流、缺口、支撐年數', '看見目前的退休狀況。'],
    ['得到建議', '缺口與調整方向', '決定下一步。'],
  ]
  return <div className="jh-experience"><header className="jh-mini-nav"><Brand compact /><button onClick={onBack}>← 返回首頁</button><button className="jh-gold" onClick={() => onStep(0)}>{startLabel}</button></header><div className="jh-page-heading"><span>A BRIGHTER TOMORROW TOGETHER</span><h1><em>開始退休健檢</em> / 查看功能 包含哪些？</h1><p>免費版完成一次試算；Pro 持續監控我的退休風險，而不是只算一次。</p></div><div className="jh-gateway-grid"><section className="jh-gateway-card gold"><h2>開始退休健檢</h2><p className="jh-pill">適合第一次使用者</p>{steps.map(([title, sub, desc], index) => <button key={title} onClick={() => onStep(index)} className="jh-step"><span className="jh-step-no">{String(index + 1).padStart(2, '0')}</span><span className="jh-step-icon">{['▥', '☷', '◉', '▤', '✧'][index]}</span><span><strong>{title}</strong><small>{sub}</small></span><span className="jh-step-desc">{desc}</span><span>›</span></button>)}<button className="jh-gold jh-card-cta" onClick={() => onStep(0)}>重點：先知道自己現在退休安不安全 →</button></section><section className="jh-gateway-card blue"><h2>免費版只可試算本次功能</h2><p className="jh-pill">本次瀏覽可查看；不跨次保存</p>{features.map((feature) => <button key={feature.id} className="jh-step" onClick={() => onFeature(feature.id)}><span className="jh-step-icon">{feature.icon}</span><span><strong>{feature.title}</strong><small>{feature.subtitle}</small></span><span className="jh-step-desc"><span>{feature.freeDescription}</span><small className="jh-pro-capability">{feature.proDescription}</small></span><span>›</span></button>)}<button className="jh-outline jh-card-cta" onClick={() => onFeature('dividends')}>先從配息月曆開始本次試算 →</button></section></div><p className="jh-gateway-note">免費版資料僅供本次瀏覽；跨次保存、持續追蹤、通知與歷史比較需試用或 Pro 資格。</p></div>
}

