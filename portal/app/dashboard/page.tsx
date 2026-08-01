import { FileText, Download, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/PageHeader'
import { card, statusPillClass } from '@/lib/ui'
import { listTasksForEmployee } from '@/lib/tasks'
import { listProjectMembers } from '@/lib/projects'
import MyTasksView from './MyTasksView'
import CreateTaskForm from './CreateTaskForm'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('*, departments!employees_department_id_fkey(name)')
    .eq('auth_user_id', user!.id)
    .single()

  const tasks = await listTasksForEmployee(supabase, employee!.id)

  // Project memberships determine both which projects this employee can
  // create a task in (tasks_project_member_insert RLS mirrors this) and
  // who the assignee options are for each — fetched up front here so
  // CreateTaskForm can switch projects client-side without a round-trip.
  const { data: memberships } = await supabase
    .from('project_members')
    .select('projects(id, name, status)')
    .eq('employee_id', employee!.id)

  const myProjects = (memberships ?? [])
    .map((row) => (row as unknown as { projects: { id: string; name: string; status: string } | null }).projects)
    .filter((p): p is { id: string; name: string; status: string } => p !== null && p.status === 'active')
    .map(({ id, name }) => ({ id, name }))

  // listProjectMembers() embeds each row's employees!project_members_employee_id_fkey(...)
  // record. On the caller's RLS-scoped `supabase` client, employees_select_self_or_admin
  // blocks that embed for every member who isn't the caller themselves — PostgREST doesn't
  // drop the parent row in that case, it returns the embedded employees field as null, which
  // crashes listProjectMembers()'s `emp.id` access as soon as a project has a second member.
  // Same chicken-and-egg RLS gap as createOwnTaskAction's assignee lookup (and the precedent
  // in Task 5's createProjectAction / app/projects/page.tsx / app/projects/[id]/page.tsx): this
  // is a plain read to populate the assignee picker with fellow project members' name/ID, not a
  // security-sensitive check, so the service-role client is appropriate here. The real
  // authorization boundary — which projects this employee may create a task in at all — is
  // already enforced above by the RLS-scoped `memberships` query and, ultimately, by
  // tasks_project_member_insert on the actual write.
  const adminClient = createAdminClient()
  const membersByProject: { [projectId: string]: { id: string; employee_id: string; name: string }[] } = {}
  for (const project of myProjects) {
    membersByProject[project.id] = await listProjectMembers(adminClient, project.id)
  }

  const { data: documents } = await supabase
    .from('employee_documents')
    .select('*')
    .eq('employee_id', employee!.id)

  const { data: signedUrls } = documents?.length
    ? await supabase.storage
        .from('employee-documents')
        .createSignedUrls(documents.map((d) => d.file_path), 60 * 10)
    : { data: [] as { path: string; signedUrl: string }[] }

  const signedUrlMap = signedUrls || []

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Employee ID', value: employee?.employee_id },
    { label: 'Position', value: employee?.position ?? '—' },
    { label: 'Department', value: employee?.departments?.name ?? '—' },
    { label: 'Contact info', value: employee?.contact_info ?? '—' },
    { label: 'Join date', value: employee?.join_date ?? '—' },
    {
      label: 'Status',
      value: (
        <span className={statusPillClass(employee?.status === 'active' ? 'active' : 'inactive')}>
          {employee?.status}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader title={`Welcome, ${employee?.name?.split(' ')[0] ?? ''}`} subtitle="Your profile and documents" />

      <section className={card}>
        <h2 className="font-display text-base font-semibold text-ink">{employee?.name}</h2>
        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label}>
              <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                {field.label}
              </dt>
              <dd className="mt-1 text-[0.9375rem] text-ink">{field.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6">
        <CreateTaskForm projects={myProjects} membersByProject={membersByProject} />
      </div>

      <section className={`${card} mt-6`}>
        <MyTasksView tasks={tasks} />
      </section>

      <section className={`${card} mt-6`}>
        <h2 className="font-display text-base font-semibold text-ink">Your documents</h2>

        {documents && documents.length > 0 ? (
          <ul className="mt-4 divide-y divide-border">
            {documents.map((doc, i) => (
              <li key={doc.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText size={18} strokeWidth={2} className="shrink-0 text-ink-muted" />
                  <span className="truncate text-[0.9375rem] text-ink">{doc.label}</span>
                </div>
                <a
                  href={signedUrlMap?.[i]?.signedUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-semibold text-certa-green-deep hover:underline"
                >
                  <Download size={15} strokeWidth={2} />
                  Download
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-2 py-10 text-center">
            <Inbox size={28} strokeWidth={1.5} className="text-ink-muted" />
            <p className="text-[0.9375rem] text-ink-muted">
              No documents yet. Your administrator will upload documents here as they become available.
            </p>
          </div>
        )}
      </section>
    </>
  )
}
