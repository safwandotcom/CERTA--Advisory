import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOutAction } from '@/app/actions'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .order('employee_id')

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Employees</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/employees/new" className="border px-3 py-1">
            + New employee
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="border px-3 py-1">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <table className="mt-4 w-full text-left">
        <thead>
          <tr>
            <th>Employee ID</th>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {employees?.map((emp) => (
            <tr key={emp.id}>
              <td>
                <Link href={`/admin/employees/${emp.id}`}>{emp.employee_id}</Link>
              </td>
              <td>{emp.name}</td>
              <td>{emp.role}</td>
              <td>{emp.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
