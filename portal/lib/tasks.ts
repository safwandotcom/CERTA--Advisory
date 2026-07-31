import type { SupabaseClient } from '@supabase/supabase-js'

export type TaskStatus = 'NEW' | 'STARTED' | 'PENDING' | 'COMPLETED'

export type Task = {
  id: string
  department_id: string
  assigned_to: string
  assigned_by: string
  title: string
  description: string | null
  status: TaskStatus
  due_date: string | null
  created_at: string
  updated_at: string
}

export async function createTask(
  supabase: SupabaseClient,
  input: {
    departmentId: string
    assignedTo: string
    assignedBy: string
    title: string
    description?: string
    dueDate?: string
  }
): Promise<{ error?: string }> {
  const { error } = await supabase.from('tasks').insert({
    department_id: input.departmentId,
    assigned_to: input.assignedTo,
    assigned_by: input.assignedBy,
    title: input.title,
    description: input.description ?? null,
    due_date: input.dueDate ?? null,
  })
  return { error: error?.message }
}

export async function updateTaskStatus(
  supabase: SupabaseClient,
  taskId: string,
  status: TaskStatus
): Promise<{ error?: string }> {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
  return { error: error?.message }
}

export async function listTasksForDepartments(
  supabase: SupabaseClient,
  departmentIds: string[]
): Promise<(Task & { assignee_name: string })[]> {
  if (departmentIds.length === 0) return []
  const { data } = await supabase
    .from('tasks')
    .select('*, employees!tasks_assigned_to_fkey(name)')
    .in('department_id', departmentIds)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => ({
    ...row,
    assignee_name: (row as unknown as { employees: { name: string } }).employees?.name ?? 'Unknown',
  }))
}

export async function listTasksForEmployee(
  supabase: SupabaseClient,
  employeeId: string
): Promise<Task[]> {
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', employeeId)
    .order('created_at', { ascending: false })
  return data ?? []
}
