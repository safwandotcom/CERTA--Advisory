import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { card } from '@/lib/ui'
import { listLeaveTypes, listAllocationsForEmployee } from '@/lib/leaveTypes'
import {
  listLeaveRequestsForEmployee,
  computeDayPeriodDays,
  computeLeaveBalance,
  type LeaveRequestStatus,
} from '@/lib/leaveRequests'
import LeaveRequestForm, { CancelRequestButton } from './LeaveRequestForm'

function leaveStatusPillClass(status: LeaveRequestStatus): string {
  switch (status) {
    case 'approved':
      return 'inline-flex items-center rounded-full bg-certa-green-tint px-2.5 py-1 text-xs font-semibold text-certa-green-deep'
    case 'rejected':
      return 'inline-flex items-center rounded-full border border-signal-coral bg-white px-2.5 py-1 text-xs font-semibold text-signal-coral-deep'
    case 'cancelled':
      return 'inline-flex items-center rounded-full bg-surface-tint px-2.5 py-1 text-xs font-semibold text-ink-muted'
    default:
      return 'inline-flex items-center rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-ink'
  }
}

function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate} – ${endDate}`
}

export default async function LeavePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('id, name')
    .eq('auth_user_id', user!.id)
    .single()

  const currentYear = new Date().getFullYear()

  const [leaveTypes, allocations, requests] = await Promise.all([
    listLeaveTypes(supabase),
    listAllocationsForEmployee(supabase, employee!.id, currentYear),
    listLeaveRequestsForEmployee(supabase, employee!.id),
  ])

  const allocationByLeaveTypeId = new Map(allocations.map((a) => [a.leave_type_id, a.allocated_days]))
  const leaveTypeById = new Map(leaveTypes.map((lt) => [lt.id, lt]))

  const balances: Record<string, { allocated: number; used: number; remaining: number }> = {}
  for (const lt of leaveTypes) {
    const requestsForType = requests
      .filter((r) => r.leave_type_id === lt.id)
      .map((r) => ({
        totalDays: computeDayPeriodDays(r.start_date, r.end_date, r.start_day_period, r.end_day_period),
        status: r.status,
      }))
    balances[lt.id] = computeLeaveBalance({
      allocatedDays: allocationByLeaveTypeId.get(lt.id) ?? 0,
      requests: requestsForType,
    })
  }

  return (
    <>
      <PageHeader title="Leave" subtitle="Submit leave requests and track your balance." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {leaveTypes.map((lt) => {
          const balance = balances[lt.id]
          return (
            <div key={lt.id} className={card}>
              <p className="text-[0.8125rem] font-semibold text-ink-muted">{lt.name}</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{balance.remaining}</p>
              <p className="mt-1 text-[0.8125rem] text-ink-muted">
                {balance.used} used of {balance.allocated}
              </p>
            </div>
          )
        })}
      </div>

      <section className={`${card} mt-6`}>
        <h2 className="font-display text-base font-semibold text-ink">Request leave</h2>
        <LeaveRequestForm leaveTypes={leaveTypes} balances={balances} />
      </section>

      <section className={`${card} mt-6`}>
        <h2 className="font-display text-base font-semibold text-ink">Your requests</h2>

        {requests.length === 0 ? (
          <p className="mt-4 text-[0.9375rem] text-ink-muted">No leave requests yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-[0.9375rem] font-semibold text-ink">
                    {leaveTypeById.get(r.leave_type_id)?.name ?? 'Leave'}
                  </p>
                  <p className="text-[0.8125rem] text-ink-muted">
                    {formatDateRange(r.start_date, r.end_date)} ·{' '}
                    {computeDayPeriodDays(r.start_date, r.end_date, r.start_day_period, r.end_day_period)} day(s)
                  </p>
                  {r.reason && <p className="mt-1 text-[0.8125rem] text-ink-muted">{r.reason}</p>}
                  {r.status === 'rejected' && r.review_note && (
                    <p className="mt-1 text-[0.8125rem] text-signal-coral-deep">Note: {r.review_note}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={leaveStatusPillClass(r.status)}>{r.status}</span>
                  {r.status === 'pending' && <CancelRequestButton requestId={r.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
