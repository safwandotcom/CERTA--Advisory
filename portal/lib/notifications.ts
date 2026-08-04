import type { SupabaseClient } from '@supabase/supabase-js'

export type Notification = {
  id: string
  recipient_id: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export async function listNotifications(supabase: SupabaseClient, limit = 20): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('id, recipient_id, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function countUnreadNotifications(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  return count ?? 0
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  notificationId: string
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
  return { error: error?.message }
}

export async function markAllNotificationsRead(supabase: SupabaseClient): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  return { error: error?.message }
}

// Cross-employee write — must be called with an admin client (service-role),
// never the caller's own RLS-scoped client. See notifications_select_own /
// notifications_update_own in 0010_notifications.sql: there is no insert
// policy for the authenticated role at all.
export async function notifyEmployees(
  adminClient: SupabaseClient,
  recipientIds: string[],
  input: { title: string; body?: string; link?: string }
): Promise<{ error?: string }> {
  if (recipientIds.length === 0) return {}
  const { error } = await adminClient.from('notifications').insert(
    recipientIds.map((recipientId) => ({
      recipient_id: recipientId,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    }))
  )
  return { error: error?.message }
}

export async function listActiveAdminIds(adminClient: SupabaseClient): Promise<string[]> {
  const { data } = await adminClient
    .from('employees')
    .select('id')
    .in('role', ['admin', 'superadmin'])
    .eq('status', 'active')
  return (data ?? []).map((row) => row.id)
}
