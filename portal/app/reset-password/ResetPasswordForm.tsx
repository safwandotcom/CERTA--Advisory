'use client'

import { useActionState } from 'react'
import Image from 'next/image'
import { AlertCircle } from 'lucide-react'
import { updateOwnPasswordAction, type ResetPasswordState } from './actions'
import { input, label as labelClass, buttonPrimary, errorText } from '@/lib/ui'

const initialState: ResetPasswordState = {}

export default function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updateOwnPasswordAction, initialState)

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
          Set a new password
        </h1>

        <form action={formAction} className="mt-8 flex flex-col gap-5">
          <div>
            <label htmlFor="password" className={labelClass}>
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="new-password"
              className={input}
            />
          </div>

          {state.error && (
            <p role="alert" className={errorText}>
              <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
              {state.error}
            </p>
          )}

          <button type="submit" disabled={pending} className={`${buttonPrimary} mt-1 w-full`}>
            {pending ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </main>
  )
}
