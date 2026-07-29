import { test, expect } from '@playwright/test'

test('admin creates a new employee', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.goto('/admin/employees/new')
  const newId = `test-${Date.now()}`
  await page.getByLabel('Employee ID').fill(newId)
  await page.getByLabel('Full name').fill('Test Employee')
  await page.getByLabel('Initial password').fill('temporary-password-123')
  await page.getByRole('button', { name: /create employee/i }).click()

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByText(newId)).toBeVisible()
})
