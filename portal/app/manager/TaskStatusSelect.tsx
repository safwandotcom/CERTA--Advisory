'use client'

import { useTransition } from 'react'
import type { TaskStatus } from '@/lib/tasks'
import { updateTaskStatusAction } from './actions'

const STATUS_STYLES: Record<TaskStatus, string> = {
  NEW: 'bg-surface-tint text-ink-muted',
  STARTED: 'bg-certa-green-tint text-certa-green-deep',
  PENDING: 'bg-white border border-signal-coral text-signal-coral-deep',
  COMPLETED: 'bg-certa-green-deep text-white',
}

export default function TaskStatusSelect({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const [isPending, startTransition] = useTransition()

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as TaskStatus
        startTransition(() => {
          updateTaskStatusAction(taskId, next)
        })
      }}
      className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      <option value="NEW">NEW</option>
      <option value="STARTED">STARTED</option>
      <option value="PENDING">PENDING</option>
      <option value="COMPLETED">COMPLETED</option>
    </select>
  )
}
