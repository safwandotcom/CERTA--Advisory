'use client'

import type { Task } from '@/lib/tasks'
import { ViewSwitcher, useViewMode } from '@/components/ViewSwitcher'
import MyTasksBoardView from './MyTasksBoardView'
import MyTasksListView from './MyTasksListView'
import MyTasksCalendarView from './MyTasksCalendarView'

export default function MyTasksView({ tasks }: { tasks: (Task & { project_name: string | null })[] }) {
  const [mode, setMode] = useViewMode('my-tasks-view')

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink">Your tasks</h2>
        <ViewSwitcher mode={mode} onChange={setMode} />
      </div>
      {mode === 'board' && <MyTasksBoardView tasks={tasks} />}
      {mode === 'list' && <MyTasksListView tasks={tasks} />}
      {mode === 'calendar' && <MyTasksCalendarView tasks={tasks} />}
    </>
  )
}
