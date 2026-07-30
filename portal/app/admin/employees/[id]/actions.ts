'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'

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
  const { error } = await supabase
    .from('employees')
    .update({
      name: String(formData.get('name') ?? ''),
      position: String(formData.get('position') ?? '') || null,
      department: String(formData.get('department') ?? '') || null,
      contact_info: String(formData.get('contactInfo') ?? '') || null,
      join_date: String(formData.get('joinDate') ?? '') || null,
      status: formData.get('status') === 'inactive' ? 'inactive' : 'active',
    })
    .eq('id', employeeRowId)

  if (error) return { error: error.message }

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
