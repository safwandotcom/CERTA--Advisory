import { test, expect } from '@playwright/test'

test('preloader overlay resolves (never stays stuck) across portal navigation', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/admin/)

  // includeHidden is required: Playwright's role locator excludes elements
  // that are currently aria-hidden="true" from the accessibility tree by
  // default (per ARIA tree exclusion rules), but this overlay toggles
  // aria-hidden between "true" and "false" as its own visibility signal —
  // without includeHidden the locator would never find it in its hidden
  // (steady) state.
  //
  // No `name` filter: browsers compute an empty accessible name for an
  // aria-hidden="true" element (confirmed via a throwaway debug spec — the
  // element is present with includeHidden but `name: /loading/i` matched 0
  // elements while hidden), so a name-based filter would only ever match
  // the overlay's momentary visible state. The app has exactly one
  // `role="status"` element (portal/components/RouteTransitionOverlay.tsx),
  // so the role alone is unambiguous here.
  const overlay = page.getByRole('status', { includeHidden: true })
  await expect(overlay).toHaveAttribute('aria-hidden', 'true')

  await page.getByRole('link', { name: 'Departments' }).click()
  await expect(page).toHaveURL(/\/admin\/departments/)
  await expect(overlay).toHaveAttribute('aria-hidden', 'true')

  await page.getByRole('link', { name: 'Reports' }).click()
  await expect(page).toHaveURL(/\/admin\/reports/)
  await expect(overlay).toHaveAttribute('aria-hidden', 'true')

  await page.getByRole('link', { name: 'Employees', exact: true }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(overlay).toHaveAttribute('aria-hidden', 'true')
})
