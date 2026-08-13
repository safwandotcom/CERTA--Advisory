import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { card, input, label as labelClass, buttonPrimary } from '@/lib/ui'
import { buildSalaryDeductionSummary } from '@/lib/salaryDeductionData'

// Rounds to 2 decimal places — used for both money amounts (currency
// precision) and day counts (fine enough for half-day, and even the
// proportional over-quota split's fractional-day results, without showing
// long floating-point tails like 1.4285714285713).
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// `Intl.NumberFormat('en-BD', ...)` is not guaranteed to be supported in
// every Node runtime (depends on which ICU data is bundled). Guard it and
// fall back to a plain "amount BDT" string if it throws, rather than
// crashing the page.
function formatBDT(amount: number): string {
  const rounded = round2(amount)
  try {
    return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(rounded)
  } catch {
    return `${rounded.toFixed(2)} BDT`
  }
}

function formatDays(value: number): string {
  // JS's default number-to-string conversion already shows the minimal
  // number of decimals needed (5 -> "5", 1.5 -> "1.5", 1.43 -> "1.43"), so
  // rounding to 2 decimals first is enough to avoid long floating-point
  // tails like "1.4285714285713" while still reading naturally for whole
  // and half-day counts.
  return String(round2(value))
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function parseYearMonth(
  yearParam: string | undefined,
  monthParam: string | undefined
): { year: number; month: number } | null {
  if (!yearParam || !monthParam) return null
  const year = Number(yearParam)
  const month = Number(monthParam)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

export default async function AdminSalaryDeductionPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; year?: string; month?: string }>
}) {
  const { employeeId, year: yearParam, month: monthParam } = await searchParams
  const now = new Date()
  const defaultYear = now.getFullYear()
  const defaultMonth = now.getMonth() + 1
  const yearMonth = parseYearMonth(yearParam, monthParam)

  const supabase = await createClient()

  const { data: employees } = await supabase
    .from('employees')
    .select('id, employee_id, name')
    .eq('archived', false)
    .order('name')

  const summary =
    employeeId && yearMonth
      ? await buildSalaryDeductionSummary(supabase, employeeId, yearMonth.year, yearMonth.month)
      : null

  const selectedEmployee = (employees ?? []).find((e) => e.id === employeeId)

  return (
    <>
      <PageHeader
        title="Salary deduction"
        subtitle="Estimate a month's deductible days and amount for an employee, based on attendance and leave records. This is a reference figure, not a payroll run."
      />

      <div className={card}>
        <form method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div>
            <label htmlFor="employeeId" className={labelClass}>
              Employee
            </label>
            <select id="employeeId" name="employeeId" defaultValue={employeeId ?? ''} className={input}>
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
              defaultValue={yearMonth?.year ?? defaultYear}
              className={`${input} w-28`}
            />
          </div>
          <div>
            <label htmlFor="month" className={labelClass}>
              Month
            </label>
            <select
              id="month"
              name="month"
              defaultValue={String(yearMonth?.month ?? defaultMonth)}
              className={`${input} w-40`}
            >
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonPrimary}>
            Load
          </button>
        </form>
      </div>

      {employeeId && yearMonth && summary && (
        <section className={`${card} mt-6`}>
          <h2 className="font-display text-base font-semibold text-ink">
            {selectedEmployee?.name ?? 'Employee'} — {MONTH_LABELS[yearMonth.month - 1]} {yearMonth.year}
          </h2>

          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Working days in month
              </dt>
              <dd className="mt-1 text-[0.9375rem] font-semibold text-ink">{summary.workingDaysInMonth}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Per-day rate</dt>
              <dd className="mt-1 text-[0.9375rem] font-semibold text-ink">
                {summary.salaryNotSet || summary.perDayRate === null ? 'Salary not set' : formatBDT(summary.perDayRate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Total deductible days
              </dt>
              <dd className="mt-1 text-[0.9375rem] font-semibold text-ink">{formatDays(summary.totalDeductibleDays)}</dd>
            </div>
          </dl>

          <div className="mt-6 overflow-hidden rounded-[10px] border border-border">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                    Deduction category
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Days</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-4 py-3.5 text-[0.9375rem] text-ink">Unpaid leave</td>
                  <td className="px-4 py-3.5 text-[0.9375rem] text-ink">
                    {formatDays(summary.deductibleDays.unpaidLeave)}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-3.5 text-[0.9375rem] text-ink">Over-quota paid leave</td>
                  <td className="px-4 py-3.5 text-[0.9375rem] text-ink">
                    {formatDays(summary.deductibleDays.overQuotaPaidLeave)}
                  </td>
                </tr>
                <tr className="border-b border-border last:border-0">
                  <td className="px-4 py-3.5 text-[0.9375rem] text-ink">Unexplained absence</td>
                  <td className="px-4 py-3.5 text-[0.9375rem] text-ink">
                    {formatDays(summary.deductibleDays.unexplainedAbsence)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3.5 text-[0.9375rem] font-semibold text-ink">Total</td>
                  <td className="px-4 py-3.5 text-[0.9375rem] font-semibold text-ink">
                    {formatDays(summary.totalDeductibleDays)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <dl className="mt-6">
            <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Estimated deduction amount
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold text-ink">
              {summary.salaryNotSet || summary.deductionAmount === null
                ? 'Salary not set'
                : formatBDT(summary.deductionAmount)}
            </dd>
          </dl>
        </section>
      )}
    </>
  )
}
