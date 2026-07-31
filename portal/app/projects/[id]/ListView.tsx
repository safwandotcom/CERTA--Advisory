import type { Task } from '@/lib/tasks'
import { card } from '@/lib/ui'
import TaskStatusSelect from './TaskStatusSelect'

export default function ListView({ tasks }: { tasks: (Task & { assignee_name: string })[] }) {
  return (
    <section className={`${card} overflow-x-auto p-0`}>
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Task</th>
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Assignee</th>
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Priority</th>
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Due</th>
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-border last:border-0">
              <td className="px-6 py-3.5 text-[0.9375rem] font-semibold text-ink">{task.title}</td>
              <td className="px-6 py-3.5 text-[0.9375rem] text-ink">{task.assignee_name}</td>
              <td className="px-6 py-3.5 text-[0.9375rem] capitalize text-ink-muted">{task.priority}</td>
              <td className="px-6 py-3.5 text-[0.9375rem] text-ink-muted">{task.due_date ?? '—'}</td>
              <td className="px-6 py-3.5"><TaskStatusSelect taskId={task.id} status={task.status} /></td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-10 text-center text-[0.9375rem] text-ink-muted">No tasks yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
