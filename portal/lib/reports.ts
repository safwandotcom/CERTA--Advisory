import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskStatus } from './tasks'

export type UnreportedMonth = {
  departmentId: string
  departmentName: string
  periodMonth: string // 'YYYY-MM-01'
  statusCounts: Record<TaskStatus, number>
  taskCount: number
}

function previousMonthStart(): string {
  const now = new Date()
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return prev.toISOString().slice(0, 10)
}

export async function getUnreportedPriorMonths(
  supabase: SupabaseClient,
  departments: { id: string; name: string }[]
): Promise<UnreportedMonth[]> {
  const periodMonth = previousMonthStart()
  const results: UnreportedMonth[] = []

  for (const dept of departments) {
    const { data: existing } = await supabase
      .from('monthly_reports')
      .select('id')
      .eq('department_id', dept.id)
      .eq('period_month', periodMonth)
      .maybeSingle()

    if (existing) continue

    const { data: tasks } = await supabase.from('tasks').select('status').eq('department_id', dept.id)

    const statusCounts: Record<TaskStatus, number> = { NEW: 0, STARTED: 0, PENDING: 0, COMPLETED: 0 }
    for (const t of tasks ?? []) {
      statusCounts[t.status as TaskStatus] += 1
    }

    results.push({
      departmentId: dept.id,
      departmentName: dept.name,
      periodMonth,
      statusCounts,
      taskCount: tasks?.length ?? 0,
    })
  }

  return results
}
