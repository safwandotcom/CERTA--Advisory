// lib/attendance.test.ts
import { describe, it, expect } from 'vitest'
import { computeUnexplainedAbsenceDates } from './attendance'

describe('computeUnexplainedAbsenceDates', () => {
  it('flags a working day with no attendance row and no approved leave as unexplained absence', () => {
    const result = computeUnexplainedAbsenceDates({
      workingDays: ['2026-08-10', '2026-08-11', '2026-08-12'],
      attendedDates: new Set(['2026-08-10']),
      leaveCoveredDates: new Set(['2026-08-12']),
    })
    expect(result).toEqual(['2026-08-11'])
  })

  it('returns an empty array when every working day is covered', () => {
    const result = computeUnexplainedAbsenceDates({
      workingDays: ['2026-08-10', '2026-08-11'],
      attendedDates: new Set(['2026-08-10']),
      leaveCoveredDates: new Set(['2026-08-11']),
    })
    expect(result).toEqual([])
  })
})
