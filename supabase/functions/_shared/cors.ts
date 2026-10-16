const productionOrigin = 'https://juanheng-cashflow-engine.github.io'
const localOrigins = new Set(['http://localhost:4173', 'http://127.0.0.1:4173', 'http://localhost:5173', 'http://127.0.0.1:5173'])

function configuredOrigins() {
  return new Set((Deno.env.get('RETIRE_ALLOWED_ORIGINS') ?? productionOrigin).split(',').map((value) => value.trim()).filter(Boolean))
}

export function isAllowedOrigin(req: Request) {
  const origin = req.headers.get('Origin')
  return !origin || configuredOrigins().has(origin) || localOrigins.has(origin)
}

export function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin')
  return {
    'Access-Control-Allow-Origin': origin && isAllowedOrigin(req) ? origin : productionOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function corsDenied(req: Request) {
  return new Response(JSON.stringify({ error: 'ORIGIN_NOT_ALLOWED' }), {
    status: 403,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}
