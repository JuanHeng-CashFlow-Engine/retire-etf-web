import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { corsDenied, corsHeaders, isAllowedOrigin } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (!isAllowedOrigin(req)) return corsDenied(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
  const priceId = Deno.env.get('STRIPE_PRO_MONTHLY_PRICE_ID') ?? ''
  const siteUrl = (Deno.env.get('RETIRE_WEB_URL') ?? 'https://juanheng-cashflow-engine.github.io/retire-etf-web/').replace(/\/$/, '')
  if (!url || !serviceKey) return json({ error: 'SERVER_NOT_CONFIGURED' }, 503)
  if (!stripeKey || !priceId) return json({ error: 'BILLING_NOT_OPEN', message: '線上訂閱尚未開放；可先使用 7 天試用。' }, 503)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  const user = userData.user
  if (userError || !user) return json({ error: 'AUTH_REQUIRED' }, 401)

  const { data: current } = await admin.from('subscriptions')
    .select('status,current_period_end,provider_customer_id').eq('user_id', user.id).maybeSingle()
  if (current && ['active', 'paid'].includes(current.status) &&
      (!current.current_period_end || Date.parse(current.current_period_end) >= Date.now())) {
    return json({ error: 'ALREADY_SUBSCRIBED', message: '目前已是 Pro 會員。' }, 409)
  }

  let customer = current?.provider_customer_id as string | null
  if (!customer) {
    const customerBody = new URLSearchParams({ email: user.email ?? '', 'metadata[supabase_user_id]': user.id })
    const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: customerBody,
    })
    const customerData = await customerResponse.json()
    if (!customerResponse.ok) { console.error('Stripe customer error', customerData?.error?.type); return json({ error: 'BILLING_PROVIDER_ERROR', message: '無法建立付款客戶，請稍後重試。' }, 502) }
    customer = customerData.id
  }

  await admin.from('subscriptions').upsert({
    user_id: user.id, plan_code: 'pro_monthly', status: current?.status ?? 'expired', price: 99, currency: 'TWD',
    provider: 'stripe', provider_customer_id: customer, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  const body = new URLSearchParams({
    mode: 'subscription', customer, 'line_items[0][price]': priceId, 'line_items[0][quantity]': '1',
    success_url: `${siteUrl}/?billing=success`, cancel_url: `${siteUrl}/?billing=cancelled`,
    client_reference_id: user.id, 'metadata[supabase_user_id]': user.id,
    'subscription_data[metadata][supabase_user_id]': user.id, allow_promotion_codes: 'true',
  })
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  })
  const data = await response.json()
  if (!response.ok || !data.url) { console.error('Stripe checkout error', data?.error?.type); return json({ error: 'BILLING_PROVIDER_ERROR', message: '無法建立結帳頁，請稍後重試。' }, 502) }
  return json({ url: data.url })
})

