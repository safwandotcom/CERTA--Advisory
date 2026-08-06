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
  const { data, error } = await supabase
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
    .select('id')

  if (error) return { error: error.message }
  // RLS silently filters the row out (wrong status, or — pre-migration-0014
  // — no row at all) rather than raising: no error, zero rows. Without this
  // check the caller sees `{}` and reports success even though nothing
  // landed. See final-review Finding 4.
  if (!data || data.length === 0) return { error: 'This form is no longer editable' }
  return {}
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

// Takes an admin client, not the caller's own RLS-scoped client, even though
// this writes the employee's OWN row: the submit write must also clear
// correction_notes (spec: "Resubmitting clears correction_notes"), and
// enforce_onboarding_self_edit_columns() (0011/0013) unconditionally rejects
// any employee-originated change to correction_notes, including clearing it
// back to null on a resubmit-after-correction. A null auth.uid() (service
// role) is treated the same as public.is_admin() by that trigger (0013), so
// the admin client is what makes this write possible at all past the first
// submit. The status gate itself (not_started/needs_correction only) is
// still enforced upstream, by saveOrSubmitOnboardingAction's unconditional
// saveOnboardingFields() call (RLS-scoped, run before this) returning an
// error and short-circuiting before submitOnboarding is ever reached.
export async function submitOnboarding(
  adminClient: SupabaseClient,
  employeeId: string
): Promise<{ error?: string }> {
  const { data, error } = await adminClient
    .from('employee_onboarding')
    .update({ status: 'submitted', submitted_at: new Date().toISOString(), correction_notes: null })
    .eq('employee_id', employeeId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'This form is no longer editable' }
  return {}
}

// Cross-employee write (admin reviewing someone else's row) — admin client.
export async function markOnboardingComplete(
  adminClient: SupabaseClient,
  employeeId: string,
  reviewerId: string
): Promise<{ error?: string }> {
  const { data, error } = await adminClient
    .from('employee_onboarding')
    .update({
      status: 'complete',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      correction_notes: null,
    })
    .eq('employee_id', employeeId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Onboarding record not found' }
  return {}
}

export async function requestOnboardingCorrection(
  adminClient: SupabaseClient,
  employeeId: string,
  reviewerId: string,
  note: string
): Promise<{ error?: string }> {
  const { data, error } = await adminClient
    .from('employee_onboarding')
    .update({
      status: 'needs_correction',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      correction_notes: note,
    })
    .eq('employee_id', employeeId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Onboarding record not found' }
  return {}
}
