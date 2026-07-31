'use client'

import type { Task } from '@/lib/tasks'
import { ViewSwitcher, useViewMode } from '@/components/ViewSwitcher'
import BoardView from './BoardView'
import ListView from './ListView'
import CalendarView from './CalendarView'

export default function ProjectBoard({
  projectId,
  tasks,
}: {
  projectId: string
  tasks: (Task & { assignee_name: string })[]
}) {
  const [mode, setMode] = useViewMode(`project-view-${projectId}`)

  return (
    <>
      <div className="mb-4 flex justify-end">
        <ViewSwitcher mode={mode} onChange={setMode} />
      </div>
      {mode === 'board' && <BoardView projectId={projectId} tasks={tasks} />}
      {mode === 'list' && <ListView projectId={projectId} tasks={tasks} />}
      {mode === 'calendar' && <CalendarView tasks={tasks} />}
    </>
  )
}
