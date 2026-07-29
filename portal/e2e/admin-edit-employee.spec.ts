import { test, expect } from '@playwright/test'

test('admin edits an employee and resets their password', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.goto('/admin')
  await page.getByText(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001').click()

  await page.getByLabel('Position').fill('Senior Accountant')
  await page.getByRole('button', { name: /save/i }).click()
  await expect(page.getByLabel('Position')).toHaveValue('Senior Accountant')

  await page.getByLabel('New password').fill('brand-new-password-456')
  await page.getByRole('button', { name: /reset password/i }).click()
  await expect(page.getByText(/password reset/i)).toBeVisible()
})
