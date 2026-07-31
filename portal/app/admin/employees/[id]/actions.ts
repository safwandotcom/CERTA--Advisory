'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { parseManagedDepartmentIds, setManagedDepartments } from '@/lib/departments'

export type ActionState = { error?: string; success?: string }

export async function updateEmployeeAction(
  employeeRowId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const supabase = await createClient()

  const { data: currentEmployee } = await supabase
    .from('employees')
    .select('role, department_id')
    .eq('id', employeeRowId)
    .single()

  const newDepartmentId = String(formData.get('departmentId') ?? '') || null

  const { error } = await supabase
    .from('employees')
    .update({
      name: String(formData.get('name') ?? ''),
      position: String(formData.get('position') ?? '') || null,
      department_id: newDepartmentId,
      contact_info: String(formData.get('contactInfo') ?? '') || null,
      join_date: String(formData.get('joinDate') ?? '') || null,
      status: formData.get('status') === 'inactive' ? 'inactive' : 'active',
    })
    .eq('id', employeeRowId)

  if (error) return { error: error.message }

  // Moving an employee to a new department must move their existing tasks
  // with them — otherwise the old department's manager keeps controlling
  // tasks for someone no longer in their department, the new manager can't
  // see them at all, and the old department's monthly reports keep counting
  // them forever. validate_task_assignment() re-checks this update against
  // the employee's now-updated department_id, so it stays consistent.
  if (newDepartmentId && currentEmployee?.department_id && currentEmployee.department_id !== newDepartmentId) {
    await supabase.from('tasks').update({ department_id: newDepartmentId }).eq('assigned_to', employeeRowId)
  }

  if (currentEmployee?.role === 'manager') {
    const managedDepartmentIds = parseManagedDepartmentIds(formData)
    const adminClient = createAdminClient()
    await setManagedDepartments(adminClient, employeeRowId, managedDepartmentIds)
  }

  revalidatePath(`/admin/employees/${employeeRowId}`)
  return { success: 'Saved' }
}

export async function uploadDocumentAction(
  employeeRowId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const file = formData.get('file') as File
  const label = String(formData.get('label') ?? '')

  if (!file || !label) {
    return { error: 'A file and a label are both required' }
  }

  const adminClient = createAdminClient()
  const filePath = `${employeeRowId}/${Date.now()}-${file.name}`

  const { error: uploadError } = await adminClient.storage
    .from('employee-documents')
    .upload(filePath, file)

  if (uploadError) return { error: uploadError.message }

  const { error: dbError } = await adminClient.from('employee_documents').insert({
    employee_id: employeeRowId,
    file_path: filePath,
    label,
  })

  if (dbError) return { error: dbError.message }

  revalidatePath(`/admin/employees/${employeeRowId}`)
  return { success: 'Uploaded' }
}

export async function resetPasswordAction(
  authUserId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const newPassword = String(formData.get('newPassword') ?? '')

  if (!newPassword) {
    return { error: 'A new password is required' }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.updateUserById(authUserId, {
    password: newPassword,
  })

  if (error) return { error: error.message }

  return { success: 'Password reset' }
}

export async function archiveEmployeeAction(
  targetAuthUserId: string,
  targetEmployeeId: string,
  targetRole: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const password = String(formData.get('confirmPassword') ?? '')
  if (!password) {
    return { error: 'Enter your password to confirm' }
  }

  if (targetRole === 'superadmin') {
    return { error: 'The superadmin account cannot be archived' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { error: NOT_AUTHORIZED }
  }

  // Re-verify the CALLER's own password (not the target employee's) before
  // allowing this destructive action to proceed.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })

  if (verifyError) {
    return { error: 'Incorrect password' }
  }

  if (user.id === targetAuthUserId) {
    return { error: 'You cannot archive your own account' }
  }

  const adminClient = createAdminClient()
  const { data: archivedRows, error } = await adminClient
    .from('employees')
    .update({ archived: true, status: 'inactive' })
    .eq('employee_id', targetEmployeeId)
    .eq('auth_user_id', targetAuthUserId)
    .neq('role', 'superadmin')
    .select('id')

  if (error) return { error: error.message }

  // Re-check at the DB, not the page-load-time targetRole closure: if the
  // target's role changed to superadmin between page load and submit, the
  // neq() above matches zero rows and the archive silently doesn't happen.
  if (!archivedRows || archivedRows.length === 0) {
    return { error: 'The superadmin account cannot be archived' }
  }

  revalidatePath('/admin')
  redirect('/admin')
}
