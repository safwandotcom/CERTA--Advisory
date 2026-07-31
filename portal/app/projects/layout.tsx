import { redirect } from 'next/navigation'
import { requireManagerOrAdmin } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  let caller
  try {
    caller = await requireManagerOrAdmin()
  } catch {
    redirect('/login')
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        variant="manager"
        name={caller.name ?? caller.employee_id}
        roleLabel={caller.role === 'manager' ? 'Manager' : caller.role === 'superadmin' ? 'Superadmin' : 'Admin'}
      />
      <main className="flex-1 overflow-y-auto bg-white pt-14 md:pt-0">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-10 sm:py-10">{children}</div>
      </main>
    </div>
  )
}
