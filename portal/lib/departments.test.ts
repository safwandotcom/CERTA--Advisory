import { describe, it, expect } from 'vitest'
import { parseManagedDepartmentIds } from './departments'

describe('parseManagedDepartmentIds', () => {
  it('returns all values for a repeated form field', () => {
    const fd = new FormData()
    fd.append('managedDepartmentIds', 'dept-1')
    fd.append('managedDepartmentIds', 'dept-2')
    expect(parseManagedDepartmentIds(fd)).toEqual(['dept-1', 'dept-2'])
  })

  it('returns an empty array when the field is absent', () => {
    const fd = new FormData()
    expect(parseManagedDepartmentIds(fd)).toEqual([])
  })

  it('returns a single-element array for one checked box', () => {
    const fd = new FormData()
    fd.append('managedDepartmentIds', 'dept-1')
    expect(parseManagedDepartmentIds(fd)).toEqual(['dept-1'])
  })
})
