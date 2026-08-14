'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { adminCancelApprovedLeaveRequestAction, type LeaveCancelActionState } from './actions'
import { buttonCoral, errorText, successText } from '@/lib/ui'

const initialState: LeaveCancelActionState = {}

// One useActionState instance per row — mirrors ReviewLeaveRow/
// CancelRequestButton's existing pattern in this codebase.
export function CancelApprovedLeaveButton({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState(adminCancelApprovedLeaveRequestAction, initialState)

  return (
    <form action={formAction} className="flex flex-col items-start gap-1.5">
      <input type="hidden" name="requestId" value={requestId} />
      <button type="submit" disabled={pending} className={`${buttonCoral} py-2`}>
        Cancel
      </button>
      {state.error && (
        <p role="alert" className={`${errorText} text-[0.75rem]`}>
          <AlertCircle size={14} strokeWidth={2} className="shrink-0" />
          {state.error}
        </p>
      )}
      {state.success && (
        <p className={`${successText} text-[0.75rem]`}>
          <CheckCircle2 size={14} strokeWidth={2} className="shrink-0" />
          {state.success}
        </p>
      )}
    </form>
  )
}
