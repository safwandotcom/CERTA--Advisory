'use client'

import { useActionState, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { submitLeaveRequestAction, cancelLeaveRequestAction, type LeaveActionState } from './actions'
import { computeDayPeriodDays, type DayPeriod } from '@/lib/leaveRequests'
import type { LeaveType } from '@/lib/leaveTypes'
import { input, label as labelClass, buttonPrimary, buttonGhost, errorText, successText } from '@/lib/ui'
import { SubmitButton } from '@/components/SubmitButton'

const initialState: LeaveActionState = {}

// Nested here (rather than a separate file) to mirror OnboardingForm.tsx's
// DocumentUpload pattern: a small client sub-component that needs its own
// useActionState instance per list row.
export function CancelRequestButton({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState(cancelLeaveRequestAction, initialState)

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="requestId" value={requestId} />
      <SubmitButton pendingText="Cancelling…" className={buttonGhost}>
        Cancel
      </SubmitButton>
      {state.error && (
        <p role="alert" className={`${errorText} text-right`}>
          <AlertCircle size={14} strokeWidth={2} className="shrink-0" />
          {state.error}
        </p>
      )}
    </form>
  )
}

const DAY_PERIOD_OPTIONS: { value: DayPeriod; label: string }[] = [
  { value: 'full', label: 'Full day' },
  { value: 'half_am', label: 'Half day (AM)' },
  { value: 'half_pm', label: 'Half day (PM)' },
]

export default function LeaveRequestForm({
  leaveTypes,
  balances,
}: {
  leaveTypes: LeaveType[]
  balances: Record<string, { allocated: number; used: number; remaining: number }>
}) {
  const [state, formAction] = useActionState(submitLeaveRequestAction, initialState)

  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startDayPeriod, setStartDayPeriod] = useState<DayPeriod>('full')
  const [endDayPeriod, setEndDayPeriod] = useState<DayPeriod>('full')

  // Half-day only ever applies to the first or last day of a range —
  // a single-day request has just one day period, shared by both columns.
  const isSingleDay = startDate !== '' && startDate === endDate

  const previewDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return null
    return computeDayPeriodDays(startDate, endDate, startDayPeriod, isSingleDay ? startDayPeriod : endDayPeriod)
  }, [startDate, endDate, startDayPeriod, endDayPeriod, isSingleDay])

  const balance = leaveTypeId ? balances[leaveTypeId] : undefined
  const selectedLeaveType = leaveTypes.find((lt) => lt.id === leaveTypeId)
  // Unpaid leave always has 0 allocation/0 remaining by definition — it has
  // no quota to exceed, so the warning would fire on every single Unpaid
  // request and is meaningless for that type.
  const exceedsBalance =
    previewDays !== null &&
    balance !== undefined &&
    previewDays > balance.remaining &&
    selectedLeaveType?.is_paid !== false

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="leaveTypeId" className={labelClass}>
            Leave type
          </label>
          <select
            id="leaveTypeId"
            name="leaveTypeId"
            required
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            className={input}
          >
            <option value="" disabled>
              Select a leave type
            </option>
            {leaveTypes.map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.name}
              </option>
            ))}
          </select>
          {balance && (
            <p className="mt-1.5 text-[0.8125rem] text-ink-muted">
              {balance.remaining} day(s) remaining of {balance.allocated}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="reason" className={labelClass}>
            Reason
          </label>
          <textarea id="reason" name="reason" rows={1} placeholder="Optional" className={input} />
        </div>

        <div>
          <label htmlFor="startDate" className={labelClass}>
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={input}
          />
        </div>

        <div>
          <label htmlFor="endDate" className={labelClass}>
            End date
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={input}
          />
        </div>

        {isSingleDay ? (
          <div>
            <label htmlFor="startDayPeriod" className={labelClass}>
              Day period
            </label>
            <select
              id="startDayPeriod"
              name="startDayPeriod"
              value={startDayPeriod}
              onChange={(e) => setStartDayPeriod(e.target.value as DayPeriod)}
              className={input}
            >
              {DAY_PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {/* Single-day requests only ever read start_day_period (0018's check
                constraint requires the two columns to match on such a row). */}
            <input type="hidden" name="endDayPeriod" value={startDayPeriod} />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="startDayPeriod" className={labelClass}>
                First day
              </label>
              <select
                id="startDayPeriod"
                name="startDayPeriod"
                value={startDayPeriod}
                onChange={(e) => setStartDayPeriod(e.target.value as DayPeriod)}
                className={input}
              >
                {DAY_PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="endDayPeriod" className={labelClass}>
                Last day
              </label>
              <select
                id="endDayPeriod"
                name="endDayPeriod"
                value={endDayPeriod}
                onChange={(e) => setEndDayPeriod(e.target.value as DayPeriod)}
                className={input}
              >
                {DAY_PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {previewDays !== null && (
        <p className="text-[0.8125rem] text-ink-muted">This request is {previewDays} day(s).</p>
      )}

      {exceedsBalance && (
        <p className={errorText}>
          <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
          This exceeds your remaining balance ({balance!.remaining} day(s) left) — you can still submit, but it
          will need admin attention.
        </p>
      )}

      {state.error && (
        <p role="alert" className={errorText}>
          <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
          {state.error}
        </p>
      )}
      {state.success && (
        <p className={successText}>
          <CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />
          {state.success}
        </p>
      )}

      <div>
        <SubmitButton pendingText="Submitting…" className={buttonPrimary}>
          Submit request
        </SubmitButton>
      </div>
    </form>
  )
}
