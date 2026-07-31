import type { Task, TaskStatus } from '@/lib/tasks'
import TaskStatusSelect from './TaskStatusSelect'

const COLUMNS: { status: TaskStatus; label: string; bg: string; text: string }[] = [
  { status: 'NEW', label: 'New', bg: 'bg-surface-tint', text: 'text-ink-muted' },
  { status: 'STARTED', label: 'Started', bg: 'bg-certa-green-tint', text: 'text-certa-green-deep' },
  { status: 'PENDING', label: 'Pending', bg: 'bg-white border border-signal-coral', text: 'text-signal-coral-deep' },
  { status: 'COMPLETED', label: 'Completed', bg: 'bg-certa-green-deep', text: 'text-white' },
]

export default function BoardView({ tasks }: { tasks: (Task & { assignee_name: string })[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((col) => (
        <div key={col.status} className="rounded-[12px] bg-surface-tint p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
            {col.label} ({tasks.filter((t) => t.status === col.status).length})
          </p>
          <div className="flex flex-col gap-2">
            {tasks
              .filter((t) => t.status === col.status)
              .map((task) => (
                <div key={task.id} className="rounded-[10px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                  <p className="text-[0.875rem] font-semibold text-ink">{task.title}</p>
                  <p className="mt-0.5 text-[0.75rem] text-ink-muted">{task.assignee_name}</p>
                  <div className="mt-2">
                    <TaskStatusSelect taskId={task.id} status={task.status} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
