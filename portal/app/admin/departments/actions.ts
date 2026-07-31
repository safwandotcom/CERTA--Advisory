'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'

export type DepartmentActionState = { error?: string; success?: string }

export async function createDepartmentAction(formData: FormData) {
  try {
    await requireAdmin()
  } catch {
    return
  }
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return

  const supabase = await createClient()
  await supabase.from('departments').insert({ name })
  revalidatePath('/admin/departments')
}

export async function archiveDepartmentAction(departmentId: string) {
  try {
    await requireAdmin()
  } catch {
    return
  }
  const supabase = await createClient()
  await supabase.from('departments').update({ archived: true }).eq('id', departmentId)
  revalidatePath('/admin/departments')
}

export async function updateDepartmentNameAction(
  departmentId: string,
  _prevState: DepartmentActionState,
  formData: FormData
): Promise<DepartmentActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Department name is required' }

  const supabase = await createClient()
  const { error } = await supabase.from('departments').update({ name }).eq('id', departmentId)

  if (error) {
    return {
      error: error.code === '23505' ? 'A department with this name already exists' : error.message,
    }
  }

  revalidatePath('/admin/departments')
  return { success: 'Saved' }
}

export async function deleteDepartmentAction(departmentId: string): Promise<DepartmentActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const supabase = await createClient()

  // Departments are otherwise archive-only (never hard-deleted) so historical
  // task/report references stay valid. A real remove is only safe when
  // nothing actually references this department yet — check first for a
  // friendly message; the FK constraints on employees/tasks/monthly_reports
  // back this up regardless (no ON DELETE clause, so they'd reject the
  // delete outright if this check were ever bypassed).
  const [{ count: employeeCount }, { count: taskCount }, { count: reportCount }] = await Promise.all([
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('department_id', departmentId),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('department_id', departmentId),
    supabase.from('monthly_reports').select('id', { count: 'exact', head: true }).eq('department_id', departmentId),
  ])

  if ((employeeCount ?? 0) > 0 || (taskCount ?? 0) > 0 || (reportCount ?? 0) > 0) {
    return {
      error: 'This department still has employees, tasks, or reports linked to it — archive it instead, or reassign those first.',
    }
  }

  const { error } = await supabase.from('departments').delete().eq('id', departmentId)
  if (error) return { error: error.message }

  revalidatePath('/admin/departments')
  return { success: 'Removed' }
}
