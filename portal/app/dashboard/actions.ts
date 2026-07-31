'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { updateTaskStatus, type TaskStatus } from '@/lib/tasks'

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
