'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { employeeIdToEmail } from '@/lib/employeeAuth'

export type LoginState = { error?: string }

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const employeeId = String(formData.get('employeeId') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!employeeId || !password) {
    return { error: 'Invalid Employee ID or password' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: employeeIdToEmail(employeeId),
    password,
  })

  if (error || !data.user) {
    return { error: 'Invalid Employee ID or password' }
  }

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('role, status')
    .eq('auth_user_id', data.user.id)
    .single()

  if (employeeError || !employee || !employee.role) {
    await supabase.auth.signOut()
    return { error: 'Invalid Employee ID or password' }
  }

  // Deactivated accounts must not be able to sign in. Same generic error as a
  // bad password — don't reveal that the account exists but is inactive.
  if (employee.status !== 'active') {
    await supabase.auth.signOut()
    return { error: 'Invalid Employee ID or password' }
  }

  const target =
    employee.role === 'superadmin' || employee.role === 'admin'
      ? '/admin'
      : employee.role === 'manager'
        ? '/manager'
        : '/dashboard'

  redirect(target)
}
