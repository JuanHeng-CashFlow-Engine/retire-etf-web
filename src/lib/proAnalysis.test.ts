import { describe, expect, it } from 'vitest'
import { buildGuestOverview, emptyGuestDraft } from '../guestData'
import { advancedDividendAlerts, portfolioRows, rebalance, runScenario } from './proAnalysis'
import type { DividendItem } from '../types'
import type { RetirementPlanInput } from './retirementPlan'

const event = (overrides: Partial<DividendItem> = {}): DividendItem => ({ id:'one',ticker:'0050',dividend_year:2026,dividend_month:9,expected_amount:1000,expected_payment_date:'2026-09-25',actual_amount:null,actual_payment_date:null,status:'announced',...overrides })
const input: RetirementPlanInput = {currentAssets:120000,targetAssets:120000,monthlyContribution:0,annualReturn:0,annualVolatility:0,yearsUntilRetirement:0,retirementYears:1,monthlyExpense:9000,inflationRate:0,simulations:500,seed:42}

describe('Pro portfolio and retirement calculations',()=>{
  it('uses lots correctly and merges ticker aliases without double counting',()=>{
    const data=buildGuestOverview(emptyGuestDraft())
    data.holdings=[{ticker:'0050',name:'ETF',shares:1.5,price:100,annualYield:2},{ticker:'0050.TW',name:'ETF',shares:1.5,price:100,annualYield:2}]
    expect(portfolioRows(data)).toEqual([{id:'stock:0050',name:'ETF',ticker:'0050',value:150000}])
  })
  it('balances purchases and sales against only the added cash',()=>{
    const plan=rebalance([{id:'a',name:'a',ticker:'',value:80000},{id:'b',name:'b',ticker:'',value:20000}],{a:50,b:50},10000)
    expect(plan.map(p=>p.adjustment)).toEqual([-25000,35000])
    expect(plan.reduce((s,p)=>s+p.adjustment,0)).toBe(10000)
  })
  it('rejects incomplete allocations and negative budgets',()=>{
    const rows=[{id:'a',name:'a',ticker:'',value:100}]
    expect(()=>rebalance(rows,{a:80})).toThrow('100%')
    expect(()=>rebalance(rows,{a:100},-1)).toThrow()
    expect(()=>rebalance(rows,{a:NaN})).toThrow()
  })
  it('reproduces zero-volatility cash depletion and fixed income effects',()=>{
    expect(runScenario(input).successProbability).toBe(100)
    expect(runScenario({...input,monthlyExpense:11000}).successProbability).toBe(0)
    expect(runScenario({...input,monthlyExpense:11000,fixedIncomes:[{monthlyAmount:2000,startMonthOffset:0,endMonthOffset:null}]}).successProbability).toBe(100)
  })
  it('rejects unbounded and fractional simulation inputs',()=>{
    for(const update of [{simulations:501.5},{yearsUntilRetirement:81},{annualVolatility:101},{monthlyExpense:Infinity},{currentAssets:1e13}]) expect(()=>runScenario({...input,...update})).toThrow()
  })
  it('keeps identical assumptions reproducible',()=>{
    const random={...input,annualVolatility:15,retirementYears:5}
    expect(runScenario(random)).toEqual(runScenario(random))
  })
})

describe('advanced dividend alerts',()=>{
  it('includes today and the boundary day, but not a date beyond the horizon',()=>{
    const data=buildGuestOverview(emptyGuestDraft())
    data.dividends=[event(),event({id:'boundary',expected_payment_date:'2026-10-25'}),event({id:'later',expected_payment_date:'2026-10-26'})]
    expect(advancedDividendAlerts(data,'2026-09-25').map(a=>a.key)).toEqual(['due:one','due:boundary'])
  })
  it('distinguishes unpaid status from paid and treats missing records as unconfirmed',()=>{
    const data=buildGuestOverview(emptyGuestDraft())
    data.dividends=[event({status:'unpaid',expected_payment_date:'2026-09-24'})]
    expect(advancedDividendAlerts(data,'2026-09-25')[0]).toMatchObject({key:'late:one'})
    data.dividends[0].status='paid'
    expect(advancedDividendAlerts(data,'2026-09-25')).toHaveLength(0)
  })
  it('retains a zero receipt and alerts only beyond the configured shortfall threshold',()=>{
    const data=buildGuestOverview(emptyGuestDraft())
    data.dividends=[event({actual_amount:0}),event({id:'threshold',actual_amount:800})]
    expect(advancedDividendAlerts(data,'2026-09-25').map(a=>a.key)).toEqual(['short:one'])
  })
  it('does not alert about unowned quote records',()=>{
    const data=buildGuestOverview(emptyGuestDraft())
    data.holdings=[{ticker:'0050',name:'ETF',shares:1,price:100,annualYield:2}]
    const quote={ticker:'0050.TW',name:'ETF',price:100,yield:2,dividend_months:[],dividend_status:null,dividend_change_pct:-30,data_source:'fixture',last_updated_at:null}
    data.quotes=[quote,{...quote,ticker:'9999'}]
    expect(advancedDividendAlerts(data,'2026-09-25')).toHaveLength(1)
  })
})
