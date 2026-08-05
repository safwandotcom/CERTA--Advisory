import type { SupabaseClient } from '@supabase/supabase-js'

export type OnboardingStatus = 'not_started' | 'submitted' | 'needs_correction' | 'complete'

export type EmployeeOnboarding = {
  id: string
  employee_id: string
  status: OnboardingStatus
  date_of_birth: string | null
  fathers_name: string | null
  mothers_name: string | null
  blood_group: string | null
  phone: string | null
  personal_email: string | null
  present_address: string | null
  permanent_address: string | null
  emergency_contact_name: string | null
  emergency_contact_relationship: string | null
  emergency_contact_phone: string | null
  bank_name: string | null
  account_holder_name: string | null
  account_number: string | null
  branch_code: string | null
  national_id_path: string | null
  offer_letter_path: string | null
  photo_path: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  correction_notes: string | null
  submitted_at: string | null
}

const ONBOARDING_COLUMNS =
  'id, employee_id, status, date_of_birth, fathers_name, mothers_name, blood_group, phone, personal_email, present_address, permanent_address, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, bank_name, account_holder_name, account_number, branch_code, national_id_path, offer_letter_path, photo_path, reviewed_by, reviewed_at, correction_notes, submitted_at'

export async function getOnboarding(
  supabase: SupabaseClient,
  employeeId: string
): Promise<EmployeeOnboarding | null> {
  const { data } = await supabase
    .from('employee_onboarding')
    .select(ONBOARDING_COLUMNS)
    .eq('employee_id', employeeId)
    .single()
  return data
}

// Cross-employee write during employee creation — always called with an
// admin client, same as createEmployeeRecord() itself.
export async function createOnboardingRow(
  adminClient: SupabaseClient,
  employeeId: string
): Promise<{ error?: string }> {
  const { error } = await adminClient.from('employee_onboarding').insert({ employee_id: employeeId })
  return { error: error?.message }
}

export type OnboardingFieldsInput = {
  dateOfBirth?: string
  fathersName?: string
  mothersName?: string
  bloodGroup?: string
  phone?: string
  personalEmail?: string
  presentAddress?: string
  permanentAddress?: string
  emergencyContactName?: string
  emergencyContactRelationship?: string
  emergencyContactPhone?: string
  bankName?: string
  accountHolderName?: string
  accountNumber?: string
  branchCode?: string
}

export async function saveOnboardingFields(
  supabase: SupabaseClient,
  employeeId: string,
  fields: OnboardingFieldsInput
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('employee_onboarding')
    .update({
      date_of_birth: fields.dateOfBirth || null,
      fathers_name: fields.fathersName || null,
      mothers_name: fields.mothersName || null,
      blood_group: fields.bloodGroup || null,
      phone: fields.phone || null,
      personal_email: fields.personalEmail || null,
      present_address: fields.presentAddress || null,
      permanent_address: fields.permanentAddress || null,
      emergency_contact_name: fields.emergencyContactName || null,
      emergency_contact_relationship: fields.emergencyContactRelationship || null,
      emergency_contact_phone: fields.emergencyContactPhone || null,
      bank_name: fields.bankName || null,
      account_holder_name: fields.accountHolderName || null,
      account_number: fields.accountNumber || null,
      branch_code: fields.branchCode || null,
    })
    .eq('employee_id', employeeId)
  return { error: error?.message }
}

const REQUIRED_FIELD_KEYS: (keyof OnboardingFieldsInput)[] = [
  'dateOfBirth',
  'fathersName',
  'mothersName',
  'bloodGroup',
  'phone',
  'personalEmail',
  'presentAddress',
  'permanentAddress',
  'emergencyContactName',
  'emergencyContactRelationship',
  'emergencyContactPhone',
  'bankName',
  'accountHolderName',
  'accountNumber',
  'branchCode',
]

export function findMissingOnboardingFields(
  fields: OnboardingFieldsInput,
  documents: { nationalIdPath: string | null; offerLetterPath: string | null; photoPath: string | null }
): string[] {
  const missing: string[] = []
  for (const key of REQUIRED_FIELD_KEYS) {
    if (!fields[key]) missing.push(key)
  }
  if (!documents.nationalIdPath) missing.push('nationalId')
  if (!documents.offerLetterPath) missing.push('offerLetter')
  if (!documents.photoPath) missing.push('photo')
  return missing
}

export async function submitOnboarding(supabase: SupabaseClient, employeeId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('employee_onboarding')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('employee_id', employeeId)
  return { error: error?.message }
}

// Cross-employee write (admin reviewing someone else's row) — admin client.
export async function markOnboardingComplete(
  adminClient: SupabaseClient,
  employeeId: string,
  reviewerId: string
): Promise<{ error?: string }> {
  const { error } = await adminClient
    .from('employee_onboarding')
    .update({
      status: 'complete',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      correction_notes: null,
    })
    .eq('employee_id', employeeId)
  return { error: error?.message }
}

export async function requestOnboardingCorrection(
  adminClient: SupabaseClient,
  employeeId: string,
  reviewerId: string,
  note: string
): Promise<{ error?: string }> {
  const { error } = await adminClient
    .from('employee_onboarding')
    .update({
      status: 'needs_correction',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      correction_notes: note,
    })
    .eq('employee_id', employeeId)
  return { error: error?.message }
}
