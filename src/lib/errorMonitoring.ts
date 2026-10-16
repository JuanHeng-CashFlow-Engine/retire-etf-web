import { supabase } from './supabase'

const MAX_MESSAGE = 1_000
const MAX_STACK = 4_000
const MAX_REPORTS_PER_SESSION = 5
let installed = false
let reportCount = 0

export function sanitizeDiagnostic(value: unknown, maxLength = MAX_MESSAGE): string {
  return String(value ?? '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/https?:\/\/[^\s)]+/gi, (url) => {
      try {
        const parsed = new URL(url)
        return `${parsed.origin}${parsed.pathname}`
      } catch {
        return '[url]'
      }
    })
    .slice(0, maxLength)
}

async function reportClientError(eventType: string, error: unknown) {
  if (!supabase || reportCount >= MAX_REPORTS_PER_SESSION) return
  reportCount += 1
  const typed = error instanceof Error ? error : new Error(String(error ?? 'Unknown client error'))
  const payload = {
    event_type: eventType,
    message: sanitizeDiagnostic(typed.message),
    stack: sanitizeDiagnostic(typed.stack, MAX_STACK) || null,
    page_path: window.location.pathname.slice(0, 300),
    release: import.meta.env.VITE_RELEASE?.slice(0, 100) || 'web',
    user_agent: navigator.userAgent.slice(0, 500),
  }
  try {
    await supabase.from('client_error_logs').insert(payload)
  } catch {
    // Monitoring must never interrupt the user's retirement workflow.
  }
}

export function installErrorMonitoring() {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (event) => {
    void reportClientError('window_error', event.error ?? event.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    void reportClientError('unhandled_rejection', event.reason)
  })
}
