'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { setAllocationAction, type LeaveTypesActionState } from './actions'
import { input, buttonPrimary, errorText, successText } from '@/lib/ui'

const initialState: LeaveTypesActionState = {}

export function AllocationForm({
  employeeId,
  leaveTypeId,
  year,
  currentAllocatedDays,
}: {
  employeeId: string
  leaveTypeId: string
  year: number
  currentAllocatedDays: number
}) {
  const [state, formAction, pending] = useActionState(setAllocationAction, initialState)

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="leaveTypeId" value={leaveTypeId} />
      <input type="hidden" name="year" value={year} />
      <div className="flex items-center gap-2">
        <input
          type="number"
          name="allocatedDays"
          min={0}
          step="0.5"
          required
          defaultValue={currentAllocatedDays}
          className={`${input} w-24 py-2`}
          aria-label="Allocated days"
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
