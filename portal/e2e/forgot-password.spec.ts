import { test, expect } from '@playwright/test'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'

test('shows the same generic message for a real Employee ID with no recovery email and a nonexistent one', async ({
  page,
}) => {
  // No personal_email set and no onboarding row completed, so neither
  // request actually triggers a Resend call -- safe to run in CI.
  const employeeId = `no-recovery-email-${Date.now()}`
  const adminClient = createAdminClient()
  await createEmployeeRecord(adminClient, {
    employeeId,
    password: 'password-no-recovery-123',
    name: 'No Recovery Email',
    role: 'employee',
  })

  await page.goto('/forgot-password')
  await page.getByLabel('Employee ID').fill(employeeId)
  await page.getByRole('button', { name: /send reset link/i }).click()
  const realIdMessage = await page.getByText(/if that employee id has a recovery email on file/i).textContent()

  await page.goto('/forgot-password')
  await page.getByLabel('Employee ID').fill(`does-not-exist-${Date.now()}`)
  await page.getByRole('button', { name: /send reset link/i }).click()
  const fakeIdMessage = await page.getByText(/if that employee id has a recovery email on file/i).textContent()

  expect(realIdMessage).toBe(fakeIdMessage)
})

test('resets a password end to end via a recovery link', async ({ page }) => {
  // Throwaway employee, never the seeded admin -- see the identical caution
  // in e2e/admin-edit-employee.spec.ts.
  const employeeId = `recovery-target-${Date.now()}`
  const adminClient = createAdminClient()
  const { employeeRowId } = await createEmployeeRecord(adminClient, {
    employeeId,
    password: 'original-password-123',
    name: 'Recovery Target',
    role: 'employee',
  })
  await adminClient
    .from('employees')
    .update({ personal_email: 'recovery-target@example.com' })
    .eq('id', employeeRowId)

  // Generated directly via the admin client, mirroring exactly what
  // requestPasswordRecoveryAction does server-side -- this avoids sending a
  // real email through Resend during the test run.
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: `emp-${employeeId.toLowerCase().replace(/[^a-z0-9]/g, '')}@internal.certaadvisory.com`,
  })
  expect(linkError).toBeNull()

  await page.goto(`/auth/confirm?token_hash=${linkData!.properties.hashed_token}&type=recovery&next=/reset-password`)
  await expect(page).toHaveURL(/\/reset-password/)

  await page.getByLabel('New password').fill('brand-new-recovered-password-789')
  await page.getByRole('button', { name: /save new password/i }).click()
  await expect(page).toHaveURL(/\/login\?reset=success/)
  await expect(page.getByText(/password updated/i)).toBeVisible()

  await page.getByLabel('Employee ID').fill(employeeId)
  await page.getByLabel('Password').fill('brand-new-recovered-password-789')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/dashboard|\/onboarding/)
})

test('an expired or invalid recovery link redirects back to forgot-password with a notice', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=not-a-real-token&type=recovery&next=/reset-password')
  await expect(page).toHaveURL(/\/forgot-password\?error=expired/)
})
