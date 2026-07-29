'use client'

import { useActionState } from 'react'
import { loginAction, type LoginState } from './actions'

const initialState: LoginState = {}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState)

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">CERTA&amp; Portal</h1>
      <form action={formAction} className="flex flex-col gap-3">
        <label htmlFor="employeeId">Employee ID</label>
        <input id="employeeId" name="employeeId" type="text" required autoFocus className="border p-2" />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required className="border p-2" />

        {state.error && (
          <p role="alert" className="text-red-600">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className="border p-2">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
