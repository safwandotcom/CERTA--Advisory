import { test, expect } from '@playwright/test'

test('a logged-in employee sees their own profile on /dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /sign in/i }).click()
  // The seeded account is an admin, so it lands on /admin — navigate to /dashboard directly.
  await page.goto('/dashboard')
  await expect(page.getByText(process.env.SEED_ADMIN_NAME ?? 'Admin')).toBeVisible()
})
