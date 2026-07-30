'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createEmployeeRecord } from '@/lib/employees'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'

export type CreateEmployeeState = { error?: string }

export async function createEmployeeAction(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const employeeId = String(formData.get('employeeId') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const role = formData.get('role') === 'admin' ? 'admin' : 'employee'
  const contactInfo = String(formData.get('contactInfo') ?? '').trim()
  const joinDate = String(formData.get('joinDate') ?? '').trim()

  if (!employeeId || !name || !password) {
    return { error: 'Employee ID, full name, and initial password are all required' }
  }

  try {
    const adminClient = createAdminClient()
    await createEmployeeRecord(adminClient, {
      employeeId,
      name,
      password,
      role,
      // Empty strings must not reach the DB — join_date is a date column.
      contactInfo: contactInfo || undefined,
      joinDate: joinDate || undefined,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create employee' }
  }

  redirect('/admin')
}
