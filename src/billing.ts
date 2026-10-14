import { requireSupabase } from './lib/supabase'

type RedirectResponse = { url?: string; error?: string; message?: string }

export async function startProTrial() {
  const { data, error } = await requireSupabase().functions.invoke<{ subscription_status?: string; trial_end_at?: string; error?: string; message?: string }>('subscription-trial', { body: {} })
  if (error) {
    throw new Error('試用資格無法啟用；若已使用過試用，可直接選擇 Pro 月繳方案。')
  }
  if (data?.error) throw new Error(data.message || '試用資格無法啟用。')
  return data
}

async function billingRedirect(functionName: 'subscription-checkout' | 'subscription-portal') {
  const { data, error } = await requireSupabase().functions.invoke<RedirectResponse>(functionName, { body: {} })
  if (error) throw new Error('訂閱服務目前尚未開放或暫時無法連線，請稍後再試。')
  if (!data?.url) throw new Error(data?.message || '沒有取得安全付款網址。')
  window.location.assign(data.url)
}

export const openSubscriptionCheckout = () => billingRedirect('subscription-checkout')
export const openBillingPortal = () => billingRedirect('subscription-portal')

const exportTables = [
  'user_profiles', 'user_portfolios', 'user_assets', 'retirement_goals', 'retirement_fixed_incomes',
  'dividend_calendar', 'retirement_snapshots_v3', 'retirement_monthly_reports', 'retirement_pro_records',
  'retirement_pro_notifications', 'subscriptions',
] as const

export async function exportMyRetirementData(userId: string, email: string) {
  const client = requireSupabase()
  const results = await Promise.all(exportTables.map(async (table) => {
    const ownerColumn = table === 'user_profiles' ? 'id' : 'user_id'
    const { data, error } = await client.from(table).select('*').eq(ownerColumn, userId)
    return [table, error ? { unavailable: true, reason: error.message } : data] as const
  }))
  const payload = { exported_at: new Date().toISOString(), account: { id: userId, email }, data: Object.fromEntries(results) }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = `juanheng-retirement-data-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(href)
}

export async function deleteMyAccount() {
  const { data, error } = await requireSupabase().functions.invoke<{ deleted?: boolean; message?: string }>('account-delete', {
    body: { confirmation: '刪除我的帳號' },
  })
  if (error || !data?.deleted) throw new Error(data?.message || '帳號刪除失敗，請稍後再試。')
  await requireSupabase().auth.signOut({ scope: 'global' })
}

