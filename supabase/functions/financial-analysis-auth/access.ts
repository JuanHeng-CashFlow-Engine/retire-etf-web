export async function authorizePro(req: Request, base: string, key: string, request: typeof fetch = fetch): Promise<Response | null> {
  const authorization=req.headers.get('authorization') || ''
  if (!/^Bearer\s+\S+$/i.test(authorization)) return Response.json({error:'請先登入會員帳號。',code:'AUTH_REQUIRED'},{status:401})
  try {
    const headers={Authorization:authorization,apikey:key}
    const user=await request(`${base}/auth/v1/user`,{headers})
    if (!user.ok) return Response.json({error:'登入憑證已失效，請重新登入。',code:'AUTH_REQUIRED'},{status:401})
    const identity=await user.json()
    if (!identity?.id || identity.is_anonymous) return Response.json({error:'需要正式會員登入。',code:'AUTH_REQUIRED'},{status:401})
    const entitlement=await request(`${base}/rest/v1/rpc/retirement_pro_enabled`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'})
    if (!entitlement.ok) return Response.json({error:'會員資格檢查暫時失敗，請稍後重試。',code:'ENTITLEMENT_UNAVAILABLE'},{status:503})
    if (await entitlement.json() !== true) return Response.json({error:'此功能需有效 Pro 訂閱或試用資格。',code:'PRO_REQUIRED'},{status:403})
    return null
  } catch { return Response.json({error:'會員資格服務暫時無法使用。',code:'ENTITLEMENT_UNAVAILABLE'},{status:503}) }
}
