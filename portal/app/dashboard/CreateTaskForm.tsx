'use client'

import { useActionState, useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { card, input, label as labelClass, buttonPrimary, errorText, successText } from '@/lib/ui'
import { createOwnTaskAction, type ActionState } from './actions'

const initialState: ActionState = {}

type Member = { id: string; employee_id: string; name: string }

export default function CreateTaskForm({
  projects,
  membersByProject,
}: {
  projects: { id: string; name: string }[]
  membersByProject: { [projectId: string]: Member[] }
}) {
  const [state, formAction, pending] = useActionState(createOwnTaskAction, initialState)
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')

  const members = membersByProject[projectId] ?? []

  if (projects.length === 0) return null

  return (
    <section className={`${card} mb-6 max-w-2xl`}>
      <h2 className="font-display text-base font-semibold text-ink">Create a task</h2>
      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="projectId" className={labelClass}>Project</label>
            <select
              id="projectId"
              name="projectId"
              required
              className={input}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="assignedTo" className={labelClass}>Assign to</label>
            <select id="assignedTo" name="assignedTo" required className={input}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name} ({member.employee_id})</option>
              ))}
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

        {state.error && <p role="alert" className={errorText}><AlertCircle size={16} strokeWidth={2} className="shrink-0" />{state.error}</p>}
        {state.success && <p className={successText}><CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />{state.success}</p>}

        <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>
          {pending ? 'Creating…' : 'Create task'}
        </button>
      </form>
    </section>
  )
}
