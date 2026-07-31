import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { card } from '@/lib/ui'

export default async function AdminReportsPage() {
  const supabase = await createClient()
  const { data: reports } = await supabase
    .from('monthly_reports')
    .select('*, departments(name), employees!monthly_reports_manager_id_fkey(name)')
    .order('period_month', { ascending: false })

  return (
    <>
      <PageHeader title="Monthly reports" subtitle="Submitted by managers, department by department." />

      <section className={`${card} p-0`}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Department
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
            {(reports ?? []).map((report) => (
              <tr key={report.id} className="border-b border-border last:border-0">
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink">
                  {(report as unknown as { departments: { name: string } }).departments?.name}
                </td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink">{report.period_month.slice(0, 7)}</td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink">
                  {(report as unknown as { employees: { name: string } }).employees?.name}
                </td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink-muted">
                  {new Date(report.submitted_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
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
