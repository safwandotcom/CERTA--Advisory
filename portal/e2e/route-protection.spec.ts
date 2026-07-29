import { test, expect } from '@playwright/test'

test('redirects an unauthenticated visitor from /dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('redirects an unauthenticated visitor from /admin to /login', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})
