import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import { corsDenied, corsHeaders, isAllowedOrigin } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (!isAllowedOrigin(req)) return corsDenied(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL') ?? '', serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !serviceKey) return json({ error: 'SERVER_NOT_CONFIGURED' }, 503)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data } = await admin.auth.getUser(token)
  if (!data.user) return json({ error: 'AUTH_REQUIRED' }, 401)
  const { data: result, error } = await admin.rpc('start_retirement_trial_for_user', { p_user: data.user.id })
  if (error) {
    if (/TRIAL_ALREADY_USED/.test(error.message)) return json({ error: 'TRIAL_ALREADY_USED', message: '此帳號已使用過試用。' }, 409)
    console.error('subscription-trial failed', error)
    return json({ error: 'TRIAL_ACTIVATION_FAILED', message: '試用目前無法啟用，請稍後重試。' }, 500)
  }
  return json(Array.isArray(result) ? result[0] : result)
})

