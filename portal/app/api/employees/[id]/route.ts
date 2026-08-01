import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { listDepartments } from '@/lib/departments'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only the admin edit page consumes this route — the employee dashboard
  // queries Supabase directly — so admin-only is the correct scope here.
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: NOT_AUTHORIZED }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { data: employee } = await supabase.from('employees').select('*').eq('id', id).single()
  const { data: documents } = await supabase
    .from('employee_documents')
    .select('*')
    .eq('employee_id', id)

  const departments = await listDepartments(supabase)

  return NextResponse.json({
    employee,
    documents: documents ?? [],
    departments,
  })
}
