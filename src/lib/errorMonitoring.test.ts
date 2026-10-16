import { describe, expect, it } from 'vitest'
import { sanitizeDiagnostic } from './errorMonitoring'

describe('client error privacy', () => {
  it('redacts tokens, email addresses and URL query strings', () => {
    const clean = sanitizeDiagnostic('Bearer secret.token user@example.com https://example.com/path?token=abc#hash')
    expect(clean).toContain('Bearer [redacted]')
    expect(clean).toContain('[email]')
    expect(clean).toContain('https://example.com/path')
    expect(clean).not.toContain('token=abc')
  })

  it('caps diagnostic length', () => {
    expect(sanitizeDiagnostic('x'.repeat(100), 20)).toHaveLength(20)
  })
})
