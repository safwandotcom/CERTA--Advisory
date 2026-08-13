'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { updateDefaultQuotaAction, type LeaveTypesActionState } from './actions'
import { input, buttonPrimary, errorText, successText } from '@/lib/ui'

const initialState: LeaveTypesActionState = {}

export function QuotaForm({ leaveTypeId, currentQuota }: { leaveTypeId: string; currentQuota: number | null }) {
  const [state, formAction, pending] = useActionState(updateDefaultQuotaAction, initialState)

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={leaveTypeId} />
      <div className="flex items-center gap-2">
        <input
          type="number"
          name="defaultAnnualQuota"
          min={0}
          step="0.5"
          defaultValue={currentQuota ?? ''}
          placeholder="No default"
          className={`${input} w-28 py-2`}
          aria-label="Default annual quota"
        />
        <button type="submit" disabled={pending} className={`${buttonPrimary} py-2`}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {state.error && (
        <span className={`${errorText} text-[0.75rem]`}>
          <AlertCircle size={14} strokeWidth={2} className="shrink-0" />
          {state.error}
        </span>
      )}
      {state.success && (
        <span className={`${successText} text-[0.75rem]`}>
          <CheckCircle2 size={14} strokeWidth={2} className="shrink-0" />
          {state.success}
        </span>
      )}
    </form>
  )
}
