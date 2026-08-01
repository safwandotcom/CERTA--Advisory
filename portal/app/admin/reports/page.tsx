import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { card } from '@/lib/ui'
import { listProjects } from '@/lib/projects'

type ReportTask = { project_id: string | null }
type ReportStats = { statusCounts?: Record<string, number>; tasks?: ReportTask[] }

function projectNamesForReport(stats: unknown, projectNamesById: Map<string, string>): string[] {
  const tasks = (stats as ReportStats | null)?.tasks ?? []
  const names = new Set<string>()
  for (const task of tasks) {
    const name = task.project_id ? projectNamesById.get(task.project_id) : undefined
    if (name) names.add(name)
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b))
}

export default async function AdminReportsPage() {
  const supabase = await createClient()
  const [{ data: reports }, projects] = await Promise.all([
    supabase
      .from('monthly_reports')
      .select('*, employees!monthly_reports_manager_id_fkey(name)')
      .order('period_month', { ascending: false }),
    listProjects(supabase, { includeArchived: true }),
  ])
  const projectNamesById = new Map(projects.map((p) => [p.id, p.name]))

  return (
    <>
      <PageHeader title="Monthly reports" subtitle="Submitted by managers, month by month." />

      <section className={`${card} p-0`}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Projects
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Month
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Submitted by
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody>
            {(reports ?? []).map((report) => {
              const names = projectNamesForReport(report.stats, projectNamesById)
              return (
                <tr key={report.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-3.5 text-[0.9375rem] text-ink">
                    {names.length > 0 ? names.join(', ') : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="px-6 py-3.5 text-[0.9375rem] text-ink">{report.period_month.slice(0, 7)}</td>
                  <td className="px-6 py-3.5 text-[0.9375rem] text-ink">
                    {(report as unknown as { employees: { name: string } }).employees?.name}
                  </td>
                  <td className="px-6 py-3.5 text-[0.9375rem] text-ink-muted">
                    {new Date(report.submitted_at).toLocaleDateString()}
                  </td>
                </tr>
              )
            })}
            {(!reports || reports.length === 0) && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-[0.9375rem] text-ink-muted">
                  No reports submitted yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
