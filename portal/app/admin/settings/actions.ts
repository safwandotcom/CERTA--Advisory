'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { setCompanySetting, addCompanyHoliday, deleteCompanyHoliday } from '@/lib/companySettings'

export type SettingsActionState = { error?: string; success?: string }

export async function updateWeeklyOffDaysAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const supabase = await createClient()
  const value = String(formData.get('weeklyOffDays') ?? '')
  const { error } = await setCompanySetting(supabase, 'weekly_off_days', value)
  if (error) return { error }
  revalidatePath('/admin/settings')
  return { success: 'Weekly off-days updated' }
}

export async function addHolidayAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const supabase = await createClient()
  const date = String(formData.get('date') ?? '')
  const name = String(formData.get('name') ?? '')
  if (!date || !name) return { error: 'Date and name are required' }
  const { error } = await addCompanyHoliday(supabase, { date, name })
  if (error) return { error }
  revalidatePath('/admin/settings')
  return { success: 'Holiday added' }
}

export async function deleteHolidayAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')
  const { error } = await deleteCompanyHoliday(supabase, id)
  if (error) return { error }
  revalidatePath('/admin/settings')
  return { success: 'Holiday removed' }
}
