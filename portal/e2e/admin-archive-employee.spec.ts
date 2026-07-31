import { test, expect } from '@playwright/test'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'

// Uses a throwaway `admin`-role account rather than the seeded superadmin:
// app/admin/layout.tsx and app/login/actions.ts currently gate on
// `role === 'admin'` only (not 'superadmin'), a pre-existing mismatch with
// lib/auth.ts's requireAdmin() which accepts both. That's outside this
// task's scope, but it means the seeded superadmin can't reach /admin
// through the browser at all right now — a throwaway admin sidesteps it.
test('admin archives an employee behind a password confirmation', async ({ page }) => {
  const adminEmployeeId = `archive-admin-${Date.now()}`
  const adminPassword = 'admin-password-archive-123'
  const adminClient = createAdminClient()
  await createEmployeeRecord(adminClient, {
    employeeId: adminEmployeeId,
    password: adminPassword,
    name: 'Archive Test Admin',
    role: 'admin',
  })

  const targetEmployeeId = `archive-target-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId: targetEmployeeId,
    password: 'password-archive-123',
    name: 'Archive Target',
    role: 'employee',
  })

  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(adminEmployeeId)
  await page.getByLabel('Password').fill(adminPassword)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/admin/)

  await page.goto('/admin')
  await page.getByText(targetEmployeeId).click()

  // Wrong password is rejected and the employee stays active.
  await page.getByLabel('Your password').fill('definitely-not-the-right-password')
  await page.getByRole('button', { name: /archive employee/i }).click()
  await expect(page.getByText(/incorrect password/i)).toBeVisible()

  // Correct (the admin's own) password archives the employee and redirects home.
  await page.getByLabel('Your password').fill(adminPassword)
  await page.getByRole('button', { name: /archive employee/i }).click()
  await expect(page).toHaveURL(/\/admin$/)

  // Gone from the default active list...
  await expect(page.getByText(targetEmployeeId)).not.toBeVisible()

  // ...but visible under "Show archived employees".
  await page.getByRole('link', { name: /show archived employees/i }).click()
  await expect(page).toHaveURL(/\/admin\?archived=1/)
  await expect(page.getByText(targetEmployeeId)).toBeVisible()

  // The archived employee can no longer log in.
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(targetEmployeeId)
  await page.getByLabel('Password').fill('password-archive-123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByText('Invalid Employee ID or password')).toBeVisible()

  // Log back in as the throwaway admin to confirm the superadmin can't be archived.
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(adminEmployeeId)
  await page.getByLabel('Password').fill(adminPassword)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/admin/)

  const { data: superadmin } = await adminClient
    .from('employees')
    .select('id')
    .eq('role', 'superadmin')
    .limit(1)
    .single()

  if (superadmin) {
    await page.goto(`/admin/employees/${superadmin.id}`)
    await expect(page.getByRole('heading', { name: 'Archive employee' })).not.toBeVisible()
  }
})
