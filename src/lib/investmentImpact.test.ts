import { describe,it,expect } from 'vitest'
import {buyImpact,shockImpact,impactSummary,monthsText} from './investmentImpact'
const rows=[{id:'cash',name:'現金',value:100000,annualIncome:1000,cash:true},{id:'stock',name:'ETF',value:100000,annualIncome:5000,cash:false}]
describe('investment retirement comparisons',()=>{
  it('transfers existing money without inventing assets and removes source income',()=>{const next=buyImpact(rows,'cash','stock','ETF',50000,6);expect(next.reduce((n,r)=>n+r.value,0)).toBe(200000);expect(next[0].annualIncome).toBe(500);expect(next[1].annualIncome).toBe(8000);expect(rows[0].value).toBe(100000)})
  it('external contribution increases total assets',()=>{expect(buyImpact(rows,'external','new','基金',10000,0).reduce((n,r)=>n+r.value,0)).toBe(210000)})
  it('rejects overspending and self-transfers',()=>{expect(()=>buyImpact(rows,'cash','new','ETF',100001,5)).toThrow();expect(()=>buyImpact(rows,'stock','stock','ETF',1000,5)).toThrow()})
  it('changes income independently from market value without double counting',()=>{const next=shockImpact(rows,{stock:{price:-20,income:-10}});expect(next[1].value).toBe(80000);expect(next[1].annualIncome).toBe(4500);expect(next[0]).toEqual(rows[0])})
  it('calculates gap and concentration excluding cash as an investment',()=>{const s=impactSummary(rows,500,2000);expect(s.gap).toBe(1000);expect(s.months).toBe(200);expect(s.concentration).toBe(50)})
  it('does not show infinity or invalid negative assets',()=>{expect(impactSummary(rows,2000,2000).months).toBeNull();expect(monthsText(null)).toContain('覆蓋');expect(()=>shockImpact(rows,{stock:{price:-101,income:0}})).toThrow()})
})
