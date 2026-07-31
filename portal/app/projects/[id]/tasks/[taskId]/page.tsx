import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireManagerOrAdmin } from '@/lib/auth'
import { listSubtasks } from '@/lib/subtasks'
import { listComments } from '@/lib/comments'
import { PageHeader } from '@/components/PageHeader'
import { card } from '@/lib/ui'
import SubtaskList from './SubtaskList'
import CommentThread from './CommentThread'
import AddSubtaskForm from './AddSubtaskForm'

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>
}) {
  await requireManagerOrAdmin()
  const { id: projectId, taskId } = await params
  const supabase = await createClient()

  const { data: task } = await supabase
    .from('tasks')
    .select('*, employees!tasks_assigned_to_fkey(name)')
    .eq('id', taskId)
    .single()

  if (!task) notFound()

  const assigneeName = (task as unknown as { employees: { name: string } }).employees?.name ?? 'Unknown'
  const [subtasks, comments] = await Promise.all([
    listSubtasks(supabase, taskId),
    listComments(supabase, taskId),
  ])

  return (
    <>
      <PageHeader title={task.title} subtitle={`Assigned to ${assigneeName}`} />

      {task.description && <p className={`${card} mb-6 text-[0.9375rem] text-ink`}>{task.description}</p>}

      <section className={`${card} mb-6`}>
        <h2 className="font-display text-base font-semibold text-ink">Subtasks</h2>
        <div className="mt-3">
          <SubtaskList projectId={projectId} taskId={taskId} subtasks={subtasks} />
        </div>
        <AddSubtaskForm projectId={projectId} taskId={taskId} />
      </section>

      <section className={card}>
        <h2 className="font-display text-base font-semibold text-ink">Comments</h2>
        <div className="mt-3">
          <CommentThread projectId={projectId} taskId={taskId} comments={comments} />
        </div>
      </section>
    </>
  )
}
