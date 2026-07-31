import { createClient } from '@/lib/supabase/server'
import { requireManagerOrAdmin } from '@/lib/auth'
import { listDepartments, listManagedDepartmentIds } from '@/lib/departments'
import { listTasksForDepartments } from '@/lib/tasks'
import { getUnreportedPriorMonths } from '@/lib/reports'
import { PageHeader } from '@/components/PageHeader'
import { MonthlyReportModal } from '@/components/MonthlyReportModal'
import { card } from '@/lib/ui'
import AssignTaskForm from './AssignTaskForm'
import TaskStatusSelect from './TaskStatusSelect'

export default async function ManagerPage() {
  const caller = await requireManagerOrAdmin()
  const supabase = await createClient()

  const allDepartments = await listDepartments(supabase)
  const managedIds =
    caller.role === 'manager'
      ? await listManagedDepartmentIds(supabase, caller.id)
      : allDepartments.map((d) => d.id) // admin/superadmin: unscoped, all active departments

  const departments = allDepartments.filter((d) => managedIds.includes(d.id))

  const { data: roster } = await supabase
    .from('employees')
    .select('id, employee_id, name, department_id')
    .in('department_id', managedIds.length > 0 ? managedIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('archived', false)

  const tasks = await listTasksForDepartments(supabase, managedIds)
  const unreportedMonths = await getUnreportedPriorMonths(supabase, departments)

  return (
    <>
      <MonthlyReportModal months={unreportedMonths} />
      <PageHeader title="My Team" subtitle={`${departments.length} department(s), ${roster?.length ?? 0} people`} />

      <AssignTaskForm departments={departments} roster={roster ?? []} />

      <section className={`${card} mt-6 overflow-x-auto p-0`}>
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Task</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Assignee
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Due
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-b border-border last:border-0">
                <td className="px-6 py-3.5 text-[0.9375rem] font-semibold text-ink">{task.title}</td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink">{task.assignee_name}</td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink-muted">{task.due_date ?? '—'}</td>
                <td className="px-6 py-3.5">
                  <TaskStatusSelect taskId={task.id} status={task.status} />
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-[0.9375rem] text-ink-muted">
                  No tasks assigned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
