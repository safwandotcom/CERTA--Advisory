'use client'

import { useState } from 'react'
import { buttonPrimary, buttonGhost, errorText } from '@/lib/ui'
import type { UnreportedMonth } from '@/lib/reports'
import { submitMonthlyReportAction } from '@/app/manager/actions'

export function MonthlyReportModal({ months }: { months: UnreportedMonth[] }) {
  const [queue, setQueue] = useState(months)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (queue.length === 0) return null

  const current = queue[0]

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    const result = await submitMonthlyReportAction(current.periodMonth)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setQueue((q) => q.slice(1))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-[16px] bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-ink">
          Monthly report — {current.projectNames.join(', ')}
        </h2>
        <p className="mt-1 text-[0.8125rem] text-ink-muted">
          For {current.periodMonth.slice(0, 7)}. This submits regardless of whether every task is
          complete.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-[0.9375rem]">
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-muted">New</dt>
            <dd className="text-ink">{current.statusCounts.NEW}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-muted">Started</dt>
            <dd className="text-ink">{current.statusCounts.STARTED}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-muted">Pending</dt>
            <dd className="text-ink">{current.statusCounts.PENDING}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-muted">Completed</dt>
            <dd className="text-ink">{current.statusCounts.COMPLETED}</dd>
          </div>
        </dl>

        {error && <p className={`mt-4 ${errorText}`}>{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className={buttonGhost}
            onClick={() => setQueue((q) => q.slice(1))}
            disabled={submitting}
          >
            Remind me later
          </button>
          <button type="button" className={buttonPrimary} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit to admin'}
          </button>
        </div>
      </div>
    </div>
  )
}
