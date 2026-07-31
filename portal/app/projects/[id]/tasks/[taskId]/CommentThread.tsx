'use client'

import { useActionState } from 'react'
import type { TaskComment } from '@/lib/comments'
import { addCommentAction, type ActionState } from './actions'
import { input, buttonPrimary, errorText } from '@/lib/ui'

const initialState: ActionState = {}

export default function CommentThread({
  projectId,
  taskId,
  comments,
}: {
  projectId: string
  taskId: string
  comments: TaskComment[]
}) {
  const [state, formAction, pending] = useActionState(addCommentAction.bind(null, projectId, taskId), initialState)

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded-[10px] bg-surface-tint p-3">
            <p className="text-[0.8125rem] font-semibold text-ink">{c.author_name}</p>
            <p className="mt-0.5 text-[0.875rem] text-ink">{c.body}</p>
          </li>
        ))}
        {comments.length === 0 && <p className="text-[0.875rem] text-ink-muted">No comments yet.</p>}
      </ul>

      <form action={formAction} className="flex flex-col gap-2">
        <textarea name="body" rows={2} required className={input} placeholder="Add a comment…" />
        {state.error && <p role="alert" className={`${errorText} text-[0.8125rem]`}>{state.error}</p>}
        <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>
          {pending ? 'Posting…' : 'Post comment'}
        </button>
      </form>
    </div>
  )
}
