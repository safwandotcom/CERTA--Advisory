import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskStatus } from './tasks'

export type UnreportedMonth = {
  managerId: string
  periodMonth: string // 'YYYY-MM-01'
  statusCounts: Record<TaskStatus, number>
  taskCount: number
  projectNames: string[]
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
// period — without this bound, every report re-counts the manager's entire
// task history, and since stats are an immutable JSONB snapshot (unique per
// manager+period), a wrong count is permanent.
export function periodMonthRange(periodMonth: string): { start: string; end: string } {
  const start = new Date(periodMonth + 'T00:00:00.000Z')
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  return { start: periodMonth, end: end.toISOString().slice(0, 10) }
}

export async function getUnreportedPriorMonths(
  supabase: SupabaseClient,
  managerId: string,
  managerCreatedAt: string,
  projects: { id: string; name: string }[]
): Promise<UnreportedMonth[]> {
  const lastReportableMonth = previousMonthStart()
  const firstReportableMonth = monthStart(managerCreatedAt)
  if (firstReportableMonth > lastReportableMonth) return []

  const candidateMonths = monthsBetween(firstReportableMonth, lastReportableMonth)

  const { data: existingReports } = await supabase
    .from('monthly_reports')
    .select('period_month')
    .eq('manager_id', managerId)
    .in('period_month', candidateMonths)

  const reportedMonths = new Set((existingReports ?? []).map((r) => r.period_month as string))
  const unreportedMonths = candidateMonths.filter((m) => !reportedMonths.has(m))

  const results: UnreportedMonth[] = []
  for (const periodMonth of unreportedMonths) {
    const { start, end } = periodMonthRange(periodMonth)
    const projectIds = projects.map((p) => p.id)
    const { data: tasks } = projectIds.length
      ? await supabase
          .from('tasks')
          .select('status, project_id, department_id, departments(name)')
          .in('project_id', projectIds)
          .gte('created_at', start)
          .lt('created_at', end)
      : { data: [] }

    const statusCounts: Record<TaskStatus, number> = { NEW: 0, STARTED: 0, PENDING: 0, COMPLETED: 0 }
    for (const t of tasks ?? []) statusCounts[t.status as TaskStatus] += 1

    results.push({
      managerId,
      periodMonth,
      statusCounts,
      taskCount: tasks?.length ?? 0,
      projectNames: projects.map((p) => p.name),
    })
  }

  return results.sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))
}
