'use client'

import { useState, useTransition } from 'react'
import type { TaskStatus } from '@/lib/tasks'
import { updateOwnTaskStatusAction } from './actions'

const STATUS_STYLES: Record<TaskStatus, string> = {
  NEW: 'bg-surface-tint text-ink-muted',
  STARTED: 'bg-certa-green-tint text-certa-green-deep',
  PENDING: 'bg-white border border-signal-coral text-signal-coral-deep',
  COMPLETED: 'bg-certa-green-deep text-white',
}

export default function EmployeeTaskStatusSelect({
  taskId,
  status,
}: {
  taskId: string
  status: TaskStatus
}) {
  const [isPending, startTransition] = useTransition()
  const [displayStatus, setDisplayStatus] = useState(status)
  const [syncedStatus, setSyncedStatus] = useState(status)
  const [error, setError] = useState<string | null>(null)

  // Re-sync local display state when the server-revalidated `status` prop
  // changes for a reason other than this component's own optimistic update
  // (React-recommended render-phase adjustment, not an effect).
  if (status !== syncedStatus) {
    setSyncedStatus(status)
    setDisplayStatus(status)
  }

  return (
    <div>
      <select
        value={displayStatus}
        disabled={isPending}
        onChange={(e) => {
          const previous = displayStatus
          const next = e.target.value as TaskStatus
          setDisplayStatus(next)
          setError(null)
          startTransition(async () => {
            const result = await updateOwnTaskStatusAction(taskId, next)
            if (result.error) {
              setDisplayStatus(previous)
              setError(result.error)
            }
          })
        }}
        className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[displayStatus]}`}
      >
        <option value="NEW">NEW</option>
        <option value="STARTED">STARTED</option>
        <option value="PENDING">PENDING</option>
        <option value="COMPLETED">COMPLETED</option>
      </select>
      {error && <p className="mt-1 text-xs font-semibold text-signal-coral-deep">{error}</p>}
    </div>
  )
}
