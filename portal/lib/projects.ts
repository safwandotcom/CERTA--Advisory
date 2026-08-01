import type { SupabaseClient } from '@supabase/supabase-js'

export type Project = {
  id: string
  name: string
  description: string | null
  status: 'active' | 'archived'
  created_by: string
  created_at: string
}

export function parseProjectMemberIds(formData: FormData): string[] {
  return formData.getAll('memberIds').map((v) => String(v))
}

export async function listProjects(
  supabase: SupabaseClient,
  { includeArchived = false }: { includeArchived?: boolean } = {}
): Promise<Project[]> {
  let query = supabase.from('projects').select('*').order('name')
  if (!includeArchived) {
    query = query.eq('status', 'active')
  }
  const { data } = await query
  return data ?? []
}

export async function createProject(
  supabase: SupabaseClient,
  input: { name: string; description?: string; createdBy: string; memberIds: string[] }
): Promise<{ projectId?: string; error?: string }> {
  const { data: project, error } = await supabase
    .from('projects')
    .insert({ name: input.name, description: input.description ?? null, created_by: input.createdBy })
    .select('id')
    .single()

  if (error || !project) return { error: error?.message ?? 'Failed to create project' }

  const memberIds = Array.from(new Set([...input.memberIds, input.createdBy]))
  const { error: memberError } = await supabase
    .from('project_members')
    .insert(memberIds.map((employee_id) => ({ project_id: project.id, employee_id })))

  if (memberError) return { error: memberError.message }

  return { projectId: project.id }
}

export async function archiveProject(supabase: SupabaseClient, projectId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('projects').update({ status: 'archived' }).eq('id', projectId)
  return { error: error?.message }
}

export async function listProjectMembers(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ id: string; employee_id: string; name: string }[]> {
  const { data } = await supabase
    .from('project_members')
    .select('employees!project_members_employee_id_fkey(id, employee_id, name)')
    .eq('project_id', projectId)

  return (data ?? [])
    .map((row) => (row as unknown as { employees: { id: string; employee_id: string; name: string } | null }).employees)
    .filter((emp): emp is { id: string; employee_id: string; name: string } => Boolean(emp))
    .map((emp) => ({ id: emp.id, employee_id: emp.employee_id, name: emp.name }))
}

export async function addProjectMember(
  supabase: SupabaseClient,
  projectId: string,
  employeeId: string
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('project_members')
    .upsert({ project_id: projectId, employee_id: employeeId }, { onConflict: 'project_id,employee_id' })
  return { error: error?.message }
}

export function isProjectMemberLocally(
  members: { employee_id: string }[],
  employeeId: string
): boolean {
  return members.some((m) => m.employee_id === employeeId)
}
