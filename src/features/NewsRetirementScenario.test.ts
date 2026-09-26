import {describe,it,expect} from 'vitest'
import {classifyNewsAsset,ratePriceChange} from './NewsRetirementScenario'
import {shockImpact,impactSummary} from '../lib/investmentImpact'
describe('news retirement event mapping',()=>{
 it('converts 80bps to duration price change without treating it as 80 percent',()=>{expect(ratePriceChange(4.2,5,5)).toBeCloseTo(-4);expect(ratePriceChange(5,4.2,5)).toBeCloseTo(4)})
 it('does not invent a growth classification',()=>{const row={id:'x',name:'中華電',value:100,annualIncome:5,cash:false};expect(classifyNewsAsset(row)).toBe('other');expect(classifyNewsAsset({...row,name:'公司債基金'})).toBe('bond');expect(classifyNewsAsset({...row,name:'高股息ETF'})).toBe('dividend');expect(classifyNewsAsset({...row,cash:true})).toBe('cash')})
 it('keeps coupon income unchanged when only bond price changes',()=>{const rows=[{id:'b',name:'bond',value:800000,annualIncome:32000,cash:false}];const after=shockImpact(rows,{b:{price:ratePriceChange(4.2,5,5),income:0}});expect(after[0].value).toBeCloseTo(768000);expect(after[0].annualIncome).toBe(32000);expect(impactSummary(after,0,22000).months).toBeLessThan(impactSummary(rows,0,22000).months!)})
 it('rejects invalid or extreme duration assumptions',()=>{expect(()=>ratePriceChange(4,5,-1)).toThrow();expect(()=>ratePriceChange(0,10,50)).toThrow();expect(()=>ratePriceChange(NaN,5,5)).toThrow()})
})
