'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireManagerOrAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { createSubtask, toggleSubtask } from '@/lib/subtasks'
import { createComment } from '@/lib/comments'

export type ActionState = { error?: string; success?: string }

export async function addSubtaskAction(
  projectId: string,
  taskId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { error: 'Subtask title is required' }

  const supabase = await createClient()
  const { error } = await createSubtask(supabase, taskId, title)
  if (error) return { error }

  revalidatePath(`/projects/${projectId}/tasks/${taskId}`)
  return { success: 'Added' }
}

export async function toggleSubtaskAction(
  projectId: string,
  taskId: string,
  subtaskId: string,
  done: boolean
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await toggleSubtask(supabase, subtaskId, done)
  if (error) return { error }

  revalidatePath(`/projects/${projectId}/tasks/${taskId}`)
  return { success: 'Updated' }
}

export async function addCommentAction(
  projectId: string,
  taskId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let caller
  try {
    caller = await requireManagerOrAdmin()
  } catch {
    // Employees can comment too (any project member) — requireManagerOrAdmin
    // rejecting them here is expected; fall through to a plain auth check
    // instead of hard-failing the whole action for a valid employee comment.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: NOT_AUTHORIZED }

    const { data: employee } = await supabase.from('employees').select('id').eq('auth_user_id', user.id).single()
    if (!employee) return { error: NOT_AUTHORIZED }

    const body = String(formData.get('body') ?? '').trim()
    if (!body) return { error: 'Comment cannot be empty' }

    const { error } = await createComment(supabase, taskId, employee.id, body)
    if (error) return { error }

    revalidatePath(`/projects/${projectId}/tasks/${taskId}`)
    return { success: 'Posted' }
  }

  const body = String(formData.get('body') ?? '').trim()
  if (!body) return { error: 'Comment cannot be empty' }

  const supabase = await createClient()
  const { error } = await createComment(supabase, taskId, caller.id, body)
  if (error) return { error }

  revalidatePath(`/projects/${projectId}/tasks/${taskId}`)
  return { success: 'Posted' }
}
