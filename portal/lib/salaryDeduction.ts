import { isWorkingDay, toDateKey } from './companySettings'
import { computeUnexplainedAbsenceDates } from './attendance'
import type { DayPeriod } from './leaveRequests'

export function computeWorkingDaysInMonth(
  year: number,
  month: number, // 1-12
  weeklyOffDays: number[],
  holidayDates: Set<string>
): string[] {
  const days: string[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    if (isWorkingDay(date, weeklyOffDays, holidayDates)) {
      days.push(toDateKey(date))
    }
  }
  return days
}

export type ApprovedLeaveForDeduction = {
  leaveTypeId: string
  isPaid: boolean
  startDate: string
  endDate: string
  startDayPeriod: DayPeriod
  endDayPeriod: DayPeriod
  totalDays: number
  // The employee's remaining balance for this leave type, computed BEFORE
  // this specific request is counted against it: the type's allocated days
  // minus every OTHER approved/pending request of the SAME type dated
  // strictly BEFORE this one (by `startDate`; ties broken by a stable order,
  // e.g. request id). Used to split this request's days into "within quota"
  // (0 deductible) vs "over quota" (deductible) — a request can straddle
  // both.
  //
  // This must NOT be computed as "allocated minus every other request"
  // (i.e. including later requests too) — that double- or multi-counts
  // over-quota days whenever an employee has 2+ requests of the same paid
  // type in a year. Example: allocated 5, request A = 3 days, request B = 3
  // days. Under the wrong "every other request" reading, both A and B would
  // see remainingBalanceBeforeThisRequest = 5-3 = 2, giving
  // overQuota(A) = overQuota(B) = max(0, 3-2) = 1, total charged = 2 — but
  // the true over-quota is only 6-5 = 1 day. Under the correct
  // chronological-prior reading, A (first) sees remaining-before = 5 (no
  // other request precedes it) → overQuota(A) = 0, and B (second) sees
  // remaining-before = 5-3 = 2 → overQuota(B) = max(0, 3-2) = 1, giving the
  // correct total of 1.
  remainingBalanceBeforeThisRequest: number
}

export type SalaryDeductionSummary = {
  workingDaysInMonth: number
  perDayRate: number | null
  salaryNotSet: boolean
  deductibleDays: {
    unpaidLeave: number
    overQuotaPaidLeave: number
    unexplainedAbsence: number
  }
  totalDeductibleDays: number
  deductionAmount: number | null
}

export function computeSalaryDeductionSummary(input: {
  year: number
  month: number
  weeklyOffDays: number[]
  holidayDates: Set<string>
  monthlySalary: number | null
  attendedDates: Set<string>
  approvedLeaveRequests: ApprovedLeaveForDeduction[]
}): SalaryDeductionSummary {
  const workingDays = computeWorkingDaysInMonth(input.year, input.month, input.weeklyOffDays, input.holidayDates)
  const workingDaysInMonth = workingDays.length
  // Month-scoped set of working days. Checking membership in this set is
  // also what filters out weekends/holidays from deductible-day counts
  // below, and — as a side effect — clips any request that spans into an
  // adjacent month, since that month's dates are simply absent from this
  // set.
  const workingDaySet = new Set(workingDays)

  let unpaidLeave = 0
  let overQuotaPaidLeave = 0
  const leaveCoveredDates = new Set<string>()

  for (const req of input.approvedLeaveRequests) {
    // Parse as LOCAL dates (split the 'YYYY-MM-DD' string ourselves) rather
    // than `new Date(dateString)`, which parses as UTC and can shift by a
    // day depending on server timezone — the same pitfall `toDateKey`'s own
    // comment in companySettings.ts warns about.
    const [sy, sm, sd] = req.startDate.split('-').map(Number)
    const end = (() => {
      const [ey, em, ed] = req.endDate.split('-').map(Number)
      return new Date(ey, em - 1, ed)
    })()

    // Mark every calendar day of the request as leave-covered (for the
    // unexplained-absence calc below), regardless of paid/unpaid status.
    // Also accumulate this request's chargeable (working-day) total: only
    // days that are actually working days count, and weekends/holidays/
    // out-of-month days contribute 0.
    let chargeableDays = 0
    for (let t = new Date(sy, sm - 1, sd); t <= end; t.setDate(t.getDate() + 1)) {
      const key = toDateKey(t)
      leaveCoveredDates.add(key)
      if (workingDaySet.has(key)) {
        const isStart = key === req.startDate
        const isEnd = key === req.endDate && req.endDate !== req.startDate
        const isHalfDay = (isStart && req.startDayPeriod !== 'full') || (isEnd && req.endDayPeriod !== 'full')
        chargeableDays += isHalfDay ? 0.5 : 1
      }
    }

    if (!req.isPaid) {
      unpaidLeave += chargeableDays
      continue
    }
    // Paid type: first determine what fraction of the request's calendar-day
    // span is over-quota, using the same balance-based split as before.
    const overQuotaCalendarDays = Math.max(0, req.totalDays - Math.max(0, req.remainingBalanceBeforeThisRequest))
    // Then apply that same fraction to the chargeable (working-day) count.
    // This is a deliberate, documented approximation: rather than trying to
    // pinpoint exactly which specific calendar days within a request are
    // "the over-quota ones" when a request straddles both a quota boundary
    // and a weekend/holiday, we proportionally translate the calendar-day
    // over-quota fraction onto the chargeable working-day total. This tool
    // is an HR reference figure, not a payroll run, so this approximation
    // is acceptable.
    const overQuotaChargeableDays = req.totalDays > 0 ? chargeableDays * (overQuotaCalendarDays / req.totalDays) : 0
    overQuotaPaidLeave += overQuotaChargeableDays
  }

  const unexplainedAbsenceDates = computeUnexplainedAbsenceDates({
    workingDays,
    attendedDates: input.attendedDates,
    leaveCoveredDates,
  })
  const unexplainedAbsence = unexplainedAbsenceDates.length

  const totalDeductibleDays = unpaidLeave + overQuotaPaidLeave + unexplainedAbsence

  const salaryNotSet = input.monthlySalary == null
  // Guard against dividing by zero when the month has no working days at
  // all (e.g. every weekday configured as an off-day) — without this,
  // perDayRate/deductionAmount would come out as Infinity/NaN instead of
  // the intended null.
  const perDayRate =
    input.monthlySalary == null || workingDaysInMonth === 0 ? null : input.monthlySalary / workingDaysInMonth
  const deductionAmount = perDayRate === null ? null : totalDeductibleDays * perDayRate

  return {
    workingDaysInMonth,
    perDayRate,
    salaryNotSet,
    deductibleDays: { unpaidLeave, overQuotaPaidLeave, unexplainedAbsence },
    totalDeductibleDays,
    deductionAmount,
  }
}
