'use client'

import { useState, useTransition } from 'react'
import type { Subtask } from '@/lib/subtasks'
import { toggleSubtaskAction } from './actions'
import { errorText } from '@/lib/ui'

export default function SubtaskList({
  projectId,
  taskId,
  subtasks,
}: {
  projectId: string
  taskId: string
  subtasks: Subtask[]
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {subtasks.map((subtask) => (
        <SubtaskRow key={subtask.id} projectId={projectId} taskId={taskId} subtask={subtask} />
      ))}
      {subtasks.length === 0 && <p className="text-[0.875rem] text-ink-muted">No subtasks yet.</p>}
    </ul>
  )
}

function SubtaskRow({ projectId, taskId, subtask }: { projectId: string; taskId: string; subtask: Subtask }) {
  const [isPending, startTransition] = useTransition()
  const [displayDone, setDisplayDone] = useState(subtask.done)
  const [error, setError] = useState<string | null>(null)

  return (
    <li className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={displayDone}
        disabled={isPending}
        onChange={(e) => {
          const previous = displayDone
          const next = e.target.checked
          setDisplayDone(next)
          setError(null)
          startTransition(async () => {
            const result = await toggleSubtaskAction(projectId, taskId, subtask.id, next)
            if (result.error) {
              setDisplayDone(previous)
              setError(result.error)
            }
          })
        }}
      />
      <span className={`text-[0.875rem] ${displayDone ? 'text-ink-muted line-through' : 'text-ink'}`}>
        {subtask.title}
      </span>
      {error && <span className={`${errorText} text-[0.75rem]`}>{error}</span>}
    </li>
  )
}
