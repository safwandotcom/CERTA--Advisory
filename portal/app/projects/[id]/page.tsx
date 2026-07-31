import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireManagerOrAdmin } from '@/lib/auth'
import { listTasksForProject } from '@/lib/tasks'
import { PageHeader } from '@/components/PageHeader'
import ProjectBoard from './ProjectBoard'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManagerOrAdmin()
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('id, name, description').eq('id', id).single()
  if (!project) notFound()

  const tasks = await listTasksForProject(supabase, id)

  return (
    <>
      <PageHeader title={project.name} subtitle={project.description ?? undefined} />
      <ProjectBoard projectId={id} tasks={tasks} />
    </>
  )
}
