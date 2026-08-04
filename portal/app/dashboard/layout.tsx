import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'
import { countUnreadNotifications } from '@/lib/notifications'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('name, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee) redirect('/login')

  const unreadCount = await countUnreadNotifications(supabase)

  return (
    <div className="flex h-screen">
      <Sidebar variant="employee" name={employee.name} roleLabel="Employee" unreadCount={unreadCount} />
      <main className="flex-1 overflow-y-auto bg-white pt-14 md:pt-0">
        <div className="mx-auto max-w-4xl px-5 py-8 sm:px-10 sm:py-10">{children}</div>
      </main>
    </div>
  )
}
