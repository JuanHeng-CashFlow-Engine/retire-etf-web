import type { ReactNode } from 'react'
import { money } from '../lib/format'

export function FeatureHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="jh-feature-hero"><div><span>JUANHENG CASHFLOW ENGINE / 退休導航</span><h1>{title}</h1><p>{subtitle}</p></div><p>退休後，<br />是另一段更精彩的旅程。</p></div>
}

export function FeaturePanel({ number, title, subtitle, children, className = '' }: { number: number; title: string; subtitle: string; children: ReactNode; className?: string }) {
  return <article className={`jh-panel ${className}`}><div className="jh-panel-heading"><span>{String(number).padStart(2, '0')}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div>{children}</article>
}

export function MiniBars({ values, labels, negative = false }: { values: number[]; labels: string[]; negative?: boolean }) {
  const max = Math.max(...values.map(Math.abs), 1)
  return <div className="jh-bars">{values.map((value, index) => <div key={`${labels[index]}-${index}`}><b>{money.format(value)}</b><span><i className={negative && value < 0 ? 'negative' : ''} style={{ height: `${Math.max(4, Math.abs(value) / max * 100)}%` }} /></span><small>{labels[index]}</small></div>)}</div>
}

export function SummaryStats({ items }: { items: Array<{ label: string; value: string; tone?: string }> }) {
  return <div className="jh-stat-row">{items.map((item) => <div key={item.label}><span>{item.label}</span><strong className={item.tone ?? ''}>{item.value}</strong></div>)}</div>
}

export type ResultTrustLevel = '高' | '中' | '低'

export function ResultTrust({ asOf, basis, confidence, reason }: {
  asOf: string | Date | null
  basis: '實際資料' | '模型假設' | '實際資料＋模型假設'
  confidence: ResultTrustLevel
  reason: string
}) {
  const parsed = asOf instanceof Date ? asOf : asOf ? new Date(asOf) : null
  const time = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString('zh-TW') : '未標示／需核對'
  return <aside className={`jh-result-trust trust-${confidence}`} aria-label="結果資料說明">
    <div><span>資料時間</span><strong>{time}</strong></div>
    <div><span>資料性質</span><strong>{basis}</strong></div>
    <div><span>可信度</span><strong>{confidence}</strong></div>
    <p>{reason}</p>
  </aside>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="jh-muted">{children}</p>
}

