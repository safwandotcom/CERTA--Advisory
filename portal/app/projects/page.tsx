import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireManagerOrAdmin } from '@/lib/auth'
import { listProjects } from '@/lib/projects'
import { PageHeader } from '@/components/PageHeader'
import { card } from '@/lib/ui'
import NewProjectForm from './NewProjectForm'

export default async function ProjectsPage() {
  await requireManagerOrAdmin()
  const supabase = await createClient()

  const { data: allEmployees } = await supabase
    .from('employees')
    .select('id, employee_id, name')
    .eq('archived', false)
    .order('name')

  const projects = await listProjects(supabase)

  return (
    <>
      <PageHeader title="Projects" subtitle={`${projects.length} active project(s)`} />

      <NewProjectForm employees={allEmployees ?? []} />

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`} className={`${card} block hover:shadow-[0_8px_20px_rgba(35,31,32,0.08)] transition-shadow`}>
            <h3 className="font-display text-base font-semibold text-ink">{project.name}</h3>
            {project.description && <p className="mt-1 text-[0.8125rem] text-ink-muted">{project.description}</p>}
          </Link>
        ))}
        {projects.length === 0 && (
          <p className="text-[0.9375rem] text-ink-muted">No projects yet. Create one above to get started.</p>
        )}
      </section>
    </>
  )
}
