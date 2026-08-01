import type { SupabaseClient } from '@supabase/supabase-js'

export type TaskStatus = 'NEW' | 'STARTED' | 'PENDING' | 'COMPLETED'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type Task = {
  id: string
  department_id: string
  project_id: string | null
  assigned_to: string
  assigned_by: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  labels: string[]
  due_date: string | null
  created_at: string
  updated_at: string
}

export async function createTask(
  supabase: SupabaseClient,
  input: {
    projectId?: string
    departmentId?: string // still accepted for the pre-Task-7 caller; Task 7 stops passing this
    assignedTo: string
    assignedBy: string
    title: string
    description?: string
    dueDate?: string
    priority?: TaskPriority
    labels?: string[]
  }
): Promise<{ error?: string }> {
  const { data: employee } = await supabase
    .from('employees')
    .select('department_id')
    .eq('id', input.assignedTo)
    .single()

  const { error } = await supabase.from('tasks').insert({
    project_id: input.projectId ?? null,
    department_id: input.departmentId ?? employee?.department_id ?? null,
    assigned_to: input.assignedTo,
    assigned_by: input.assignedBy,
    title: input.title,
    description: input.description ?? null,
    due_date: input.dueDate ?? null,
    priority: input.priority ?? 'medium',
    labels: input.labels ?? [],
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

export async function listTasksForProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<(Task & { assignee_name: string })[]> {
  const { data } = await supabase
    .from('tasks')
    .select('*, employees!tasks_assigned_to_fkey(name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => ({
    ...row,
    assignee_name: (row as unknown as { employees: { name: string } }).employees?.name ?? 'Unknown',
  }))
}

export async function listTasksForEmployee(
  supabase: SupabaseClient,
  employeeId: string
): Promise<(Task & { project_name: string | null })[]> {
  const { data } = await supabase
    .from('tasks')
    .select('*, projects(name)')
    .eq('assigned_to', employeeId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => ({
    ...row,
    project_name: (row as unknown as { projects: { name: string } | null }).projects?.name ?? null,
  }))
}
