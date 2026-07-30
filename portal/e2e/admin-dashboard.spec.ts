import { test, expect } from '@playwright/test'

test('admin sees the full employee list on /admin', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/admin/)
  await expect(
    page.getByRole('link', { name: process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001', exact: true })
  ).toBeVisible()
})
