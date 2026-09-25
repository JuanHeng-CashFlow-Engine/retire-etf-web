import { alignedCorrelation } from './correlation.ts';
import { authorizePro } from './access.ts';
import { possibleIncomeDuplicates } from './fixed-income.ts';
const allowedOrigin = "https://juanheng-cashflow-engine.github.io";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const TW_NAMES: Record<string,string> = {
  "0050":"元大台灣50",
  "0056":"元大高股息",
  "006208":"富邦台50",
  "00679B":"元大美債20年",
  "00730":"富邦臺灣優質高息",
  "00786B":"元大10年期以上美元投資級銀行債",
  "2884":"玉山金",
  "00713":"元大台灣高息低波",
  "00751B":"元大20年期以上AAA至A級美元公司債",
  "00878":"國泰永續高股息",
  "00919":"群益台灣精選高息",
  "00929":"復華台灣科技優息",
  "00935":"野村臺灣創新科技50",
  "00938":"凱基優選30",
  "00941":"中信上游半導體",
  "00981A":"主動統一台股增長",
  "009802":"富邦台灣旗艦動能50",
  "2412":"中華電信",
  "2890":"永豐金",
  "2885":"元大金",
  "2330":"台積電",
  "2454":"聯發科",
  "3711":"日月光投控",
  "3037":"欣興"
};

function n(v:any){ return typeof v === "number" && Number.isFinite(v) ? v : null; }
function pct(a:number|null,b:number|null){ return a!==null && b!==null && b!==0 ? ((a-b)/b)*100 : null; }
function mean(xs:number[]){ return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null; }
function sma(values:number[], p:number){ return values.length>=p ? mean(values.slice(-p)) : null; }
function stddev(values:number[], p:number){
  if(values.length<p) return null;
  const xs=values.slice(-p), m=mean(xs)!;
  return Math.sqrt(xs.reduce((s,x)=>s+(x-m)*(x-m),0)/p);
}
function emaSeries(values:number[], p:number){ if(!values.length) return []; const k=2/(p+1); let e=values[0]; const out:number[]=[]; for(const x of values){ e=x*k+e*(1-k); out.push(e); } return out; }
function rsi(values:number[], p=14){ if(values.length<=p) return null; let g=0,l=0; for(let i=values.length-p;i<values.length;i++){ const d=values[i]-values[i-1]; if(d>0)g+=d; else l-=d; } const ag=g/p, al=l/p; if(al===0)return 100; const rs=ag/al; return 100-100/(1+rs); }
function macd(values:number[]){ if(values.length<35)return null; const a=emaSeries(values,12),b=emaSeries(values,26); const line=a.map((x,i)=>x-b[i]); const sig=emaSeries(line,9); const i=line.length-1; return {line:line[i],signal:sig[i],hist:line[i]-sig[i]}; }
function stochasticKD(highs:number[],lows:number[],closes:number[],period=9,kSmooth=3,dSmooth=3){
  const len=Math.min(highs.length,lows.length,closes.length);
  if(len<period+kSmooth+dSmooth) return null;
  const rawK:number[]=[];
  for(let i=period-1;i<len;i++){
    const hh=Math.max(...highs.slice(i-period+1,i+1));
    const ll=Math.min(...lows.slice(i-period+1,i+1));
    rawK.push(hh===ll?50:((closes[i]-ll)/(hh-ll))*100);
  }
  const smooth=(arr:number[],p:number)=>{
    const out:number[]=[];
    for(let i=0;i<arr.length;i++){
      if(i<p-1) out.push(arr[i]);
      else out.push(mean(arr.slice(i-p+1,i+1))!);
    }
    return out;
  };
  const k=smooth(rawK,kSmooth), d=smooth(k,dSmooth);
  return {k:k[k.length-1],d:d[d.length-1],j:3*k[k.length-1]-2*d[d.length-1]};
}
function obvSeries(closes:number[],volumes:number[]){
  const len=Math.min(closes.length,volumes.length);
  if(len<2) return [];
  const out:number[]=[0];
  for(let i=1;i<len;i++){
    let v=out[i-1];
    if(closes[i]>closes[i-1]) v+=volumes[i]||0;
    else if(closes[i]<closes[i-1]) v-=volumes[i]||0;
    out.push(v);
  }
  return out;
}
function linregSlope(values:number[], lookback=20){
  const xs=values.slice(-lookback);
  const n=xs.length; if(n<3) return null;
  const mx=(n-1)/2, my=mean(xs)!;
  let num=0, den=0;
  for(let i=0;i<n;i++){ num+=(i-mx)*(xs[i]-my); den+=(i-mx)*(i-mx); }
  return den?num/den:null;
}
function rollingReturns(values:number[]){ const o:number[]=[]; for(let i=1;i<values.length;i++) if(values[i-1]!==0)o.push(values[i]/values[i-1]-1); return o; }
function atr14(highs:number[],lows:number[],closes:number[],p=14){
  const len=Math.min(highs.length,lows.length,closes.length);
  if(len<=p) return null;
  const tr:number[]=[];
  for(let i=1;i<len;i++){
    const h=highs[i], l=lows[i], pc=closes[i-1];
    tr.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));
  }
  return tr.length>=p ? mean(tr.slice(-p)) : null;
}
function corr(a:number[],b:number[]){ const len=Math.min(a.length,b.length); if(len<3)return null; const x=a.slice(-len),y=b.slice(-len),mx=mean(x)!,my=mean(y)!; let num=0,dx=0,dy=0; for(let i=0;i<len;i++){ const xa=x[i]-mx,ya=y[i]-my; num+=xa*ya;dx+=xa*xa;dy+=ya*ya;} return dx&&dy?num/Math.sqrt(dx*dy):null; }

function candidateSymbols(text:string){
  const out:string[]=[]; const add=(s:string)=>{ s=s.toUpperCase(); if(s&&!out.includes(s))out.push(s); };
  const aliases:Record<string,string>={"台積電":"2330","中華電":"2412","中華電信":"2412","國泰永續高股息":"00878","主動統一台股增長":"00981A","統一台股增長":"00981A","元大台灣高息低波":"00713","永豐金":"2890","元大金":"2885","聯發科":"2454","日月光":"3711","欣興":"3037"};
  for(const [k,v] of Object.entries(aliases)) if(text.includes(k)) add(v);
  for(const m of text.matchAll(/\b(\d{4,6}[A-Z]?)\b/gi)) {
    const token=m[1].toUpperCase();
    const yearNum=/^\d{4}$/.test(token)?parseInt(token,10):null;
    if(yearNum!==null && yearNum>=1900 && yearNum<=2100) continue;
    add(token);
  }
  for(const m of text.matchAll(/\b(NVDA|AAPL|MSFT|GOOG|GOOGL|AMZN|META|TSLA|AMD|AVGO|QCOM|INTC|QQQ|VOO|VT|JEPI|IBIT|URA|IGV|VWRA|BND|BNDW)\b/gi)) add(m[1]);
  return out.slice(0,8);
}

async function yahooChart(ticker:string,interval:string,range:string){
  const url="https://query1.finance.yahoo.com/v8/finance/chart/"+encodeURIComponent(ticker)+"?interval="+interval+"&range="+range+"&events=div%2Csplits";
  const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"}});
  if(!r.ok)return null;
  const j=await r.json();
  return j?.chart?.result?.[0]??null;
}
async function resolveTicker(symbol:string){
  const isTwCode=/^\d{4,6}[A-Z]?$/.test(symbol);
  const a=isTwCode?[symbol+".TW",symbol+".TWO"]:[symbol];
  for(const t of a){ const x=await yahooChart(t,"1d","5d"); if(x?.meta?.regularMarketPrice!=null)return t; }
  return null;
}
async function barsFor(ticker:string,interval:string,range:string){
  const x=await yahooChart(ticker,interval,range); if(!x)return null;
  const q=x?.indicators?.quote?.[0]??{}, ts=x?.timestamp??[];
  const bars=ts.map((t:number,i:number)=>({t,o:n(q.open?.[i]),h:n(q.high?.[i]),l:n(q.low?.[i]),c:n(q.close?.[i]),v:n(q.volume?.[i])}));
  return {bars,meta:x.meta};
}
async function snapshot(symbol:string){
  const ticker=await resolveTicker(symbol); if(!ticker)return null;
  const [day,year,weekly]=await Promise.all([barsFor(ticker,"5m","1d"),barsFor(ticker,"1d","1y"),barsFor(ticker,"1wk","2y")]); if(!day?.meta)return null;
  const meta=day.meta, dc=day.bars.map((b:any)=>b.c).filter((x:any)=>x!==null), dh=day.bars.map((b:any)=>b.h).filter((x:any)=>x!==null), dl=day.bars.map((b:any)=>b.l).filter((x:any)=>x!==null), dv=day.bars.map((b:any)=>b.v).filter((x:any)=>x!==null);
  const yc=year?.bars.map((b:any)=>b.c).filter((x:any)=>x!==null)??[], yh=year?.bars.map((b:any)=>b.h).filter((x:any)=>x!==null)??[], yl=year?.bars.map((b:any)=>b.l).filter((x:any)=>x!==null)??[], yv=year?.bars.map((b:any)=>b.v).filter((x:any)=>x!==null&&x>0)??[], wc=weekly?.bars.map((b:any)=>b.c).filter((x:any)=>x!==null)??[], wh=weekly?.bars.map((b:any)=>b.h).filter((x:any)=>x!==null)??[], wl=weekly?.bars.map((b:any)=>b.l).filter((x:any)=>x!==null)??[];
  const price=n(meta.regularMarketPrice), prev=n(meta.chartPreviousClose)??n(meta.previousClose), vol=n(meta.regularMarketVolume)??(dv.length?dv.reduce((a:number,b:number)=>a+b,0):null), avgVol=yv.length?mean(yv.slice(-20)):null, atr=atr14(yh,yl,yc,14);
  const base=ticker.replace(/\.(TW|TWO)$/,"");
  const isTW=ticker.endsWith(".TW")||ticker.endsWith(".TWO");
  return {
    symbol:ticker,
    display_name:isTW ? (TW_NAMES[base] || meta.shortName || meta.longName || base) : (meta.shortName||meta.longName||ticker),
    display_code:base,
    market:isTW?"台股":"美股",
    currency:meta.currency||"",
    price,previous_close:prev,change:price!==null&&prev!==null?price-prev:null,change_pct:pct(price,prev),
    open:n(meta.regularMarketOpen)??day.bars.find((b:any)=>b.o!==null)?.o??null,
    day_high:n(meta.regularMarketDayHigh)??(dh.length?Math.max(...dh):null),
    day_low:n(meta.regularMarketDayLow)??(dl.length?Math.min(...dl):null),
    high_52w:yh.length?Math.max(...yh):n(meta.fiftyTwoWeekHigh),
    low_52w:yl.length?Math.min(...yl):n(meta.fiftyTwoWeekLow),
    volume:vol,avg_volume_20d:avgVol,relative_volume:vol!==null&&avgVol?vol/avgVol:null,
    sparkline:dc.slice(-48),
    market_time:typeof meta.regularMarketTime==="number"?new Date(meta.regularMarketTime*1000).toISOString():null,
    source:"Yahoo Finance public chart endpoint",
    delayed_note:"公開行情可能延遲，非交易所授權即時報價",
    daily_closes:yc, daily_highs:yh, daily_lows:yl, daily_volumes:yv, weekly_closes:wc, weekly_highs:wh, weekly_lows:wl, weekly_volumes:weekly?.bars.map((b:any)=>b.v).filter((x:any)=>x!==null&&x>0)??[], atr14:atr
  };
}

function technicalReport(s:any,prompt:string=""){
  const d=s.daily_closes as number[];
  const dh=s.daily_highs as number[];
  const dl=s.daily_lows as number[];
  const dv=s.daily_volumes as number[];
  const w=s.weekly_closes as number[];
  const wh=s.weekly_highs as number[];
  const wl=s.weekly_lows as number[];
  const wv=s.weekly_volumes as number[];
  const price=s.price as number|null;

  let ma_mode="standard";
  if(prompt.includes("10EMA")||prompt.includes("20EMA")||prompt.includes("50SMA")||prompt.includes("200SMA")) ma_mode="us_ema_sma";
  else if(prompt.includes("布林通道")||prompt.includes("Bollinger")) ma_mode="bollinger";

  const dma5=sma(d,5), dma20=sma(d,20), dma60=sma(d,60), dma120=sma(d,120), dma240=sma(d,240);
  const dema10Arr=emaSeries(d,10), dema20Arr=emaSeries(d,20);
  const dema10=dema10Arr.length?dema10Arr[dema10Arr.length-1]:null;
  const dema20=dema20Arr.length?dema20Arr[dema20Arr.length-1]:null;
  const dsma50=sma(d,50), dsma200=sma(d,200);
  const bbMid=dma20, bbStd=stddev(d,20);
  const bbUpper=bbMid!==null&&bbStd!==null?bbMid+2*bbStd:null;
  const bbLower=bbMid!==null&&bbStd!==null?bbMid-2*bbStd:null;
  const wma5=sma(w,5), wma13=sma(w,13), wma26=sma(w,26), wma52=sma(w,52);

  const drsi=rsi(d,14), wrsi=rsi(w,14);
  const dmacd=macd(d), wmacd=macd(w);
  const dkd=stochasticKD(dh,dl,d,9,3,3);
  const wkd=stochasticKD(wh,wl,w,9,3,3);
  const dobv=obvSeries(d,dv), wobv=obvSeries(w,wv);
  const dobvSlope=dobv.length?linregSlope(dobv,20):null;
  const wobvSlope=wobv.length?linregSlope(wobv,13):null;
  const dSlope=linregSlope(d,20), wSlope=linregSlope(w,13);

  let indicator_mode="rsi_macd";
  if(prompt.includes("KD")||prompt.includes("隨機指標")) indicator_mode="kd";
  else if(prompt.includes("OBV")||prompt.includes("量價")) indicator_mode="obv";

  const supports=[
    {label:"日線20MA",value:dma20},
    {label:"日線60MA",value:dma60},
    {label:"今日低點",value:s.day_low},
    {label:"週線13MA",value:wma13}
  ].filter((x:any)=>x.value!==null && (price===null || x.value<=price))
   .sort((a:any,b:any)=>b.value-a.value);

  const resistances=[
    {label:"日線5MA",value:dma5},
    {label:"今日高點",value:s.day_high},
    {label:"52週高點",value:s.high_52w},
    {label:"週線5MA",value:wma5}
  ].filter((x:any)=>x.value!==null && (price===null || x.value>=price))
   .sort((a:any,b:any)=>a.value-b.value);

  const supportLevels=supports.slice(0,3);
  const resistanceLevels=resistances.slice(0,3);

  let dailyTrend="盤整";
  if(ma_mode==="us_ema_sma"){
    if(price!==null&&dema20!==null&&dsma50!==null&&dsma200!==null){
      if(price>dema20&&dema20>dsma50&&dsma50>dsma200) dailyTrend="偏多";
      else if(price<dema20&&dema20<dsma50&&dsma50<dsma200) dailyTrend="偏空";
    }
  }else if(ma_mode==="bollinger"){
    if(price!==null&&bbMid!==null&&bbUpper!==null&&bbLower!==null){
      if(price>bbMid) dailyTrend="偏多";
      else if(price<bbMid) dailyTrend="偏空";
    }
  }else{
    if(price!==null&&dma20!==null&&dma60!==null){
      if(price>dma20&&dma20>dma60) dailyTrend="偏多";
      else if(price<dma20&&dma20<dma60) dailyTrend="偏空";
    }
  }

  let weeklyTrend="盤整";
  if(price!==null&&wma13!==null&&wma26!==null){
    if(price>wma13&&wma13>wma26) weeklyTrend="偏多";
    else if(price<wma13&&wma13<wma26) weeklyTrend="偏空";
  }

  const trendLineDaily=dSlope===null?"資料不足":(dSlope>0?"上升趨勢線":"下降趨勢線");
  const trendLineWeekly=wSlope===null?"資料不足":(wSlope>0?"上升趨勢線":"下降趨勢線");

  const reasons:string[]=[];
  let score=0;

  if(dailyTrend==="偏多"){
    score+=2;
    reasons.push(ma_mode==="us_ema_sma" ? "日線價格與10/20EMA、50/200SMA結構偏多。" : ma_mode==="bollinger" ? "股價位於布林中線之上，日線結構偏多。" : "日線價格與20/60日均線呈多頭排列。");
  } else if(dailyTrend==="偏空"){
    score-=2;
    reasons.push(ma_mode==="us_ema_sma" ? "日線價格與10/20EMA、50/200SMA結構偏空。" : ma_mode==="bollinger" ? "股價位於布林中線之下，日線結構偏空。" : "日線價格與20/60日均線呈空頭排列。");
  } else reasons.push("日線均線結構偏盤整。");

  if(weeklyTrend==="偏多"){ score+=2; reasons.push("週線13/26週均線結構偏多。"); }
  else if(weeklyTrend==="偏空"){ score-=2; reasons.push("週線13/26週均線結構偏空。"); }
  else reasons.push("週線結構偏盤整。");

  if(ma_mode==="bollinger" && price!==null && bbUpper!==null && bbLower!==null){
    if(price>=bbUpper) reasons.push("股價接近或突破布林上軌，短線可能偏強，但也要留意過熱。");
    else if(price<=bbLower) reasons.push("股價接近或跌破布林下軌，短線可能偏弱或接近超賣。");
    else reasons.push("股價目前位於布林通道內，尚未出現明顯極端位置。");
  }

  if(indicator_mode==="rsi_macd"){
    if(drsi!==null){
      if(drsi<30){ score+=1; reasons.push("日RSI低於30，進入偏低區，但仍需等待止跌。"); }
      else if(drsi>70){ score-=1; reasons.push("日RSI高於70，短線過熱風險升高。"); }
    }
    if(dmacd){
      if(dmacd.hist>0){ score+=1; reasons.push("日MACD柱狀體為正，動能偏正向。"); }
      else { score-=1; reasons.push("日MACD柱狀體為負，動能偏弱。"); }
    }
    if(wmacd){
      if(wmacd.hist>0){ score+=1; reasons.push("週MACD柱狀體為正，中期動能較佳。"); }
      else { score-=1; reasons.push("週MACD柱狀體為負，中期動能偏弱。"); }
    }
  } else if(indicator_mode==="kd"){
    if(dkd){
      if(dkd.k>dkd.d && dkd.k<80){ score+=1; reasons.push("日KD中K值高於D值，短線動能偏正向。"); }
      else if(dkd.k<dkd.d){ score-=1; reasons.push("日KD中K值低於D值，短線動能偏弱。"); }
      if(dkd.k>80) reasons.push("日KD位於高檔區，短線追價風險較高。");
      if(dkd.k<20) reasons.push("日KD位於低檔區，可能接近超賣。");
    }
    if(wkd){
      if(wkd.k>wkd.d){ score+=1; reasons.push("週KD偏多，中期動能較佳。"); }
      else { score-=1; reasons.push("週KD偏空，中期動能偏弱。"); }
    }
  } else {
    if(dobvSlope!==null){
      if(dobvSlope>0){ score+=1; reasons.push("日OBV呈上升，量價資金動能偏正向。"); }
      else { score-=1; reasons.push("日OBV呈下降，量價資金動能偏弱。"); }
    }
    if(wobvSlope!==null){
      if(wobvSlope>0){ score+=1; reasons.push("週OBV趨勢向上，中期量價結構較佳。"); }
      else { score-=1; reasons.push("週OBV趨勢向下，中期量價結構偏弱。"); }
    }
    if(typeof s.relative_volume==="number"){
      if(s.relative_volume>=1.2) reasons.push("目前成交量高於近20日平均，市場參與度較高。");
      else reasons.push("目前成交量低於近20日平均，量能偏保守。");
    }
  }

  let signal="持有 / 觀望";
  if(score>=4) signal="偏多訊號：可觀察買進條件";
  else if(score<=-4) signal="偏空訊號：可觀察減碼 / 賣出條件";

  const actionReasons = signal.startsWith("偏多")
    ? ["等待價格守住主要支撐或突破壓力後再確認。","若相對成交量同步放大，訊號可信度較高。","停損可參考最近支撐下方或ATR。"]
    : signal.startsWith("偏空")
    ? ["若跌破主要支撐且量增，減碼訊號更明確。","反彈若無法站回20日線/13週線，可視為弱勢延續。","避免只因單一指標超賣就逆勢加碼。"]
    : ["目前多空訊號混合，等待價格突破壓力或跌破支撐。","觀察日週線是否同方向，再決定是否調整部位。"];

  return {
    title:s.display_name+"（"+s.display_code+"）日線＋週線技術分析",
    summary:"日線："+dailyTrend+"；週線："+weeklyTrend+"；綜合訊號："+signal+"。",
    signal,
    score,
    indicator_mode,
    ma_mode,
    daily:{
      trend:dailyTrend,trend_line:trendLineDaily,
      ma5:dma5,ma20:dma20,ma60:dma60,ma120:dma120,ma240:dma240,
      ema10:dema10,ema20:dema20,sma50:dsma50,sma200:dsma200,
      bollinger:{mid:bbMid,upper:bbUpper,lower:bbLower},
      rsi14:drsi,macd:dmacd,kd:dkd,
      obv:dobv.length?dobv[dobv.length-1]:null,
      obv_slope:dobvSlope,
      volume:s.volume,avg_volume_20d:s.avg_volume_20d,relative_volume:s.relative_volume
    },
    weekly:{
      trend:weeklyTrend,trend_line:trendLineWeekly,
      ma5:wma5,ma13:wma13,ma26:wma26,ma52:wma52,
      rsi14:wrsi,macd:wmacd,kd:wkd,
      obv:wobv.length?wobv[wobv.length-1]:null,
      obv_slope:wobvSlope
    },
    support_levels:supportLevels,
    resistance_levels:resistanceLevels,
    metrics:{
      ma5:dma5,ma20:dma20,ma60:dma60,ma120:dma120,ma240:dma240,
      rsi14:drsi,macd:dmacd,
      support:supportLevels.length?supportLevels[0].value:null,
      resistance:resistanceLevels.length?resistanceLevels[0].value:null
    },
    reasons,
    action_reasons:actionReasons,
    notes:[
      "日線與週線均以公開歷史行情計算。",
      "趨勢線為最近一段收盤價的線性回歸斜率判定。",
      "買進／持有／賣出為規則式訊號，不代表投資建議。"
    ]
  };
}

function parseRequiredRR(prompt:string){
  const m=prompt.match(/1\s*:\s*([0-9.]+)/);
  const v=m?parseFloat(m[1]):2.5;
  return Number.isFinite(v)&&v>=1?v:2.5;
}
function parseTradeStyle(prompt:string){
  if(prompt.includes("短線當沖")||prompt.includes("短線隔日沖")||prompt.includes("1-3 天")){
    return {
      key:"short",
      label:"短線隔日沖（1～3天）",
      hold_days:3,
      entry_atr:0.05,
      stop_atr:0.55,
      support_ma:"MA5",
      trend_ma:"MA20",
      focus:"短均線、量能、RSI/KD與快速停損"
    };
  }
  if(prompt.includes("中長線")||prompt.includes("1-3 個月")){
    return {
      key:"medium",
      label:"中長線趨勢（1～3個月）",
      hold_days:60,
      entry_atr:0.20,
      stop_atr:1.50,
      support_ma:"MA20",
      trend_ma:"MA60",
      focus:"MA20/60、週線方向、MACD與中期趨勢"
    };
  }
  if(prompt.includes("價值型長期")||prompt.includes("6 個月以上")||prompt.includes("長線存股")){
    return {
      key:"long",
      label:"價值型長線存股（6個月以上）",
      hold_days:120,
      entry_atr:0.25,
      stop_atr:2.20,
      support_ma:"MA60",
      trend_ma:"MA240",
      focus:"MA60/240、52週位置、長期趨勢與基本面確認"
    };
  }
  return {
    key:"swing",
    label:"波段操作（1～4週）",
    hold_days:20,
    entry_atr:0.15,
    stop_atr:0.85,
    support_ma:"MA20",
    trend_ma:"MA60",
    focus:"MA20/60、支撐壓力、MACD/RSI與量價"
  };
}

function tradeIdeaReport(s:any,prompt:string){
  const t=technicalReport(s);
  const p=s.price as number|null;
  const sup=t.metrics.support as number|null;
  const res=t.metrics.resistance as number|null;
  const ma5=t.metrics.ma5 as number|null;
  const ma20=t.metrics.ma20 as number|null;
  const ma60=t.metrics.ma60 as number|null;
  const ma240=t.metrics.ma240 as number|null;
  const R=t.metrics.rsi14 as number|null;
  const atr=(typeof s.atr14==="number"&&s.atr14>0)?s.atr14:(p?Math.max(p*0.02,0.01):1);
  const rr=parseRequiredRR(prompt);
  const style=parseTradeStyle(prompt);
  const ideas:any[]=[];

  const styleSupport = style.key==="short" ? (ma5??sup??p)
    : style.key==="medium" ? (ma20??sup??p)
    : style.key==="long" ? (ma60??ma240??sup??p)
    : (sup??ma20??p);

  const styleTrend = style.key==="short" ? (ma20??p)
    : style.key==="medium" ? (ma60??p)
    : style.key==="long" ? (ma240??ma60??p)
    : (ma60??p);

  const add=(name:string,entry:number,stop:number,target:number,trigger:string,technical_reason:string,fundamental_reason:string)=>{
    const risk=Math.max(entry-stop,0.0001);
    const reward=Math.max(target-entry,0);
    ideas.push({
      name,
      trade_style:style.label,
      entry_price:entry,
      target_price:target,
      stop_loss:stop,
      risk_reward:reward/risk,
      requested_rr:rr,
      trigger,
      technical_reason,
      fundamental_reason,
      note:"價格由規則引擎依最新公開行情與所選交易風格估算，非保證成交價。"
    });
  };

  if(p!==null){
    const fundamental_reason = style.key==="long"
      ? "長線存股除了價格趨勢，還應再確認營收、獲利、配息與估值；目前完整基本面資料尚未接入，因此不臆測。"
      : "目前尚未接入完整財報/估值資料；基本面欄位先標示資料不足，避免臆測。";

    {
      const entry=Math.max(0.01,(styleSupport as number)+style.entry_atr*atr);
      const stop=Math.max(0.01,(styleSupport as number)-style.stop_atr*atr);
      const target=entry+rr*(entry-stop);
      add(
        style.key==="short"?"短線支撐快進快出":style.key==="medium"?"中期支撐回踩":style.key==="long"?"長期支撐分批布局":"支撐回測反彈",
        entry,stop,target,
        style.key==="short"?"價格快速回測短均線後止跌，且量能沒有明顯失控。":
        style.key==="long"?"價格接近中長期支撐區，且長期趨勢沒有明顯轉空。":
        "價格回測所選週期的重要支撐後止跌。",
        "依所選交易風格使用不同均線與ATR距離設定支撐與停損。",
        fundamental_reason
      );
    }

    {
      const resistanceBase=res??Math.max(p,ma5??p);
      const entry=resistanceBase+(style.key==="short"?0.10:style.key==="long"?0.30:0.20)*atr;
      const stop=Math.max(0.01,resistanceBase-(style.key==="short"?0.45:style.key==="medium"?1.20:style.key==="long"?2.00:0.80)*atr);
      const target=entry+rr*(entry-stop);
      add(
        style.key==="short"?"短線放量突破":style.key==="medium"?"中期突破續強":style.key==="long"?"長期趨勢突破":"突破壓力續強",
        entry,stop,target,
        "價格有效站上壓力區，且成交量最好同步放大。",
        "短週期使用較緊停損；長週期使用較寬停損，避免被一般波動洗掉。",
        fundamental_reason
      );
    }

    {
      const base=styleTrend as number;
      const entry=Math.max(0.01,base+(style.key==="short"?0.05:0.10)*atr);
      const stop=Math.max(0.01,base-(style.key==="short"?0.50:style.key==="medium"?1.40:style.key==="long"?2.00:0.90)*atr);
      const target=entry+rr*(entry-stop);
      add(
        style.key==="short"?"短均線趨勢跟隨":style.key==="long"?"長期均線趨勢布局":style.key==="medium"?"中期趨勢回踩":"20日線趨勢回踩",
        entry,stop,target,
        "價格維持在所選週期的主要趨勢線之上，回踩後重新轉強。",
        "交易風格不同，趨勢線會由短均線、中期均線或長期均線擔任。",
        fundamental_reason
      );
    }

    {
      const entry=p+(style.key==="short"?0.05:style.key==="long"?0.20:0.10)*atr;
      const stop=Math.max(0.01,p-(style.key==="short"?0.50:style.key==="medium"?1.20:style.key==="long"?1.80:0.90)*atr);
      const target=entry+rr*(entry-stop);
      const rsiText=R===null?"RSI資料不足":"RSI14="+R.toFixed(1);
      add(
        style.key==="short"?"短線量價動能":style.key==="medium"?"中期動能延續":style.key==="long"?"長期趨勢續抱":"波段動能延續",
        entry,stop,target,
        style.key==="long"?"中長期趨勢仍向上，且短期沒有明顯破壞結構。":"股價維持趨勢線之上，動能沒有明顯轉弱。",
        "以均線、MACD、RSI與ATR配合所選持有期間判斷；"+rsiText+"。",
        fundamental_reason
      );
    }

    {
      const base=(R!==null&&R<35)?p:(ma5??p);
      const entry=Math.max(0.01,base);
      const stop=Math.max(0.01,entry-(style.key==="short"?0.45:style.key==="medium"?1.00:style.key==="long"?1.60:0.80)*atr);
      const target=entry+rr*(entry-stop);
      add(
        style.key==="short"?"短線超賣反彈":style.key==="medium"?"中期拉回布局":style.key==="long"?"長線分批低接":"波段均值回歸",
        entry,stop,target,
        style.key==="long"?"價格偏離長期均值較多時，等待止跌後分批布局。":"RSI偏低或價格與短均線乖離收斂後，出現止跌訊號。",
        "所選週期越長，容許的價格波動與停損距離越大。",
        fundamental_reason
      );
    }
  }

  return {
    title:s.display_name+"（"+s.display_code+"）5個交易機會掃描",
    trade_style:style,
    style_settings:{
      hold_days:style.hold_days,
      support_ma:style.support_ma,
      trend_ma:style.trend_ma,
      stop_atr:style.stop_atr,
      focus:style.focus
    },
    summary:"已依「"+style.label+"」調整進場條件、均線基準、ATR停損距離與回測持有天數。",
    rr_requested:rr,
    ideas
  };
}

async function backtestTradeIdeas(symbol:string, rr:number, prompt:string){
  const ticker=await resolveTicker(symbol);
  if(!ticker) return [];
  const d=await barsFor(ticker,"1d","5y");
  if(!d) return [];

  const style=parseTradeStyle(prompt);
  const bars=d.bars.filter((b:any)=>b.c!==null&&b.h!==null&&b.l!==null);
  if(bars.length<260) return [];

  const closes=bars.map((b:any)=>b.c as number);
  const highs=bars.map((b:any)=>b.h as number);
  const lows=bars.map((b:any)=>b.l as number);
  const vols=bars.map((b:any)=>typeof b.v==="number"?b.v:0);

  const ma5Arr=closes.map((_,i)=>i>=4?mean(closes.slice(i-4,i+1)):null);
  const ma20Arr=closes.map((_,i)=>i>=19?mean(closes.slice(i-19,i+1)):null);
  const ma60Arr=closes.map((_,i)=>i>=59?mean(closes.slice(i-59,i+1)):null);
  const ma240Arr=closes.map((_,i)=>i>=239?mean(closes.slice(i-239,i+1)):null);
  const rsiArr=closes.map((_,i)=>i>=14?rsi(closes.slice(0,i+1),14):null);
  const macdHist=closes.map((_,i)=>i>=35?(macd(closes.slice(0,i+1))?.hist??null):null);
  const atrArr=closes.map((_,i)=>i>=14?atr14(highs.slice(0,i+1),lows.slice(0,i+1),closes.slice(0,i+1),14):null);
  const vol20=vols.map((_,i)=>i>=19?mean(vols.slice(i-19,i+1)):null);

  const styleCfg = style.key==="short"
    ? {hold:3, stopAtr:0.55, volMin:1.30, rsiLow:35, rsiHigh:68}
    : style.key==="medium"
    ? {hold:60, stopAtr:1.50, volMin:1.10, rsiLow:40, rsiHigh:75}
    : style.key==="long"
    ? {hold:120, stopAtr:2.20, volMin:1.00, rsiLow:35, rsiHigh:80}
    : {hold:20, stopAtr:0.85, volMin:1.20, rsiLow:35, rsiHigh:70};

  const result:any[]=[];

  const runStrategy=(name:string, entryRule:(i:number)=>boolean, stopTarget:(i:number)=>{entry:number,stop:number,target:number}|null)=>{
    let trades=0,wins=0,grossWin=0,grossLoss=0,equity=1,peak=1,mdd=0;
    const rets:number[]=[];

    for(let i=240;i<bars.length-1;i++){
      if(!entryRule(i)) continue;
      const st=stopTarget(i);
      if(!st) continue;
      const {entry,stop,target}=st;
      if(!(entry>stop && target>entry)) continue;

      let exitRet:number|null=null;
      for(let j=i+1;j<Math.min(bars.length,i+1+styleCfg.hold);j++){
        const h=highs[j], l=lows[j];
        const hitStop=l<=stop, hitTarget=h>=target;
        if(hitStop && hitTarget){ exitRet=(stop-entry)/entry; break; }
        if(hitStop){ exitRet=(stop-entry)/entry; break; }
        if(hitTarget){ exitRet=(target-entry)/entry; break; }
      }
      if(exitRet===null){
        const j=Math.min(bars.length-1,i+styleCfg.hold);
        exitRet=(closes[j]-entry)/entry;
      }

      trades++;
      rets.push(exitRet);
      equity*=1+exitRet;
      if(exitRet>=0){wins++;grossWin+=exitRet;} else grossLoss+=-exitRet;
      peak=Math.max(peak,equity);
      mdd=Math.min(mdd,equity/peak-1);
      i+=3;
    }

    result.push({
      name,
      trades,
      win_rate:trades?wins/trades:null,
      profit_factor:grossLoss?grossWin/grossLoss:(grossWin>0?999:null),
      max_drawdown:mdd,
      avg_return:rets.length?mean(rets):null,
      sample_ok:trades>=20,
      style_label:style.label,
      hold_days:styleCfg.hold,
      note:trades>=20 ? "歷史樣本數足夠，可作為參考，但不代表未來一定相同。" : "歷史交易次數較少，統計可信度有限。"
    });
  };

  runStrategy(
    style.key==="short"?"短線支撐快進快出":style.key==="medium"?"中期支撐回踩":style.key==="long"?"長期支撐分批布局":"支撐回測反彈",
    i=>{
      const atr=atrArr[i]; if(atr===null) return false;
      const support = style.key==="short" ? ma5Arr[i] :
                      style.key==="medium" ? ma20Arr[i] :
                      style.key==="long" ? (ma60Arr[i]??ma240Arr[i]) :
                      Math.max(ma20Arr[i]??0,ma60Arr[i]??0);
      if(support===null||support===0) return false;
      return lows[i] <= support + (style.key==="short"?0.15:style.key==="long"?0.40:0.25)*atr
        && closes[i] >= support && closes[i] > closes[i-1];
    },
    i=>{
      const atr=atrArr[i]; if(atr===null) return null;
      const support = style.key==="short" ? ma5Arr[i] :
                      style.key==="medium" ? ma20Arr[i] :
                      style.key==="long" ? (ma60Arr[i]??ma240Arr[i]) :
                      Math.max(ma20Arr[i]??0,ma60Arr[i]??0);
      if(support===null||support===0) return null;
      const entry=closes[i], stop=support-styleCfg.stopAtr*atr;
      return {entry,stop,target:entry+rr*(entry-stop)};
    }
  );

  runStrategy(
    style.key==="short"?"短線放量突破":style.key==="medium"?"中期突破續強":style.key==="long"?"長期趨勢突破":"突破壓力續強",
    i=>{
      const atr=atrArr[i], v20=vol20[i];
      if(atr===null||v20===null||v20===0) return false;
      const lookback=style.key==="short"?10:style.key==="long"?60:20;
      const priorHigh=Math.max(...highs.slice(Math.max(0,i-lookback),i));
      return closes[i] > priorHigh + (style.key==="short"?0.05:style.key==="long"?0.25:0.10)*atr
        && vols[i]/v20 >= styleCfg.volMin;
    },
    i=>{
      const atr=atrArr[i]; if(atr===null) return null;
      const entry=closes[i], stop=entry-styleCfg.stopAtr*atr;
      return {entry,stop,target:entry+rr*(entry-stop)};
    }
  );

  runStrategy(
    style.key==="short"?"短均線趨勢跟隨":style.key==="long"?"長期均線趨勢布局":style.key==="medium"?"中期趨勢回踩":"20日線趨勢回踩",
    i=>{
      const atr=atrArr[i]; if(atr===null) return false;
      if(style.key==="short"){
        const a=ma5Arr[i],b=ma20Arr[i]; return a!==null&&b!==null&&a>b&&lows[i]<=a+0.10*atr&&closes[i]>=a;
      }
      if(style.key==="medium"){
        const a=ma20Arr[i],b=ma60Arr[i]; return a!==null&&b!==null&&a>b&&lows[i]<=a+0.20*atr&&closes[i]>=a;
      }
      if(style.key==="long"){
        const a=ma60Arr[i],b=ma240Arr[i]; return a!==null&&b!==null&&a>b&&lows[i]<=a+0.35*atr&&closes[i]>=a;
      }
      const a=ma20Arr[i],b=ma60Arr[i]; return a!==null&&b!==null&&a>b&&lows[i]<=a+0.20*atr&&closes[i]>=a;
    },
    i=>{
      const atr=atrArr[i]; if(atr===null) return null;
      const base=style.key==="short"?ma5Arr[i]:style.key==="medium"?ma20Arr[i]:style.key==="long"?ma60Arr[i]:ma20Arr[i];
      if(base===null) return null;
      const entry=closes[i], stop=base-styleCfg.stopAtr*atr;
      return {entry,stop,target:entry+rr*(entry-stop)};
    }
  );

  runStrategy(
    style.key==="short"?"短線量價動能":style.key==="medium"?"中期動能延續":style.key==="long"?"長期趨勢續抱":"波段動能延續",
    i=>{
      const r=rsiArr[i],mh=macdHist[i]; if(r===null||mh===null) return false;
      const trendOk = style.key==="short" ? (ma5Arr[i]!==null&&ma20Arr[i]!==null&&ma5Arr[i]!>ma20Arr[i]!) :
                      style.key==="long" ? (ma60Arr[i]!==null&&ma240Arr[i]!==null&&ma60Arr[i]!>ma240Arr[i]!) :
                      (ma20Arr[i]!==null&&ma60Arr[i]!==null&&ma20Arr[i]!>ma60Arr[i]!);
      return trendOk && r>=50 && r<=styleCfg.rsiHigh && mh>0;
    },
    i=>{
      const atr=atrArr[i]; if(atr===null) return null;
      const entry=closes[i], stop=entry-styleCfg.stopAtr*atr;
      return {entry,stop,target:entry+rr*(entry-stop)};
    }
  );

  runStrategy(
    style.key==="short"?"短線超賣反彈":style.key==="medium"?"中期拉回布局":style.key==="long"?"長線分批低接":"波段均值回歸",
    i=>{
      const r=rsiArr[i]; if(r===null) return false;
      const ref=style.key==="long"?ma60Arr[i]:ma5Arr[i];
      return ref!==null && r<styleCfg.rsiLow && closes[i]<ref && closes[i]>closes[i-1];
    },
    i=>{
      const atr=atrArr[i]; if(atr===null) return null;
      const entry=closes[i], stop=entry-styleCfg.stopAtr*atr;
      return {entry,stop,target:entry+rr*(entry-stop)};
    }
  );

  return result;
}

async function fetchGoogleNews(query:string){
  const url="https://news.google.com/rss/search?q="+encodeURIComponent(query)+"&hl=zh-TW&gl=TW&ceid=TW:zh-Hant";
  try{ const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"}}); if(!r.ok)return []; const xml=await r.text(); const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,8).map(m=>m[1]);
    const get=(it:string,tag:string)=>{ const mm=it.match(new RegExp("<"+tag+">([\\s\\S]*?)<\\/"+tag+">")); return mm?mm[1].replace(/<!\[CDATA\[|\]\]>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/<[^>]+>/g,"").trim():""; };
    return items.map(it=>({title:get(it,"title"),link:get(it,"link"),pubDate:get(it,"pubDate"),source:get(it,"source")}));
  }catch(_){return [];}
}
function newsRuleReport(news:any[],target:string,snapshot:any,prompt:string){
  const pos=["成長","上調","增長","獲利","擴產","合作","得標","創高","回購","升評","強勁","AI","配息","股利","營收","突破"];
  const neg=["下調","衰退","虧損","調查","訴訟","召回","減產","降評","風險","下滑","裁員","減配","降息","衰退","違約"];
  const scored=news.map(x=>{
    let score=0;
    for(const k of pos) if(x.title.includes(k)) score++;
    for(const k of neg) if(x.title.includes(k)) score--;
    return {...x,impact:score>=2?"偏正面":score<=-2?"偏負面":"中性/待確認",score};
  });

  const totalScore=scored.reduce((s,x)=>s+x.score,0);
  const avgScore=scored.length?totalScore/scored.length:0;
  const positive=scored.filter(x=>x.impact==="偏正面").length;
  const negative=scored.filter(x=>x.impact==="偏負面").length;

  let shortImpact="中性";
  if(avgScore>=0.75||positive>=negative+2) shortImpact="偏正面";
  else if(avgScore<=-0.75||negative>=positive+2) shortImpact="偏負面";

  let longImpact="中性";
  const longPos=["擴產","合作","得標","營收","獲利","成長","回購","配息","股利"];
  const longNeg=["訴訟","調查","裁員","減產","衰退","違約","虧損"];
  let longScore=0;
  for(const x of scored){
    for(const k of longPos) if(x.title.includes(k)) longScore++;
    for(const k of longNeg) if(x.title.includes(k)) longScore--;
  }
  if(longScore>=2) longImpact="偏正面";
  else if(longScore<=-2) longImpact="偏負面";

  const price=typeof snapshot?.price==="number"?snapshot.price:null;
  const atr=typeof snapshot?.atr14==="number"&&snapshot.atr14>0?snapshot.atr14:(price?price*0.02:null);
  const dailyMove=atr&&price?atr/price:0.02;

  const sentimentBias=shortImpact==="偏正面"?0.75:shortImpact==="偏負面"?-0.75:0;
  const lowPct=Math.max(-0.12, sentimentBias*dailyMove - 1.5*dailyMove);
  const highPct=Math.min(0.12, sentimentBias*dailyMove + 1.5*dailyMove);

  const priceRange = price!==null ? {
    current:price,
    lower:price*(1+lowPct),
    upper:price*(1+highPct),
    lower_pct:lowPct,
    upper_pct:highPct,
    basis:"依近期波動（ATR）與新聞方向估算的短期情境區間，不是價格預測。"
  } : null;

  let risk="balanced";
  if(prompt.includes("保守")||prompt.includes("穩健")) risk="conservative";
  else if(prompt.includes("積極")||prompt.includes("進取")) risk="aggressive";

  let position:any={};
  if(risk==="conservative"){
    position={
      style:"保守型",
      initial:"5%～10%",
      add:"確認利多與價格站穩後，可分批提高到 10%～15%",
      max:"單一標的不建議超過 15%",
      note:"新聞尚未被價格確認前，先小部位觀察。"
    };
  }else if(risk==="aggressive"){
    position={
      style:"積極型",
      initial:"10%～15%",
      add:"若新聞持續偏正面且價格突破壓力，可分批提高到 20%～25%",
      max:"單一標的不建議超過 25%",
      note:"仍應設定停損與最大單一標的上限。"
    };
  }else{
    position={
      style:"穩健型",
      initial:"5%～10%",
      add:"若價格與成交量同步確認，可分批提高到 15%～20%",
      max:"單一標的不建議超過 20%",
      note:"避免一次投入全部資金。"
    };
  }

  if(shortImpact==="偏負面"){
    position.initial="0%～5%";
    position.add="先不加碼，等待利空鈍化或價格重新站回支撐。";
    position.note="目前新聞偏負面，優先控制部位與等待確認。";
  }

  const shortReason = shortImpact==="偏正面"
    ? "近期新聞中正面訊號較多，短線有利於市場情緒與買盤。"
    : shortImpact==="偏負面"
    ? "近期新聞中負面訊號較多，短線可能增加賣壓與波動。"
    : "近期新聞多空訊號混合，短線方向不明顯。";

  const longReason = longImpact==="偏正面"
    ? "較多新聞涉及成長、獲利、合作或配息等較長期因素。"
    : longImpact==="偏負面"
    ? "較多新聞涉及虧損、調查、裁員或減產等中長期風險。"
    : "目前新聞不足以支持明確的中長期方向。";

  return {
    title:target+" 新聞轉交易策略",
    news:scored,
    short_term:{impact:shortImpact,reason:shortReason},
    long_term:{impact:longImpact,reason:longReason},
    price_range:priceRange,
    position_plan:position,
    method:"依新聞標題關鍵字、近期波動與使用者風險偏好做規則式整理；重大事件仍需閱讀原文確認。"
  };
}

async function backtest(symbol:string){
  const ticker=await resolveTicker(symbol); if(!ticker)return null;
  const d=await barsFor(ticker,"1d","5y"); if(!d)return null;
  const bars=d.bars.filter((b:any)=>b.c!==null), closes=bars.map((b:any)=>b.c as number);
  let position=false,entry=0,equity=1,peak=1,mdd=0,wins=0,trades=0,grossWin=0,grossLoss=0;
  const tradeReturns:number[]=[];
  for(let i=60;i<closes.length;i++){
    const ma20=mean(closes.slice(i-19,i+1))!,ma60=mean(closes.slice(i-59,i+1))!,p=closes[i];
    if(!position&&ma20>ma60){position=true;entry=p;}
    else if(position&&ma20<ma60){
      const rr=(p-entry)/entry;
      equity*=1+rr; trades++; tradeReturns.push(rr);
      if(rr>=0){wins++;grossWin+=rr;}else grossLoss+=-rr;
      position=false;
    }
    peak=Math.max(peak,equity); mdd=Math.min(mdd,equity/peak-1);
  }
  if(position){
    const p=closes[closes.length-1],rr=(p-entry)/entry;
    equity*=1+rr;trades++;tradeReturns.push(rr);
    if(rr>=0){wins++;grossWin+=rr;}else grossLoss+=-rr;
  }

  const years=Math.max(1,(bars[bars.length-1].t-bars[0].t)/(365.25*86400));
  const cagr=Math.pow(equity,1/years)-1;
  const winRate=trades?wins/trades:null;
  const profitFactor=grossLoss?grossWin/grossLoss:null;
  const base=ticker.replace(/\.(TW|TWO)$/,"");

  const improvement_directions:any[]=[];

  // 1. Trend filter
  if(winRate!==null && winRate<0.55){
    improvement_directions.push({
      title:"加入長期趨勢濾網",
      why:"目前勝率偏低時，均線交叉容易在盤整區反覆進出。",
      change:"新增200日均線條件：價格高於200MA時只做多，低於200MA時降低或停止做多訊號。",
      expected_effect:"目標是減少假突破與盤整期虧損交易；實際效果需重新回測確認。"
    });
  }else{
    improvement_directions.push({
      title:"維持趨勢濾網並做參數敏感度測試",
      why:"目前勝率尚可，但仍需確認20/60MA是否只是特定期間最佳。",
      change:"比較10/40、20/60、50/100等多組均線，觀察績效是否穩定。",
      expected_effect:"降低參數過度配適風險。"
    });
  }

  // 2. ATR stop
  if(mdd < -0.15){
    improvement_directions.push({
      title:"加入ATR動態停損",
      why:"最大回撤較大，單純死亡交叉出場可能反應太慢。",
      change:"以14日ATR設定初始停損，例如1.5～2.5倍ATR，並搭配移動停損。",
      expected_effect:"目標是降低單筆虧損與整體MDD；需重新回測停損倍數。"
    });
  }else{
    improvement_directions.push({
      title:"加入ATR移動停利",
      why:"回撤尚可，可進一步改善獲利保留效率。",
      change:"持倉獲利後用2倍ATR追蹤停利，而不是只等均線死亡交叉。",
      expected_effect:"可能提升盈虧比，但也可能提早離場。"
    });
  }

  // 3. Volume confirmation
  improvement_directions.push({
    title:"增加成交量確認",
    why:"均線交叉本身無法判斷突破是否有資金支持。",
    change:"進場時要求成交量高於20日均量，例如相對均量 > 1.2倍。",
    expected_effect:"有機會過濾低量假突破，但可能減少交易次數。"
  });

  // 4. RSI confirmation
  improvement_directions.push({
    title:"加入RSI動能濾網",
    why:"均線交叉可能在弱勢反彈中產生買進訊號。",
    change:"只在RSI14 > 50時接受多頭交叉；RSI過熱時則避免追價或改用分批進場。",
    expected_effect:"可強化動能確認，但需避免錯過快速反轉行情。"
  });

  // 5. Cost and robustness
  improvement_directions.push({
    title:"納入交易成本與樣本外驗證",
    why:"目前回測未納入稅費、滑價與配息再投入，容易高估實際表現。",
    change:"加入手續費、證交稅/滑價，並將資料切成訓練期與樣本外測試期。",
    expected_effect:"可提高回測可信度，避免只對歷史資料最佳化。"
  });

  return {
    title:(TW_NAMES[base]||base)+"（"+base+"）5年規則回測",
    ticker,
    strategy:"20MA/60MA 黃金交叉與死亡交叉",
    trades,
    win_rate:winRate,
    profit_factor:profitFactor,
    max_drawdown:mdd,
    cagr,
    final_multiple:equity,
    improvement_directions,
    method:"使用Yahoo Finance近5年日線；目前未納入稅費、滑價與配息再投入。改進方向為規則式診斷，應逐項重新回測驗證。"
  };
}
function extractNameHints(text:string){
  const map:Record<string,string>={};
  const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);

  for(let i=0;i<lines.length;i++){
    const line=lines[i];

    // Same-line formats: 00730 富邦臺灣優質高息: 164000
    let m=line.match(/\b(\d{4,6}[A-Z]?)\b\s*([^:：0-9$%][^:：$%]*)?/i);
    if(m){
      const code=m[1].toUpperCase();
      let label=(m[2]||"").trim();
      label=label.replace(/[,:：-]+$/,"").trim();
      if(label && /[\u4e00-\u9fff]/.test(label)) map[code]=label;
    }

    // Two-line format: 00981A / 主動統一台股增長
    if(/^\d{4,6}[A-Z]?$/i.test(line) && i+1<lines.length){
      const next=lines[i+1];
      if(/[\u4e00-\u9fff]/.test(next) && !/[0-9,.]+\s*(%|元|萬|億)?$/.test(next)){
        map[line.toUpperCase()]=next.replace(/[:：]+$/,"").trim();
      }
    }
  }
  return map;
}

function parsePortfolio(text:string){
  const rows:any[]=[];
  const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  let pendingName="";

  const addAmount=(name:string,rawAmount:string,unit:string)=>{
    let amount=parseFloat(rawAmount.replace(/,/g,""));
    if(unit==="萬") amount*=10000;
    else if(unit==="億") amount*=100000000;
    if(!Number.isFinite(amount)) return;
    rows.push({
      name:name.trim(),
      input_type:"amount",
      raw_value:amount,
      amount,
      weight:null
    });
  };

  for(let i=0;i<lines.length;i++){
    const line=lines[i];

    // Percentage on the same line.
    let m=line.match(/^(.+?)\s*[:：]\s*([0-9,.]+)\s*%\s*$/);
    if(m){
      const v=parseFloat(m[2].replace(/,/g,""));
      rows.push({name:m[1].trim(),input_type:"percent",raw_value:v,weight:v/100,amount:null});
      pendingName="";
      continue;
    }

    // Named amount on the same line.
    m=line.match(/^(.+?)\s*[:：]\s*(?:NT\$|TWD|\$)?\s*([0-9,.]+)\s*(萬|億|元)?\s*$/i);
    if(m){
      addAmount(m[1],m[2],m[3]||"");
      pendingName="";
      continue;
    }

    // Amount-only line, e.g. $75,300 / NT$60,440 / 50萬.
    m=line.match(/^(?:NT\$|TWD|\$)?\s*([0-9,.]+)\s*(萬|億|元)?\s*$/i);
    if(m){
      if(pendingName){
        addAmount(pendingName,m[1],m[2]||"");
        pendingName="";
      }
      continue;
    }

    // Name/code-only line. Join consecutive ticker + Chinese name lines.
    if(!pendingName){
      pendingName=line;
    }else{
      const pendingIsTicker=/^\d{4,6}[A-Z]?$/i.test(pendingName);
      const lineIsName=/[\u4e00-\u9fffA-Za-z]/.test(line) && !/^[0-9,.]+$/.test(line);
      if(pendingIsTicker && lineIsName){
        pendingName=pendingName+" "+line;
      }else{
        // Replace stale pending text with the newer line.
        pendingName=line;
      }
    }
  }

  const amountRows=rows.filter(x=>x.input_type==="amount");
  const percentRows=rows.filter(x=>x.input_type==="percent");

  if(amountRows.length && percentRows.length){
    return {rows:[],mode:"mixed",error:"請不要同時混用金額與百分比。請整組都用金額，或整組都用百分比。",total_amount:null};
  }

  if(amountRows.length){
    const total=amountRows.reduce((s,x)=>s+(x.amount||0),0);
    if(total>0) amountRows.forEach(x=>x.weight=x.amount/total);
    return {rows:amountRows,mode:"amount",error:null,total_amount:total};
  }

  return {rows:percentRows,mode:"percent",error:null,total_amount:null};
}

async function portfolioRisk(text:string){
  const parsed=parsePortfolio(text);
  if(parsed.error) return {title:"投資組合規則風控",error:parsed.error,input_mode:parsed.mode,total_amount:parsed.total_amount};

  const rows=parsed.rows,resolved:any[]=[];
  for(const r of rows){
    const syms=candidateSymbols(r.name),sym=syms[0]??r.name.match(/\b[A-Z]{1,5}\b/)?.[0]??null;
    if(sym){
      const t=await resolveTicker(sym);
      if(t){
        const d=await barsFor(t,"1d","1y");
        if(d){
          resolved.push({...r,ticker:t,bars:d.bars});
          continue;
        }
      }
    }
    resolved.push({...r,ticker:null,bars:[]});
  }

  const total=rows.reduce((s,x)=>s+x.weight,0);
  const hhi=rows.reduce((s,x)=>s+x.weight*x.weight,0);
  const top=[...rows].sort((a,b)=>b.weight-a.weight).slice(0,3);

  const correlations:any[]=[];
  for(let i=0;i<resolved.length;i++) for(let j=i+1;j<resolved.length;j++){
    const cc=alignedCorrelation(resolved[i].bars,resolved[j].bars);
    if(cc!==null) correlations.push({a:resolved[i].name,b:resolved[j].name,...cc});
  }
  correlations.sort((a,b)=>Math.abs(b.corr)-Math.abs(a.corr));

  const classify=(name:string)=>{
    const nm=name.toLowerCase();
    if(nm.includes("現金")||nm.includes("定存")||nm.includes("cash")) return "cash";
    if(nm.includes("債")||nm.includes("bond")||nm.includes("bnd")) return "bond";
    if(nm.includes("黃金")||nm.includes("gold")) return "gold";
    if(nm.includes("qqq")||nm.includes("nvda")||nm.includes("msft")||nm.includes("aapl")||nm.includes("meta")||nm.includes("amd")||nm.includes("半導體")||nm.includes("科技")) return "tech";
    return "equity";
  };

  const stressMap:Record<string,number>={cash:0,bond:-0.07,gold:-0.05,tech:-0.30,equity:-0.20};
  const stressLoss=rows.reduce((s,x)=>s+x.weight*(stressMap[classify(x.name)]??-0.20),0);

  // Risk profile from prompt text
  let profile="balanced";
  if(text.includes("保守防禦型")) profile="conservative";
  else if(text.includes("積極成長型")) profile="growth";

  const maxSingle = profile==="conservative" ? 0.20 : profile==="growth" ? 0.40 : 0.30;
  const targetCash = profile==="conservative" ? 0.20 : profile==="growth" ? 0.05 : 0.10;
  const targetBond = profile==="conservative" ? 0.30 : profile==="growth" ? 0.10 : 0.20;

  const weaknesses:any[]=[];

  // Concentration / overexposure
  // 單一標的上限只套用股票／ETF等風險資產；
  // 現金、債券、黃金屬於防守資產，不用同一個股票集中度上限判斷。
  for(const r of [...rows].sort((a,b)=>b.weight-a.weight)){
    const assetClass = classify(r.name);
    const isRiskAsset = assetClass === "equity" || assetClass === "tech";
    if(isRiskAsset && r.weight>maxSingle){
      weaknesses.push({
        type:"曝險過度",
        title:r.name+" 比例偏高",
        detail:"目前約 "+(r.weight*100).toFixed(1)+"%，高於此風險設定建議的單一風險資產上限 "+(maxSingle*100).toFixed(0)+"%。",
        severity:r.weight>maxSingle+0.10?"高":"中"
      });
    }
  }

  if(hhi>0.25){
    weaknesses.push({
      type:"集中風險",
      title:"投資組合集中度偏高",
      detail:"HHI = "+hhi.toFixed(3)+"。資金較集中在少數標的，單一標的大跌時影響會比較大。",
      severity:hhi>0.35?"高":"中"
    });
  }

  // Hidden correlation
  const hiddenCorr=correlations.filter(x=>x.corr>=0.70).slice(0,5);
  for(const x of hiddenCorr){
    weaknesses.push({
      type:"隱藏相關性",
      title:x.a+" 與 "+x.b+" 走勢很像",
      detail:"近一年相關係數約 "+x.corr.toFixed(2)+"。兩個標的可能同漲同跌，分散效果較小。",
      severity:Math.abs(x.corr)>=0.85?"高":"中"
    });
  }

  const cashWeight=rows.filter(x=>classify(x.name)==="cash").reduce((s,x)=>s+x.weight,0);
  const bondWeight=rows.filter(x=>classify(x.name)==="bond").reduce((s,x)=>s+x.weight,0);

  if(cashWeight<targetCash){
    weaknesses.push({
      type:"流動性",
      title:"現金緩衝偏低",
      detail:"目前現金約 "+(cashWeight*100).toFixed(1)+"%，此風險設定可考慮至少保留約 "+(targetCash*100).toFixed(0)+"%。",
      severity:"中"
    });
  }

  // Rebalance suggestions
  const rebalance:any[]=[];
  const excessRows=[...rows].filter(x=>['equity','tech'].includes(classify(x.name))&&x.weight>maxSingle).sort((a,b)=>b.weight-a.weight);
  for(const r of excessRows){
    const reduce=Math.max(0,r.weight-maxSingle);
    rebalance.push({
      action:"降低",
      asset:r.name,
      from_weight:r.weight,
      to_weight:maxSingle,
      change:-reduce,
      reason:"降低單一標的集中風險。"
    });
  }

  let freed=rebalance.reduce((s,x)=>s+(-x.change),0);
  const cashGap=Math.max(0,targetCash-cashWeight);
  const bondGap=Math.max(0,targetBond-bondWeight);

  if(cashGap>0){
    const add=Math.min(cashGap,freed||cashGap);
    rebalance.push({action:"增加",asset:"現金／短期資金",from_weight:cashWeight,to_weight:cashWeight+add,change:add,reason:"提高市場下跌時的緩衝與加碼彈性。"});
    freed=Math.max(0,freed-add);
  }
  if(bondGap>0){
    const add=Math.min(bondGap,freed||bondGap);
    rebalance.push({action:"增加",asset:"債券部位",from_weight:bondWeight,to_weight:bondWeight+add,change:add,reason:"降低整體波動，增加防守性。"});
    freed=Math.max(0,freed-add);
  }

  if(!rebalance.length){
    rebalance.push({
      action:"維持",
      asset:"目前配置",
      from_weight:null,
      to_weight:null,
      change:0,
      reason:"目前沒有偵測到明顯超過單一標的上限的情況；可持續觀察集中度與相關性。"
    });
  }

  // Down-20 hedge plan
  const hedge:any[]=[
    {
      step:"第一層",
      action:"保留現金緩衝",
      detail:"市場下跌時不要一次把現金用完，建議分批使用，避免過早用盡資金。"
    },
    {
      step:"第二層",
      action:"降低高相關、高波動部位",
      detail:hiddenCorr.length
        ? "若市場轉弱，可優先檢查高相關標的，避免多個部位一起下跌。"
        : "若市場轉弱，可先檢查波動較大的股票／科技部位。"
    },
    {
      step:"第三層",
      action:"分批再平衡",
      detail:"若大盤接近 -10%、-15%、-20%，可分階段把部分資金從防守資產移回核心資產，而不是一次押滿。"
    }
  ];

  return {
    title:"投資組合風險管理",
    input_mode:parsed.mode,
    total_amount:parsed.total_amount,
    total_weight:total,
    concentration_hhi:hhi,
    top_holdings:top,
    strongest_correlations:correlations.slice(0,5),
    method:"近一年 Yahoo 日線收盤價報酬；依相同起迄交易日期配對，至少 30 筆共同樣本。未調整配息與拆股，跨市場交易時差仍可能影響結果。",
    stress_market_minus20_estimate:stressLoss,
    holdings:rows.map(x=>({name:x.name,amount:x.amount,weight:x.weight})),
    weaknesses,
    overexposure:weaknesses.filter(x=>x.type==="曝險過度"||x.type==="集中風險"),
    hidden_correlations:hiddenCorr,
    rebalance_plan:rebalance,
    hedge_plan:hedge,
    risk_profile:profile,
    notes:[
      parsed.mode==="amount" ? "已依輸入金額自動加總並換算各標的比例。" : "已依輸入比例進行分析。",
      "壓力測試與再平衡為規則式情境，不是市場預測。",
      "未能辨識的資產預設股票 -20%；現金 0%、債券 -7%、黃金 -5%、科技股 -30%。"
    ]
  };
}


function jwtSubFromRequest(req:Request){
  const auth=req.headers.get("Authorization")||"";
  const token=auth.replace(/^Bearer\s+/i,"");
  if(!token) return null;
  try{
    const payload=token.split(".")[1]||"";
    const base64=payload.replace(/-/g,"+").replace(/_/g,"/");
    const padded=base64+"=".repeat((4-base64.length%4)%4);
    const decoded=JSON.parse(atob(padded));
    return typeof decoded?.sub==="string"?decoded.sub:null;
  }catch(_){ return null; }
}

async function restGet(req:Request,path:string){
  const base=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const auth=req.headers.get("Authorization")||"";
  const r=await fetch(base+"/rest/v1/"+path,{
    headers:{
      "Authorization":auth,
      "apikey":anon,
      "Accept":"application/json"
    }
  });
  if(!r.ok) throw new Error("Supabase read failed: "+r.status+" "+await r.text());
  return await r.json();
}

async function restInsert(req:Request,table:string,row:any){
  const base=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const auth=req.headers.get("Authorization")||"";
  const r=await fetch(base+"/rest/v1/"+table,{
    method:"POST",
    headers:{
      "Authorization":auth,
      "apikey":anon,
      "Content-Type":"application/json",
      "Prefer":"return=representation"
    },
    body:JSON.stringify(row)
  });
  if(!r.ok) throw new Error("Supabase insert failed: "+r.status+" "+await r.text());
  return await r.json();
}

async function buildRetirementImpact(req:Request,analysis:any){
  const userId=jwtSubFromRequest(req);
  if(!userId) return null;

  const [goals,fixedRows,portfolios,assets,quotes]=await Promise.all([
    restGet(req,"retirement_goals?select=monthly_expense&is_active=eq.true&order=updated_at.desc&limit=1"),
    restGet(req,"retirement_fixed_incomes?select=name,category,monthly_amount,start_month,end_month,is_active,updated_at&is_active=eq.true&order=updated_at.desc"),
    restGet(req,"user_portfolios?select=selected_tickers,shares_map&limit=1"),
    restGet(req,"user_assets?select=current_value,annual_yield,is_income_asset&is_active=eq.true"),
    restGet(req,"etf_prices?select=ticker,price,yield")
  ]);

  const portfolio=Array.isArray(portfolios)?portfolios[0]:null;
  const selected=Array.isArray(portfolio?.selected_tickers)?portfolio.selected_tickers.map(String):[];
  const sharesMap=(portfolio?.shares_map&&typeof portfolio.shares_map==="object"&&!Array.isArray(portfolio.shares_map))?portfolio.shares_map:{};

  const clean=(v:any)=>String(v||"").trim().toUpperCase();
  const codeOf=(v:any)=>clean(v).replace(/\.(TW|TWO)$/i,"");
  const quoteByTicker=new Map<string,any>();
  const quoteByCode=new Map<string,any>();
  for(const q of Array.isArray(quotes)?quotes:[]){
    quoteByTicker.set(clean(q.ticker),q);
    quoteByCode.set(codeOf(q.ticker),q);
  }

  let annualInvestmentIncome=0;
  let holdingsValue=0;
  for(const ticker of selected){
    const raw=clean(ticker);
    const q=quoteByTicker.get(raw)||quoteByCode.get(codeOf(raw));
    const shares=Math.max(Number(sharesMap[raw]??sharesMap[ticker]??0)||0,0);
    const price=Number(q?.price||0)||0;
    const y=Number(q?.yield||0)||0;
    const mv=shares*1000*price;
    holdingsValue+=mv;
    annualInvestmentIncome+=mv*(y/100);
  }

  let otherAssetsValue=0;
  for(const a of Array.isArray(assets)?assets:[]){
    const value=Math.max(Number(a?.current_value||0)||0,0);
    otherAssetsValue+=value;
    if(a?.is_income_asset) annualInvestmentIncome+=value*((Number(a?.annual_yield||0)||0)/100);
  }

  const now=new Date();
  const today=now.toISOString().slice(0,10);

  // All active incomes count; similar entries are warnings only.
  const effectiveFixed:any[]=Array.isArray(fixedRows)?fixedRows:[];
  const fixedIncomeWarnings=possibleIncomeDuplicates(effectiveFixed);

  const activeAt=(row:any,date:string)=>{
    const start=String(row?.start_month||"");
    const end=row?.end_month?String(row.end_month):null;
    if(start&&start>date) return false;
    if(end&&end<date) return false;
    return true;
  };

  let monthlyFixedIncome=0;
  for(const row of effectiveFixed){
    if(activeAt(row,today)) monthlyFixedIncome+=Math.max(Number(row?.monthly_amount||0)||0,0);
  }

  const futureStartDates=effectiveFixed
    .map((row:any)=>String(row?.start_month||""))
    .filter((start:string)=>start&&start>today)
    .sort();
  const futureFixedIncomeStart=futureStartDates[0]||null;

  let monthlyFixedIncomeFuture=monthlyFixedIncome;
  if(futureFixedIncomeStart){
    monthlyFixedIncomeFuture=0;
    for(const row of effectiveFixed){
      if(activeAt(row,futureFixedIncomeStart)){
        monthlyFixedIncomeFuture+=Math.max(Number(row?.monthly_amount||0)||0,0);
      }
    }
  }

  const monthlyExpense=Math.max(Number(goals?.[0]?.monthly_expense||0)||0,0);
  const monthlyInvestmentIncomeBefore=annualInvestmentIncome/12;
  const dividendDropPct=20;
  const monthlyInvestmentIncomeAfter=monthlyInvestmentIncomeBefore*(1-dividendDropPct/100);

  const fallbackAssets=holdingsValue+otherAssetsValue;
  const assetsBefore=Number(analysis?.total_amount||0)>0 ? Number(analysis.total_amount) : fallbackAssets;
  const rawStress=Number(analysis?.stress_market_minus20_estimate||0)||0;
  const stressLossFraction=rawStress>0?-rawStress:rawStress;
  const assetsAfter=Math.max(assetsBefore*(1+stressLossFraction),0);
  const monthlyIncomeAfter=monthlyInvestmentIncomeAfter+monthlyFixedIncome;
  const monthlyGapAfter=monthlyIncomeAfter-monthlyExpense;
  const monthlyIncomeFutureAfter=monthlyInvestmentIncomeAfter+monthlyFixedIncomeFuture;
  const monthlyGapFutureAfter=monthlyIncomeFutureAfter-monthlyExpense;

  const impact={
    schema_version:3,
    fixed_income_policy:'include_all_warn_only',
    generated_at:new Date().toISOString(),
    scenario_label:"AI 投組壓力情境",
    stress_loss_pct:Math.abs(stressLossFraction)*100,
    assets_before:assetsBefore,
    assets_after:assetsAfter,
    dividend_drop_pct:dividendDropPct,
    monthly_investment_income_before:monthlyInvestmentIncomeBefore,
    monthly_investment_income_after:monthlyInvestmentIncomeAfter,
    monthly_fixed_income:monthlyFixedIncome,
    monthly_expense:monthlyExpense,
    monthly_income_after:monthlyIncomeAfter,
    monthly_gap_after:monthlyGapAfter,
    future_fixed_income_start:futureFixedIncomeStart,
    monthly_fixed_income_future:monthlyFixedIncomeFuture,
    monthly_income_future_after:monthlyIncomeFutureAfter,
    monthly_gap_future_after:monthlyGapFutureAfter,
    fixed_income_duplicate_detected:fixedIncomeWarnings.length>0,
    fixed_income_warnings:fixedIncomeWarnings
  };

  await restInsert(req,"retirement_ai_stress_snapshots",{
    user_id:userId,
    scenario_label:impact.scenario_label,
    stress_loss_pct:impact.stress_loss_pct,
    assets_before:impact.assets_before,
    assets_after:impact.assets_after,
    dividend_drop_pct:impact.dividend_drop_pct,
    monthly_investment_income_before:impact.monthly_investment_income_before,
    monthly_investment_income_after:impact.monthly_investment_income_after,
    monthly_fixed_income:impact.monthly_fixed_income,
    monthly_expense:impact.monthly_expense,
    monthly_income_after:impact.monthly_income_after,
    monthly_gap_after:impact.monthly_gap_after,
    future_fixed_income_start:impact.future_fixed_income_start,
    monthly_fixed_income_future:impact.monthly_fixed_income_future,
    monthly_income_future_after:impact.monthly_income_future_after,
    monthly_gap_future_after:impact.monthly_gap_future_after,
    fixed_income_duplicate_detected:impact.fixed_income_duplicate_detected,
    fixed_income_warnings:impact.fixed_income_warnings,
    source:"financial-analysis-auth",
    analysis:{
      fixed_income_policy:'include_all_warn_only',
      concentration_hhi:analysis?.concentration_hhi??null,
      stress_market_minus20_estimate:analysis?.stress_market_minus20_estimate??null,
      weaknesses:analysis?.weaknesses??[],
      rebalance_plan:analysis?.rebalance_plan??[]
    }
  });

  return impact;
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return Response.json({error:"method not allowed"},{status:405,headers:cors});
  const origin=req.headers.get("origin")??""; if(origin!==allowedOrigin)return Response.json({error:"origin not allowed"},{status:403,headers:cors});
  const denied=await authorizePro(req,Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_ANON_KEY')||'');
  if(denied){ for(const [key,value] of Object.entries(cors))denied.headers.set(key,value); return denied; }
  try{
    const body=await req.json(),moduleNo=Number(body?.module??0),prompt=String(body?.prompt??""),symbols=candidateSymbols(prompt),nameHints=extractNameHints(prompt),snaps=(await Promise.all(symbols.map(snapshot))).filter(Boolean).map((s:any)=>{ const key=String(s.display_code||"").toUpperCase(); if(nameHints[key]) s.display_name=nameHints[key]; return s; }); let analysis:any={};
    if(moduleNo===1){
      if(snaps.length){
        analysis=tradeIdeaReport(snaps[0],prompt);
        const rr=parseRequiredRR(prompt);
        const symbol=symbols[0]||snaps[0].display_code;
        const bt=await backtestTradeIdeas(symbol,rr,prompt);
        analysis.ideas=analysis.ideas.map((x:any)=>({...x,backtest:bt.find((b:any)=>b.name===x.name)||null}));
        analysis.backtest_period="近5年日線";
        analysis.trade_style=parseTradeStyle(prompt);
        const styleInfo=parseTradeStyle(prompt);
        analysis.summary="已套用「"+styleInfo.label+"」：進場基準、停損寬度、量能門檻、最長持有天數與回測規則都會跟著改變。每個情境並附近5年歷史回測；回測只代表過去。";
      }else{
        analysis={title:"交易點子生成器",summary:"請輸入可辨識的股票/ETF代號，例如2330、00878、00981A、NVDA。",ideas:[]};
      }
    }
    else if(moduleNo===2)analysis=snaps.length?technicalReport(snaps[0],prompt):{title:"自動技術分析",summary:"請輸入可辨識的股票/ETF代號。"};
    else if(moduleNo===3){
      const target=symbols[0]||prompt.slice(0,60);
      const q=TW_NAMES[target]?TW_NAMES[target]+" "+target:target;
      const snap=snaps.find((x:any)=>String(x.display_code||"").toUpperCase()===String(target).toUpperCase()) || snaps[0] || null;
      analysis=newsRuleReport(await fetchGoogleNews(q),q,snap,prompt);
    }
    else if(moduleNo===4)analysis=symbols[0]?(await backtest(symbols[0])??{title:"策略回測",summary:"回測資料取得失敗。"}):{title:"策略回測",summary:"請輸入可辨識的股票/ETF代號。"};
    else if(moduleNo===5)analysis=await portfolioRisk(prompt);
    else return Response.json({error:"unknown module"},{status:400,headers:cors});
    let retirement_impact:any=null;
    if(moduleNo===5){
      try{ retirement_impact=await buildRetirementImpact(req,analysis); }
      catch(e){ retirement_impact={error:e instanceof Error?e.message:String(e)}; }
    }
    return Response.json({engine:"rule-engine-v1",module:moduleNo,market_snapshots:snaps,analysis,retirement_impact,generated_at:new Date().toISOString()},{headers:cors});
  }catch(e){return Response.json({error:e instanceof Error?e.message:String(e)},{status:500,headers:cors});}
});

