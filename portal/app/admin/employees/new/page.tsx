import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { listDepartments } from '@/lib/departments'
import NewEmployeeClient from './NewEmployeeClient'

export default async function NewEmployeePage() {
  const caller = await requireAdmin()
  const supabase = await createClient()
  const departments = await listDepartments(supabase)

  return <NewEmployeeClient departments={departments} canCreateAdmin={caller.role === 'superadmin'} />
}
