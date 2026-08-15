'use client'

import { useActionState } from 'react'
import { deleteHolidayAction, type SettingsActionState } from './actions'
import { errorText, buttonCoral } from '@/lib/ui'
import { SubmitButton } from '@/components/SubmitButton'

const initialState: SettingsActionState = {}

export function DeleteHolidayButton({ holidayId, holidayName }: { holidayId: string; holidayName: string }) {
  const [state, formAction] = useActionState(deleteHolidayAction, initialState)

  return (
    <form
      action={formAction}
      className="flex flex-col items-end gap-1"
      onSubmit={(e) => {
        if (!window.confirm(`Remove the holiday "${holidayName}"?`)) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={holidayId} />
      <SubmitButton pendingText="Deleting…" className={`${buttonCoral} px-4 py-2 text-[0.75rem]`}>
        Delete
      </SubmitButton>
      {state.error && <span className={`${errorText} text-[0.75rem]`}>{state.error}</span>}
    </form>
  )
}
