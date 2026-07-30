import type { SupabaseClient } from '@supabase/supabase-js'
import { employeeIdToEmail } from './employeeAuth'

export type NewEmployeeInput = {
  employeeId: string
  password: string
  name: string
  role: 'admin' | 'manager' | 'employee'
  contactInfo?: string
  position?: string
  departmentId?: string
  joinDate?: string
}

export async function createEmployeeRecord(
  adminClient: SupabaseClient,
  input: NewEmployeeInput
): Promise<{ employeeRowId: string }> {
  const email = employeeIdToEmail(input.employeeId)

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    throw new Error(`Failed to create auth user: ${authError?.message}`)
  }

  const { data: employeeRow, error: dbError } = await adminClient
    .from('employees')
    .insert({
      employee_id: input.employeeId,
      auth_user_id: authUser.user.id,
      name: input.name,
      role: input.role,
      contact_info: input.contactInfo ?? null,
      position: input.position ?? null,
      department_id: input.departmentId ?? null,
      join_date: input.joinDate ?? null,
      status: 'active',
    })
    .select('id')
    .single()

  if (dbError || !employeeRow) {
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    throw new Error(`Failed to create employee record: ${dbError?.message}`)
  }

  return { employeeRowId: employeeRow.id }
}
