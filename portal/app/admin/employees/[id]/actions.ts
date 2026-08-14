'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { markOnboardingComplete, requestOnboardingCorrection } from '@/lib/onboarding'
import { notifyEmployees } from '@/lib/notifications'
import { setMonthlySalary } from '@/lib/employeeSalary'

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
    .select('department_id')
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

export async function markOnboardingCompleteAction(
  employeeRowId: string,
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  let reviewer
  try {
    reviewer = await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const adminClient = createAdminClient()
  const { error } = await markOnboardingComplete(adminClient, employeeRowId, reviewer.id)
  if (error) return { error }

  revalidatePath(`/admin/employees/${employeeRowId}`)
  return { success: 'Onboarding marked complete' }
}

export async function requestOnboardingCorrectionAction(
  employeeRowId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let reviewer
  try {
    reviewer = await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const note = String(formData.get('correctionNote') ?? '').trim()
  if (!note) {
    return { error: 'Explain what needs to be corrected' }
  }

  const adminClient = createAdminClient()
  const { error } = await requestOnboardingCorrection(adminClient, employeeRowId, reviewer.id, note)
  if (error) return { error }

  await notifyEmployees(adminClient, [employeeRowId], {
    title: 'Your onboarding needs a correction',
    link: '/onboarding',
  })

  revalidatePath(`/admin/employees/${employeeRowId}`)
  return { success: 'Correction requested' }
}

export async function updateMonthlySalaryAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const employeeId = String(formData.get('employeeId') ?? '')
  const amount = Number(formData.get('monthlySalary') ?? '')
  if (!employeeId || Number.isNaN(amount) || amount < 0) {
    return { error: 'Enter a valid salary amount' }
  }

  const supabase = await createClient()
  const { error } = await setMonthlySalary(supabase, employeeId, amount)
  if (error) return { error }

  revalidatePath(`/admin/employees/${employeeId}`)
  return { success: 'Salary updated' }
}

// Permanent, unrecoverable removal — deliberately gated to already-archived
// employees only (checked below against the DB, not a value passed in from
// the page) so an active employee's full history can never be wiped in one
// click. Archive is the everyday "remove someone" action and keeps their
// history; this is for cleaning up an archived record for good.
//
// attendance_records, leave_requests/leave_allocations (by employee_id),
// employee_documents, employee_onboarding (by employee_id), notifications,
// and project_members all cascade-delete with the employee row. Four other
// columns reference employees with NOT NULL and no cascade (tasks.assigned_to/
// assigned_by, task_comments.author_id, task_status_history.changed_by) --
// relaxing those to nullable would ripple into the Tasks/Projects UI's
// assumption that an assignee/author always resolves to a real employee, so
// instead this blocks deletion with a specific message when any exist,
// mirroring deleteDepartmentAction's existing "still referenced, resolve
// this first" pattern. leave_requests.reviewed_by and
// employee_onboarding.reviewed_by ARE nullable but still enforce referential
// integrity on a non-null value, so those get explicitly cleared first.
export async function deleteEmployeeAction(
  targetAuthUserId: string,
  targetEmployeeId: string,
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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { error: NOT_AUTHORIZED }
  }

  if (user.id === targetAuthUserId) {
    return { error: 'You cannot delete your own account' }
  }

  // Re-verify the CALLER's own password before allowing this irreversible action.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (verifyError) {
    return { error: 'Incorrect password' }
  }

  const adminClient = createAdminClient()

  const { data: target, error: targetError } = await adminClient
    .from('employees')
    .select('id, role, archived')
    .eq('employee_id', targetEmployeeId)
    .eq('auth_user_id', targetAuthUserId)
    .single()

  if (targetError || !target) return { error: 'Employee not found' }
  if (target.role === 'superadmin') return { error: 'The superadmin account cannot be deleted' }
  if (!target.archived) {
    return { error: 'Archive this employee first, then permanently delete them from the archived list' }
  }

  const employeeRowId = target.id as string

  const [
    { count: assignedToCount },
    { count: assignedByCount },
    { count: commentCount },
    { count: projectCount },
    { count: historyCount },
  ] = await Promise.all([
    adminClient.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', employeeRowId),
    adminClient.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_by', employeeRowId),
    adminClient.from('task_comments').select('id', { count: 'exact', head: true }).eq('author_id', employeeRowId),
    adminClient.from('projects').select('id', { count: 'exact', head: true }).eq('created_by', employeeRowId),
    adminClient.from('task_status_history').select('id', { count: 'exact', head: true }).eq('changed_by', employeeRowId),
  ])

  const blockers: string[] = []
  if ((assignedToCount ?? 0) > 0) blockers.push('tasks assigned to them')
  if ((assignedByCount ?? 0) > 0) blockers.push('tasks they assigned to others')
  if ((commentCount ?? 0) > 0) blockers.push('task comments they wrote')
  if ((projectCount ?? 0) > 0) blockers.push('projects they created')
  if ((historyCount ?? 0) > 0) blockers.push('task status changes they made')

  if (blockers.length > 0) {
    return {
      error: `This employee still has ${blockers.join(', ')} — reassign or remove those first, then delete.`,
    }
  }

  await Promise.all([
    adminClient.from('employee_onboarding').update({ reviewed_by: null }).eq('reviewed_by', employeeRowId),
    adminClient.from('leave_requests').update({ reviewed_by: null, review_note: null }).eq('reviewed_by', employeeRowId),
  ])

  const { error: deleteError } = await adminClient.from('employees').delete().eq('id', employeeRowId)
  if (deleteError) return { error: deleteError.message }

  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(targetAuthUserId)
  if (authDeleteError) {
    // The employee row is already gone at this point; a leftover auth user
    // with nothing pointing to it isn't a data-integrity problem, just a
    // stray login credential -- surface it rather than pretending nothing
    // went wrong, but there's nothing left to roll back.
    return { error: `Employee removed, but their login could not be deleted: ${authDeleteError.message}` }
  }

  revalidatePath('/admin')
  redirect('/admin?archived=1')
}
