'use client'

import { useActionState } from 'react'
import { AlertCircle, Clock } from 'lucide-react'
import { clockInAction, clockOutAction, type AttendanceActionState } from './actions'
import { buttonPrimary, buttonCoral, card, errorText } from '@/lib/ui'
import { SubmitButton } from '@/components/SubmitButton'

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

// Explicit locale + Asia/Dhaka timeZone: this renders during SSR too, so
// leaving these unset would run in the server's locale/TZ (mismatching the
// client on hydration) and would show UTC-host times with no Dhaka context.
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit' })
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
            <SubmitButton pendingText="Clocking in…" className={buttonPrimary}>
              Clock In
            </SubmitButton>
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
            <SubmitButton pendingText="Clocking out…" className={buttonCoral}>
              Clock Out
            </SubmitButton>
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
