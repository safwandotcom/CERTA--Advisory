'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

export async function createDepartmentAction(formData: FormData) {
  try {
    await requireAdmin()
  } catch {
    return
  }
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return

  const supabase = await createClient()
  await supabase.from('departments').insert({ name })
  revalidatePath('/admin/departments')
}

export async function archiveDepartmentAction(departmentId: string) {
  try {
    await requireAdmin()
  } catch {
    return
  }
  const supabase = await createClient()
  await supabase.from('departments').update({ archived: true }).eq('id', departmentId)
  revalidatePath('/admin/departments')
}
