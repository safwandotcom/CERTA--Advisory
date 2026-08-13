import { describe, it, expect } from 'vitest'
import { computeWorkingDaysInMonth, computeSalaryDeductionSummary } from './salaryDeduction'

describe('computeWorkingDaysInMonth', () => {
  it('excludes weekends and holidays from August 2026', () => {
    // August 2026: 31 days. Sat/Sun off-days. 2026-08-15 is a holiday (also
    // happens to be a Saturday) — included in the weekend count already, so
    // it shouldn't be double-subtracted. Weekends in Aug 2026: 1,2,8,9,15,16,22,23,29,30 = 10 days.
    const result = computeWorkingDaysInMonth(2026, 8, [0, 6], new Set(['2026-08-15', '2026-08-19']))
    // 31 total - 10 weekend days - 1 non-weekend holiday (08-19, a Wednesday) = 20
    expect(result.length).toBe(20)
    expect(result).not.toContain('2026-08-15')
    expect(result).not.toContain('2026-08-19')
    expect(result).not.toContain('2026-08-01') // a Saturday
  })
})

describe('computeSalaryDeductionSummary', () => {
  // Spec Testing item #6: a month containing a company holiday, a weekend,
  // one approved paid-type leave within quota (not deductible), one
  // approved paid-type leave that pushes past quota (partially
  // deductible), one approved Unpaid-type leave (fully deductible), and
  // one unexplained absence.
  it('computes working days, per-day rate, and total deduction correctly for a mixed month', () => {
    // September 2026: 30 days, weekly off-days Sat/Sun.
    // Weekends: 5,6,12,13,19,20,26,27 = 8 days. One holiday: 2026-09-09 (Wed).
    // Working days = 30 - 8 - 1 = 21.
    const result = computeSalaryDeductionSummary({
      year: 2026,
      month: 9,
      weeklyOffDays: [0, 6],
      holidayDates: new Set(['2026-09-09']),
      monthlySalary: 21000, // → per-day rate = 21000 / 21 = 1000
      attendedDates: new Set(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']), // partial month attendance
      approvedLeaveRequests: [
        // Within-quota paid leave: Casual, 2 days (09-07..09-08, both full), remaining balance before this = 3 → fully within quota, 0 deductible.
        {
          leaveTypeId: 'casual', isPaid: true, startDate: '2026-09-07', endDate: '2026-09-08',
          startDayPeriod: 'full', endDayPeriod: 'full', totalDays: 2, remainingBalanceBeforeThisRequest: 3,
        },
        // Over-quota paid leave: Sick, 3 days (09-14..09-16), remaining balance before this = 1 → 1 day within quota, 2 days deductible.
        {
          leaveTypeId: 'sick', isPaid: true, startDate: '2026-09-14', endDate: '2026-09-16',
          startDayPeriod: 'full', endDayPeriod: 'full', totalDays: 3, remainingBalanceBeforeThisRequest: 1,
        },
        // Unpaid leave: fully deductible, 1 day (09-21).
        {
          leaveTypeId: 'unpaid', isPaid: false, startDate: '2026-09-21', endDate: '2026-09-21',
          startDayPeriod: 'full', endDayPeriod: 'full', totalDays: 1, remainingBalanceBeforeThisRequest: 0,
        },
      ],
    })

    // Unexplained absence: working days minus attended minus leave-covered.
    // Working days in Sept 2026 (excluding the 09-07/08, 09-14/15/16, 09-21 leave days and weekends/holiday):
    // 09-22, 09-23, 09-24, 09-25, 09-28, 09-29, 09-30 have no attendance and no leave → unexplained, EXCEPT
    // this test only asserts the totals below, not the exact date list (covered by computeUnexplainedAbsenceDates's own unit tests in lib/attendance.test.ts).

    expect(result.workingDaysInMonth).toBe(21)
    expect(result.perDayRate).toBe(1000)
    expect(result.deductibleDays.overQuotaPaidLeave).toBe(2)
    expect(result.deductibleDays.unpaidLeave).toBe(1)
    expect(result.deductibleDays.unexplainedAbsence).toBeGreaterThan(0)
    const expectedTotalDeductibleDays =
      result.deductibleDays.overQuotaPaidLeave + result.deductibleDays.unpaidLeave + result.deductibleDays.unexplainedAbsence
    expect(result.totalDeductibleDays).toBe(expectedTotalDeductibleDays)
    expect(result.deductionAmount).toBe(expectedTotalDeductibleDays * 1000)
  })

  it('shows "salary not set" instead of a number when monthlySalary is null', () => {
    const result = computeSalaryDeductionSummary({
      year: 2026,
      month: 9,
      weeklyOffDays: [0, 6],
      holidayDates: new Set(),
      monthlySalary: null,
      attendedDates: new Set(),
      approvedLeaveRequests: [],
    })
    expect(result.perDayRate).toBeNull()
    expect(result.deductionAmount).toBeNull()
    expect(result.salaryNotSet).toBe(true)
  })

  it('respects half-day modifiers in deductible-day counts', () => {
    const result = computeSalaryDeductionSummary({
      year: 2026,
      month: 9,
      weeklyOffDays: [0, 6],
      holidayDates: new Set(),
      monthlySalary: 21000,
      attendedDates: new Set(),
      approvedLeaveRequests: [
        {
          leaveTypeId: 'unpaid', isPaid: false, startDate: '2026-09-02', endDate: '2026-09-02',
          startDayPeriod: 'half_am', endDayPeriod: 'half_am', totalDays: 0.5, remainingBalanceBeforeThisRequest: 0,
        },
      ],
    })
    expect(result.deductibleDays.unpaidLeave).toBe(0.5)
  })
})
