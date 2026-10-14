import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL') ?? '', serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
  const siteUrl = (Deno.env.get('RETIRE_WEB_URL') ?? 'https://juanheng-cashflow-engine.github.io/retire-etf-web/').replace(/\/$/, '')
  if (!stripeKey) return json({ error: 'BILLING_NOT_OPEN' }, 503)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data } = await admin.auth.getUser(token)
  if (!data.user) return json({ error: 'AUTH_REQUIRED' }, 401)
  const { data: subscription } = await admin.from('subscriptions').select('provider_customer_id').eq('user_id', data.user.id).maybeSingle()
  if (!subscription?.provider_customer_id) return json({ error: 'NO_BILLING_ACCOUNT' }, 404)
  const body = new URLSearchParams({ customer: subscription.provider_customer_id, return_url: `${siteUrl}/?billing=portal_return` })
  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  })
  const result = await response.json()
  return response.ok && result.url ? json({ url: result.url }) : json({ error: 'BILLING_PROVIDER_ERROR', message: result?.error?.message }, 502)
})

