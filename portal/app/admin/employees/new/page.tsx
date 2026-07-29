'use client'

import { useActionState } from 'react'
import { createEmployeeAction, type CreateEmployeeState } from './actions'

const initialState: CreateEmployeeState = {}

export default function NewEmployeePage() {
  const [state, formAction, pending] = useActionState(createEmployeeAction, initialState)

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">New employee</h1>
      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <label htmlFor="employeeId">Employee ID</label>
        <input id="employeeId" name="employeeId" required className="border p-2" />

        <label htmlFor="name">Full name</label>
        <input id="name" name="name" required className="border p-2" />

        <label htmlFor="password">Initial password</label>
        <input id="password" name="password" type="password" required className="border p-2" />

        <label htmlFor="role">Role</label>
        <select id="role" name="role" className="border p-2">
          <option value="employee">Employee</option>
          <option value="admin">Admin</option>
        </select>

        {state.error && (
          <p role="alert" className="text-red-600">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className="border p-2">
          {pending ? 'Creating…' : 'Create employee'}
        </button>
      </form>
    </main>
  )
}
