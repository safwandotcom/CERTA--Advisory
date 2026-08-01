import { redirect } from 'next/navigation'
import { requireEmployee } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  let caller
  try {
    caller = await requireEmployee()
  } catch {
    redirect('/login')
  }

  const isManagerOrAdmin = ['superadmin', 'admin', 'manager'].includes(caller.role)

  return (
    <div className="flex h-screen">
      <Sidebar
        variant={isManagerOrAdmin ? 'manager' : 'employee'}
        name={caller.name ?? caller.employee_id}
        roleLabel={
          caller.role === 'manager'
            ? 'Manager'
            : caller.role === 'superadmin'
              ? 'Superadmin'
              : caller.role === 'admin'
                ? 'Admin'
                : 'Employee'
        }
      />
      <main className="flex-1 overflow-y-auto bg-white pt-14 md:pt-0">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-10 sm:py-10">{children}</div>
      </main>
    </div>
  )
}
