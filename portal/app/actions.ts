'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from '@/lib/notifications'

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function listNotificationsAction(): Promise<Notification[]> {
  const supabase = await createClient()
  return listNotifications(supabase)
}

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const supabase = await createClient()
  await markNotificationRead(supabase, notificationId)
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const supabase = await createClient()
  await markAllNotificationsRead(supabase)
}
