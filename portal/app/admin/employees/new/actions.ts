'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createEmployeeRecord } from '@/lib/employees'
import { requireAdmin, requireSuperAdmin } from '@/lib/auth'
import { parseManagedDepartmentIds, setManagedDepartments } from '@/lib/departments'

export type CreateEmployeeState = { error?: string }

export async function createEmployeeAction(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  await requireAdmin()

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
    const { employeeRowId } = await createEmployeeRecord(adminClient, {
      employeeId,
      name,
      password,
      role,
      departmentId,
      contactInfo: String(formData.get('contactInfo') ?? '') || undefined,
      joinDate: String(formData.get('joinDate') ?? '') || undefined,
    })

    if (role === 'manager') {
      const managedDepartmentIds = parseManagedDepartmentIds(formData)
      await setManagedDepartments(adminClient, employeeRowId, managedDepartmentIds)
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create employee' }
  }

  redirect('/admin')
}
