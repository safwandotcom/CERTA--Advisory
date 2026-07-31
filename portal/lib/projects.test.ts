import { describe, expect, it } from 'vitest'
import { parseProjectMemberIds } from './projects'

describe('parseProjectMemberIds', () => {
  it('extracts all memberIds values from FormData', () => {
    const formData = new FormData()
    formData.append('memberIds', 'a')
    formData.append('memberIds', 'b')
    expect(parseProjectMemberIds(formData)).toEqual(['a', 'b'])
  })

  it('returns an empty array when none are present', () => {
    expect(parseProjectMemberIds(new FormData())).toEqual([])
  })
})
