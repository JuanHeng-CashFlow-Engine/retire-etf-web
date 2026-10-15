import { supabase } from './supabase'

export const ANALYTICS_CONSENT_VERSION = 'analytics-v1'
const CONSENT_KEY = 'jh_analytics_consent_v1'
const VISITOR_KEY = 'jh_analytics_visitor_id_v1'
const SESSION_KEY = 'jh_analytics_session_id_v1'

export type AnalyticsConsent = 'granted' | 'denied' | null
export type ProductEvent =
  | 'consent_granted'
  | 'page_view'
  | 'guest_check_started'
  | 'pro_plan_viewed'
  | 'signup_completed'
  | 'login_completed'
  | 'trial_started'
  | 'checkout_started'
  | 'billing_return_success'
  | 'billing_return_cancelled'
  | 'monthly_report_viewed'

function read(storage: Storage, key: string) {
  try { return storage.getItem(key) } catch { return null }
}

function write(storage: Storage, key: string, value: string) {
  try { storage.setItem(key, value) } catch { /* storage may be disabled */ }
}

function id(storage: Storage, key: string) {
  const current = read(storage, key)
  if (current) return current
  const next = crypto.randomUUID()
  write(storage, key, next)
  return next
}

export function getAnalyticsConsent(): AnalyticsConsent {
  const value = read(localStorage, CONSENT_KEY)
  return value === 'granted' || value === 'denied' ? value : null
}

export function setAnalyticsConsent(value: Exclude<AnalyticsConsent, null>) {
  write(localStorage, CONSENT_KEY, value)
  window.dispatchEvent(new CustomEvent('jh-analytics-consent', { detail: value }))
}

export function clearAnonymousAnalyticsIdentity() {
  try {
    localStorage.removeItem(VISITOR_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  } catch { /* storage may be disabled */ }
}

function cleanMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) =>
    value == null || ['string', 'number', 'boolean'].includes(typeof value)))
}

export async function trackEvent(action: ProductEvent, page: string, metadata: Record<string, unknown> = {}) {
  if (getAnalyticsConsent() !== 'granted' || !supabase) return
  const payload = {
    user_id: null,
    action,
    page: page.slice(0, 80),
    visitor_id: id(localStorage, VISITOR_KEY),
    session_id: id(sessionStorage, SESSION_KEY),
    consent_version: ANALYTICS_CONSENT_VERSION,
    metadata: cleanMetadata(metadata),
  }
  const { error } = await supabase.from('user_activity_logs').insert(payload)
  if (error && import.meta.env.DEV) console.warn('匿名產品事件未送出', error.message)
}


