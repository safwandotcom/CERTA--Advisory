import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireManagerOrAdmin } from '@/lib/auth'
import { listTasksForProject } from '@/lib/tasks'
import { PageHeader } from '@/components/PageHeader'
import ProjectBoard from './ProjectBoard'
import AssignTaskForm from './AssignTaskForm'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManagerOrAdmin()
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('id, name, description').eq('id', id).single()
  if (!project) notFound()

  const tasks = await listTasksForProject(supabase, id)

  // Phase 3's whole point is that a task can be assigned to any employee
  // company-wide, not just the manager's own department — Phase 2's
  // employees RLS still scopes a manager's own SELECT to their managed
  // department(s), so this dropdown needs the service-role client here,
  // not the page's RLS-scoped `supabase` above, or the picker would
  // silently shrink to just that manager's department (the same bug
  // caught and fixed for the new-project member picker in Task 5).
  const adminClient = createAdminClient()
  const { data: allEmployees } = await adminClient
    .from('employees')
    .select('id, employee_id, name')
    .eq('archived', false)
    .order('name')

  return (
    <>
      <PageHeader title={project.name} subtitle={project.description ?? undefined} />
      <AssignTaskForm projectId={id} employees={allEmployees ?? []} />
      <ProjectBoard projectId={id} tasks={tasks} />
    </>
  )
}
