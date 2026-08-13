import type { SupabaseClient } from '@supabase/supabase-js'
import { getCompanySetting, listCompanyHolidays, parseWeeklyOffDays, toDateKey } from './companySettings'
import { listAttendanceInRange } from './attendance'
import { getMonthlySalary } from './employeeSalary'
import { computeSalaryDeductionSummary, type SalaryDeductionSummary } from './salaryDeduction'
import { computeDayPeriodDays, type DayPeriod, type LeaveRequestStatus } from './leaveRequests'

type YearScopedLeaveRequest = {
  id: string
  leave_type_id: string
  start_date: string
  end_date: string
  start_day_period: DayPeriod
  end_day_period: DayPeriod
  status: LeaveRequestStatus
}

// Leave quota is a calendar-year concept (allocations are stored one row
// per employee/leave-type/year), so `remainingBalanceBeforeThisRequest` for
// any given request must always be computed from the pool of
// approved/pending requests AND the allocation row for the calendar year of
// that request's OWN start_date — never from whatever year the admin
// happens to be viewing. Fetched lazily per distinct start year (almost
// always just the viewed year, occasionally one prior year for a
// December-into-January request) and cached so each year is only queried
// once.
async function fetchYearLeaveData(
  supabase: SupabaseClient,
  employeeId: string,
  year: number
): Promise<{ requests: YearScopedLeaveRequest[]; allocationByType: Map<string, number> }> {
  const [{ data: requests }, { data: allocations }] = await Promise.all([
    supabase
      .from('leave_requests')
      .select('id, leave_type_id, start_date, end_date, start_day_period, end_day_period, status')
      .eq('employee_id', employeeId)
      .gte('start_date', `${year}-01-01`)
      .lte('start_date', `${year}-12-31`)
      .in('status', ['approved', 'pending']),
    supabase
      .from('leave_allocations')
      .select('leave_type_id, allocated_days')
      .eq('employee_id', employeeId)
      .eq('year', year),
  ])
  return {
    requests: (requests ?? []) as YearScopedLeaveRequest[],
    allocationByType: new Map((allocations ?? []).map((a) => [a.leave_type_id, a.allocated_days])),
  }
}

// This is the DB-fetching glue between Task 4/Task 7's data-access functions
// and Task 8's pure `computeSalaryDeductionSummary` calculator. It is kept
// separate from `lib/salaryDeduction.ts` so that file stays 100%
// pure/dependency-free and trivially testable.
export async function buildSalaryDeductionSummary(
  supabase: SupabaseClient,
  employeeId: string,
  year: number,
  month: number
): Promise<SalaryDeductionSummary> {
  const weeklyOffDaysRaw = (await getCompanySetting(supabase, 'weekly_off_days')) ?? 'sat,sun'
  const weeklyOffDays = parseWeeklyOffDays(weeklyOffDaysRaw)
  const holidays = await listCompanyHolidays(supabase)
  const holidayDates = new Set(holidays.map((h) => h.date))

  const firstOfMonth = toDateKey(new Date(year, month - 1, 1))
  const lastOfMonth = toDateKey(new Date(year, month, 0))

  const attendance = await listAttendanceInRange(supabase, employeeId, firstOfMonth, lastOfMonth)
  const attendedDates = new Set(attendance.map((a) => a.date))

  const monthlySalary = await getMonthlySalary(supabase, employeeId)

  // Approved leave requests overlapping this month, found by a pure
  // date-range overlap query with NO year restriction — a request that
  // starts in the prior calendar year (e.g. 2025-12-28 -> 2026-01-05) must
  // still surface when viewing January 2026, even though its start_date
  // isn't in that year. (A year-scoped query here would silently drop such
  // requests, so their leave days would wrongly count as unexplained
  // absence instead of approved leave — the December-starting/into-next-
  // January case is the one direction a year-scoped `start_date` filter
  // can't see.) The overlap condition alone is sufficient to bound this to
  // the handful of requests actually touching this month.
  const { data: monthOverlapRequestsRaw } = await supabase
    .from('leave_requests')
    .select('id, leave_type_id, start_date, end_date, start_day_period, end_day_period, status, leave_types(is_paid)')
    .eq('employee_id', employeeId)
    .eq('status', 'approved')
    .lte('start_date', lastOfMonth)
    .gte('end_date', firstOfMonth)
  const monthOverlapRequests = monthOverlapRequestsRaw ?? []

  // Per-year request pool + allocation map, fetched lazily and cached per
  // distinct calendar year encountered (see fetchYearLeaveData's doc
  // comment above for why this must be keyed by each request's own
  // start_date year, not the viewed `year`).
  const yearDataCache = new Map<number, ReturnType<typeof fetchYearLeaveData>>()
  function getYearData(y: number) {
    let cached = yearDataCache.get(y)
    if (!cached) {
      cached = fetchYearLeaveData(supabase, employeeId, y)
      yearDataCache.set(y, cached)
    }
    return cached
  }

  // Each request pairs with the employee's remaining balance for that
  // leave type computed chronologically: allocated days (for the calendar
  // year of THIS request's own start_date) minus every OTHER
  // approved/pending request of the SAME type, dated strictly BEFORE this
  // one within that same year's pool (ties broken by request id), per Task
  // 8's ApprovedLeaveForDeduction contract. This is deliberately NOT
  // "allocated minus every other request" (which would include later
  // requests too and double-/multi-count over-quota days whenever an
  // employee has 2+ requests of the same paid type in a year — see the
  // worked example in salaryDeduction.ts's doc comment).
  const approvedLeaveRequests = await Promise.all(
    monthOverlapRequests.map(async (r) => {
      // start_date/end_date are passed straight through from the Supabase
      // response, unmodified — PostgREST serializes Postgres `date` columns
      // as 'YYYY-MM-DD', which is exactly what computeSalaryDeductionSummary
      // (via computeDayPeriodDays and its own local-date parsing) requires.
      // No .toISOString()/`new Date(...).toString()` reformatting here.
      const totalDays = computeDayPeriodDays(r.start_date, r.end_date, r.start_day_period, r.end_day_period)
      const startYear = Number(r.start_date.slice(0, 4))
      const { requests: yearRequests, allocationByType } = await getYearData(startYear)
      const allocated = allocationByType.get(r.leave_type_id) ?? 0
      const usedByOthersBefore = yearRequests
        .filter(
          (other) =>
            other.leave_type_id === r.leave_type_id &&
            (other.start_date < r.start_date || (other.start_date === r.start_date && other.id < r.id))
        )
        .reduce(
          (sum, other) => sum + computeDayPeriodDays(other.start_date, other.end_date, other.start_day_period, other.end_day_period),
          0
        )
      return {
        leaveTypeId: r.leave_type_id,
        isPaid: (r.leave_types as unknown as { is_paid: boolean })?.is_paid ?? true,
        startDate: r.start_date,
        endDate: r.end_date,
        startDayPeriod: r.start_day_period,
        endDayPeriod: r.end_day_period,
        totalDays,
        remainingBalanceBeforeThisRequest: allocated - usedByOthersBefore,
      }
    })
  )

  return computeSalaryDeductionSummary({
    year,
    month,
    weeklyOffDays,
    holidayDates,
    monthlySalary,
    attendedDates,
    approvedLeaveRequests,
  })
}
