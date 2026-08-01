'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createTask, updateTaskStatus, type TaskStatus } from '@/lib/tasks'

export type ActionState = { error?: string; success?: string }

export async function updateOwnTaskStatusAction(taskId: string, status: TaskStatus): Promise<ActionState> {
  const supabase = await createClient()
  // No explicit role check here: the tasks_employee_update_own RLS policy
  // (Task 1) only allows this update to succeed if the row's assigned_to
  // resolves to the caller's own employees row — RLS is the actual
  // authorization boundary for this action, not application code.
  const { error } = await updateTaskStatus(supabase, taskId, status)
  if (error) return { error }
  revalidatePath('/dashboard')
  return { success: 'Updated' }
}

export async function createOwnTaskAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }

  const { data: caller } = await supabase.from('employees').select('id').eq('auth_user_id', user.id).single()
  if (!caller) return { error: 'Not authorized' }

  const projectId = String(formData.get('projectId') ?? '')
  const assignedTo = String(formData.get('assignedTo') ?? '') || caller.id
  const title = String(formData.get('title') ?? '').trim()

  if (!projectId || !title) return { error: 'Project and title are required' }

  // createTask() looks up the assignee's own department_id internally, using
  // whichever client it's given, to populate tasks.department_id (still
  // NOT NULL and still checked by Phase 2's tasks_validate_assignment
  // trigger until Task 13). If that lookup ran on the caller's own
  // RLS-scoped `supabase` client below, it would silently fail whenever
  // assignedTo is a *fellow* project member rather than the caller
  // themselves — employees_select_self_or_admin only lets an employee read
  // their own employees row, not a teammate's, so the lookup would return
  // no rows, department_id would resolve to null, and the trigger would
  // reject the insert ("assigned_to employee must belong to the task's
  // department") even when assigner and assignee share a real department.
  // This is the same class of chicken-and-egg RLS gap already fixed for
  // Task 5's createProjectAction and Task 7's assignTaskAction — the fix
  // here is narrower: only this one auxiliary read needs the service-role
  // client, not the whole action. The actual tasks INSERT below stays on
  // the caller's RLS-scoped `supabase`, so tasks_project_member_insert's
  // is_project_member(project_id) check still enforces that the caller is
  // really a member of projectId — that RLS check is the real security
  // boundary here and must not be bypassed.
  const adminClient = createAdminClient()
  const { data: assignee } = await adminClient
    .from('employees')
    .select('department_id')
    .eq('id', assignedTo)
    .single()

  // RLS (project_members_select / tasks writes) is the real boundary that
  // rejects this if the caller isn't actually a member of projectId — this
  // app-layer code doesn't need its own membership check duplicated here.
  const { error } = await createTask(supabase, {
    projectId,
    departmentId: assignee?.department_id ?? undefined,
    assignedTo,
    assignedBy: caller.id,
    title,
    description: String(formData.get('description') ?? '').trim() || undefined,
  })

  if (error) return { error }

  revalidatePath('/dashboard')
  return { success: 'Task created' }
}
