'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireEmployee, NOT_AUTHORIZED } from '@/lib/auth'
import { clockIn as clockInDb, clockOut as clockOutDb } from '@/lib/attendance'

export type AttendanceActionState = { error?: string; success?: string }

export async function clockInAction(
  _prevState: AttendanceActionState,
  _formData: FormData
): Promise<AttendanceActionState> {
  let employee
  try {
    employee = await requireEmployee()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const supabase = await createClient()
  const { error } = await clockInDb(supabase, employee.id)
  if (error) return { error }
  revalidatePath('/dashboard')
  return { success: 'Clocked in' }
}

export async function clockOutAction(
  _prevState: AttendanceActionState,
  _formData: FormData
): Promise<AttendanceActionState> {
  let employee
  try {
    employee = await requireEmployee()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const supabase = await createClient()
  const { error } = await clockOutDb(supabase, employee.id)
  if (error) return { error }
  revalidatePath('/dashboard')
  return { success: 'Clocked out' }
}
