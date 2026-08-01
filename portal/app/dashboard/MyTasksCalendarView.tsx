import type { Task } from '@/lib/tasks'
import { card } from '@/lib/ui'

export default function MyTasksCalendarView({
  tasks,
}: {
  tasks: (Task & { project_name: string | null })[]
}) {
  const withDates = tasks.filter((t) => t.due_date)
  const byDate = new Map<string, (Task & { project_name: string | null })[]>()
  for (const task of withDates) {
    const key = task.due_date as string
    byDate.set(key, [...(byDate.get(key) ?? []), task])
  }
  const sortedDates = Array.from(byDate.keys()).sort()

  return (
    <section className={`${card}`}>
      {sortedDates.length === 0 && (
        <p className="text-[0.9375rem] text-ink-muted">No tasks with a due date yet.</p>
      )}
      <div className="flex flex-col gap-4">
        {sortedDates.map((date) => (
          <div key={date}>
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">{date}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {(byDate.get(date) ?? []).map((task) => (
                <li key={task.id} className="flex items-center justify-between rounded-[8px] bg-surface-tint px-3 py-2">
                  <span className="text-[0.875rem] font-semibold text-ink">{task.title}</span>
                  <span className="text-[0.75rem] text-ink-muted">{task.project_name ?? '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
