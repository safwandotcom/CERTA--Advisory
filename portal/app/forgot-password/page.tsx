'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { requestPasswordRecoveryAction, type ForgotPasswordState } from './actions'
import { input, label as labelClass, buttonPrimary, successText, errorText } from '@/lib/ui'

const initialState: ForgotPasswordState = {}

function ExpiredLinkNotice() {
  const searchParams = useSearchParams()
  const expired = searchParams.get('error') === 'expired'

  if (!expired) return null

  return (
    <p className={`${errorText} mt-4`}>That link expired — request a new one below.</p>
  )
}

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordRecoveryAction, initialState)

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-tint px-4 py-12">
      <div className="w-full max-w-sm rounded-[16px] bg-white p-8 sm:p-10">
        <Image
          src="/brand/certa-mark.png"
          alt=""
          width={40}
          height={40}
          priority
          className="h-10 w-10"
        />

        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-ink">
          Reset your password
        </h1>
        <p className="mt-1.5 text-[0.9375rem] text-ink-muted">
          Enter your Employee ID and we&apos;ll email a reset link to the recovery address on file for it.
        </p>

        <Suspense fallback={null}>
          <ExpiredLinkNotice />
        </Suspense>

        {state.success ? (
          <p role="status" className={`${successText} mt-8`}>{state.success}</p>
        ) : (
          <form action={formAction} className="mt-8 flex flex-col gap-5">
            <div>
              <label htmlFor="employeeId" className={labelClass}>
                Employee ID
              </label>
              <input
                id="employeeId"
                name="employeeId"
                type="text"
                required
                autoFocus
                autoComplete="username"
                className={input}
              />
            </div>

            <button type="submit" disabled={pending} className={`${buttonPrimary} mt-1 w-full`}>
              {pending ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Back to sign in
        </Link>
      </div>
    </main>
  )
}
