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

export async function loadProRecord<T>(userId: string, id: string): Promise<ProRecord<T>> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('分析情境 ID 格式不正確。')
  const { data, error } = await requireSupabase().from('retirement_pro_records').select('id,kind,name,payload,created_at').eq('id', id).eq('user_id', userId).eq('kind', 'analysis').single()
  if (error || !data) throw new Error('找不到這筆已保存的分析，或目前帳號沒有讀取權限。')
  return data as ProRecord<T>
}

