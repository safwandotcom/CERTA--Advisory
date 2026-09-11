export const RECOVERY_THROTTLE_MS = 2 * 60 * 1000 // 2 minutes

export function resolveRecoveryEmail(input: {
  employeePersonalEmail: string | null
  onboardingPersonalEmail: string | null
}): string | null {
  return input.employeePersonalEmail || input.onboardingPersonalEmail || null
}

export function isRecoveryThrottled(lastRequestedAt: string | null, now: Date = new Date()): boolean {
  if (!lastRequestedAt) return false
  const elapsed = now.getTime() - new Date(lastRequestedAt).getTime()
  return elapsed < RECOVERY_THROTTLE_MS
}
