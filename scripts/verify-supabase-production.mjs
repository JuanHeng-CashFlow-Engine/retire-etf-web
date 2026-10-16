const required = ['SUPABASE_PROJECT_URL', 'SUPABASE_PUBLISHABLE_KEY', 'PRODUCTION_ORIGIN', 'RELEASE_SHA']
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`)
}

const base = process.env.SUPABASE_PROJECT_URL.replace(/\/$/, '')
const key = process.env.SUPABASE_PUBLISHABLE_KEY
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
}

async function body(response) {
  const text = await response.text()
  try { return text ? JSON.parse(text) : null } catch { return text }
}

const billingResponse = await fetch(`${base}/functions/v1/billing-status`, {
  headers: { Origin: process.env.PRODUCTION_ORIGIN },
})
const billing = await body(billingResponse)
if (!billingResponse.ok || typeof billing?.checkout_available !== 'boolean' || typeof billing?.webhook_ready !== 'boolean') {
  throw new Error(`billing-status verification failed (${billingResponse.status})`)
}

const deniedOrigin = await fetch(`${base}/functions/v1/billing-status`, {
  headers: { Origin: 'https://untrusted.invalid' },
})
if (deniedOrigin.status !== 403) throw new Error(`untrusted origin was not rejected (${deniedOrigin.status})`)

const validInsert = await fetch(`${base}/rest/v1/client_error_logs`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'return=minimal' },
  body: JSON.stringify({
    event_type: 'window_error',
    message: 'Automated post-deploy verification',
    page_path: '/deployment-verification',
    release: process.env.RELEASE_SHA,
    user_agent: 'GitHub Actions production verification',
  }),
})
if (!validInsert.ok) throw new Error(`anonymous monitoring insert failed (${validInsert.status})`)

const forgedInsert = await fetch(`${base}/rest/v1/client_error_logs`, {
  method: 'POST',
  headers: { ...headers, Prefer: 'return=minimal' },
  body: JSON.stringify({
    user_id: '00000000-0000-0000-0000-000000000001',
    event_type: 'window_error',
    message: 'This forged row must be rejected',
    page_path: '/deployment-verification',
    release: process.env.RELEASE_SHA,
  }),
})
if (forgedInsert.ok) throw new Error('anonymous client was allowed to forge user_id')

const anonymousRead = await fetch(`${base}/rest/v1/client_error_logs?select=id&limit=1`, { headers })
if (anonymousRead.ok) throw new Error('anonymous client was allowed to read monitoring records')

console.log(JSON.stringify({
  ok: true,
  billingStatus: billingResponse.status,
  rejectedOrigin: deniedOrigin.status,
  validAnonymousInsert: validInsert.status,
  rejectedForgedIdentity: forgedInsert.status,
  rejectedAnonymousRead: anonymousRead.status,
}))
