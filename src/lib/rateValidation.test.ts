import {describe,expect,it} from 'vitest'
import {calculateRateValidation,validateRateValidationInput} from '../../supabase/functions/financial-analysis-auth/rate-validation'

describe('historical rate model validation',()=>{
  it('compares duration estimate with the observed market move',()=>{
    const result=calculateRateValidation(4.2,5,5,100,94)
    expect(result.yieldChangeBps).toBeCloseTo(80)
    expect(result.estimatedPriceChangePct).toBeCloseTo(-4)
    expect(result.actualPriceChangePct).toBeCloseTo(-6)
    expect(result.errorPctPoints).toBeCloseTo(-2)
    expect(result.directionMatch).toBe(true)
  })
  it('reports a direction mismatch instead of hiding it',()=>{expect(calculateRateValidation(4,5,7,100,103).directionMatch).toBe(false)})
  it('rejects future, reversed and excessively long validation ranges',()=>{
    expect(()=>validateRateValidationInput({ticker:'TLT',startDate:'2023-10-19',endDate:'2023-07-03',duration:16})).toThrow()
    expect(()=>validateRateValidationInput({ticker:'TLT',startDate:'2020-01-01',endDate:'2022-01-02',duration:16})).toThrow()
    expect(()=>validateRateValidationInput({ticker:'TLT',startDate:'2999-01-01',endDate:'2999-02-01',duration:16})).toThrow()
  })
})

