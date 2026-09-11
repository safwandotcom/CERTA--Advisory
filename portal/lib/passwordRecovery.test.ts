import { describe, it, expect } from 'vitest'
import { resolveRecoveryEmail, isRecoveryThrottled, RECOVERY_THROTTLE_MS } from './passwordRecovery'

describe('resolveRecoveryEmail', () => {
  it('prefers the employee-set personal email over the onboarding one', () => {
    expect(
      resolveRecoveryEmail({
        employeePersonalEmail: 'admin@example.com',
        onboardingPersonalEmail: 'onboarding@example.com',
      })
    ).toBe('admin@example.com')
  })

  it('falls back to the onboarding email when the employee one is not set', () => {
    expect(
      resolveRecoveryEmail({ employeePersonalEmail: null, onboardingPersonalEmail: 'onboarding@example.com' })
    ).toBe('onboarding@example.com')
  })

  it('returns null when neither source has an email', () => {
    expect(resolveRecoveryEmail({ employeePersonalEmail: null, onboardingPersonalEmail: null })).toBeNull()
  })

  it('treats an empty string as not set', () => {
    expect(
      resolveRecoveryEmail({ employeePersonalEmail: '', onboardingPersonalEmail: 'onboarding@example.com' })
    ).toBe('onboarding@example.com')
  })
})

describe('isRecoveryThrottled', () => {
  it('is not throttled when there is no prior request', () => {
    expect(isRecoveryThrottled(null, new Date('2026-01-01T00:00:00Z'))).toBe(false)
  })

  it('is throttled just inside the window', () => {
    const last = new Date('2026-01-01T00:00:00Z')
    const now = new Date(last.getTime() + RECOVERY_THROTTLE_MS - 1000)
    expect(isRecoveryThrottled(last.toISOString(), now)).toBe(true)
  })

  it('is not throttled once the window has fully elapsed', () => {
    const last = new Date('2026-01-01T00:00:00Z')
    const now = new Date(last.getTime() + RECOVERY_THROTTLE_MS + 1000)
    expect(isRecoveryThrottled(last.toISOString(), now)).toBe(false)
  })
})
