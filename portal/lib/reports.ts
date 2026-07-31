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

// A monthly report's stats must only reflect tasks assigned during that
// period — without this bound, every report re-counts the department's
// entire task history, and since stats are an immutable JSONB snapshot
// (unique per department+period), a wrong count is permanent.
export function periodMonthRange(periodMonth: string): { start: string; end: string } {
  const start = new Date(periodMonth + 'T00:00:00.000Z')
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  return { start: periodMonth, end: end.toISOString().slice(0, 10) }
}

export async function getUnreportedPriorMonths(
  supabase: SupabaseClient,
  departments: { id: string; name: string }[]
): Promise<UnreportedMonth[]> {
  const periodMonth = previousMonthStart()
  const { start, end } = periodMonthRange(periodMonth)
  const results: UnreportedMonth[] = []

  for (const dept of departments) {
    const { data: existing } = await supabase
      .from('monthly_reports')
      .select('id')
      .eq('department_id', dept.id)
      .eq('period_month', periodMonth)
      .maybeSingle()

    if (existing) continue

    const { data: tasks } = await supabase
      .from('tasks')
      .select('status')
      .eq('department_id', dept.id)
      .gte('created_at', start)
      .lt('created_at', end)

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
