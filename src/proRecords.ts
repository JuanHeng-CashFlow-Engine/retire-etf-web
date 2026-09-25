import { requireSupabase } from './lib/supabase'
export type ProRecord<T = unknown> = { id: string; kind: string; name: string; payload: T; created_at: string }
export async function loadProRecords<T>(userId: string, kind: 'scenario' | 'analysis' | 'alert_preferences'): Promise<ProRecord<T>[]> {
  const {data,error} = await requireSupabase().from('retirement_pro_records').select('id,kind,name,payload,created_at').eq('user_id',userId).eq('kind',kind).order('created_at',{ascending:false}).limit(100)
  if (error) throw new Error(error.code === 'PGRST205' || error.code === '42P01' ? '進階功能的雲端儲存尚未啟用。請先完成資料庫設定。' : error.message)
  return (data || []) as ProRecord<T>[]
}
export async function saveProRecord<T>(userId: string, kind: string, name: string, payload: T): Promise<ProRecord<T>> {
  const {data,error} = await requireSupabase().from('retirement_pro_records').insert({user_id:userId,kind,name:name.trim().slice(0,100),payload}).select('id,kind,name,payload,created_at').single()
  if (error) throw new Error(error.message)
  return data as ProRecord<T>
}
