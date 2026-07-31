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

function monthStart(dateString: string): string {
  const d = new Date(dateString)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

// Every whole month from `start` through `end` (both 'YYYY-MM-01'), inclusive.
function monthsBetween(start: string, end: string): string[] {
  const months: string[] = []
  let cursor = new Date(start + 'T00:00:00.000Z')
  const last = new Date(end + 'T00:00:00.000Z')
  while (cursor <= last) {
    months.push(cursor.toISOString().slice(0, 10))
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }
  return months
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
  departments: { id: string; name: string; created_at: string }[]
): Promise<UnreportedMonth[]> {
  const lastReportableMonth = previousMonthStart()
  const results: UnreportedMonth[] = []

  for (const dept of departments) {
    const firstReportableMonth = monthStart(dept.created_at)
    // Department didn't exist yet for any fully-elapsed month.
    if (firstReportableMonth > lastReportableMonth) continue

    const candidateMonths = monthsBetween(firstReportableMonth, lastReportableMonth)

    const { data: existingReports } = await supabase
      .from('monthly_reports')
      .select('period_month')
      .eq('department_id', dept.id)
      .in('period_month', candidateMonths)

    const reportedMonths = new Set((existingReports ?? []).map((r) => r.period_month as string))
    const unreportedMonths = candidateMonths.filter((m) => !reportedMonths.has(m))

    for (const periodMonth of unreportedMonths) {
      const { start, end } = periodMonthRange(periodMonth)
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
  }

  return results.sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))
}
