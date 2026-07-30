import { createClient } from '@/lib/supabase/server'

export type AuthorizedEmployee = {
  id: string
  auth_user_id: string
  employee_id: string
  role: 'admin' | 'employee'
  status: 'active' | 'inactive'
}

// Deliberately generic: never leak whether the caller was unauthenticated,
// missing an employee row, or simply not an admin. Same principle as the
// generic login error.
export const NOT_AUTHORIZED = 'Not authorized'

/**
 * Guard for admin-only Server Actions and route handlers.
 *
 * Server Actions are reachable by direct POST to the action endpoint regardless
 * of which page renders their trigger, and several admin actions use the
 * service-role client (which bypasses RLS entirely), so an in-code check here is
 * the only real authorization boundary for them. Middleware is defence in depth
 * on top of this, not a replacement for it.
 *
 * Throws with a generic message when the caller is not an active admin.
 */
export async function requireAdmin(): Promise<AuthorizedEmployee> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error(NOT_AUTHORIZED)
  }

  const { data: employee, error } = await supabase
    .from('employees')
    .select('id, auth_user_id, employee_id, role, status')
    .eq('auth_user_id', user.id)
    .single()

  if (error || !employee || employee.role !== 'admin' || employee.status !== 'active') {
    throw new Error(NOT_AUTHORIZED)
  }

  return employee as AuthorizedEmployee
}
