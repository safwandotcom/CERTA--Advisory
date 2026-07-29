import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'
import { employeeIdToEmail } from '../lib/employeeAuth'

test('an employee cannot read another employee row via the API', async () => {
  const adminClient = createAdminClient()

  const a = `rls-a-${Date.now()}`
  const b = `rls-b-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId: a,
    password: 'password-a-123',
    name: 'Employee A',
    role: 'employee',
  })
  await createEmployeeRecord(adminClient, {
    employeeId: b,
    password: 'password-b-123',
    name: 'Employee B',
    role: 'employee',
  })

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await anonClient.auth.signInWithPassword({
    email: employeeIdToEmail(a),
    password: 'password-a-123',
  })

  const { data, error } = await anonClient.from('employees').select('*').eq('employee_id', b)

  // RLS must return zero rows for another employee's data, not an error and not the row.
  expect(error).toBeNull()
  expect(data).toHaveLength(0)
})

test('an employee is redirected away from /admin in the UI', async ({ page }) => {
  const employeeId = `rls-ui-${Date.now()}`
  const adminClient = createAdminClient()
  await createEmployeeRecord(adminClient, {
    employeeId,
    password: 'password-ui-123',
    name: 'UI Employee',
    role: 'employee',
  })

  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(employeeId)
  await page.getByLabel('Password').fill('password-ui-123')
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/dashboard/)
})
