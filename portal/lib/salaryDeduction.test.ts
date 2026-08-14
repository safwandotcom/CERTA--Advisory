import { describe, it, expect } from 'vitest'
import { computeWorkingDaysInMonth, computeSalaryDeductionSummary } from './salaryDeduction'
import { toDateKey } from './companySettings'

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
    // Working days in Sept 2026 (excluding weekends and the 09-09 holiday):
    // 01,02,03,04,07,08,10,11,14,15,16,17,18,21,22,23,24,25,28,29,30 (21 days).
    // Remove attended (01-04) and leave-covered (07,08,14,15,16,21):
    // remaining = 10,11,17,18,22,23,24,25,28,29,30 → 11 unexplained-absence dates.
    // (Hand-derived against the actual Sept 2026 calendar; the exact date
    // list is otherwise covered by computeUnexplainedAbsenceDates's own unit
    // tests in lib/attendance.test.ts — this comment exists only to justify
    // the hard-coded 11 below.)

    expect(result.workingDaysInMonth).toBe(21)
    expect(result.perDayRate).toBe(1000)
    expect(result.deductibleDays.overQuotaPaidLeave).toBe(2)
    expect(result.deductibleDays.unpaidLeave).toBe(1)
    expect(result.deductibleDays.unexplainedAbsence).toBe(11)
    expect(result.totalDeductibleDays).toBe(14)
    expect(result.deductionAmount).toBe(14000)
  })

  // Critical #1 fix verification: two approved requests of the SAME paid
  // leave type in one call must not double-count over-quota days. This test
  // constructs `remainingBalanceBeforeThisRequest` the way a correct caller
  // (Task 9, not yet built) must: chronological-prior only.
  it('does not double-count over-quota days across two same-type paid leave requests', () => {
    // Allocated 5 days of 'sick' leave for the year. Request A (earlier,
    // 2026-09-01..09-03, 3 days) is entirely within the original quota of 5,
    // so its remaining-before is 5 and it is 0 over-quota. Request B (later,
    // 2026-09-14..09-16, 3 days) sees remaining-before = 5 - 3 (consumed by
    // A) = 2, so 1 of its 3 days is over-quota. True combined over-quota:
    // 6 total days - 5 allocated = 1, matching A's 0 + B's 1.
    const result = computeSalaryDeductionSummary({
      year: 2026,
      month: 9,
      weeklyOffDays: [0, 6],
      holidayDates: new Set(),
      monthlySalary: 21000,
      attendedDates: new Set(),
      approvedLeaveRequests: [
        {
          leaveTypeId: 'sick', isPaid: true, startDate: '2026-09-01', endDate: '2026-09-03',
          startDayPeriod: 'full', endDayPeriod: 'full', totalDays: 3, remainingBalanceBeforeThisRequest: 5,
        },
        {
          leaveTypeId: 'sick', isPaid: true, startDate: '2026-09-14', endDate: '2026-09-16',
          startDayPeriod: 'full', endDayPeriod: 'full', totalDays: 3, remainingBalanceBeforeThisRequest: 2,
        },
      ],
    })
    expect(result.deductibleDays.overQuotaPaidLeave).toBe(1)
  })

  // Critical #2 fix verification: leave that spans a weekend must only be
  // charged for the working days within it, not the full calendar span.
  it('charges unpaid leave spanning a weekend only for working days, not the full calendar span', () => {
    // 2026-09-04 is a Friday, 2026-09-07 is the following Monday — a 4
    // calendar-day span that includes the weekend (09-05 Sat, 09-06 Sun).
    // Only the Friday and Monday are working days, so only 2 days should be
    // charged, not 4.
    const result = computeSalaryDeductionSummary({
      year: 2026,
      month: 9,
      weeklyOffDays: [0, 6],
      holidayDates: new Set(),
      monthlySalary: 21000,
      attendedDates: new Set(),
      approvedLeaveRequests: [
        {
          leaveTypeId: 'unpaid', isPaid: false, startDate: '2026-09-04', endDate: '2026-09-07',
          startDayPeriod: 'full', endDayPeriod: 'full', totalDays: 4, remainingBalanceBeforeThisRequest: 0,
        },
      ],
    })
    expect(result.deductibleDays.unpaidLeave).toBe(2)
  })

  // Important #3 fix verification: a month with zero working days (e.g.
  // every weekday configured as an off-day) must not produce Infinity/NaN
  // from dividing the salary by zero working days.
  it('returns a null perDayRate and deductionAmount when the month has zero working days', () => {
    const result = computeSalaryDeductionSummary({
      year: 2026,
      month: 9,
      weeklyOffDays: [0, 1, 2, 3, 4, 5, 6], // every day of the week is an off-day
      holidayDates: new Set(),
      monthlySalary: 21000,
      attendedDates: new Set(),
      approvedLeaveRequests: [],
    })
    expect(result.workingDaysInMonth).toBe(0)
    expect(result.perDayRate).toBeNull()
    expect(result.deductionAmount).toBeNull()
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

  // Important #3 fix verification: viewing the CURRENT, in-progress month
  // must not flag working days later in the month (which haven't happened
  // yet) as unexplained absence — only days up to and including today
  // (Dhaka-local, matching toDateKey) are checked. Derives "today" the same
  // way the implementation does (via toDateKey), so this test is valid on
  // any run date and under any host TZ (including the TZ=UTC verification
  // run), not just the day it was written.
  it('clamps unexplained-absence checks to today when viewing the current, in-progress month', () => {
    const todayKey = toDateKey(new Date())
    const year = Number(todayKey.slice(0, 4))
    const month = Number(todayKey.slice(5, 7))
    const dayOfMonth = Number(todayKey.slice(8, 10))
    const daysInMonth = new Date(year, month, 0).getDate()

    const result = computeSalaryDeductionSummary({
      year,
      month,
      weeklyOffDays: [], // no weekly off-days, so every calendar day is a working day
      holidayDates: new Set(),
      monthlySalary: null,
      attendedDates: new Set(),
      approvedLeaveRequests: [],
    })

    // workingDaysInMonth (the whole-month rate basis) is NOT clamped.
    expect(result.workingDaysInMonth).toBe(daysInMonth)
    // But unexplained-absence checking IS clamped to today: only days
    // 1..dayOfMonth are unattended-and-uncovered-and-in-the-past(-or-today),
    // so the count must equal dayOfMonth, not the full daysInMonth (unless
    // today happens to be the last day of the month).
    expect(result.deductibleDays.unexplainedAbsence).toBe(dayOfMonth)
  })

  // Past-month sanity check: the clamp must NOT apply outside the current
  // calendar month — every working day of a past month has already
  // happened, so the full month is checked, same as before this fix.
  it('does not clamp unexplained-absence checks for a past month', () => {
    // 2026-09 is guaranteed to be a past month relative to any date this
    // suite could plausibly run on for the foreseeable future... but to
    // stay robust indefinitely, use whichever of "last January" or a fixed
    // far-past month is actually in the past relative to real "today".
    const todayKey = toDateKey(new Date())
    const year = Number(todayKey.slice(0, 4)) - 1
    const month = 6
    const daysInMonth = new Date(year, month, 0).getDate()

    const result = computeSalaryDeductionSummary({
      year,
      month,
      weeklyOffDays: [],
      holidayDates: new Set(),
      monthlySalary: null,
      attendedDates: new Set(),
      approvedLeaveRequests: [],
    })

    expect(result.workingDaysInMonth).toBe(daysInMonth)
    expect(result.deductibleDays.unexplainedAbsence).toBe(daysInMonth)
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
