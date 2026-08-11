'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { updateWeeklyOffDaysAction, type SettingsActionState } from './actions'
import { card, input, label as labelClass, buttonPrimary, errorText, successText } from '@/lib/ui'

const initialState: SettingsActionState = {}

export function WeeklyOffDaysForm({ currentValue }: { currentValue: string }) {
  const [state, formAction] = useActionState(updateWeeklyOffDaysAction, initialState)

  return (
    <form action={formAction} className={card}>
      <h2 className="font-display text-base font-semibold text-ink">Weekly off-days</h2>
      <p className="mt-1 text-[0.8125rem] text-ink-muted">
        Comma-separated weekday abbreviations (e.g. <code>sat,sun</code>) that count as non-working days for
        attendance and leave calculations.
      </p>
      <div className="mt-4 max-w-xs">
        <label htmlFor="weeklyOffDays" className={labelClass}>
          Weekly off-days
        </label>
        <input id="weeklyOffDays" name="weeklyOffDays" required defaultValue={currentValue} className={input} />
      </div>

      {state.error && (
        <p role="alert" className={`${errorText} mt-4`}>
          <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
          {state.error}
        </p>
      )}
      {state.success && (
        <p className={`${successText} mt-4`}>
          <CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />
          {state.success}
        </p>
      )}

      <div className="mt-6">
        <button type="submit" className={buttonPrimary}>
          Save
        </button>
      </div>
    </form>
  )
}
