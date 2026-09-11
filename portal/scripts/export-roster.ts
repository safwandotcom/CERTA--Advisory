// Exports a local-only snapshot of every employee/admin account to
// internal/employee-roster.md. Never commit this file's output — it holds
// real names, roles, and contact info. See internal/ in .gitignore.
//
// Run after creating, editing, or archiving any employee so the local
// roster stays in sync with Supabase:
//
//   npm run roster:export

import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { createAdminClient } from '../lib/supabase/admin'
import { resolveRecoveryEmail } from '../lib/passwordRecovery'

type Row = {
  id: string
  employee_id: string
  name: string
  role: string
  status: string
  contact_info: string | null
  personal_email: string | null
  position: string | null
  join_date: string | null
  created_at: string
  auth_user_id: string
  departments: { name: string } | { name: string }[] | null
}

function departmentName(departments: Row['departments']): string {
  if (!departments) return ''
  return Array.isArray(departments) ? (departments[0]?.name ?? '') : departments.name
}

async function main() {
  const admin = createAdminClient()

  const { data: employees, error } = await admin
    .from('employees')
    .select(
      'id, employee_id, name, role, status, contact_info, personal_email, position, join_date, created_at, auth_user_id, departments(name)'
    )
    .order('role', { ascending: true })
    .order('employee_id', { ascending: true })

  if (error || !employees) {
    throw new Error(`Failed to fetch employees: ${error?.message}`)
  }

  const { data: usersList, error: usersError } = await admin.auth.admin.listUsers({ perPage: 200 })
  if (usersError) {
    throw new Error(`Failed to fetch auth users: ${usersError.message}`)
  }
  const emailByAuthId = new Map((usersList?.users ?? []).map((u) => [u.id, u.email ?? '']))

  const { data: onboardingRows, error: onboardingError } = await admin
    .from('employee_onboarding')
    .select('employee_id, personal_email')
  if (onboardingError) {
    throw new Error(`Failed to fetch onboarding records: ${onboardingError.message}`)
  }

  const onboardingEmailByEmployeeRowId = new Map(
    (onboardingRows ?? []).map((o) => [o.employee_id, o.personal_email as string | null])
  )

  const rows = (employees as Row[]).map((e) => ({
    employeeId: e.employee_id,
    name: e.name,
    role: e.role,
    status: e.status,
    authEmail: emailByAuthId.get(e.auth_user_id) ?? '',
    department: departmentName(e.departments),
    contactInfo: e.contact_info ?? '',
    recoveryEmail:
      resolveRecoveryEmail({
        employeePersonalEmail: e.personal_email,
        onboardingPersonalEmail: onboardingEmailByEmployeeRowId.get(e.id) ?? null,
      }) ?? '',
    position: e.position ?? '',
    joinDate: e.join_date ?? '',
    createdAt: e.created_at,
  }))

  const header = [
    'Employee ID (login)',
    'Name',
    'Role',
    'Status',
    'Department',
    'Contact info',
    'Recovery email',
    'Position',
    'Join date',
    'Auth email',
    'Created at',
  ]
  const lines = [
    '# CERTA& Portal — Employee Roster',
    '',
    '> Local-only snapshot, not committed to git (see internal/ in .gitignore).',
    `> Generated ${new Date().toISOString()} by \`npm run roster:export\`.`,
    `> Re-run that command after creating, editing, or archiving any employee.`,
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows.map((r) =>
      `| ${r.employeeId} | ${r.name} | ${r.role} | ${r.status} | ${r.department} | ${r.contactInfo} | ${r.recoveryEmail} | ${r.position} | ${r.joinDate} | ${r.authEmail} | ${r.createdAt} |`
    ),
    '',
    `Total: ${rows.length} accounts`,
    '',
  ]

  const outDir = path.resolve(__dirname, '..', 'internal')
  mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'employee-roster.md')
  writeFileSync(outPath, lines.join('\n'), 'utf8')

  console.log(`Wrote ${rows.length} accounts to ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
