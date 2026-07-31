import type { SupabaseClient } from '@supabase/supabase-js'

export type Department = {
  id: string
  name: string
  archived: boolean
  created_at: string
}

export function parseManagedDepartmentIds(formData: FormData): string[] {
  return formData.getAll('managedDepartmentIds').map((v) => String(v))
}

export async function listDepartments(
  supabase: SupabaseClient,
  { includeArchived = false }: { includeArchived?: boolean } = {}
): Promise<Department[]> {
  let query = supabase.from('departments').select('id, name, archived, created_at').order('name')
  if (!includeArchived) {
    query = query.eq('archived', false)
  }
  const { data } = await query
  return data ?? []
}

export async function listManagedDepartmentIds(
  supabase: SupabaseClient,
  managerId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('department_managers')
    .select('department_id')
    .eq('manager_id', managerId)
  return (data ?? []).map((row) => row.department_id as string)
}

export async function setManagedDepartments(
  supabase: SupabaseClient,
  managerId: string,
  departmentIds: string[]
): Promise<void> {
  await supabase.from('department_managers').delete().eq('manager_id', managerId)
  if (departmentIds.length > 0) {
    await supabase
      .from('department_managers')
      .insert(departmentIds.map((department_id) => ({ department_id, manager_id: managerId })))
  }
}
