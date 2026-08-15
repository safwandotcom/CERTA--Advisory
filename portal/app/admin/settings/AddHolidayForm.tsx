'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { addHolidayAction, type SettingsActionState } from './actions'
import { input, label as labelClass, buttonPrimary, errorText, successText } from '@/lib/ui'
import { SubmitButton } from '@/components/SubmitButton'

const initialState: SettingsActionState = {}

export function AddHolidayForm() {
  const [state, formAction] = useActionState(addHolidayAction, initialState)

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="date" className={labelClass}>
          Date
        </label>
        <input id="date" name="date" type="date" required className={input} />
      </div>
      <div className="flex-1 min-w-[180px]">
        <label htmlFor="name" className={labelClass}>
          Holiday name
        </label>
        <input id="name" name="name" required className={input} />
      </div>
      <SubmitButton pendingText="Adding…" className={buttonPrimary}>
        Add holiday
      </SubmitButton>

      {state.error && (
        <p role="alert" className={`${errorText} w-full`}>
          <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
          {state.error}
        </p>
      )}
      {state.success && (
        <p className={`${successText} w-full`}>
          <CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />
          {state.success}
        </p>
      )}
    </form>
  )
}
