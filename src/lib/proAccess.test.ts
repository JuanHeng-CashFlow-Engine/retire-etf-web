import { describe, it, expect, vi } from 'vitest'
import { authorizePro } from '../../supabase/functions/financial-analysis-auth/access'
import { possibleIncomeDuplicates } from '../../supabase/functions/financial-analysis-auth/fixed-income'
describe('backend Pro access',()=>{
  const req=new Request('https://example.test',{headers:{Authorization:'Bearer token'}})
  it('rejects missing credentials before network access',async()=>{
    const fetcher=vi.fn();expect((await authorizePro(new Request('https://example.test'),'','',fetcher))?.status).toBe(401);expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([[false,403],[true,null]])('checks server entitlement %s',async(eligible,status)=>{
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json({id:'owner'})).mockResolvedValueOnce(Response.json(eligible))
    expect((await authorizePro(req,'https://example.test','key',fetcher))?.status??null).toBe(status)
    expect(fetcher.mock.calls[1][0]).toContain('/rpc/retirement_pro_enabled')
  })
  it('rejects anonymous users',async()=>{
    const fetcher=vi.fn().mockResolvedValue(Response.json({id:'owner',is_anonymous:true}));expect((await authorizePro(req,'','',fetcher))?.status).toBe(401)
  })
  it('fails closed on unavailable entitlement service',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json({id:'owner'})).mockRejectedValueOnce(new Error('offline'));expect((await authorizePro(req,'','',fetcher))?.status).toBe(503)
  })
})
describe('fixed income duplicate warnings',()=>{
  const first={name:'年金 A',category:'pension',start_month:'2026-01-01',monthly_amount:10000}
  it('keeps different pensions starting on the same date',()=>{expect(possibleIncomeDuplicates([first,{...first,name:'年金 B'}])).toEqual([])})
  it('warns without excluding identical rows or mutating inputs',()=>{
    const rows=[first,{...first}];expect(possibleIncomeDuplicates(rows)).toMatchObject([{count:2,ignored_count:0}]);expect(rows).toHaveLength(2)
  })
  it('does not conflate distinct amounts',()=>{expect(possibleIncomeDuplicates([first,{...first,monthly_amount:12000}])).toEqual([])})
})
