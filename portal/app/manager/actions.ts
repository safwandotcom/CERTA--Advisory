'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireManagerOrAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { createTask, updateTaskStatus, type TaskStatus } from '@/lib/tasks'
import { addProjectMember } from '@/lib/projects'
import { periodMonthRange } from '@/lib/reports'

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

  const projectId = String(formData.get('projectId') ?? '')
  const assignedTo = String(formData.get('assignedTo') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const dueDate = String(formData.get('dueDate') ?? '').trim()
  const priority = String(formData.get('priority') ?? 'medium') as 'low' | 'medium' | 'high' | 'urgent'
  const labels = String(formData.get('labels') ?? '')
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean)

  if (!projectId || !assignedTo || !title) {
    return { error: 'Project, assignee, and title are all required' }
  }

  // Service-role client, not the RLS-scoped one: the assigning manager is
  // not necessarily a member of projectId themselves (assignment is
  // deliberately unrestricted by project membership — see Global
  // Constraints), so project_members_write's is_project_member(project_id)
  // check would reject the auto-add-member insert below if it ran under
  // the caller's own RLS-scoped session. requireManagerOrAdmin() above
  // already did the real authorization check; this mirrors Task 5's
  // createProjectAction for the same reason.
  const supabase = createAdminClient()

  // Assignment is unrestricted by department, but the assignee must be a
  // project member to see the task in that project's views — add them if
  // they aren't already, rather than making the assigning manager do a
  // separate step first. Check the result: if this silently failed, the
  // task would still get created but the assignee couldn't see it in the
  // project, defeating the whole point of this step.
  const { error: memberError } = await addProjectMember(supabase, projectId, assignedTo)
  if (memberError) return { error: memberError }

  const { error } = await createTask(supabase, {
    projectId,
    assignedTo,
    assignedBy: caller.id,
    title,
    description: description || undefined,
    dueDate: dueDate || undefined,
    priority,
    labels,
  })

  if (error) return { error }

  revalidatePath(`/projects/${projectId}`)
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

  // Monthly reports are a manager-only responsibility — admin/superadmin
  // don't submit them (design spec's permission table). requireManagerOrAdmin()
  // only checks role membership, not this narrower rule, so enforce it here.
  if (caller.role !== 'manager') {
    return { error: 'Only a department manager can submit its monthly report' }
  }

  const supabase = await createClient()

  const { start, end } = periodMonthRange(periodMonth)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('department_id', departmentId)
    .gte('created_at', start)
    .lt('created_at', end)

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
