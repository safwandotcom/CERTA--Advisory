// lib/companySettings.test.ts
import { describe, it, expect } from 'vitest'
import { parseWeeklyOffDays, isWorkingDay } from './companySettings'

describe('parseWeeklyOffDays', () => {
  it('parses comma-separated weekday abbreviations into JS getDay() numbers', () => {
    expect(parseWeeklyOffDays('sat,sun')).toEqual([6, 0])
  })

  it('handles whitespace and mixed case', () => {
    expect(parseWeeklyOffDays(' Fri , Sat ')).toEqual([5, 6])
  })

  it('returns an empty array for an empty string', () => {
    expect(parseWeeklyOffDays('')).toEqual([])
  })
})

describe('isWorkingDay', () => {
  const holidays = new Set(['2026-12-16'])

  it('returns false for a weekly off-day', () => {
    // 2026-08-15 is a Saturday
    expect(isWorkingDay(new Date('2026-08-15'), [6, 0], holidays)).toBe(false)
  })

  it('returns false for a holiday even if not a weekly off-day', () => {
    // 2026-12-16 is a Wednesday
    expect(isWorkingDay(new Date('2026-12-16'), [6, 0], holidays)).toBe(false)
  })

  it('returns true for an ordinary weekday with no holiday', () => {
    // 2026-08-12 is a Wednesday
    expect(isWorkingDay(new Date('2026-08-12'), [6, 0], holidays)).toBe(true)
  })
})
