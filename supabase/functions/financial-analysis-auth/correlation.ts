export type DatedBar = { t: number; c: number | null }
export function alignedCorrelation(a: DatedBar[], b: DatedBar[], minimum = 30) {
  const returns = (bars: DatedBar[]) => {
    const valid = bars.filter(x => Number.isFinite(x.t) && x.c != null && Number.isFinite(x.c) && x.c > 0).sort((x,y) => x.t-y.t)
    const values = new Map<string, number>()
    for (let i=1; i<valid.length; i++) {
      const start = new Date(valid[i-1].t*1000).toISOString().slice(0,10)
      const end = new Date(valid[i].t*1000).toISOString().slice(0,10)
      if (start !== end) values.set(`${start}/${end}`, valid[i].c! / valid[i-1].c! - 1)
    }
    return values
  }
  const x=returns(a), y=returns(b)
  const dates=[...x.keys()].filter(date => y.has(date)).sort()
  if (dates.length < minimum) return null
  const mx=dates.reduce((s,d)=>s+x.get(d)!,0)/dates.length
  const my=dates.reduce((s,d)=>s+y.get(d)!,0)/dates.length
  let numerator=0,xx=0,yy=0
  for (const d of dates) { const dx=x.get(d)!-mx,dy=y.get(d)!-my; numerator+=dx*dy;xx+=dx*dx;yy+=dy*dy }
  if (xx<=Number.EPSILON || yy<=Number.EPSILON) return null
  return {corr:Math.max(-1,Math.min(1,numerator/Math.sqrt(xx*yy))),samples:dates.length,start:dates[0].slice(0,10),end:dates.at(-1)!.slice(11)}
}
