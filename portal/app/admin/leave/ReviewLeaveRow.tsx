'use client'

import { useActionState, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { reviewLeaveRequestAction, type LeaveReviewActionState } from './actions'
import { input, buttonPrimary, buttonCoral, errorText, successText } from '@/lib/ui'

const initialState: LeaveReviewActionState = {}

// One useActionState instance per row — mirrors CancelRequestButton in
// app/dashboard/leave/LeaveRequestForm.tsx. A single form posts either
// decision via the clicked submit button's name/value pair.
export function ReviewLeaveRow({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState(reviewLeaveRequestAction, initialState)
  const [pendingDecision, setPendingDecision] = useState<'approved' | 'rejected' | null>(null)

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <textarea
        name="reviewNote"
        rows={1}
        placeholder="Optional note"
        aria-label="Review note"
        className={`${input} py-2 text-[0.8125rem]`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="decision"
          value="approved"
          disabled={pending}
          onClick={() => setPendingDecision('approved')}
          className={`${buttonPrimary} py-2`}
        >
          {pending && pendingDecision === 'approved' ? (
            <>
              <Loader2 size={15} strokeWidth={2} className="animate-spin" />
              Approving…
            </>
          ) : (
            'Approve'
          )}
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending}
          onClick={() => setPendingDecision('rejected')}
          className={`${buttonCoral} py-2`}
        >
          {pending && pendingDecision === 'rejected' ? (
            <>
              <Loader2 size={15} strokeWidth={2} className="animate-spin" />
              Rejecting…
            </>
          ) : (
            'Reject'
          )}
        </button>
      </div>
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
