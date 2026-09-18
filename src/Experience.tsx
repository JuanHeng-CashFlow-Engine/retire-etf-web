import { brandLogoUrl } from './brandAssets'

export type ExperiencePage = 'guide' | 'dividends' | 'gap' | 'market' | 'success' | 'report'
export const features: { id: ExperiencePage; icon: string; title: string; subtitle: string; description: string }[] = [
  { id: 'dividends', icon: '▦', title: '自動追蹤配息', subtitle: '下一筆配息與入帳月曆', description: '掌握下一筆配息時間，分清已入帳、已公告與預估。' },
  { id: 'gap', icon: '⚠', title: '現金流缺口預警', subtitle: '提早看見不足月份', description: '比較未來十二個月的預估收入與生活費。' },
  { id: 'market', icon: '◇', title: '市場大跌追蹤', subtitle: '模擬下跌後還能撐多久', description: '自訂跌幅與曝險資產，檢視資產及現金流變化。' },
  { id: 'success', icon: '↗', title: '退休成功率變化', subtitle: '追蹤計畫穩定度', description: '依保存的情境快照看續航率，再調整目標試算。' },
  { id: 'report', icon: '▤', title: '每月退休健檢報告', subtitle: '快速總覽退休狀態', description: '集中查看資產、現金流、風險與本月建議。' },
]

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`jh-brand ${compact ? 'compact' : ''}`}><img src={brandLogoUrl} alt="" /><div><strong>涓恆退休金流續航儀</strong><span>JuanHeng CashFlow Engine</span></div></div>
}

export function LandingPage({ onGuide, onLogin, onPlan }: { onGuide: () => void; onLogin: () => void; onPlan: (plan: 'free' | 'pro') => void }) {
  return <div className="jh-public">
    <header className="jh-public-nav"><Brand /><nav aria-label="主要導覽"><button className="active">首頁</button><button onClick={onGuide}>功能</button><button onClick={onGuide}>健檢</button><button onClick={onGuide}>退休知識</button><button onClick={onGuide}>關於我們</button></nav><div className="jh-nav-actions"><button className="jh-text-button" onClick={onLogin}>登入</button><button className="jh-outline" onClick={() => onPlan('free')}>免費版</button><button className="jh-gold" onClick={() => onPlan('pro')}>♛ Pro 版</button></div></header>
    <main className="jh-landing-hero"><div className="jh-hero-side"><span>A BRIGHTER<br />TOMORROW<br />TOGETHER</span><i /><span>財富延續<br />生活更精彩</span></div><div className="jh-landing-copy"><p className="jh-kicker">退休後，生活仍要精彩</p><h1><em>退休，</em>不只看資產<br />更要看每月現金流</h1><p>用最直覺的方式掌握配息、缺口、風險與退休續航力。</p><div className="jh-hero-actions"><button className="jh-gold large" onClick={onGuide}>開始退休健檢 <span>→</span></button><button className="jh-outline large" onClick={onGuide}>查看功能</button></div></div><p className="jh-handwritten">退休後，<br />是另一段更精彩的旅程。</p></main>
    <footer className="jh-landing-footer"><div><b>▥</b><strong>掌握現金流</strong><span>看見每月收入與支出，<br />提早規劃退休生活。</span></div><div><b>♢</b><strong>發現風險缺口</strong><span>模擬市場變化，<br />找出潛在風險並提前因應。</span></div><div><b>◈</b><strong>量化退休續航力</strong><span>以數據看見你的<br />退休能走多遠。</span></div><div><b>♙</b><strong>打造理想生活</strong><span>不只是數字，<br />更是你想要的未來。</span></div></footer>
  </div>
}

export function GatewayPage({ onBack, onStep, onFeature }: { onBack: () => void; onStep: (step: number) => void; onFeature: (page: ExperiencePage) => void }) {
  const steps = [
    ['輸入資產', '股票、ETF、基金、現金', '建立退休試算基礎。'],
    ['設定生活費', '每月支出與退休年限', '了解需要的現金流。'],
    ['填入固定收入', '勞保、勞退、年金、股息', '整理已起領與預期收入。'],
    ['查看退休結果', '每月現金流、缺口、支撐年數', '看見目前的退休狀況。'],
    ['得到建議', '缺口與調整方向', '決定下一步。'],
  ]
  return <div className="jh-experience"><header className="jh-mini-nav"><Brand compact /><button onClick={onBack}>← 返回首頁</button><button className="jh-gold" onClick={() => onStep(0)}>登入開始</button></header><div className="jh-page-heading"><span>A BRIGHTER TOMORROW TOGETHER</span><h1><em>開始退休健檢</em> / 查看功能 包含哪些？</h1><p>先完成五步健檢，再選擇想深入了解的功能</p></div><div className="jh-gateway-grid"><section className="jh-gateway-card gold"><h2>開始退休健檢</h2><p className="jh-pill">適合第一次使用者</p>{steps.map(([title, sub, desc], index) => <button key={title} onClick={() => onStep(index)} className="jh-step"><span className="jh-step-no">{String(index + 1).padStart(2, '0')}</span><span className="jh-step-icon">{['▥', '☷', '◉', '▤', '✧'][index]}</span><span><strong>{title}</strong><small>{sub}</small></span><span className="jh-step-desc">{desc}</span><span>›</span></button>)}<button className="jh-gold jh-card-cta" onClick={() => onStep(0)}>重點：先知道自己現在退休安不安全 →</button></section><section className="jh-gateway-card blue"><h2>查看功能</h2><p className="jh-pill">適合想深入查看者</p>{features.map((feature) => <button key={feature.id} className="jh-step" onClick={() => onFeature(feature.id)}><span className="jh-step-icon">{feature.icon}</span><span><strong>{feature.title}</strong><small>{feature.subtitle}</small></span><span className="jh-step-desc">{feature.description}</span><span>›</span></button>)}<button className="jh-outline jh-card-cta" onClick={() => onFeature('dividends')}>重點：再深入掌握日常追蹤與風險變化 →</button></section></div><p className="jh-gateway-note">第一次使用？先完成健檢，再開啟各項追蹤功能。</p></div>
}
