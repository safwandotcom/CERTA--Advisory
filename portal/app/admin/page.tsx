import Link from 'next/link'
import { Plus, ChevronRight, Users, UserCheck, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { card, buttonCoral, statusPillClass, rolePillClass } from '@/lib/ui'
import { ArchiveEmployeeButton } from './ArchiveEmployeeButton'

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const { archived } = await searchParams
  const showArchived = archived === '1'

  const supabase = await createClient()
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .eq('archived', showArchived)
    .order('employee_id')

  const staff = employees?.filter((e) => e.role !== 'admin' && e.role !== 'superadmin') ?? []
  const total = staff.length
  const active = staff.filter((e) => e.status === 'active').length
  const admins = employees?.filter((e) => e.role === 'admin' || e.role === 'superadmin').length ?? 0

  const stats = [
    { label: 'Employees', value: total, icon: Users },
    { label: 'Active', value: active, icon: UserCheck },
    { label: 'Admins', value: admins, icon: ShieldCheck },
  ]

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={
          showArchived
            ? `${total} archived ${total === 1 ? 'employee' : 'employees'}`
            : `${total} ${total === 1 ? 'person' : 'people'} across the organisation`
        }
        actions={
          <Link href="/admin/employees/new" className={buttonCoral}>
            <Plus size={16} strokeWidth={2.5} />
            New employee
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className={card}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                {stat.label}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-certa-green-tint text-certa-green-deep">
                <stat.icon size={16} strokeWidth={2} />
              </span>
            </div>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 mt-6 flex justify-end">
        <Link
          href={showArchived ? '/admin' : '/admin?archived=1'}
          className="text-[0.8125rem] font-semibold text-ink-muted hover:text-ink"
        >
          {showArchived ? '← Back to active employees' : 'Show archived employees'}
        </Link>
      </div>

      <section className={`${card} overflow-x-auto p-0`}>
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Employee ID
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Name
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Role
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Status
              </th>
              <th className="w-32 px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {employees?.map((emp) => (
              <tr key={emp.id} className="border-b border-border last:border-0">
                <td className="p-0">
                  <Link
                    href={`/admin/employees/${emp.id}`}
                    className="block px-6 py-3.5 text-[0.9375rem] font-semibold text-ink hover:text-certa-green-deep"
                  >
                    {emp.employee_id}
                  </Link>
                </td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink">{emp.name}</td>
                <td className="px-6 py-3.5">
                  <span className={rolePillClass(emp.role)}>{emp.role}</span>
                </td>
                <td className="px-6 py-3.5">
                  <span className={statusPillClass(emp.status)}>{emp.status}</span>
                </td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center justify-end gap-4">
                    {!showArchived && emp.role !== 'superadmin' && (
                      <ArchiveEmployeeButton
                        authUserId={emp.auth_user_id}
                        employeeId={emp.employee_id}
                        role={emp.role}
                        name={emp.name}
                      />
                    )}
                    <Link href={`/admin/employees/${emp.id}`} aria-label={`View ${emp.name}`}>
                      <ChevronRight size={16} strokeWidth={2} className="text-ink-muted" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {(!employees || employees.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-[0.9375rem] text-ink-muted">
                  {showArchived
                    ? 'No archived employees.'
                    : 'No employees yet. Create the first one to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
