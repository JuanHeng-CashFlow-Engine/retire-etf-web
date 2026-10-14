import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })
  const { data } = await admin.auth.getUser(token)
  if (!data.user) return json({ error: 'AUTH_REQUIRED' }, 401)
  const { data: result, error } = await admin.rpc('start_retirement_trial_for_user', { p_user: data.user.id })
  if (error) {
    if (/TRIAL_ALREADY_USED/.test(error.message)) return json({ error: 'TRIAL_ALREADY_USED', message: '此帳號已使用過試用。' }, 409)
    return json({ error: 'TRIAL_ACTIVATION_FAILED', message: error.message }, 500)
  }
  return json(Array.isArray(result) ? result[0] : result)
})

