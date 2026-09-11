'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { employeeIdToEmail } from '@/lib/employeeAuth'
import { resolveRecoveryEmail, isRecoveryThrottled } from '@/lib/passwordRecovery'
import { sendRecoveryEmail } from '@/lib/email'

export type ForgotPasswordState = { success?: string }

// Always the same message regardless of outcome -- an attacker must not be
// able to tell a real Employee ID from a fake one, or one with a recovery
// email on file from one without. See spec: "No account enumeration".
const GENERIC_MESSAGE = "If that Employee ID has a recovery email on file, we've sent a reset link."

const SITE_URL = 'https://portal.certaadvisory.com'

export async function requestPasswordRecoveryAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const employeeId = String(formData.get('employeeId') ?? '').trim()

  if (!employeeId) {
    return { success: GENERIC_MESSAGE }
  }

  try {
    const admin = createAdminClient()

    // Escape ILIKE/PostgREST wildcards (%, _, *) in the user's input so this
    // stays a literal case-insensitive match, not a wildcard pattern that
    // could match an unrelated real account.
    const escapedEmployeeId = employeeId.replace(/[%_*]/g, '\\$&')

    const { data: employee } = await admin
      .from('employees')
      .select('id, employee_id, personal_email, last_recovery_requested_at')
      .ilike('employee_id', escapedEmployeeId)
      .eq('status', 'active')
      .maybeSingle()

    if (!employee) {
      return { success: GENERIC_MESSAGE }
    }

    const { data: onboarding } = await admin
      .from('employee_onboarding')
      .select('personal_email')
      .eq('employee_id', employee.id)
      .maybeSingle()

    const recoveryEmail = resolveRecoveryEmail({
      employeePersonalEmail: employee.personal_email,
      onboardingPersonalEmail: onboarding?.personal_email ?? null,
    })

    if (!recoveryEmail || isRecoveryThrottled(employee.last_recovery_requested_at)) {
      return { success: GENERIC_MESSAGE }
    }

    const authEmail = employeeIdToEmail(employee.employee_id)

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: authEmail,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('generateLink failed for password recovery:', linkError?.message)
      return { success: GENERIC_MESSAGE }
    }

    const resetLink = `${SITE_URL}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=recovery&next=/reset-password`

    // Stamp the throttle right after a successful generateLink call (the
    // sensitive, rate-limit-bypassing operation) rather than after the email
    // send -- otherwise an unconfigured/failing email provider means the
    // throttle never engages and generateLink can be called without limit.
    const { error: throttleError } = await admin
      .from('employees')
      .update({ last_recovery_requested_at: new Date().toISOString() })
      .eq('id', employee.id)

    if (throttleError) {
      console.error('Failed to stamp last_recovery_requested_at:', throttleError.message)
    }

    const { error: emailError } = await sendRecoveryEmail(recoveryEmail, resetLink)
    if (emailError) {
      console.error('sendRecoveryEmail failed:', emailError)
      return { success: GENERIC_MESSAGE }
    }
  } catch (err) {
    console.error('requestPasswordRecoveryAction failed:', err)
  }

  return { success: GENERIC_MESSAGE }
}
