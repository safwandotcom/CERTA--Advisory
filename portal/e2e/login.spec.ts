import { test, expect } from '@playwright/test'

test('rejects an invalid Employee ID / password', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill('9999999')
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByText('Invalid Employee ID or password')).toBeVisible()
})

test('logs in a seeded admin and redirects to /admin', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/admin/)
})
