import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { card } from '@/lib/ui'
import { listPendingLeaveRequests, computeDayPeriodDays } from '@/lib/leaveRequests'
import { ReviewLeaveRow } from './ReviewLeaveRow'

function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate} – ${endDate}`
}

export default async function AdminLeaveReviewPage() {
  const supabase = await createClient()
  const requests = await listPendingLeaveRequests(supabase)

  return (
    <>
      <PageHeader title="Review leave" subtitle="Approve or reject pending leave requests." />

      <section className={`${card} p-0`}>
        {requests.length === 0 ? (
          <p className="p-6 text-[0.9375rem] text-ink-muted">No pending leave requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                    Leave type
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                    Dates
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                    Review
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-border align-top last:border-0">
                    <td className="px-6 py-4 text-[0.9375rem] font-semibold text-ink">{r.employee_name}</td>
                    <td className="px-6 py-4 text-[0.9375rem] text-ink">{r.leave_type_name}</td>
                    <td className="px-6 py-4 text-[0.8125rem] text-ink-muted">
                      {formatDateRange(r.start_date, r.end_date)}
                      <br />
                      {computeDayPeriodDays(r.start_date, r.end_date, r.start_day_period, r.end_day_period)} day(s)
                    </td>
                    <td className="px-6 py-4 max-w-[220px] text-[0.8125rem] text-ink-muted">{r.reason || '—'}</td>
                    <td className="px-6 py-4">
                      <ReviewLeaveRow requestId={r.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
