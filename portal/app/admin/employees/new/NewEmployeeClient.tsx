'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { createEmployeeAction, type CreateEmployeeState } from './actions'
import { PageHeader } from '@/components/PageHeader'
import { card, input, label as labelClass, buttonPrimary, errorText } from '@/lib/ui'
import type { Department } from '@/lib/departments'

const initialState: CreateEmployeeState = {}

export default function NewEmployeeClient({
  departments,
  canCreateAdmin,
}: {
  departments: Department[]
  canCreateAdmin: boolean
}) {
  const [state, formAction, pending] = useActionState(createEmployeeAction, initialState)
  const [role, setRole] = useState<'admin' | 'manager' | 'employee'>('employee')

  return (
    <>
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={2} />
        Back to employees
      </Link>

      <PageHeader title="New employee" subtitle="Create an account and staff-directory record." />

      <form action={formAction} className={`${card} max-w-xl`}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="employeeId" className={labelClass}>
              Employee ID
            </label>
            <input id="employeeId" name="employeeId" required className={input} />
          </div>

          <div>
            <label htmlFor="name" className={labelClass}>
              Full name
            </label>
            <input id="name" name="name" required className={input} />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Initial password
            </label>
            <input id="password" name="password" type="password" required className={input} />
          </div>

          <div>
            <label htmlFor="role" className={labelClass}>
              Role
            </label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className={input}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              {canCreateAdmin && <option value="admin">Admin</option>}
            </select>
          </div>

          <div>
            <label htmlFor="departmentId" className={labelClass}>
              Department
            </label>
            <select id="departmentId" name="departmentId" required className={input}>
              <option value="">Select a department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="contactInfo" className={labelClass}>
              Contact info
            </label>
            <input id="contactInfo" name="contactInfo" placeholder="Phone or personal email" className={input} />
          </div>

          <div>
            <label htmlFor="joinDate" className={labelClass}>
              Join date
            </label>
            <input id="joinDate" name="joinDate" type="date" className={input} />
          </div>
        </div>

        {state.error && (
          <p role="alert" className={`${errorText} mt-5`}>
            <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className={`${buttonPrimary} mt-6`}>
          {pending ? 'Creating…' : 'Create employee'}
        </button>
      </form>
    </>
  )
}
