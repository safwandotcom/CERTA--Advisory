import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// The portal has no public landing page — the root just routes you to the
// right place based on whether you're signed in and what role you hold.
export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  const target =
    employee?.role === 'superadmin' || employee?.role === 'admin'
      ? '/admin'
      : employee?.role === 'manager'
        ? '/projects'
        : '/dashboard'

  redirect(target)
}
