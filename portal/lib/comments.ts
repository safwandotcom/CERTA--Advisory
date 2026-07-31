import type { SupabaseClient } from '@supabase/supabase-js'

export type TaskComment = {
  id: string
  task_id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
}

export async function listComments(supabase: SupabaseClient, taskId: string): Promise<TaskComment[]> {
  const { data } = await supabase
    .from('task_comments')
    .select('id, task_id, author_id, body, created_at, employees!task_comments_author_id_fkey(name)')
    .eq('task_id', taskId)
    .order('created_at')

  return (data ?? []).map((row) => ({
    id: row.id,
    task_id: row.task_id,
    author_id: row.author_id,
    author_name: (row as unknown as { employees: { name: string } }).employees?.name ?? 'Unknown',
    body: row.body,
    created_at: row.created_at,
  }))
}

export async function createComment(
  supabase: SupabaseClient,
  taskId: string,
  authorId: string,
  body: string
): Promise<{ error?: string }> {
  const { error } = await supabase.from('task_comments').insert({ task_id: taskId, author_id: authorId, body })
  return { error: error?.message }
}
