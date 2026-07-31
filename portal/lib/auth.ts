import { createClient } from '@/lib/supabase/server'

export type AuthorizedEmployee = {
  id: string
  auth_user_id: string
  employee_id: string
  name: string
  role: 'superadmin' | 'admin' | 'manager' | 'employee'
  status: 'active' | 'inactive'
}

// Deliberately generic: never leak whether the caller was unauthenticated,
// missing an employee row, or simply not authorized. Same principle as the
// generic login error.
export const NOT_AUTHORIZED = 'Not authorized'

async function loadCallerOrThrow(): Promise<AuthorizedEmployee> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error(NOT_AUTHORIZED)
  }

  const { data: employee, error } = await supabase
    .from('employees')
    .select('id, auth_user_id, employee_id, name, role, status')
    .eq('auth_user_id', user.id)
    .single()

  if (error || !employee || employee.status !== 'active') {
    throw new Error(NOT_AUTHORIZED)
  }

  return employee as AuthorizedEmployee
}

/**
 * Guard for admin-only Server Actions and route handlers. Accepts both
 * `admin` and `superadmin` — see requireSuperAdmin() for the narrower check.
 */
export async function requireAdmin(): Promise<AuthorizedEmployee> {
  const employee = await loadCallerOrThrow()
  if (employee.role !== 'admin' && employee.role !== 'superadmin') {
    throw new Error(NOT_AUTHORIZED)
  }
  return employee
}

/**
 * Guard for the one superadmin-only action in this app: granting the
 * `admin` role to a new account.
 */
export async function requireSuperAdmin(): Promise<AuthorizedEmployee> {
  const employee = await loadCallerOrThrow()
  if (employee.role !== 'superadmin') {
    throw new Error(NOT_AUTHORIZED)
  }
  return employee
}

/**
 * Guard for the /manager section: superadmin and admin can view it
 * unscoped (RLS returns every department for them); a manager sees only
 * their own department(s) via is_manager_of() in the underlying queries.
 */
export async function requireManagerOrAdmin(): Promise<AuthorizedEmployee> {
  const employee = await loadCallerOrThrow()
  if (!['superadmin', 'admin', 'manager'].includes(employee.role)) {
    throw new Error(NOT_AUTHORIZED)
  }
  return employee
}
