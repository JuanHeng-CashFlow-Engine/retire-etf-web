const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
    status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
  })
  const checkoutAvailable = Boolean(Deno.env.get('STRIPE_SECRET_KEY') && Deno.env.get('STRIPE_PRO_MONTHLY_PRICE_ID'))
  const webhookReady = Boolean(Deno.env.get('STRIPE_WEBHOOK_SECRET'))
  return new Response(JSON.stringify({
    checkout_available: checkoutAvailable,
    webhook_ready: webhookReady,
    trial_available: true,
  }), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
})


