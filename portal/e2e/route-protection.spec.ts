import { test, expect } from '@playwright/test'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'

test('redirects an unauthenticated visitor from /dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('redirects an unauthenticated visitor from /admin to /login', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})

test('a not-yet-onboarded employee is redirected to /onboarding from /dashboard', async ({ page }) => {
  const adminClient = createAdminClient()
  const employeeId = `gate-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId,
    password: 'password-gate-123',
    name: 'Gate Test Employee',
    role: 'employee',
  })

  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(employeeId)
  await page.getByLabel('Password').fill('password-gate-123')
  await page.getByRole('button', { name: /sign in/i }).click()

  // The login Server Action redirects to /dashboard, which middleware's
  // onboarding gate re-redirects to /onboarding. That second hop resolves
  // as a soft (RSC) navigation: the rendered page is correctly /onboarding,
  // but the address bar is left showing /dashboard until the next hard
  // navigation (verified: an explicit page.goto('/dashboard') below, which
  // forces middleware to re-evaluate from scratch, does update the URL
  // correctly). So we assert on the rendered page here rather than the URL.
  await expect(page.getByRole('heading', { name: /personal details/i })).toBeVisible()

  // Trying to force-navigate elsewhere still bounces back — and this hard
  // navigation is also where the URL bar itself is verified.
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/onboarding/)
})
