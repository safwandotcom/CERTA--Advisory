'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle } from 'lucide-react'
import { loginAction, type LoginState } from './actions'
import { input, label as labelClass, buttonPrimary, errorText, successText } from '@/lib/ui'

const initialState: LoginState = {}

function ResetSuccessNotice() {
  const searchParams = useSearchParams()
  const justReset = searchParams.get('reset') === 'success'

  if (!justReset) return null

  return (
    <p className={`${successText} mt-4`}>Password updated — sign in with your new password.</p>
  )
}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState)

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
          Sign in to the portal
        </h1>
        <p className="mt-1.5 text-[0.9375rem] text-ink-muted">
          Use the Employee ID and password issued to you by your administrator.
        </p>

        <Suspense fallback={null}>
          <ResetSuccessNotice />
        </Suspense>

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

          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={input}
            />
          </div>

          <div className="-mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-[0.8125rem] font-semibold text-certa-green-deep hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {state.error && (
            <p role="alert" className={errorText}>
              <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
              {state.error}
            </p>
          )}

          <button type="submit" disabled={pending} className={`${buttonPrimary} mt-1 w-full`}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
