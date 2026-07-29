import { describe, it, expect } from 'vitest'
import { employeeIdToEmail } from './employeeAuth'

describe('employeeIdToEmail', () => {
  it('maps a simple numeric ID to a stable internal email', () => {
    expect(employeeIdToEmail('1023')).toBe('emp-1023@internal.certaadvisory.com')
  })

  it('lowercases and strips non-alphanumeric characters', () => {
    expect(employeeIdToEmail(' EMP-007 ')).toBe('emp-emp007@internal.certaadvisory.com')
  })

  it('throws on an ID with no alphanumeric characters', () => {
    expect(() => employeeIdToEmail('   ---   ')).toThrow()
  })
})
