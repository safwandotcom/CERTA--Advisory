'use client'

import { useActionState, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { deleteEmployeeAction } from '@/app/admin/employees/[id]/actions'
import type { ActionState } from '@/app/admin/employees/[id]/actions'
import { input, label as labelClass, buttonCoral, buttonGhost, errorText } from '@/lib/ui'
import { SubmitButton } from '@/components/SubmitButton'

const initialState: ActionState = {}

export function RemoveEmployeeButton({
  authUserId,
  employeeId,
  name,
}: {
  authUserId: string
  employeeId: string
  name: string
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    deleteEmployeeAction.bind(null, authUserId, employeeId),
    initialState
  )

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${buttonCoral} px-4 py-2 text-[0.75rem]`}>
        Remove
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-sm rounded-[16px] bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Permanently delete {name}</h2>
            <p className="mt-1 text-[0.8125rem] text-ink-muted">
              This cannot be undone. Their attendance records, leave requests and balances,
              documents, and onboarding data are all permanently deleted along with their login.
            </p>

            <form action={formAction} className="mt-4 flex flex-col gap-3">
              <div>
                <label htmlFor={`confirmDeletePassword-${employeeId}`} className={labelClass}>
                  Your password
                </label>
                <input
                  id={`confirmDeletePassword-${employeeId}`}
                  name="confirmPassword"
                  type="password"
                  required
                  autoFocus
                  className={input}
                />
              </div>

              {state.error && (
                <p role="alert" className={errorText}>
                  <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
                  {state.error}
                </p>
              )}

              <div className="mt-1 flex justify-end gap-3">
                <button
                  type="button"
                  className={buttonGhost}
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </button>
                <SubmitButton pendingText="Deleting…" className={buttonCoral}>
                  Permanently delete
                </SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
