'use client'

import { useActionState } from 'react'
import { input, buttonPrimary, errorText } from '@/lib/ui'
import { addSubtaskAction, type ActionState } from './actions'

const initialState: ActionState = {}

export default function AddSubtaskForm({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [state, formAction, pending] = useActionState(addSubtaskAction.bind(null, projectId, taskId), initialState)

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-2">
      <div className="flex gap-2">
        <input name="title" required className={input} placeholder="New subtask…" />
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? 'Adding…' : 'Add'}
        </button>
      </div>
      {state.error && <p role="alert" className={`${errorText} text-[0.8125rem]`}>{state.error}</p>}
    </form>
  )
}
