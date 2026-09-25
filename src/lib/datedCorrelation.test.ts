import { describe,expect,it } from 'vitest'
import { alignedCorrelation,type DatedBar } from '../../supabase/functions/financial-analysis-auth/correlation'
function series(offset=0,reverse=false):DatedBar[]{
  let c=100
  return Array.from({length:45},(_,i)=>{if(i)c*=1+(reverse?-1:1)*(i%3-1)*.01;return {t:Date.UTC(2026,0,i+1+offset)/1000,c}})
}
describe('date-aligned historical correlation',()=>{
  it('finds positive and inverse returns with sample dates',()=>{
    expect(alignedCorrelation(series(),series())).toMatchObject({corr:1,samples:44,start:'2026-01-01',end:'2026-02-14'})
    expect(alignedCorrelation(series(),series(0,true))?.corr).toBeCloseTo(-1)
  })
  it('does not correlate unrelated trading periods by array position',()=>{
    expect(alignedCorrelation(series(),series(100))).toBeNull()
  })
  it('requires enough shared periods and excludes mismatched return intervals',()=>{
    expect(alignedCorrelation(series(),series().slice(20))).toBeNull()
    const missing=series().filter((_,i)=>i!==10)
    expect(alignedCorrelation(series(),missing)?.samples).toBe(42)
  })
  it('does not invent correlations for constant assets',()=>{
    expect(alignedCorrelation(series(),series().map(x=>({...x,c:100})))).toBeNull()
  })
})
