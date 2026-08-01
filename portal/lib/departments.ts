import type { SupabaseClient } from '@supabase/supabase-js'

export type Department = {
  id: string
  name: string
  archived: boolean
  created_at: string
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
