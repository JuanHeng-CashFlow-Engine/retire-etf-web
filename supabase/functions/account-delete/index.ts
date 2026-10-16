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
  const body = await req.json().catch(() => ({}))
  if (body.confirmation !== '刪除我的帳號') return json({ error: 'CONFIRMATION_REQUIRED' }, 400)
  const { error } = await admin.auth.admin.deleteUser(data.user.id)
  if (error) console.error('account-delete failed', error)
  return error ? json({ error: 'DELETE_FAILED', message: '帳號目前無法刪除，請稍後重試。' }, 500) : json({ deleted: true })
})

