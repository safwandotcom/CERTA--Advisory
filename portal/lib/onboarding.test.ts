import { describe, expect, it } from 'vitest'
import { findMissingOnboardingFields, type OnboardingFieldsInput } from './onboarding'

const COMPLETE_FIELDS: OnboardingFieldsInput = {
  dateOfBirth: '1990-01-01',
  fathersName: 'Father Name',
  mothersName: 'Mother Name',
  bloodGroup: 'O+',
  phone: '01700000000',
  personalEmail: 'person@example.com',
  presentAddress: '123 Present St',
  permanentAddress: '456 Permanent Rd',
  emergencyContactName: 'Contact Name',
  emergencyContactRelationship: 'Sibling',
  emergencyContactPhone: '01800000000',
  bankName: 'Test Bank',
  accountHolderName: 'Account Holder',
  accountNumber: '00112233',
  branchCode: 'BR001',
}

const COMPLETE_DOCS = { nationalIdPath: 'emp-1/national-id.pdf', offerLetterPath: 'emp-1/offer-letter.pdf', photoPath: 'emp-1/photo.jpg' }

describe('findMissingOnboardingFields', () => {
  it('returns an empty array when every field and document is present', () => {
    expect(findMissingOnboardingFields(COMPLETE_FIELDS, COMPLETE_DOCS)).toEqual([])
  })

  it('lists a missing text field by its key', () => {
    const fields = { ...COMPLETE_FIELDS, bloodGroup: '' }
    expect(findMissingOnboardingFields(fields, COMPLETE_DOCS)).toContain('bloodGroup')
  })

  it('lists missing documents by name', () => {
    const docs = { nationalIdPath: null, offerLetterPath: null, photoPath: COMPLETE_DOCS.photoPath }
    const missing = findMissingOnboardingFields(COMPLETE_FIELDS, docs)
    expect(missing).toContain('nationalId')
    expect(missing).toContain('offerLetter')
    expect(missing).not.toContain('photo')
  })
})
