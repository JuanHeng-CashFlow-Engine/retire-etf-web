import {describe,it,expect} from 'vitest'
import {validateBacktestRequest} from '../../supabase/functions/financial-analysis-auth/backtest-request'
describe('backtest strategy identity',()=>{
 it('allows ticker-only baseline and explicit baseline',()=>{expect(validateBacktestRequest('2890')).toBeNull();expect(validateBacktestRequest('2890 20/60 均線')).toBeNull()})
 it('rejects unsupported strategies and cost assumptions',()=>{for(const p of ['RSI 超賣背離','KD 雙背離','唐奇安突破','20/60 均線 手續費 0.1425%','200MA 濾網','10/40 均線'])expect(validateBacktestRequest(p)).toBeTruthy()})
})
