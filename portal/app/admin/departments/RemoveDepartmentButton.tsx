'use client'

import { useState, useTransition } from 'react'
import { deleteDepartmentAction } from './actions'
import { errorText } from '@/lib/ui'

export function RemoveDepartmentButton({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Permanently remove "${departmentName}"? This cannot be undone.`)) return
          setError(null)
          startTransition(async () => {
            const result = await deleteDepartmentAction(departmentId)
            if (result.error) setError(result.error)
          })
        }}
        className="text-[0.8125rem] font-semibold text-ink-muted hover:text-signal-coral-deep disabled:opacity-60"
      >
        Remove
      </button>
      {error && <p className={`${errorText} max-w-[220px] text-right text-[0.75rem]`}>{error}</p>}
    </div>
  )
}
