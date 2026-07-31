'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { card, input, label as labelClass, buttonPrimary, errorText, successText } from '@/lib/ui'
import { createProjectAction, type ActionState } from './actions'

const initialState: ActionState = {}

export default function NewProjectForm({
  employees,
}: {
  employees: { id: string; employee_id: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState)

  return (
    <section className={`${card} max-w-2xl`}>
      <h2 className="font-display text-base font-semibold text-ink">New project</h2>
      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <div>
          <label htmlFor="name" className={labelClass}>Name</label>
          <input id="name" name="name" required className={input} />
        </div>
        <div>
          <label htmlFor="description" className={labelClass}>Description</label>
          <textarea id="description" name="description" rows={2} className={input} />
        </div>
        <div>
          <p className={labelClass}>Members</p>
          <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto rounded-[10px] border border-border p-3 sm:grid-cols-2">
            {employees.map((emp) => (
              <label key={emp.id} className="flex items-center gap-2 text-[0.875rem] text-ink">
                <input type="checkbox" name="memberIds" value={emp.id} />
                {emp.name} ({emp.employee_id})
              </label>
            ))}
          </div>
        </div>

        {state.error && (
          <p role="alert" className={errorText}><AlertCircle size={16} strokeWidth={2} className="shrink-0" />{state.error}</p>
        )}
        {state.success && (
          <p className={successText}><CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />{state.success}</p>
        )}

        <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>
          {pending ? 'Creating…' : 'Create project'}
        </button>
      </form>
    </section>
  )
}
