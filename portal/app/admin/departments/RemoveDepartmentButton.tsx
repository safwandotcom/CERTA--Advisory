'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { deleteDepartmentAction } from './actions'
import { errorText, buttonCoral } from '@/lib/ui'

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
        className={`${buttonCoral} px-4 py-2 text-[0.75rem]`}
      >
        {isPending ? (
          <>
            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            Removing…
          </>
        ) : (
          'Remove'
        )}
      </button>
      {error && <p className={`${errorText} max-w-[220px] text-right text-[0.75rem]`}>{error}</p>}
    </div>
  )
}
