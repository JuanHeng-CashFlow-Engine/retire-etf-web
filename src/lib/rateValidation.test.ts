import {describe,expect,it} from 'vitest'
import {aggregateRateValidation,calculateRateValidation,RATE_VALIDATION_CASES,validateRateValidationInput} from '../../supabase/functions/financial-analysis-auth/rate-validation'

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
  it('uses adjusted close total return for model error and direction',()=>{
    const result=calculateRateValidation(5,4,8,100,107,98,107)
    expect(result.actualPriceChangePct).toBeCloseTo(7)
    expect(result.actualTotalReturnPct).toBeCloseTo(9.1837,3)
    expect(result.estimatedPriceChangePct).toBeCloseTo(8)
    expect(result.errorPctPoints).toBeCloseTo(1.1837,3)
    expect(result.directionMatch).toBe(true)
  })
  it('keeps multiple ETFs, rate regimes and holdout rows in the preset matrix',()=>{
    expect(new Set(RATE_VALIDATION_CASES.map(r=>r.ticker)).size).toBeGreaterThanOrEqual(4)
    expect(new Set(RATE_VALIDATION_CASES.map(r=>r.regime))).toEqual(new Set(['升息','降息']))
    expect(RATE_VALIDATION_CASES.filter(r=>r.sample==='holdout').length).toBeGreaterThanOrEqual(4)
    expect(RATE_VALIDATION_CASES.every(r=>r.durationAsOf&&r.durationSourceUrl.startsWith('https://'))).toBe(true)
  })
  it('applies both out-of-sample MAE and direction thresholds',()=>{
    const pass=aggregateRateValidation([{sample:'calibration',errorPctPoints:8,directionMatch:true},{sample:'holdout',errorPctPoints:2,directionMatch:true},{sample:'holdout',errorPctPoints:-4,directionMatch:true}])
    expect(pass.holdout.mae).toBe(3);expect(pass.pass).toBe(true)
    const fail=aggregateRateValidation([{sample:'holdout',errorPctPoints:6,directionMatch:true},{sample:'holdout',errorPctPoints:2,directionMatch:false}])
    expect(fail.pass).toBe(false)
  })
  it('rejects future, reversed and excessively long validation ranges',()=>{
    expect(()=>validateRateValidationInput({ticker:'TLT',startDate:'2023-10-19',endDate:'2023-07-03',duration:16})).toThrow()
    expect(()=>validateRateValidationInput({ticker:'TLT',startDate:'2020-01-01',endDate:'2022-01-02',duration:16})).toThrow()
    expect(()=>validateRateValidationInput({ticker:'TLT',startDate:'2999-01-01',endDate:'2999-02-01',duration:16})).toThrow()
  })
})

