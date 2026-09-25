import { useEffect, useState } from 'react'
import type { RetirementOverview } from '../data'
import { advancedDividendAlerts } from '../lib/proAnalysis'
import { memberState } from '../lib/insights'
import { loadProRecords, saveProRecord } from '../proRecords'
import { requireSupabase } from '../lib/supabase'
type Preferences={days:number;cut:number;enabled:boolean}
type Notification={id:string;title:string;message:string;is_read:boolean;created_at:string}
export function AdvancedAlerts({data,userId}: {data:RetirementOverview;userId:string}) {
  const [prefs,setPrefs]=useState<Preferences>({days:30,cut:20,enabled:false})
  const [notifications,setNotifications]=useState<Notification[]>([])
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const allowed=memberState(data)!=='free'
  useEffect(()=>{let live=true;Promise.all([loadProRecords<Preferences>(userId,'alert_preferences'),requireSupabase().from('retirement_pro_notifications').select('id,title,message,is_read,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(100)]).then(([p,n])=>{if(!live)return;if(p[0])setPrefs(p[0].payload);if(n.error)throw n.error;setNotifications(n.data||[])}).catch(e=>{if(live)setMessage(e.message)});return()=>{live=false}},[userId])
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  const alerts=advancedDividendAlerts(data,today,prefs.days,prefs.cut)
  async function save(){if(!allowed)return;setBusy(true);try{await saveProRecord(userId,'alert_preferences','配息預警設定',prefs);setMessage('通知設定已保存。已啟用時，後端每日檢查並保存站內通知。')}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
  async function read(id:string){const {error}=await requireSupabase().from('retirement_pro_notifications').update({is_read:true}).eq('id',id).eq('user_id',userId);if(error)setMessage(error.message);else setNotifications(old=>old.map(n=>n.id===id?{...n,is_read:true}:n))}
  return <section className="jh-panel"><h2>進階配息預警</h2><p>檢查即將入帳、逾期未確認、入帳低於預期及資料來源標示的配息下降。</p>{!allowed&&<p>每日站內通知設定需試用或 Pro 資格。</p>}<fieldset className="pro-fieldset" disabled={!allowed||busy}><label><input type="checkbox" checked={prefs.enabled} onChange={e=>setPrefs({...prefs,enabled:e.target.checked})}/>啟用每日站內通知</label><div className="jh-form-actions"><label>提前天數<input type="number" min={1} max={90} value={prefs.days} onChange={e=>setPrefs({...prefs,days:Math.max(1,Math.min(90,Number(e.target.value)||1))})}/></label><label>下降門檻 %<input type="number" min={1} max={100} value={prefs.cut} onChange={e=>setPrefs({...prefs,cut:Math.max(1,Math.min(100,Number(e.target.value)||1))})}/></label><button className="primary-button" onClick={()=>void save()}>保存通知設定</button></div></fieldset>{message&&<p role="status">{message}</p>}
  <h3>目前檢查結果</h3><div className="jh-list">{alerts.map(a=><div key={a.key}><strong>{a.title}</strong><span>{a.detail}</span></div>)}{!alerts.length&&<p>現有紀錄未觸發上述規則；缺少紀錄的配息仍需人工核對。</p>}</div><h3>後端通知紀錄</h3><div className="jh-list">{notifications.map(n=><div key={n.id}><strong>{n.title}</strong><span>{n.message} · {new Date(n.created_at).toLocaleDateString('zh-TW')}</span>{n.is_read?<b>已讀</b>:<button className="text-button" onClick={()=>void read(n.id)}>標為已讀</button>}</div>)}{!notifications.length&&<p>尚無保存的通知。</p>}</div></section>
}
