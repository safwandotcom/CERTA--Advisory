import { test, expect } from '@playwright/test'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'

test('admin edits an employee and resets their password', async ({ page }) => {
  // Edit a throwaway employee, never the seeded admin itself — resetting the
  // seeded admin's own password would invalidate SEED_ADMIN_PASSWORD and break
  // every other spec in the suite for the rest of the run.
  const employeeId = `edit-target-${Date.now()}`
  const adminClient = createAdminClient()
  await createEmployeeRecord(adminClient, {
    employeeId,
    password: 'password-edit-123',
    name: 'Edit Target',
    role: 'employee',
  })

  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.goto('/admin')
  await page.getByText(employeeId).click()

  await page.getByLabel('Position').fill('Senior Accountant')
  await page.getByRole('button', { name: /save/i }).click()
  await expect(page.getByLabel('Position')).toHaveValue('Senior Accountant')

  await page.getByLabel('New password').fill('brand-new-password-456')
  await page.getByRole('button', { name: /reset password/i }).click()
  await expect(page.getByText(/password reset/i)).toBeVisible()
})
