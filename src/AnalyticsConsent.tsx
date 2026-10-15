import { useEffect, useState } from 'react'
import { ANALYTICS_CONSENT_VERSION, getAnalyticsConsent, setAnalyticsConsent, trackEvent, type AnalyticsConsent } from './lib/analytics'

export function AnalyticsConsentBanner() {
  const [consent, setConsent] = useState<AnalyticsConsent>(() => getAnalyticsConsent())
  const [details, setDetails] = useState(false)

  useEffect(() => {
    const update = (event: Event) => setConsent((event as CustomEvent<AnalyticsConsent>).detail)
    window.addEventListener('jh-analytics-consent', update)
    return () => window.removeEventListener('jh-analytics-consent', update)
  }, [])

  if (consent) return null
  function choose(value: Exclude<AnalyticsConsent, null>) {
    setAnalyticsConsent(value)
    setConsent(value)
    if (value === 'granted') void trackEvent('consent_granted', 'consent', { version: ANALYTICS_CONSENT_VERSION })
  }

  return <aside className="jh-consent" role="dialog" aria-labelledby="analytics-consent-title" aria-describedby="analytics-consent-copy">
    <div>
      <strong id="analytics-consent-title">協助我們改善退休工具</strong>
      <p id="analytics-consent-copy">經你同意後，我們只記錄匿名功能使用事件，用來觀察健檢完成率、次月回訪及試用流程。</p>
      {details && <p className="jh-consent-details">不記錄 Email、姓名、持股內容、資產金額、信用卡資料或分析輸入。你可以在「隱私與資料」隨時停止後續追蹤。</p>}
    </div>
    <div className="jh-consent-actions">
      <button className="text-button" onClick={() => setDetails((value) => !value)}>{details ? '收起說明' : '了解資料內容'}</button>
      <button className="jh-outline" onClick={() => choose('denied')}>不要追蹤</button>
      <button className="primary-button" onClick={() => choose('granted')}>同意匿名分析</button>
    </div>
  </aside>
}


