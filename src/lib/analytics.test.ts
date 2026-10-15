import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: null }))

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

vi.stubGlobal('localStorage', memoryStorage())
vi.stubGlobal('sessionStorage', memoryStorage())
vi.stubGlobal('window', { dispatchEvent: vi.fn() })
vi.stubGlobal('CustomEvent', class { constructor(public type: string, public init?: unknown) {} })

describe('anonymous analytics consent', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('starts without consent and persists a choice', async () => {
    const analytics = await import('./analytics')
    expect(analytics.getAnalyticsConsent()).toBeNull()
    analytics.setAnalyticsConsent('granted')
    expect(analytics.getAnalyticsConsent()).toBe('granted')
  })

  it('does not fail when tracking is disabled', async () => {
    const analytics = await import('./analytics')
    await expect(analytics.trackEvent('page_view', 'landing')).resolves.toBeUndefined()
  })
})


