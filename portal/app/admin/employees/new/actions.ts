'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createEmployeeRecord } from '@/lib/employees'
import { requireAdmin, requireSuperAdmin, NOT_AUTHORIZED } from '@/lib/auth'

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
  const departmentId = String(formData.get('departmentId') ?? '').trim()
  const roleInput = formData.get('role')
  const role = roleInput === 'admin' ? 'admin' : roleInput === 'manager' ? 'manager' : 'employee'

  if (!employeeId || !name || !password || !departmentId) {
    return { error: 'Employee ID, full name, initial password, and department are all required' }
  }

  if (role === 'admin') {
    try {
      await requireSuperAdmin()
    } catch {
      return { error: 'Only the superadmin can create admin accounts' }
    }
  }

  try {
    const adminClient = createAdminClient()
    await createEmployeeRecord(adminClient, {
      employeeId,
      name,
      password,
      role,
      departmentId,
      contactInfo: String(formData.get('contactInfo') ?? '') || undefined,
      joinDate: String(formData.get('joinDate') ?? '') || undefined,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create employee' }
  }

  redirect('/admin')
}
