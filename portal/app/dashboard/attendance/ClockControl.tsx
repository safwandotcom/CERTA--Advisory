'use client'

import { useActionState } from 'react'
import { AlertCircle, Clock } from 'lucide-react'
import { clockInAction, clockOutAction, type AttendanceActionState } from './actions'
import { buttonPrimary, buttonCoral, card, errorText } from '@/lib/ui'

const initialState: AttendanceActionState = {}

function ErrorMessage({ state }: { state: AttendanceActionState }) {
  if (!state.error) return null
  return (
    <p role="alert" className={`${errorText} mt-3`}>
      <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
      {state.error}
    </p>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString()
}

export default function ClockControl({
  today,
}: {
  today: { clock_in_at: string; clock_out_at: string | null } | null
}) {
  const [clockInState, clockInFormAction] = useActionState(clockInAction, initialState)
  const [clockOutState, clockOutFormAction] = useActionState(clockOutAction, initialState)

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
        <Clock size={18} strokeWidth={2} className="text-ink-muted" />
        Attendance
      </h2>

      {today === null && (
        <div className="mt-4">
          <form action={clockInFormAction}>
            <button type="submit" className={buttonPrimary}>
              Clock In
            </button>
          </form>
          <ErrorMessage state={clockInState} />
        </div>
      )}

      {today !== null && today.clock_out_at === null && (
        <div className="mt-4">
          <p className="text-[0.9375rem] text-ink">
            Clocked in at <span className="font-semibold">{formatTime(today.clock_in_at)}</span>
          </p>
          <form action={clockOutFormAction} className="mt-3">
            <button type="submit" className={buttonCoral}>
              Clock Out
            </button>
          </form>
          <ErrorMessage state={clockOutState} />
        </div>
      )}

      {today !== null && today.clock_out_at !== null && (
        <div className="mt-4">
          <p className="text-[0.9375rem] text-ink">
            Clocked in at <span className="font-semibold">{formatTime(today.clock_in_at)}</span>, clocked out at{' '}
            <span className="font-semibold">{formatTime(today.clock_out_at)}</span>
          </p>
        </div>
      )}
    </section>
  )
}
