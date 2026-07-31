'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireManagerOrAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { createTask, updateTaskStatus, type TaskStatus } from '@/lib/tasks'

export type ActionState = { error?: string; success?: string }

export async function assignTaskAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let caller
  try {
    caller = await requireManagerOrAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const departmentId = String(formData.get('departmentId') ?? '')
  const assignedTo = String(formData.get('assignedTo') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const dueDate = String(formData.get('dueDate') ?? '').trim()

  if (!departmentId || !assignedTo || !title) {
    return { error: 'Department, assignee, and title are all required' }
  }

  const supabase = await createClient()
  const { error } = await createTask(supabase, {
    departmentId,
    assignedTo,
    assignedBy: caller.id,
    title,
    description: description || undefined,
    dueDate: dueDate || undefined,
  })

  if (error) return { error }

  revalidatePath('/manager')
  return { success: 'Task assigned' }
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus): Promise<ActionState> {
  try {
    await requireManagerOrAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const supabase = await createClient()
  const { error } = await updateTaskStatus(supabase, taskId, status)
  if (error) return { error }
  revalidatePath('/manager')
  return { success: 'Updated' }
}

export async function submitMonthlyReportAction(
  departmentId: string,
  periodMonth: string
): Promise<ActionState> {
  let caller
  try {
    caller = await requireManagerOrAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const supabase = await createClient()

  const { data: tasks } = await supabase.from('tasks').select('*').eq('department_id', departmentId)

  const statusCounts: Record<string, number> = { NEW: 0, STARTED: 0, PENDING: 0, COMPLETED: 0 }
  for (const t of tasks ?? []) {
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1
  }

  const { error } = await supabase.from('monthly_reports').insert({
    department_id: departmentId,
    manager_id: caller.id,
    period_month: periodMonth,
    stats: { statusCounts, tasks: tasks ?? [] },
  })

  if (error) return { error: error.message }
  revalidatePath('/manager')
  return { success: 'Report submitted' }
}
