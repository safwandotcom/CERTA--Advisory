import type { SupabaseClient } from '@supabase/supabase-js'

export type Subtask = {
  id: string
  task_id: string
  title: string
  done: boolean
}

export async function listSubtasks(supabase: SupabaseClient, taskId: string): Promise<Subtask[]> {
  const { data } = await supabase
    .from('subtasks')
    .select('id, task_id, title, done')
    .eq('task_id', taskId)
    .order('created_at')
  return data ?? []
}

export async function createSubtask(
  supabase: SupabaseClient,
  taskId: string,
  title: string
): Promise<{ error?: string }> {
  const { error } = await supabase.from('subtasks').insert({ task_id: taskId, title })
  return { error: error?.message }
}

export async function toggleSubtask(
  supabase: SupabaseClient,
  subtaskId: string,
  done: boolean
): Promise<{ error?: string }> {
  const { error } = await supabase.from('subtasks').update({ done }).eq('id', subtaskId)
  return { error: error?.message }
}
