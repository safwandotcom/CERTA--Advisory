import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'

async function main() {
  const employeeId = process.env.SEED_ADMIN_EMPLOYEE_ID
  const password = process.env.SEED_ADMIN_PASSWORD
  const name = process.env.SEED_ADMIN_NAME ?? 'Admin'

  if (!employeeId || !password) {
    throw new Error(
      'Set SEED_ADMIN_EMPLOYEE_ID and SEED_ADMIN_PASSWORD env vars before running this script'
    )
  }

  const adminClient = createAdminClient()
  const { employeeRowId } = await createEmployeeRecord(adminClient, {
    employeeId,
    password,
    name,
    role: 'admin',
  })

  console.log(`Created admin employee row ${employeeRowId} for Employee ID ${employeeId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
