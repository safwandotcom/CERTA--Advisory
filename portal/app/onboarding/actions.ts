'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEmployee, NOT_AUTHORIZED } from '@/lib/auth'
import {
  saveOnboardingFields,
  submitOnboarding,
  getOnboarding,
  findMissingOnboardingFields,
  type OnboardingFieldsInput,
} from '@/lib/onboarding'
import { notifyEmployees, listActiveAdminIds } from '@/lib/notifications'

export type OnboardingActionState = { error?: string; success?: string }

export async function saveOrSubmitOnboardingAction(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  let employee
  try {
    employee = await requireEmployee()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const supabase = await createClient()

  const fields: OnboardingFieldsInput = {
    dateOfBirth: String(formData.get('dateOfBirth') ?? ''),
    fathersName: String(formData.get('fathersName') ?? ''),
    mothersName: String(formData.get('mothersName') ?? ''),
    bloodGroup: String(formData.get('bloodGroup') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    personalEmail: String(formData.get('personalEmail') ?? ''),
    presentAddress: String(formData.get('presentAddress') ?? ''),
    permanentAddress: String(formData.get('permanentAddress') ?? ''),
    emergencyContactName: String(formData.get('emergencyContactName') ?? ''),
    emergencyContactRelationship: String(formData.get('emergencyContactRelationship') ?? ''),
    emergencyContactPhone: String(formData.get('emergencyContactPhone') ?? ''),
    bankName: String(formData.get('bankName') ?? ''),
    accountHolderName: String(formData.get('accountHolderName') ?? ''),
    accountNumber: String(formData.get('accountNumber') ?? ''),
    branchCode: String(formData.get('branchCode') ?? ''),
  }

  const { error: saveError } = await saveOnboardingFields(supabase, employee.id, fields)
  if (saveError) return { error: saveError }

  revalidatePath('/onboarding')

  const intent = formData.get('intent')
  if (intent !== 'submit') {
    return { success: 'Progress saved' }
  }

  const onboarding = await getOnboarding(supabase, employee.id)
  const missing = findMissingOnboardingFields(fields, {
    nationalIdPath: onboarding?.national_id_path ?? null,
    offerLetterPath: onboarding?.offer_letter_path ?? null,
    photoPath: onboarding?.photo_path ?? null,
  })

  if (missing.length > 0) {
    return { error: `Please complete: ${missing.join(', ')}` }
  }

  const { error: submitError } = await submitOnboarding(supabase, employee.id)
  if (submitError) return { error: submitError }

  const adminClient = createAdminClient()
  const adminIds = await listActiveAdminIds(adminClient)
  await notifyEmployees(adminClient, adminIds, {
    title: `New onboarding submission: ${employee.name}`,
    link: `/admin/employees/${employee.id}`,
  })

  redirect('/dashboard')
}

const UPLOAD_SLOT_FILE_NAMES = {
  national_id: 'national-id',
  offer_letter: 'offer-letter',
  photo: 'photo',
} as const

const UPLOAD_SLOT_COLUMNS = {
  national_id: 'national_id_path',
  offer_letter: 'offer_letter_path',
  photo: 'photo_path',
} as const

const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export async function uploadOnboardingDocumentAction(
  slot: keyof typeof UPLOAD_SLOT_FILE_NAMES,
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  let employee
  try {
    employee = await requireEmployee()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { error: 'Choose a file first' }
  }
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return { error: 'Only PDF, JPG, or PNG files are allowed' }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: 'File must be 5MB or smaller' }
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const filePath = `${employee.id}/${UPLOAD_SLOT_FILE_NAMES[slot]}.${ext}`

  const supabase = await createClient()

  const { error: uploadError } = await supabase.storage
    .from('onboarding-documents')
    .upload(filePath, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { error: dbError } = await supabase
    .from('employee_onboarding')
    .update({ [UPLOAD_SLOT_COLUMNS[slot]]: filePath })
    .eq('employee_id', employee.id)

  if (dbError) return { error: dbError.message }

  revalidatePath('/onboarding')
  return { success: 'Uploaded' }
}
