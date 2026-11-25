import { supabase } from '@/lib/supabase'

export type NotificationType =
  | 'tenant'
  | 'payment'
  | 'deposit'
  | 'expense'
  | 'income'
  | 'loan'
  | 'loan_repayment'
  | 'broadcast'

/** Notifications saved before the finer types existed only carry a coarse one
 * ("expense" for loans, "payment" for income and deposits) — recover the real
 * kind from the title so they get the right icon too. */
function resolveType(type: string, title: string): NotificationType {
  if (title.startsWith('Loan repayment')) return 'loan_repayment'
  if (title.startsWith('Loan')) return 'loan'
  if (title.startsWith('Income')) return 'income'
  if (title.startsWith('Deposit')) return 'deposit'
  return type as NotificationType
}

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  createdAt: string
  read: boolean
}

export async function getNotifications(): Promise<AppNotification[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: buildingRow, error: buildingError } = await supabase
    .from('building')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (buildingError) throw buildingError

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, message, read, created_at')
    .eq('building_id', buildingRow.id)
    .order('created_at', { ascending: false })
  if (error) throw error

  return data.map((n) => ({
    id: n.id,
    type: resolveType(n.type, n.title),
    title: n.title,
    message: n.message,
    createdAt: n.created_at,
    read: n.read,
  }))
}

export async function clearAllNotifications(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: buildingRow, error: buildingError } = await supabase
    .from('building')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (buildingError) throw buildingError

  const { error } = await supabase.from('notifications').delete().eq('building_id', buildingRow.id)
  if (error) throw error
}

export async function markAllNotificationsRead(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: buildingRow, error: buildingError } = await supabase
    .from('building')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (buildingError) throw buildingError

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('building_id', buildingRow.id)
    .eq('read', false)
  if (error) throw error
}

/** Called from other feature services (tenants, expenses, broadcast) to log
 * an event to the bell feed. This is a
 * side-effect of the calling mutation, not the mutation itself, so a
 * failure here is swallowed (logged) rather than thrown — the tenant/
 * payment/expense/broadcast the caller just committed must not get
 * reported as failed just because the notification log didn't write. */
export async function pushSupabaseNotification(
  buildingId: string,
  type: NotificationType,
  title: string,
  message: string,
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({ building_id: buildingId, type, title, message })
  if (error) console.error('[notifications] failed to log notification:', error.message)
}
