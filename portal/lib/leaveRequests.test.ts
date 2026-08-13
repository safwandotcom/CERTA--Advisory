import { describe, it, expect } from 'vitest'
import { computeDayPeriodDays, computeLeaveBalance } from './leaveRequests'

describe('computeDayPeriodDays', () => {
  it('counts a single full day as 1', () => {
    expect(computeDayPeriodDays('2026-08-10', '2026-08-10', 'full', 'full')).toBe(1)
  })

  it('counts a single half day as 0.5', () => {
    expect(computeDayPeriodDays('2026-08-10', '2026-08-10', 'half_am', 'half_am')).toBe(0.5)
  })

  it('counts a 3-day range with a half first day as 2.5', () => {
    expect(computeDayPeriodDays('2026-08-10', '2026-08-12', 'half_pm', 'full')).toBe(2.5)
  })

  it('counts a 5-day range with half first and half last day as 4', () => {
    expect(computeDayPeriodDays('2026-08-10', '2026-08-14', 'half_am', 'half_pm')).toBe(4)
  })
})

describe('computeLeaveBalance', () => {
  it('nets pending and approved days against the allocation', () => {
    const result = computeLeaveBalance({
      allocatedDays: 10,
      requests: [
        { totalDays: 2, status: 'approved' },
        { totalDays: 1.5, status: 'pending' },
        { totalDays: 3, status: 'rejected' }, // rejected days don't count
        { totalDays: 1, status: 'cancelled' }, // cancelled days don't count
      ],
    })
    expect(result).toEqual({ allocated: 10, used: 3.5, remaining: 6.5 })
  })

  it('allows remaining to go negative when requests exceed allocation', () => {
    const result = computeLeaveBalance({
      allocatedDays: 2,
      requests: [{ totalDays: 5, status: 'approved' }],
    })
    expect(result).toEqual({ allocated: 2, used: 5, remaining: -3 })
  })
})
