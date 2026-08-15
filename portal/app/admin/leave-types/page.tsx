import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { card, input, label as labelClass, buttonPrimary } from '@/lib/ui'
import { listLeaveTypes, listAllocationsForEmployee } from '@/lib/leaveTypes'
import { QuotaForm } from './QuotaForm'
import { AllocationForm } from './AllocationForm'
import { SubmitButton } from '@/components/SubmitButton'

function leavePillClass(isPaid: boolean): string {
  return isPaid
    ? 'inline-flex items-center rounded-full bg-certa-green-tint px-2.5 py-1 text-xs font-semibold text-certa-green-deep'
    : 'inline-flex items-center rounded-full bg-surface-tint px-2.5 py-1 text-xs font-semibold text-ink-muted'
}

export default async function AdminLeaveTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; year?: string }>
}) {
  const { employeeId, year: yearParam } = await searchParams
  const currentYear = new Date().getFullYear()
  const year = yearParam ? Number(yearParam) : currentYear

  const supabase = await createClient()

  const [leaveTypes, { data: employees }] = await Promise.all([
    listLeaveTypes(supabase),
    supabase.from('employees').select('id, employee_id, name').eq('archived', false).order('name'),
  ])

  const allocations = employeeId ? await listAllocationsForEmployee(supabase, employeeId, year) : []
  const allocationByLeaveTypeId = new Map(allocations.map((a) => [a.leave_type_id, a.allocated_days]))

  return (
    <>
      <PageHeader
        title="Leave types"
        subtitle="Manage leave type default quotas and set per-employee leave allocations."
      />

      <section className={`${card} p-0`}>
        <div className="p-6 pb-0">
          <h2 className="font-display text-base font-semibold text-ink">Leave types</h2>
          <p className="mt-1 text-[0.8125rem] text-ink-muted">
            Default annual quota is a fallback shown to employees; per-employee allocations (below) override it.
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Name</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Paid</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                  Default annual quota
                </th>
              </tr>
            </thead>
            <tbody>
              {leaveTypes.map((lt) => (
                <tr key={lt.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-3.5 text-[0.9375rem] font-semibold text-ink">{lt.name}</td>
                  <td className="px-6 py-3.5">
                    <span className={leavePillClass(lt.is_paid)}>{lt.is_paid ? 'Paid' : 'Unpaid'}</span>
                  </td>
                  <td className="px-6 py-3.5">
                    <QuotaForm leaveTypeId={lt.id} currentQuota={lt.default_annual_quota} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={`${card} mt-6`}>
        <h2 className="font-display text-base font-semibold text-ink">Per-employee allocations</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-muted">
          Pick an employee and year to view and set that employee&apos;s leave allocation for each type.
        </p>

        <form method="get" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label htmlFor="employeeId" className={labelClass}>
              Employee
            </label>
            <select
              id="employeeId"
              name="employeeId"
              defaultValue={employeeId ?? ''}
              className={input}
            >
              <option value="" disabled>
                Select an employee
              </option>
              {(employees ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employee_id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="year" className={labelClass}>
              Year
            </label>
            <input
              id="year"
              name="year"
              type="number"
              defaultValue={year}
              className={`${input} w-28`}
            />
          </div>
          <SubmitButton pendingText="Loading…" className={buttonPrimary}>
            Load
          </SubmitButton>
        </form>

        {employeeId && (
          <div className="mt-6 overflow-hidden rounded-[10px] border border-border">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                    Leave type
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                    Allocated days ({year})
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((lt) => (
                  <tr key={lt.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3.5 text-[0.9375rem] text-ink">{lt.name}</td>
                    <td className="px-4 py-3.5">
                      <AllocationForm
                        employeeId={employeeId}
                        leaveTypeId={lt.id}
                        year={year}
                        currentAllocatedDays={allocationByLeaveTypeId.get(lt.id) ?? 0}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
