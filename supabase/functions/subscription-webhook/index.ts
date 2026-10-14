import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

function bytes(value: string) { return new TextEncoder().encode(value) }
function hex(buffer: ArrayBuffer) { return [...new Uint8Array(buffer)].map((n) => n.toString(16).padStart(2, '0')).join('') }
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}
async function verify(raw: string, header: string, secret: string) {
  const fields = header.split(',').map((part) => part.trim().split('=', 2))
  const timestamp = Number(fields.find(([key]) => key === 't')?.[1])
  const signatures = fields.filter(([key]) => key === 'v1').map(([, value]) => value).filter(Boolean)
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300 || !signatures.length) return false
  const key = await crypto.subtle.importKey('raw', bytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = hex(await crypto.subtle.sign('HMAC', key, bytes(`${timestamp}.${raw}`)))
  return signatures.some((candidate) => safeEqual(signature, candidate))
}
const unix = (value: unknown) => typeof value === 'number' ? new Date(value * 1000).toISOString() : null
function status(value: string) {
  if (value === 'trialing') return 'trialing'
  if (value === 'active') return 'active'
  if (['past_due', 'unpaid', 'incomplete', 'paused'].includes(value)) return 'past_due'
  return value === 'canceled' ? 'cancelled' : 'expired'
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('METHOD_NOT_ALLOWED', { status: 405 })
  const raw = await req.text(), secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
  if (!secret || !(await verify(raw, req.headers.get('stripe-signature') ?? '', secret))) return new Response('INVALID_SIGNATURE', { status: 401 })
  const event = JSON.parse(raw), object = event.data?.object ?? {}
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })
  const { error: eventError } = await admin.from('subscription_webhook_events').insert({ event_id: event.id, event_type: event.type })
  if (eventError?.code === '23505') return new Response('ok')
  if (eventError) return new Response('EVENT_LEDGER_ERROR', { status: 500 })

  let userId = object.metadata?.supabase_user_id || object.client_reference_id || null
  const customer = typeof object.customer === 'string' ? object.customer : object.customer?.id
  if (!userId && customer) {
    const { data } = await admin.from('subscriptions').select('user_id').eq('provider_customer_id', customer).maybeSingle()
    userId = data?.user_id
  }
  if (!userId) return new Response('ok')

  if (event.type.startsWith('customer.subscription.')) {
    await admin.from('subscriptions').upsert({
      user_id: userId, plan_code: 'pro_monthly', status: status(object.status), price: 99, currency: 'TWD', provider: 'stripe',
      provider_customer_id: customer, provider_subscription_id: object.id,
      current_period_start: unix(object.current_period_start), current_period_end: unix(object.current_period_end),
      trial_end_at: unix(object.trial_end), updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  } else if (event.type === 'checkout.session.completed') {
    await admin.from('subscriptions').upsert({
      user_id: userId, plan_code: 'pro_monthly', status: object.payment_status === 'paid' ? 'active' : 'past_due',
      price: 99, currency: 'TWD', provider: 'stripe', provider_customer_id: customer,
      provider_subscription_id: typeof object.subscription === 'string' ? object.subscription : object.subscription?.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  } else if (event.type === 'invoice.payment_failed') {
    await admin.from('subscriptions').update({ status: 'past_due', updated_at: new Date().toISOString() }).eq('user_id', userId)
  }
  return new Response('ok')
})

