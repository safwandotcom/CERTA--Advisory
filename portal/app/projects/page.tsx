import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireManagerOrAdmin } from '@/lib/auth'
import { listProjects } from '@/lib/projects'
import { PageHeader } from '@/components/PageHeader'
import { card } from '@/lib/ui'
import NewProjectForm from './NewProjectForm'

export default async function ProjectsPage() {
  await requireManagerOrAdmin()
  const supabase = await createClient()

  // Phase 3's whole point is that a manager can involve any employee from
  // any department in a project — Phase 2's employees RLS still scopes a
  // manager's own SELECT to their managed department(s), so the member
  // picker needs the service-role client here, not the caller's own
  // session, or a manager could only ever add people from their own
  // department. This is a plain read of names/IDs for a picker, not a
  // security-sensitive operation — actual project/task access is enforced
  // by project_members/tasks RLS elsewhere, unaffected by this query.
  const adminClient = createAdminClient()
  const { data: allEmployees } = await adminClient
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
