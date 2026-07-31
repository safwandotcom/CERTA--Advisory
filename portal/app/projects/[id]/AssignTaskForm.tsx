'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { card, input, label as labelClass, buttonPrimary, errorText, successText } from '@/lib/ui'
import { assignTaskAction, type ActionState } from '@/app/manager/actions'

const initialState: ActionState = {}

export default function AssignTaskForm({
  projectId,
  employees,
}: {
  projectId: string
  employees: { id: string; employee_id: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState(assignTaskAction, initialState)

  return (
    <section className={`${card} mb-6 max-w-2xl`}>
      <h2 className="font-display text-base font-semibold text-ink">Assign a task</h2>
      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="projectId" value={projectId} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="assignedTo" className={labelClass}>Assign to</label>
            <select id="assignedTo" name="assignedTo" required className={input}>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="priority" className={labelClass}>Priority</label>
            <select id="priority" name="priority" defaultValue="medium" className={input}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="title" className={labelClass}>Title</label>
          <input id="title" name="title" required className={input} />
        </div>
        <div>
          <label htmlFor="description" className={labelClass}>Description</label>
          <textarea id="description" name="description" rows={2} className={input} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="dueDate" className={labelClass}>Due date</label>
            <input id="dueDate" name="dueDate" type="date" className={input} />
          </div>
          <div>
            <label htmlFor="labels" className={labelClass}>Labels (comma-separated)</label>
            <input id="labels" name="labels" placeholder="e.g. urgent-fix, client-facing" className={input} />
          </div>
        </div>

        {state.error && <p role="alert" className={errorText}><AlertCircle size={16} strokeWidth={2} className="shrink-0" />{state.error}</p>}
        {state.success && <p className={successText}><CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />{state.success}</p>}

        <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>
          {pending ? 'Assigning…' : 'Assign task'}
        </button>
      </form>
    </section>
  )
}
