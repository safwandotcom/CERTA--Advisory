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
  // this specific request is counted against it (i.e. allocated minus every
  // OTHER approved/pending request for the same type/year). Used to split
  // this request's days into "within quota" (0 deductible) vs "over quota"
  // (deductible) — a request can straddle both.
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

  let unpaidLeave = 0
  let overQuotaPaidLeave = 0
  const leaveCoveredDates = new Set<string>()

  for (const req of input.approvedLeaveRequests) {
    // Mark every calendar day of the request as leave-covered (for the
    // unexplained-absence calc below), regardless of paid/unpaid status.
    const start = new Date(req.startDate)
    const end = new Date(req.endDate)
    for (let t = new Date(start); t <= end; t.setDate(t.getDate() + 1)) {
      leaveCoveredDates.add(toDateKey(t))
    }

    if (!req.isPaid) {
      unpaidLeave += req.totalDays
      continue
    }
    // Paid type: only the portion beyond the remaining balance is deductible.
    const overQuota = Math.max(0, req.totalDays - Math.max(0, req.remainingBalanceBeforeThisRequest))
    overQuotaPaidLeave += overQuota
  }

  const unexplainedAbsenceDates = computeUnexplainedAbsenceDates({
    workingDays,
    attendedDates: input.attendedDates,
    leaveCoveredDates,
  })
  const unexplainedAbsence = unexplainedAbsenceDates.length

  const totalDeductibleDays = unpaidLeave + overQuotaPaidLeave + unexplainedAbsence

  const salaryNotSet = input.monthlySalary === null
  const perDayRate = salaryNotSet ? null : (input.monthlySalary as number) / workingDaysInMonth
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
