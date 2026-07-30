import { createClient } from '@/lib/supabase/server'
import { listDepartments } from '@/lib/departments'
import { PageHeader } from '@/components/PageHeader'
import { card, input, buttonPrimary } from '@/lib/ui'
import { createDepartmentAction, archiveDepartmentAction } from './actions'

export default async function DepartmentsPage() {
  const supabase = await createClient()
  const departments = await listDepartments(supabase, { includeArchived: true })

  return (
    <>
      <PageHeader title="Departments" subtitle="Manage the organisation's department list." />

      <form action={createDepartmentAction} className={`${card} flex max-w-md items-end gap-3`}>
        <div className="flex-1">
          <label htmlFor="name" className="mb-1.5 block text-[0.8125rem] font-semibold text-ink">
            New department name
          </label>
          <input id="name" name="name" required className={input} />
        </div>
        <button type="submit" className={buttonPrimary}>
          Add
        </button>
      </form>

      <section className={`${card} mt-6 p-0`}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Name
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Status
              </th>
              <th className="w-32 px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <tr key={dept.id} className="border-b border-border last:border-0">
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink">{dept.name}</td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink-muted">
                  {dept.archived ? 'Archived' : 'Active'}
                </td>
                <td className="px-6 py-3.5 text-right">
                  {!dept.archived && (
                    <form action={archiveDepartmentAction.bind(null, dept.id)}>
                      <button
                        type="submit"
                        className="text-[0.8125rem] font-semibold text-ink-muted hover:text-signal-coral-deep"
                      >
                        Archive
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-[0.9375rem] text-ink-muted">
                  No departments yet. Add one above to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
