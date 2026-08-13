import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { card, input, label as labelClass, buttonPrimary } from '@/lib/ui'
import { listAttendanceInRange, type AttendanceRecord } from '@/lib/attendance'
import {
  getCompanySetting,
  parseWeeklyOffDays,
  isWorkingDay,
  listCompanyHolidays,
  toDateKey,
} from '@/lib/companySettings'

// Parses a `?month=YYYY-MM` search param into a calendar year/month pair,
// falling back to the current month when absent or malformed.
function parseMonthParam(month: string | undefined): { year: number; monthIndex: number } {
  if (month) {
    const match = /^(\d{4})-(\d{2})$/.exec(month)
    if (match) {
      const year = Number(match[1])
      const monthIndex = Number(match[2]) - 1
      if (monthIndex >= 0 && monthIndex <= 11) return { year, monthIndex }
    }
  }
  const now = new Date()
  return { year: now.getFullYear(), monthIndex: now.getMonth() }
}

function monthParam(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatHoursWorked(clockInAt: string, clockOutAt: string | null): string {
  if (!clockOutAt) return '—'
  const totalMinutes = Math.max(0, Math.round((new Date(clockOutAt).getTime() - new Date(clockInAt).getTime()) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

function dayTypePillClass(isNonWorking: boolean): string {
  return isNonWorking
    ? 'inline-flex items-center rounded-full bg-surface-tint px-2.5 py-1 text-xs font-semibold text-ink-muted'
    : 'inline-flex items-center rounded-full bg-certa-green-tint px-2.5 py-1 text-xs font-semibold text-certa-green-deep'
}

type TimesheetRow = {
  dateKey: string
  weekdayLabel: string
  dayTypeLabel: string
  isNonWorking: boolean
  record: AttendanceRecord | undefined
}

// Builds one row per calendar day in the given month.
function buildTimesheetRows(
  year: number,
  monthIndex: number,
  records: AttendanceRecord[],
  weeklyOffDays: number[],
  holidayNameByDate: Map<string, string>
): TimesheetRow[] {
  const recordByDate = new Map(records.map((r) => [r.date, r]))
  const holidayDates = new Set(holidayNameByDate.keys())
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  return Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, monthIndex, i + 1)
    const dateKey = toDateKey(date)
    const working = isWorkingDay(date, weeklyOffDays, holidayDates)
    const holidayName = holidayNameByDate.get(dateKey)
    const dayTypeLabel = holidayName ? `Holiday (${holidayName})` : working ? 'Working day' : 'Weekend'

    return {
      dateKey,
      weekdayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayTypeLabel,
      isNonWorking: !working,
      record: recordByDate.get(dateKey),
    }
  })
}

function TimesheetTable({ rows }: { rows: TimesheetRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Date</th>
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Day</th>
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Clock in</th>
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Clock out</th>
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Hours worked
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.dateKey} className="border-b border-border last:border-0">
              <td className="px-6 py-3.5 text-[0.9375rem] text-ink">
                {row.dateKey} <span className="text-ink-muted">({row.weekdayLabel})</span>
              </td>
              <td className="px-6 py-3.5">
                <span className={dayTypePillClass(row.isNonWorking)}>{row.dayTypeLabel}</span>
              </td>
              <td className="px-6 py-3.5 text-[0.8125rem] text-ink-muted">
                {row.record ? formatTime(row.record.clock_in_at) : '—'}
              </td>
              <td className="px-6 py-3.5 text-[0.8125rem] text-ink-muted">
                {row.record ? formatTime(row.record.clock_out_at) : '—'}
              </td>
              <td className="px-6 py-3.5 text-[0.8125rem] text-ink-muted">
                {row.record ? formatHoursWorked(row.record.clock_in_at, row.record.clock_out_at) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MonthNav({
  basePath,
  employeeId,
  year,
  monthIndex,
}: {
  basePath: string
  employeeId: string
  year: number
  monthIndex: number
}) {
  const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const prev = new Date(year, monthIndex - 1, 1)
  const next = new Date(year, monthIndex + 1, 1)

  return (
    <div className="mb-4 flex items-center justify-between">
      <Link
        href={`${basePath}?employeeId=${employeeId}&month=${monthParam(prev.getFullYear(), prev.getMonth())}`}
        className="text-[0.8125rem] font-semibold text-ink-muted hover:text-ink"
      >
        ← Previous
      </Link>
      <h2 className="font-display text-base font-semibold text-ink">{monthLabel}</h2>
      <Link
        href={`${basePath}?employeeId=${employeeId}&month=${monthParam(next.getFullYear(), next.getMonth())}`}
        className="text-[0.8125rem] font-semibold text-ink-muted hover:text-ink"
      >
        Next →
      </Link>
    </div>
  )
}

export default async function AdminTimesheetPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; month?: string }>
}) {
  const { employeeId, month } = await searchParams
  const { year, monthIndex } = parseMonthParam(month)

  const supabase = await createClient()

  const { data: employees } = await supabase
    .from('employees')
    .select('id, employee_id, name')
    .eq('archived', false)
    .order('name')

  let rows: TimesheetRow[] = []
  if (employeeId) {
    const firstOfMonth = toDateKey(new Date(year, monthIndex, 1))
    const lastOfMonth = toDateKey(new Date(year, monthIndex + 1, 0))

    const [records, weeklyOffSetting, holidays] = await Promise.all([
      listAttendanceInRange(supabase, employeeId, firstOfMonth, lastOfMonth),
      getCompanySetting(supabase, 'weekly_off_days'),
      listCompanyHolidays(supabase),
    ])

    const weeklyOffDays = parseWeeklyOffDays(weeklyOffSetting ?? '')
    const holidayNameByDate = new Map(holidays.map((h) => [h.date, h.name]))
    rows = buildTimesheetRows(year, monthIndex, records, weeklyOffDays, holidayNameByDate)
  }

  return (
    <>
      <PageHeader title="Timesheet" subtitle="View any employee's attendance for a given month." />

      <div className={card}>
        <form method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
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
          <input type="hidden" name="month" value={monthParam(year, monthIndex)} />
          <button type="submit" className={buttonPrimary}>
            Load
          </button>
        </form>
      </div>

      {employeeId && (
        <section className={`${card} mt-6 p-0`}>
          <div className="p-6 pb-0">
            <MonthNav basePath="/admin/timesheet" employeeId={employeeId} year={year} monthIndex={monthIndex} />
          </div>
          <div className="mt-4">
            <TimesheetTable rows={rows} />
          </div>
        </section>
      )}
    </>
  )
}
