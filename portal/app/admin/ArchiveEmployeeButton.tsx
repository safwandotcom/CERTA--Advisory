'use client'

import { useActionState, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { archiveEmployeeAction, type ActionState } from '@/app/admin/employees/[id]/actions'
import { input, label as labelClass, buttonCoral, buttonGhost, errorText } from '@/lib/ui'

const initialState: ActionState = {}

export function ArchiveEmployeeButton({
  authUserId,
  employeeId,
  role,
  name,
}: {
  authUserId: string
  employeeId: string
  role: string
  name: string
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    archiveEmployeeAction.bind(null, authUserId, employeeId, role),
    initialState
  )

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${buttonGhost} px-4 py-2 text-[0.75rem]`}>
        Archive
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-sm rounded-[16px] bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Archive {name}</h2>
            <p className="mt-1 text-[0.8125rem] text-ink-muted">
              Revokes their login and hides them from the active list. Task, document, and
              report history is kept.
            </p>

            <form action={formAction} className="mt-4 flex flex-col gap-3">
              <div>
                <label htmlFor={`confirmPassword-${employeeId}`} className={labelClass}>
                  Your password
                </label>
                <input
                  id={`confirmPassword-${employeeId}`}
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
                <button type="submit" className={buttonCoral} disabled={pending}>
                  {pending ? 'Archiving…' : 'Archive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
