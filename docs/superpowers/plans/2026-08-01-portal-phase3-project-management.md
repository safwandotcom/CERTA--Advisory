# Portal Phase 3 (Project Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase 2's department-scoped task assignment with a Jira/ClickUp-style Projects model — any manager can assign any task to any employee in any department, tasks live inside Projects with Board/List/Calendar views, and monthly reporting moves from per-department to per-manager.

**Architecture:** Additive-first, same pattern Phase 2 used successfully: Tasks 1–12 add new schema and application code alongside the existing Phase 2 department-scoped code (which keeps working throughout, so nothing is ever broken mid-build). Task 13 is the one destructive migration — it drops `department_managers`, `is_manager_of()`, and the old cross-department assignment trigger, applied only after every task that depends on the new model is built and reviewed. Task 14 adds RLS isolation tests for the new model.

**Tech Stack:** Next.js 16 (App Router, TypeScript), Supabase (Postgres/Auth/Storage), Tailwind v4, Vitest, Playwright — same as Phases 1–2, no new dependencies.

## Global Constraints

- Archive-only: `projects.status` supports `archived`, never a hard delete of a project. Tasks/subtasks/comments are still never hard-deleted by application code.
- Every Server Action performing a privileged mutation must wrap its `requireX()` guard call in try/catch and return a friendly `{ error }`, never let it throw unhandled — this project has hit this exact regression three times before (Tasks 5, 10, 12 of Phase 2) and it is treated as mandatory here.
- Supabase embedded-relation queries (`.select('*, table(col)')`) must be checked against the schema for ambiguous join paths before shipping — Phase 2 had a live, production-breaking bug from exactly this (`employees` had two paths to `departments`). Prefer the explicit `table!constraint_name(col)` syntax whenever more than one foreign key could exist between two tables.
- View-switcher preference (Board/List/Calendar) is stored client-side (`localStorage`), not in the database — it's a UI preference, not data worth a schema column or a network round-trip.
- Task assignment by admin/superadmin/manager is genuinely unrestricted — not gated by the assigner's own project membership. Project membership *management* (adding/removing members, archiving) *is* gated to admin/superadmin or existing members. These are deliberately different scopes — see the design spec's permission table.
- `lib/ui.ts` style constants (`input`, `label`, `card`, `buttonPrimary`, `buttonCoral`, `buttonGhost`, `statusPillClass`, `rolePillClass`, `errorText`, `successText`) are the established design system — reuse them, don't invent new ad hoc styling.
- The status-select error-handling pattern established in `portal/app/manager/TaskStatusSelect.tsx` (local display state, revert-on-failure, inline error via `useTransition`) is the required pattern for any new client component that fires a Server Action outside a `<form>` and needs to surface a failure.

---

### Task 1: Database schema — Projects, members, subtasks, comments, task fields

**Files:**
- Create: `portal/supabase/migrations/0005_phase3_projects.sql`

**Interfaces:**
- Produces: `projects`, `project_members`, `subtasks`, `task_comments` tables; `tasks.project_id` / `tasks.priority` / `tasks.labels` columns; `is_project_member(uuid)` SQL function; RLS policies on all four new tables plus updated `tasks` policies that add manager-unconditional write access alongside the existing Phase 2 policies (which stay in place until Task 13).

- [ ] **Step 1: Write the migration**

`portal/supabase/migrations/0005_phase3_projects.sql`:
```sql
-- ── Projects ─────────────────────────────────────────────────────────────
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references employees(id),
  created_at timestamptz not null default now()
);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (project_id, employee_id)
);

-- ── Tasks: additive changes ──────────────────────────────────────────────
-- Nullable for now — Task 13 (after every task's tasks are backfilled into
-- a project by the app itself, since assignment always sets project_id
-- going forward) can decide whether to enforce not-null. Until then a null
-- project_id only affects tasks created before this migration landed.
alter table tasks add column project_id uuid references projects(id);
alter table tasks add column priority text not null default 'medium'
  check (priority in ('low', 'medium', 'high', 'urgent'));
alter table tasks add column labels text[] not null default '{}';

-- ── Subtasks ─────────────────────────────────────────────────────────────
create table subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Task comments ────────────────────────────────────────────────────────
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid not null references employees(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ── RLS helper ───────────────────────────────────────────────────────────
create or replace function public.is_project_member(target_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from project_members pm
    join employees e on e.id = pm.employee_id
    where e.auth_user_id = auth.uid() and pm.project_id = target_project_id
  );
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from employees e
    where e.auth_user_id = auth.uid() and e.role in ('manager', 'admin', 'superadmin')
  );
$$;

-- ── Projects RLS ─────────────────────────────────────────────────────────
alter table projects enable row level security;
alter table project_members enable row level security;
alter table subtasks enable row level security;
alter table task_comments enable row level security;

create policy "projects_select" on projects
  for select using (public.is_admin() or public.is_project_member(id));

create policy "projects_insert" on projects
  for insert with check (public.is_admin() or public.is_manager_or_admin());

create policy "projects_update" on projects
  for update using (public.is_admin() or public.is_project_member(id))
  with check (public.is_admin() or public.is_project_member(id));

create policy "project_members_select" on project_members
  for select using (public.is_admin() or public.is_project_member(project_id));

create policy "project_members_write" on project_members
  for all using (public.is_admin() or public.is_project_member(project_id))
  with check (public.is_admin() or public.is_project_member(project_id));

create policy "subtasks_select" on subtasks
  for select using (
    exists (
      select 1 from tasks t
      where t.id = subtasks.task_id
      and (public.is_admin() or public.is_project_member(t.project_id)
           or exists (select 1 from employees e where e.id = t.assigned_to and e.auth_user_id = auth.uid()))
    )
  );

create policy "subtasks_write" on subtasks
  for all using (
    exists (
      select 1 from tasks t
      where t.id = subtasks.task_id
      and (public.is_admin() or public.is_manager_or_admin()
           or exists (select 1 from employees e where e.id = t.assigned_to and e.auth_user_id = auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from tasks t
      where t.id = subtasks.task_id
      and (public.is_admin() or public.is_manager_or_admin()
           or exists (select 1 from employees e where e.id = t.assigned_to and e.auth_user_id = auth.uid()))
    )
  );

create policy "task_comments_select" on task_comments
  for select using (
    exists (
      select 1 from tasks t
      where t.id = task_comments.task_id
      and (public.is_admin() or public.is_project_member(t.project_id))
    )
  );

create policy "task_comments_insert" on task_comments
  for insert with check (
    author_id in (select id from employees where auth_user_id = auth.uid())
    and exists (
      select 1 from tasks t
      where t.id = task_comments.task_id
      and (public.is_admin() or public.is_project_member(t.project_id))
    )
  );

-- ── Tasks: unrestricted assignment for the new model ────────────────────
-- Coexists with Phase 2's tasks_manager_admin_write (still department-
-- scoped) until Task 13 removes that one. Permissive policies OR together,
-- so a manager can write via EITHER the old department-scoped policy or
-- this new unconditional one — meaning assignment is already unrestricted
-- as of this migration, even before Task 13 cleans up the old policy.
--
-- Split from SELECT: the design spec scopes task/project *visibility* to
-- "own projects" for managers, while *assignment* is unrestricted. A
-- single FOR ALL policy would grant unconditional SELECT too, silently
-- widening visibility past what the spec intends.
create policy "tasks_manager_unrestricted_insert" on tasks
  for insert with check (public.is_admin() or public.is_manager_or_admin());

create policy "tasks_manager_unrestricted_update" on tasks
  for update using (public.is_admin() or public.is_manager_or_admin())
  with check (public.is_admin() or public.is_manager_or_admin());

create policy "tasks_project_member_select" on tasks
  for select using (public.is_admin() or public.is_project_member(project_id));

-- A plain employee has no path to INSERT a task under either policy above
-- (both are role-gated to admin/manager) — but the design spec requires
-- employees to be able to create tasks within projects they already
-- belong to. Scoped to the caller's own membership; the constraint that
-- the assignee must also be a member is enforced by the assign-task UI
-- only ever offering fellow project members, not by this policy.
create policy "tasks_project_member_insert" on tasks
  for insert with check (public.is_project_member(project_id));

create index projects_status_idx on projects (status);
create index project_members_employee_id_idx on project_members (employee_id);
create index tasks_project_id_idx on tasks (project_id);
create index subtasks_task_id_idx on subtasks (task_id);
create index task_comments_task_id_idx on task_comments (task_id);
```

- [ ] **Step 2: Type-check**

```bash
cd portal
npx tsc --noEmit
```

Expected: no errors (this task is pure SQL, no app code touched yet).

- [ ] **Step 3: Commit**

```bash
git add portal/supabase/migrations/0005_phase3_projects.sql
git commit -m "Add Phase 3 schema: projects, members, subtasks, comments, task fields"
```

---

### Task 2: `lib/projects.ts` helpers

**Files:**
- Create: `portal/lib/projects.ts`
- Test: `portal/lib/projects.test.ts`

**Interfaces:**
- Consumes: none beyond `@supabase/supabase-js` types.
- Produces: `type Project = { id: string; name: string; description: string | null; status: 'active' | 'archived'; created_by: string; created_at: string }`; `createProject()`, `listProjects()`, `archiveProject()`, `listProjectMembers()`, `addProjectMember()`, `isProjectMemberLocally()` — used by every later task that touches projects.

- [ ] **Step 1: Write the failing test**

`portal/lib/projects.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseProjectMemberIds } from './projects'

describe('parseProjectMemberIds', () => {
  it('extracts all memberIds values from FormData', () => {
    const formData = new FormData()
    formData.append('memberIds', 'a')
    formData.append('memberIds', 'b')
    expect(parseProjectMemberIds(formData)).toEqual(['a', 'b'])
  })

  it('returns an empty array when none are present', () => {
    expect(parseProjectMemberIds(new FormData())).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
cd portal
npx vitest run lib/projects.test.ts
```

Expected: FAIL — `lib/projects.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`portal/lib/projects.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type Project = {
  id: string
  name: string
  description: string | null
  status: 'active' | 'archived'
  created_by: string
  created_at: string
}

export function parseProjectMemberIds(formData: FormData): string[] {
  return formData.getAll('memberIds').map((v) => String(v))
}

export async function listProjects(
  supabase: SupabaseClient,
  { includeArchived = false }: { includeArchived?: boolean } = {}
): Promise<Project[]> {
  let query = supabase.from('projects').select('*').order('name')
  if (!includeArchived) {
    query = query.eq('status', 'active')
  }
  const { data } = await query
  return data ?? []
}

export async function createProject(
  supabase: SupabaseClient,
  input: { name: string; description?: string; createdBy: string; memberIds: string[] }
): Promise<{ projectId?: string; error?: string }> {
  const { data: project, error } = await supabase
    .from('projects')
    .insert({ name: input.name, description: input.description ?? null, created_by: input.createdBy })
    .select('id')
    .single()

  if (error || !project) return { error: error?.message ?? 'Failed to create project' }

  const memberIds = Array.from(new Set([...input.memberIds, input.createdBy]))
  const { error: memberError } = await supabase
    .from('project_members')
    .insert(memberIds.map((employee_id) => ({ project_id: project.id, employee_id })))

  if (memberError) return { error: memberError.message }

  return { projectId: project.id }
}

export async function archiveProject(supabase: SupabaseClient, projectId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('projects').update({ status: 'archived' }).eq('id', projectId)
  return { error: error?.message }
}

export async function listProjectMembers(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ id: string; employee_id: string; name: string }[]> {
  const { data } = await supabase
    .from('project_members')
    .select('employees!project_members_employee_id_fkey(id, employee_id, name)')
    .eq('project_id', projectId)

  return (data ?? []).map((row) => {
    const emp = (row as unknown as { employees: { id: string; employee_id: string; name: string } }).employees
    return { id: emp.id, employee_id: emp.employee_id, name: emp.name }
  })
}

export async function addProjectMember(
  supabase: SupabaseClient,
  projectId: string,
  employeeId: string
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('project_members')
    .upsert({ project_id: projectId, employee_id: employeeId }, { onConflict: 'project_id,employee_id' })
  return { error: error?.message }
}
```

Note: `employees!project_members_employee_id_fkey` — verify this exact constraint name against `project_members`'s inline FK declaration from Task 1's migration (`employee_id uuid not null references employees(id) on delete cascade`, no explicit name given, so Postgres's default naming is `project_members_employee_id_fkey`). If a live query returns "could not find a relationship" or an ambiguity error, check the real name via `\d project_members` in the SQL Editor and correct this string — do not guess a second time, verify.

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd portal
npx vitest run lib/projects.test.ts
```

Expected: PASS.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add portal/lib/projects.ts portal/lib/projects.test.ts
git commit -m "Add lib/projects.ts helpers"
```

---

### Task 3: `lib/tasks.ts` — project scoping, priority, labels

**Files:**
- Modify: `portal/lib/tasks.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Task` type gains `project_id: string | null`, `priority: TaskPriority`, `labels: string[]`; new `type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'`; `createTask()` accepts `projectId` and optional `priority`/`labels`; new `listTasksForProject(supabase, projectId)`; `listTasksForEmployee()` unchanged in signature but now also returns the new fields.

- [ ] **Step 1: Read the current file in full**

Read `portal/lib/tasks.ts` before editing — it was last touched in Phase 2's Task 9 and has `TaskStatus`, `Task`, `createTask()`, `updateTaskStatus()`, `listTasksForDepartments()`, `listTasksForEmployee()`. Do not remove `listTasksForDepartments()` in this task — Phase 2's `/manager` page still calls it until Task 13 replaces that page.

- [ ] **Step 2: Update the file**

Add alongside the existing exports (don't remove anything yet):
```ts
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
```

Update the `Task` type to add:
```ts
  project_id: string | null
  priority: TaskPriority
  labels: string[]
```

Update `createTask()`'s input type and insert call to accept and write the new fields. Keep `departmentId` as a still-accepted (optional) parameter alongside the new optional `projectId`, so the existing Phase 2 caller (`assignTaskAction` in `app/manager/actions.ts`, which still only knows about `departmentId` until Task 7 rewrites it) keeps compiling and working exactly as before — this task must not leave the build in a broken intermediate state:
```ts
export async function createTask(
  supabase: SupabaseClient,
  input: {
    projectId?: string
    departmentId?: string // still accepted for the pre-Task-7 caller; Task 7 stops passing this
    assignedTo: string
    assignedBy: string
    title: string
    description?: string
    dueDate?: string
    priority?: TaskPriority
    labels?: string[]
  }
): Promise<{ error?: string }> {
  const { data: employee } = await supabase
    .from('employees')
    .select('department_id')
    .eq('id', input.assignedTo)
    .single()

  const { error } = await supabase.from('tasks').insert({
    project_id: input.projectId ?? null,
    department_id: input.departmentId ?? employee?.department_id ?? null,
    assigned_to: input.assignedTo,
    assigned_by: input.assignedBy,
    title: input.title,
    description: input.description ?? null,
    due_date: input.dueDate ?? null,
    priority: input.priority ?? 'medium',
    labels: input.labels ?? [],
  })
  return { error: error?.message }
}
```

Task 7 will pass `projectId` and stop passing `departmentId` (letting it fall back to the assignee's current department automatically, matching the design spec's informational-snapshot behavior) — but that's Task 7's change to make, not this one's.

Add the new project-scoped list function, using the same assignee-name-embed pattern already proven safe in this file:
```ts
export async function listTasksForProject(
  supabase: SupabaseClient,
  projectId: string
): Promise<(Task & { assignee_name: string })[]> {
  const { data } = await supabase
    .from('tasks')
    .select('*, employees!tasks_assigned_to_fkey(name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => ({
    ...row,
    assignee_name: (row as unknown as { employees: { name: string } }).employees?.name ?? 'Unknown',
  }))
}
```

- [ ] **Step 3: Type-check**

```bash
cd portal
npx tsc --noEmit
```

Expected: no errors — both `projectId` and `departmentId` are optional, so the existing `assignTaskAction` caller (still passing `departmentId`) keeps compiling unchanged. If you see an error here, something is wrong with this task's change, not an acceptable known gap — fix it before committing.

- [ ] **Step 4: Commit**

```bash
git add portal/lib/tasks.ts
git commit -m "Add project scoping, priority, and labels to lib/tasks.ts"
```

---

### Task 4: `lib/subtasks.ts` and `lib/comments.ts` helpers

**Files:**
- Create: `portal/lib/subtasks.ts`
- Create: `portal/lib/comments.ts`

**Interfaces:**
- Produces: `type Subtask = { id: string; task_id: string; title: string; done: boolean }`; `listSubtasks()`, `createSubtask()`, `toggleSubtask()`. `type TaskComment = { id: string; task_id: string; author_id: string; author_name: string; body: string; created_at: string }`; `listComments()`, `createComment()`.

- [ ] **Step 1: Write `lib/subtasks.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type Subtask = {
  id: string
  task_id: string
  title: string
  done: boolean
}

export async function listSubtasks(supabase: SupabaseClient, taskId: string): Promise<Subtask[]> {
  const { data } = await supabase
    .from('subtasks')
    .select('id, task_id, title, done')
    .eq('task_id', taskId)
    .order('created_at')
  return data ?? []
}

export async function createSubtask(
  supabase: SupabaseClient,
  taskId: string,
  title: string
): Promise<{ error?: string }> {
  const { error } = await supabase.from('subtasks').insert({ task_id: taskId, title })
  return { error: error?.message }
}

export async function toggleSubtask(
  supabase: SupabaseClient,
  subtaskId: string,
  done: boolean
): Promise<{ error?: string }> {
  const { error } = await supabase.from('subtasks').update({ done }).eq('id', subtaskId)
  return { error: error?.message }
}
```

- [ ] **Step 2: Write `lib/comments.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type TaskComment = {
  id: string
  task_id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
}

export async function listComments(supabase: SupabaseClient, taskId: string): Promise<TaskComment[]> {
  const { data } = await supabase
    .from('task_comments')
    .select('id, task_id, author_id, body, created_at, employees!task_comments_author_id_fkey(name)')
    .eq('task_id', taskId)
    .order('created_at')

  return (data ?? []).map((row) => ({
    id: row.id,
    task_id: row.task_id,
    author_id: row.author_id,
    author_name: (row as unknown as { employees: { name: string } }).employees?.name ?? 'Unknown',
    body: row.body,
    created_at: row.created_at,
  }))
}

export async function createComment(
  supabase: SupabaseClient,
  taskId: string,
  authorId: string,
  body: string
): Promise<{ error?: string }> {
  const { error } = await supabase.from('task_comments').insert({ task_id: taskId, author_id: authorId, body })
  return { error: error?.message }
}
```

Note: `employees!task_comments_author_id_fkey` — verify against `task_comments.author_id uuid not null references employees(id)` from Task 1's migration (default naming, no explicit constraint name given) before relying on it. `task_comments` has only this one FK to `employees` (unlike the Phase 2 `employees`↔`departments` case), so this embed is not ambiguous — confirm this remains true if you add any other FK to `employees` on this table.

- [ ] **Step 3: Type-check**

```bash
cd portal
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add portal/lib/subtasks.ts portal/lib/comments.ts
git commit -m "Add lib/subtasks.ts and lib/comments.ts helpers"
```

---

### Task 5: Admin/Manager — Projects list page

**Files:**
- Create: `portal/app/projects/layout.tsx`
- Create: `portal/app/projects/page.tsx`
- Create: `portal/app/projects/actions.ts`
- Create: `portal/app/projects/NewProjectForm.tsx`
- Modify: `portal/components/Sidebar.tsx`
- Modify: `portal/middleware.ts`

**Interfaces:**
- Consumes: `requireManagerOrAdmin()` (`lib/auth.ts`), `listProjects()`/`createProject()`/`parseProjectMemberIds()` (Task 2).
- Produces: `/projects` route — list of the caller's projects (admin/superadmin see all active ones), a "New project" form. This is additive; `/manager` keeps working unchanged until Task 13.

- [ ] **Step 1: Add `/projects` to the protected-routes middleware**

Read `portal/middleware.ts` in full first. It currently has a block for `/manager` (from Phase 2 Task 8) checking `['superadmin', 'admin', 'manager'].includes(employee?.role ?? '')`. Add an identical block for `/projects`, and add `/projects/:path*` to `config.matcher`. Also add `/projects` to the unauthenticated-redirect check at the top of the file (the same fix Phase 2 Task 8 had to add for `/manager` — don't reproduce that gap here for `/projects`).

- [ ] **Step 2: Write the layout**

`portal/app/projects/layout.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { requireManagerOrAdmin } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  let caller
  try {
    caller = await requireManagerOrAdmin()
  } catch {
    redirect('/login')
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        variant="manager"
        name={caller.name ?? caller.employee_id}
        roleLabel={caller.role === 'manager' ? 'Manager' : caller.role === 'superadmin' ? 'Superadmin' : 'Admin'}
      />
      <main className="flex-1 overflow-y-auto bg-white pt-14 md:pt-0">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-10 sm:py-10">{children}</div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Write the actions**

`portal/app/projects/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireManagerOrAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { createProject, parseProjectMemberIds } from '@/lib/projects'

export type ActionState = { error?: string; success?: string }

export async function createProjectAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let caller
  try {
    caller = await requireManagerOrAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Project name is required' }

  // The service-role client is required here, not the RLS-scoped one: a
  // brand-new project has zero project_members rows yet, so
  // project_members_write's is_project_member(project_id) check would
  // reject the creator's own membership insert (chicken-and-egg — you
  // can't be a member of a project before your own membership row
  // exists). Authorization is already enforced above by
  // requireManagerOrAdmin(); this mirrors the same pattern Phase 2 used
  // for setManagedDepartments().
  const supabase = createAdminClient()
  const { projectId, error } = await createProject(supabase, {
    name,
    description: String(formData.get('description') ?? '').trim() || undefined,
    createdBy: caller.id,
    memberIds: parseProjectMemberIds(formData),
  })

  if (error || !projectId) return { error: error ?? 'Failed to create project' }

  revalidatePath('/projects')
  return { success: 'Project created' }
}
```

- [ ] **Step 4: Write the page**

`portal/app/projects/page.tsx`:
```tsx
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
```

Note: `listProjects()` (from Task 2) already filters to rows visible under RLS (`projects_select`: admin sees all, everyone else only projects they're a member of) — the query itself doesn't need extra scoping here, RLS is the boundary.

- [ ] **Step 5: Write the new-project client form**

`portal/app/projects/NewProjectForm.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { card, input, label as labelClass, buttonPrimary, errorText, successText } from '@/lib/ui'
import { createProjectAction, type ActionState } from './actions'

const initialState: ActionState = {}

export default function NewProjectForm({
  employees,
}: {
  employees: { id: string; employee_id: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState)

  return (
    <section className={`${card} max-w-2xl`}>
      <h2 className="font-display text-base font-semibold text-ink">New project</h2>
      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <div>
          <label htmlFor="name" className={labelClass}>Name</label>
          <input id="name" name="name" required className={input} />
        </div>
        <div>
          <label htmlFor="description" className={labelClass}>Description</label>
          <textarea id="description" name="description" rows={2} className={input} />
        </div>
        <div>
          <p className={labelClass}>Members</p>
          <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto rounded-[10px] border border-border p-3 sm:grid-cols-2">
            {employees.map((emp) => (
              <label key={emp.id} className="flex items-center gap-2 text-[0.875rem] text-ink">
                <input type="checkbox" name="memberIds" value={emp.id} />
                {emp.name} ({emp.employee_id})
              </label>
            ))}
          </div>
        </div>

        {state.error && (
          <p role="alert" className={errorText}><AlertCircle size={16} strokeWidth={2} className="shrink-0" />{state.error}</p>
        )}
        {state.success && (
          <p className={successText}><CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />{state.success}</p>
        )}

        <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>
          {pending ? 'Creating…' : 'Create project'}
        </button>
      </form>
    </section>
  )
}
```

- [ ] **Step 6: Add the sidebar nav item**

Read `portal/components/Sidebar.tsx` in full first. Add a "Projects" entry to `MANAGER_NAV` (import a suitable icon, e.g. `FolderKanban` from `lucide-react`):
```ts
  {
    href: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    isActive: (pathname) => pathname.startsWith('/projects'),
  },
```

- [ ] **Step 7: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Log in as superadmin, visit `/projects`, create a project with a couple of members, confirm it appears in the list. Stop the dev server after.

- [ ] **Step 8: Commit**

```bash
git add portal/app/projects portal/components/Sidebar.tsx portal/middleware.ts
git commit -m "Add Projects list page and project creation"
```

---

### Task 6: Project detail page — Board / List / Calendar views

**Files:**
- Create: `portal/app/projects/[id]/page.tsx`
- Create: `portal/app/projects/[id]/ProjectBoard.tsx`
- Create: `portal/app/projects/[id]/BoardView.tsx`
- Create: `portal/app/projects/[id]/ListView.tsx`
- Create: `portal/app/projects/[id]/CalendarView.tsx`
- Create: `portal/app/projects/[id]/TaskStatusSelect.tsx`
- Create: `portal/components/ViewSwitcher.tsx`

**Interfaces:**
- Consumes: `listTasksForProject()` (Task 3), `Task`/`TaskPriority`/`TaskStatus` (Task 3), `updateTaskStatusAction` (reuse Phase 2's `app/manager/actions.ts` export — it's already unconditional for admin/manager via `requireManagerOrAdmin()`, so no new action is needed here).
- Produces: `/projects/[id]` route; `ViewMode`/`useViewMode`/`ViewSwitcher` exported from `portal/components/ViewSwitcher.tsx` (not under `app/projects/[id]/` — it lives in the shared `components/` directory specifically because Task 9 imports it verbatim for the employee personal view).

- [ ] **Step 1: Write the view switcher**

`portal/components/ViewSwitcher.tsx` (put it here, not under `app/projects/[id]/`, since Task 9 needs it too):
```tsx
'use client'

import { useEffect, useState } from 'react'
import { LayoutGrid, List as ListIcon, Calendar as CalendarIcon } from 'lucide-react'

export type ViewMode = 'board' | 'list' | 'calendar'

const OPTIONS: { mode: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { mode: 'board', label: 'Board', icon: LayoutGrid },
  { mode: 'list', label: 'List', icon: ListIcon },
  { mode: 'calendar', label: 'Calendar', icon: CalendarIcon },
]

export function useViewMode(storageKey: string): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>('board')

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey)
    if (stored === 'board' || stored === 'list' || stored === 'calendar') setMode(stored)
  }, [storageKey])

  const update = (next: ViewMode) => {
    setMode(next)
    window.localStorage.setItem(storageKey, next)
  }

  return [mode, update]
}

export function ViewSwitcher({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-[10px] border border-border bg-white p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.mode}
          type="button"
          onClick={() => onChange(opt.mode)}
          className={`flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
            mode === opt.mode ? 'bg-certa-green-tint text-certa-green-deep' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <opt.icon size={15} strokeWidth={2} />
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write the status select (project-scoped copy of the established pattern)**

`portal/app/projects/[id]/TaskStatusSelect.tsx` — copy `portal/app/manager/TaskStatusSelect.tsx` verbatim (same `displayStatus`/`syncedStatus`/error-revert pattern, same import of `updateTaskStatusAction` from `@/app/manager/actions`) — do not reinvent it, that component's error-handling design was already reviewed and fixed once in Phase 2; reusing it via copy (not a shared import, since it's small and keeps this feature self-contained) avoids re-introducing the same bug.

- [ ] **Step 3: Write the three view components**

`portal/app/projects/[id]/BoardView.tsx`:
```tsx
import type { Task, TaskStatus } from '@/lib/tasks'
import TaskStatusSelect from './TaskStatusSelect'

const COLUMNS: { status: TaskStatus; label: string; bg: string; text: string }[] = [
  { status: 'NEW', label: 'New', bg: 'bg-surface-tint', text: 'text-ink-muted' },
  { status: 'STARTED', label: 'Started', bg: 'bg-certa-green-tint', text: 'text-certa-green-deep' },
  { status: 'PENDING', label: 'Pending', bg: 'bg-white border border-signal-coral', text: 'text-signal-coral-deep' },
  { status: 'COMPLETED', label: 'Completed', bg: 'bg-certa-green-deep', text: 'text-white' },
]

export default function BoardView({ tasks }: { tasks: (Task & { assignee_name: string })[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((col) => (
        <div key={col.status} className="rounded-[12px] bg-surface-tint p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
            {col.label} ({tasks.filter((t) => t.status === col.status).length})
          </p>
          <div className="flex flex-col gap-2">
            {tasks
              .filter((t) => t.status === col.status)
              .map((task) => (
                <div key={task.id} className="rounded-[10px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                  <p className="text-[0.875rem] font-semibold text-ink">{task.title}</p>
                  <p className="mt-0.5 text-[0.75rem] text-ink-muted">{task.assignee_name}</p>
                  <div className="mt-2">
                    <TaskStatusSelect taskId={task.id} status={task.status} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

`portal/app/projects/[id]/ListView.tsx`:
```tsx
import type { Task } from '@/lib/tasks'
import { card } from '@/lib/ui'
import TaskStatusSelect from './TaskStatusSelect'

export default function ListView({ tasks }: { tasks: (Task & { assignee_name: string })[] }) {
  return (
    <section className={`${card} overflow-x-auto p-0`}>
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Task</th>
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Assignee</th>
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Priority</th>
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Due</th>
            <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-border last:border-0">
              <td className="px-6 py-3.5 text-[0.9375rem] font-semibold text-ink">{task.title}</td>
              <td className="px-6 py-3.5 text-[0.9375rem] text-ink">{task.assignee_name}</td>
              <td className="px-6 py-3.5 text-[0.9375rem] capitalize text-ink-muted">{task.priority}</td>
              <td className="px-6 py-3.5 text-[0.9375rem] text-ink-muted">{task.due_date ?? '—'}</td>
              <td className="px-6 py-3.5"><TaskStatusSelect taskId={task.id} status={task.status} /></td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-10 text-center text-[0.9375rem] text-ink-muted">No tasks yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
```

`portal/app/projects/[id]/CalendarView.tsx`:
```tsx
import type { Task } from '@/lib/tasks'
import { card } from '@/lib/ui'

export default function CalendarView({ tasks }: { tasks: (Task & { assignee_name: string })[] }) {
  const withDates = tasks.filter((t) => t.due_date)
  const byDate = new Map<string, (Task & { assignee_name: string })[]>()
  for (const task of withDates) {
    const key = task.due_date as string
    byDate.set(key, [...(byDate.get(key) ?? []), task])
  }
  const sortedDates = Array.from(byDate.keys()).sort()

  return (
    <section className={`${card}`}>
      {sortedDates.length === 0 && (
        <p className="text-[0.9375rem] text-ink-muted">No tasks with a due date yet.</p>
      )}
      <div className="flex flex-col gap-4">
        {sortedDates.map((date) => (
          <div key={date}>
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">{date}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {(byDate.get(date) ?? []).map((task) => (
                <li key={task.id} className="flex items-center justify-between rounded-[8px] bg-surface-tint px-3 py-2">
                  <span className="text-[0.875rem] font-semibold text-ink">{task.title}</span>
                  <span className="text-[0.75rem] text-ink-muted">{task.assignee_name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Write the page**

`portal/app/projects/[id]/page.tsx`:
```tsx
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
```

`ProjectBoard` is the client component wrapping the view switcher + the three view components (needed because `useViewMode` is a client hook) — write it at `portal/app/projects/[id]/ProjectBoard.tsx`:
```tsx
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
      {mode === 'board' && <BoardView tasks={tasks} />}
      {mode === 'list' && <ListView tasks={tasks} />}
      {mode === 'calendar' && <CalendarView tasks={tasks} />}
    </>
  )
}
```

- [ ] **Step 5: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Visit a project created in Task 5, confirm the view switcher works and persists across a page reload (check `localStorage`). Stop the dev server after.

- [ ] **Step 6: Commit**

```bash
git add portal/app/projects/\[id\] portal/components/ViewSwitcher.tsx
git commit -m "Add project detail page with Board/List/Calendar views"
```

---

### Task 7: Assign-task flow — unrestricted assignment, priority, labels, auto-membership

**Files:**
- Modify: `portal/app/manager/actions.ts`
- Create: `portal/app/projects/[id]/AssignTaskForm.tsx`
- Modify: `portal/app/projects/[id]/page.tsx`

**Interfaces:**
- Consumes: `createTask()` (Task 3, new signature), `addProjectMember()` (Task 2), `listProjectMembers()` (Task 2).
- Produces: `assignTaskAction` in `app/manager/actions.ts` gains project-scoping and priority/labels; a new `AssignTaskForm` on the project detail page lets any admin/manager assign a task to **any active employee company-wide**, auto-adding them to the project if they aren't already a member.

- [ ] **Step 1: Update `assignTaskAction`**

Read `portal/app/manager/actions.ts` in full first (Phase 2's version, with the try/catch fix and the manager-role gate on `submitMonthlyReportAction` already in place — don't touch that action in this task, only `assignTaskAction`). Replace `assignTaskAction`:
```ts
export async function assignTaskAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let caller
  try {
    caller = await requireManagerOrAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const projectId = String(formData.get('projectId') ?? '')
  const assignedTo = String(formData.get('assignedTo') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const dueDate = String(formData.get('dueDate') ?? '').trim()
  const priority = String(formData.get('priority') ?? 'medium') as 'low' | 'medium' | 'high' | 'urgent'
  const labels = String(formData.get('labels') ?? '')
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean)

  if (!projectId || !assignedTo || !title) {
    return { error: 'Project, assignee, and title are all required' }
  }

  // Service-role client, not the RLS-scoped one: the assigning manager is
  // not necessarily a member of projectId themselves (assignment is
  // deliberately unrestricted by project membership — see Global
  // Constraints), so project_members_write's is_project_member(project_id)
  // check would reject the auto-add-member insert below if it ran under
  // the caller's own RLS-scoped session. requireManagerOrAdmin() above
  // already did the real authorization check; this mirrors Task 5's
  // createProjectAction for the same reason.
  const supabase = createAdminClient()

  // Assignment is unrestricted by department, but the assignee must be a
  // project member to see the task in that project's views — add them if
  // they aren't already, rather than making the assigning manager do a
  // separate step first.
  await addProjectMember(supabase, projectId, assignedTo)

  const { error } = await createTask(supabase, {
    projectId,
    assignedTo,
    assignedBy: caller.id,
    title,
    description: description || undefined,
    dueDate: dueDate || undefined,
    priority,
    labels,
  })

  if (error) return { error }

  revalidatePath(`/projects/${projectId}`)
  return { success: 'Task assigned' }
}
```

Add the new imports this requires (`addProjectMember` from `@/lib/projects`, `createAdminClient` from `@/lib/supabase/admin` — check whether `app/manager/actions.ts` already imports `createAdminClient` for a different action in the same file before adding a duplicate import) to the top of the file alongside the existing ones. The existing `createClient` import can stay if other actions in the same file still use it — only `assignTaskAction` switches to the admin client.

- [ ] **Step 2: Write the assign-task form**

`portal/app/projects/[id]/AssignTaskForm.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { card, input, label as labelClass, buttonPrimary, errorText, successText } from '@/lib/ui'
import { assignTaskAction, type ActionState } from '@/app/manager/actions'

const initialState: ActionState = {}

export default function AssignTaskForm({
  projectId,
  employees,
}: {
  projectId: string
  employees: { id: string; employee_id: string; name: string }[]
}) {
  const [state, formAction, pending] = useActionState(assignTaskAction, initialState)

  return (
    <section className={`${card} mb-6 max-w-2xl`}>
      <h2 className="font-display text-base font-semibold text-ink">Assign a task</h2>
      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="projectId" value={projectId} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="assignedTo" className={labelClass}>Assign to</label>
            <select id="assignedTo" name="assignedTo" required className={input}>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_id})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="priority" className={labelClass}>Priority</label>
            <select id="priority" name="priority" defaultValue="medium" className={input}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="title" className={labelClass}>Title</label>
          <input id="title" name="title" required className={input} />
        </div>
        <div>
          <label htmlFor="description" className={labelClass}>Description</label>
          <textarea id="description" name="description" rows={2} className={input} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="dueDate" className={labelClass}>Due date</label>
            <input id="dueDate" name="dueDate" type="date" className={input} />
          </div>
          <div>
            <label htmlFor="labels" className={labelClass}>Labels (comma-separated)</label>
            <input id="labels" name="labels" placeholder="e.g. urgent-fix, client-facing" className={input} />
          </div>
        </div>

        {state.error && <p role="alert" className={errorText}><AlertCircle size={16} strokeWidth={2} className="shrink-0" />{state.error}</p>}
        {state.success && <p className={successText}><CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />{state.success}</p>}

        <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>
          {pending ? 'Assigning…' : 'Assign task'}
        </button>
      </form>
    </section>
  )
}
```

Note this deliberately offers **every active employee company-wide** in the assignee dropdown, not just current project members — matching the unrestricted-assignment requirement. The employee list is passed in as a prop from the page (all active employees, company-wide, not project-scoped).

- [ ] **Step 3: Wire it into the project detail page**

Modify `portal/app/projects/[id]/page.tsx`: fetch all active employees and render `<AssignTaskForm projectId={id} employees={allEmployees ?? []} />` above `<ProjectBoard ... />`. Use `createAdminClient()` (from `@/lib/supabase/admin`) for this specific read, not the page's existing RLS-scoped `supabase` — the same reason Task 5's member picker needed it: Phase 2's `employees` RLS still scopes a manager's own SELECT to their managed department(s), so the assignee dropdown would silently shrink to just that manager's department otherwise, contradicting "assign to any employee, any department." Task 6's `page.tsx` already has a `supabase` in scope for other reads (`listTasksForProject`, the project fetch) — those stay on the RLS-scoped client; only add a second, admin client for this one employee list:
```ts
const adminClient = createAdminClient()
const { data: allEmployees } = await adminClient
  .from('employees')
  .select('id, employee_id, name')
  .eq('archived', false)
  .order('name')
```

- [ ] **Step 4: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Assign a task to an employee not yet on the project, confirm they're auto-added as a member (check `project_members` in the SQL Editor) and the task appears in the board. Stop the dev server after.

- [ ] **Step 5: Commit**

```bash
git add portal/app/manager/actions.ts portal/app/projects/\[id\]/AssignTaskForm.tsx portal/app/projects/\[id\]/page.tsx
git commit -m "Add unrestricted task assignment with priority, labels, auto-membership"
```

---

### Task 8: Task detail — subtasks and comments

**Files:**
- Create: `portal/app/projects/[id]/tasks/[taskId]/page.tsx`
- Create: `portal/app/projects/[id]/tasks/[taskId]/actions.ts`
- Create: `portal/app/projects/[id]/tasks/[taskId]/SubtaskList.tsx`
- Create: `portal/app/projects/[id]/tasks/[taskId]/CommentThread.tsx`
- Modify: `portal/app/projects/[id]/BoardView.tsx`
- Modify: `portal/app/projects/[id]/ListView.tsx`
- Modify: `portal/app/projects/[id]/ProjectBoard.tsx`

**Interfaces:**
- Consumes: `listSubtasks()`/`createSubtask()`/`toggleSubtask()`, `listComments()`/`createComment()` (Task 4).
- Produces: `/projects/[id]/tasks/[taskId]` route — a task detail page with subtask checklist and comment thread. Task titles in Board/List views link here.

- [ ] **Step 1: Write the actions**

`portal/app/projects/[id]/tasks/[taskId]/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireManagerOrAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { createSubtask, toggleSubtask } from '@/lib/subtasks'
import { createComment } from '@/lib/comments'

export type ActionState = { error?: string; success?: string }

export async function addSubtaskAction(
  projectId: string,
  taskId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { error: 'Subtask title is required' }

  const supabase = await createClient()
  const { error } = await createSubtask(supabase, taskId, title)
  if (error) return { error }

  revalidatePath(`/projects/${projectId}/tasks/${taskId}`)
  return { success: 'Added' }
}

export async function toggleSubtaskAction(
  projectId: string,
  taskId: string,
  subtaskId: string,
  done: boolean
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await toggleSubtask(supabase, subtaskId, done)
  if (error) return { error }

  revalidatePath(`/projects/${projectId}/tasks/${taskId}`)
  return { success: 'Updated' }
}

export async function addCommentAction(
  projectId: string,
  taskId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let caller
  try {
    caller = await requireManagerOrAdmin()
  } catch {
    // Employees can comment too (any project member) — requireManagerOrAdmin
    // rejecting them here is expected; fall through to a plain auth check
    // instead of hard-failing the whole action for a valid employee comment.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: NOT_AUTHORIZED }

    const { data: employee } = await supabase.from('employees').select('id').eq('auth_user_id', user.id).single()
    if (!employee) return { error: NOT_AUTHORIZED }

    const body = String(formData.get('body') ?? '').trim()
    if (!body) return { error: 'Comment cannot be empty' }

    const { error } = await createComment(supabase, taskId, employee.id, body)
    if (error) return { error }

    revalidatePath(`/projects/${projectId}/tasks/${taskId}`)
    return { success: 'Posted' }
  }

  const body = String(formData.get('body') ?? '').trim()
  if (!body) return { error: 'Comment cannot be empty' }

  const supabase = await createClient()
  const { error } = await createComment(supabase, taskId, caller.id, body)
  if (error) return { error }

  revalidatePath(`/projects/${projectId}/tasks/${taskId}`)
  return { success: 'Posted' }
}
```

Note the shape of `addCommentAction` — `requireManagerOrAdmin()` throwing for a plain employee is the *expected* path here, not an error condition, since comments are open to any project member regardless of role. This is deliberately different from every other action in this codebase, which uses `requireManagerOrAdmin()`/`requireAdmin()` to reject non-privileged callers. Do not "fix" this into a cleaner-looking single `try/catch` that ends up rejecting employees — the RLS policy (`task_comments_insert`, Task 1) is the real authorization boundary here (checks `is_project_member`), this app-layer code only needs to confirm *some* authenticated employee is calling, not a privileged one.

- [ ] **Step 2: Write the subtask list**

`portal/app/projects/[id]/tasks/[taskId]/SubtaskList.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import type { Subtask } from '@/lib/subtasks'
import { toggleSubtaskAction } from './actions'
import { errorText } from '@/lib/ui'

export default function SubtaskList({
  projectId,
  taskId,
  subtasks,
}: {
  projectId: string
  taskId: string
  subtasks: Subtask[]
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {subtasks.map((subtask) => (
        <SubtaskRow key={subtask.id} projectId={projectId} taskId={taskId} subtask={subtask} />
      ))}
      {subtasks.length === 0 && <p className="text-[0.875rem] text-ink-muted">No subtasks yet.</p>}
    </ul>
  )
}

function SubtaskRow({ projectId, taskId, subtask }: { projectId: string; taskId: string; subtask: Subtask }) {
  const [isPending, startTransition] = useTransition()
  const [displayDone, setDisplayDone] = useState(subtask.done)
  const [error, setError] = useState<string | null>(null)

  return (
    <li className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={displayDone}
        disabled={isPending}
        onChange={(e) => {
          const previous = displayDone
          const next = e.target.checked
          setDisplayDone(next)
          setError(null)
          startTransition(async () => {
            const result = await toggleSubtaskAction(projectId, taskId, subtask.id, next)
            if (result.error) {
              setDisplayDone(previous)
              setError(result.error)
            }
          })
        }}
      />
      <span className={`text-[0.875rem] ${displayDone ? 'text-ink-muted line-through' : 'text-ink'}`}>
        {subtask.title}
      </span>
      {error && <span className={`${errorText} text-[0.75rem]`}>{error}</span>}
    </li>
  )
}
```

- [ ] **Step 3: Write the comment thread**

`portal/app/projects/[id]/tasks/[taskId]/CommentThread.tsx`:
```tsx
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
```

- [ ] **Step 4: Write the task detail page**

`portal/app/projects/[id]/tasks/[taskId]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireManagerOrAdmin } from '@/lib/auth'
import { listSubtasks } from '@/lib/subtasks'
import { listComments } from '@/lib/comments'
import { PageHeader } from '@/components/PageHeader'
import { card, label as labelClass, input, buttonPrimary } from '@/lib/ui'
import SubtaskList from './SubtaskList'
import CommentThread from './CommentThread'
import { addSubtaskAction } from './actions'

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
        <form action={addSubtaskAction.bind(null, projectId, taskId)} className="mt-4 flex gap-2">
          <input name="title" required className={input} placeholder="New subtask…" />
          <button type="submit" className={buttonPrimary}>Add</button>
        </form>
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
```

Note: `addSubtaskAction` is bound directly to a plain `<form action={...}>` here in a Server Component. This is the exact shape that broke in Phase 2 (a `useActionState`-signature action bound to a plain form fails `tsc`) — but `addSubtaskAction`'s signature here is `(projectId, taskId, prevState, formData)`, and `.bind(null, projectId, taskId)` leaves it as `(prevState, formData) => Promise<ActionState>`, which **is** a valid plain-form action signature (Next.js accepts either `(formData) => void/Promise<void>` or the bound two-remaining-arg form for progressive enhancement without `useActionState` on the reading side — since this page doesn't render `state.error` for the add-subtask form, a plain, non-`useActionState` form action is fine here; only convert to a client component with `useActionState` if you need to display its error, matching the same judgment call already made correctly elsewhere in this codebase). If `tsc` disagrees, extract a small client component the same way Phase 2's `AssignTaskForm.tsx` did — check the type error message and follow it before assuming this note is right.

- [ ] **Step 5: Link task titles to the detail page**

Modify `BoardView.tsx` and `ListView.tsx`: wrap each task's title in a `<Link href={`/projects/${projectId}/tasks/${task.id}`}>` (both components need a `projectId` prop added — thread it through from `ProjectBoard.tsx`).

- [ ] **Step 6: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Open a task, add a subtask, toggle it done and un-done, post a comment. Stop the dev server after.

- [ ] **Step 7: Commit**

```bash
git add portal/app/projects
git commit -m "Add task detail page with subtasks and comments"
```

---

### Task 9: Employee personal task view

**Files:**
- Create: `portal/app/dashboard/MyTasksView.tsx`
- Modify: `portal/app/dashboard/page.tsx`
- Modify: `portal/lib/tasks.ts`

**Interfaces:**
- Consumes: `useViewMode`/`ViewSwitcher` (Task 6), `listTasksForEmployee()` (existing, from Phase 2 Task 9).
- Produces: replaces the current simple "Your tasks" list on the employee dashboard with the same Board/List/Calendar switcher used on `/projects/[id]`, scoped to the current employee's own tasks across every project.

- [ ] **Step 1: Extend `listTasksForEmployee()` to include project names**

Read the current `listTasksForEmployee()` in `portal/lib/tasks.ts` (from Phase 2 Task 9 — currently `select('*')`). Change it to also embed the project name:
```ts
export async function listTasksForEmployee(
  supabase: SupabaseClient,
  employeeId: string
): Promise<(Task & { project_name: string | null })[]> {
  const { data } = await supabase
    .from('tasks')
    .select('*, projects(name)')
    .eq('assigned_to', employeeId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => ({
    ...row,
    project_name: (row as unknown as { projects: { name: string } | null }).projects?.name ?? null,
  }))
}
```

`tasks.project_id` has exactly one foreign key to `projects` (declared in Task 1's migration), so `projects(name)` is not ambiguous — confirm this is still true (no second FK from `tasks` to `projects` was added anywhere) before relying on the unqualified embed syntax.

- [ ] **Step 2: Write the view component**

`portal/app/dashboard/MyTasksView.tsx` — a client component structured identically to `portal/app/projects/[id]/ProjectBoard.tsx` (Task 6), reusing `useViewMode`/`ViewSwitcher` from `@/components/ViewSwitcher`, but:
- uses a different `localStorage` key (`'my-tasks-view'`, not project-specific)
- renders `EmployeeTaskStatusSelect` (the existing Phase 2 component at `portal/app/dashboard/EmployeeTaskStatusSelect.tsx`) instead of the manager-facing `TaskStatusSelect`, since an employee can only ever update their own task's status via that established action
- Board/List/Calendar sub-views for this page can be simplified copies of Task 6's three view components (drop the "Assignee" column/label from List view, since every task here is the same person's) — write them as `portal/app/dashboard/MyTasksBoardView.tsx`, `MyTasksListView.tsx`, `MyTasksCalendarView.tsx`, following the exact same structure as Task 6's versions.

```tsx
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
```

- [ ] **Step 3: Wire it into the dashboard**

Read `portal/app/dashboard/page.tsx` in full first (it currently renders a simple `<ul>` of tasks under an "Your tasks" `<section>` — Phase 2 Task 11's work, later touched by the ambiguous-embed fix). Replace that section's contents with `<MyTasksView tasks={tasks} />` (the `tasks` variable already exists from the current `listTasksForEmployee()` call — just update the destructured type to match this task's Step 1 change).

- [ ] **Step 4: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Log in as an employee with tasks across two different projects, confirm the personal view shows all of them and the switcher works. Stop the dev server after.

- [ ] **Step 5: Commit**

```bash
git add portal/app/dashboard portal/lib/tasks.ts
git commit -m "Add Board/List/Calendar personal task view for employees"
```

---

### Task 10: Employee task creation

**Files:**
- Create: `portal/app/dashboard/CreateTaskForm.tsx`
- Create: `portal/app/dashboard/actions.ts` (modify — file exists from Phase 2 Task 11)
- Modify: `portal/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `createTask()` (Task 3), `listProjectMembers()` (Task 2).
- Produces: `createOwnTaskAction` — lets an employee create a task within a project they're already a member of, assigned to themselves or a fellow member of that same project.

- [ ] **Step 1: Add the action**

Read `portal/app/dashboard/actions.ts` in full first (has `updateOwnTaskStatusAction` from Phase 2 Task 11). Add:
```ts
export async function createOwnTaskAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }

  const { data: caller } = await supabase.from('employees').select('id').eq('auth_user_id', user.id).single()
  if (!caller) return { error: 'Not authorized' }

  const projectId = String(formData.get('projectId') ?? '')
  const assignedTo = String(formData.get('assignedTo') ?? '') || caller.id
  const title = String(formData.get('title') ?? '').trim()

  if (!projectId || !title) return { error: 'Project and title are required' }

  // createTask() looks up the assignee's own department_id internally, using
  // whichever client it's given, to populate tasks.department_id (still
  // NOT NULL and still checked by Phase 2's tasks_validate_assignment
  // trigger until Task 13). If that lookup ran on the caller's own
  // RLS-scoped `supabase` client below, it would silently fail whenever
  // assignedTo is a *fellow* project member rather than the caller
  // themselves — employees_select_self_or_admin only lets an employee read
  // their own employees row, not a teammate's, so the lookup would return
  // no rows, department_id would resolve to null, and the trigger would
  // reject the insert ("assigned_to employee must belong to the task's
  // department") even when assigner and assignee share a real department.
  // This is the same class of chicken-and-egg RLS gap already fixed for
  // Task 5's createProjectAction and Task 7's assignTaskAction — the fix
  // here is narrower: only this one auxiliary read needs the service-role
  // client, not the whole action. The actual tasks INSERT below stays on
  // the caller's RLS-scoped `supabase`, so tasks_project_member_insert's
  // is_project_member(project_id) check still enforces that the caller is
  // really a member of projectId — that RLS check is the real security
  // boundary here and must not be bypassed.
  const adminClient = createAdminClient()
  const { data: assignee } = await adminClient
    .from('employees')
    .select('department_id')
    .eq('id', assignedTo)
    .single()

  // RLS (project_members_select / tasks writes) is the real boundary that
  // rejects this if the caller isn't actually a member of projectId — this
  // app-layer code doesn't need its own membership check duplicated here.
  const { error } = await createTask(supabase, {
    projectId,
    departmentId: assignee?.department_id ?? undefined,
    assignedTo,
    assignedBy: caller.id,
    title,
    description: String(formData.get('description') ?? '').trim() || undefined,
  })

  if (error) return { error }

  revalidatePath('/dashboard')
  return { success: 'Task created' }
}
```

Add `createTask` to the existing `@/lib/tasks` import at the top of the file, and add `import { createAdminClient } from '@/lib/supabase/admin'` (check it isn't already imported in this file before adding a duplicate).

- [ ] **Step 2: Write the form**

`portal/app/dashboard/CreateTaskForm.tsx` — a small `useActionState` form (same shape as every other form in this codebase) with: a `projectId` select (populated from the employee's own project memberships, passed in as a prop), an `assignedTo` select (populated from that project's members, so it needs to be a client component that refetches members when the project selection changes — for a first version, keep it simple: fetch ALL of the employee's projects' members up front server-side, pass down as `{ [projectId]: Member[] }`, and use client-side `useState` to track the selected project and filter the assignee options from that map without a network round-trip), title, description.

- [ ] **Step 3: Wire it into the dashboard**

Fetch the employee's project memberships and each project's member list in `portal/app/dashboard/page.tsx`, pass to `<CreateTaskForm />`, rendered above `<MyTasksView />`.

- [ ] **Step 4: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Log in as an employee, create a task in a project they belong to, confirm it appears for both themselves and a teammate they assigned it to. Attempt (via direct action call or by temporarily editing the form) to submit a `projectId` the employee isn't a member of — confirm RLS rejects it rather than the task silently succeeding. Stop the dev server after.

- [ ] **Step 5: Commit**

```bash
git add portal/app/dashboard
git commit -m "Let employees create tasks within their own projects"
```

---

### Task 11: Reporting — re-scope from per-department to per-manager

**Files:**
- Modify: `portal/lib/reports.ts`
- Modify: `portal/app/manager/actions.ts`
- Modify: `portal/components/MonthlyReportModal.tsx`
- Modify: `portal/app/projects/page.tsx`
- Create: `portal/supabase/migrations/0006_reports_per_manager.sql`

**Interfaces:**
- Consumes: `listProjects()` (Task 2).
- Produces: `getUnreportedPriorMonths()` rewritten to operate per-manager instead of per-department; `monthly_reports` schema change (drop the `department_id`-based unique constraint, key by `manager_id` instead).

- [ ] **Step 1: Migration — restructure `monthly_reports`**

`portal/supabase/migrations/0006_reports_per_manager.sql`:
```sql
-- Existing rows (if any) predate Projects and can't be meaningfully
-- migrated to a manager+projects shape — this system has been in active
-- use for under a week and monthly reports only start mattering after a
-- full month has elapsed, so check the live row count before assuming
-- it's safe to truncate; if any real rows exist, stop and ask rather than
-- deleting them.
delete from monthly_reports;

alter table monthly_reports drop constraint monthly_reports_department_id_period_month_key;
alter table monthly_reports drop column department_id;
alter table monthly_reports add constraint monthly_reports_manager_id_period_month_key unique (manager_id, period_month);

drop policy "monthly_reports_manager_insert" on monthly_reports;
create policy "monthly_reports_manager_insert" on monthly_reports
  for insert with check (
    manager_id in (select id from employees where auth_user_id = auth.uid())
  );

drop policy "monthly_reports_select" on monthly_reports;
create policy "monthly_reports_select" on monthly_reports
  for select using (
    public.is_admin() or manager_id in (select id from employees where auth_user_id = auth.uid())
  );
```

Verify the exact constraint name (`monthly_reports_department_id_period_month_key`) against Phase 2's migration 0002 before running this — it declared `unique (department_id, period_month)` inline with no explicit name, so Postgres's default naming applies (`<table>_<col1>_<col2>_key`); confirm via `\d monthly_reports` in the SQL Editor rather than assuming.

- [ ] **Step 2: Rewrite `getUnreportedPriorMonths()`**

Read `portal/lib/reports.ts` in full first (the rough-edges fix already made it check every unreported month, not just one — keep that behavior, just change what it iterates over). Replace the department-iteration with project-based aggregation:
```ts
export async function getUnreportedPriorMonths(
  supabase: SupabaseClient,
  managerId: string,
  managerCreatedAt: string,
  projects: { id: string; name: string }[]
): Promise<UnreportedMonth[]> {
  const lastReportableMonth = previousMonthStart()
  const firstReportableMonth = monthStart(managerCreatedAt)
  if (firstReportableMonth > lastReportableMonth) return []

  const candidateMonths = monthsBetween(firstReportableMonth, lastReportableMonth)

  const { data: existingReports } = await supabase
    .from('monthly_reports')
    .select('period_month')
    .eq('manager_id', managerId)
    .in('period_month', candidateMonths)

  const reportedMonths = new Set((existingReports ?? []).map((r) => r.period_month as string))
  const unreportedMonths = candidateMonths.filter((m) => !reportedMonths.has(m))

  const results: UnreportedMonth[] = []
  for (const periodMonth of unreportedMonths) {
    const { start, end } = periodMonthRange(periodMonth)
    const projectIds = projects.map((p) => p.id)
    const { data: tasks } = projectIds.length
      ? await supabase
          .from('tasks')
          .select('status, project_id, department_id, departments(name)')
          .in('project_id', projectIds)
          .gte('created_at', start)
          .lt('created_at', end)
      : { data: [] }

    const statusCounts: Record<TaskStatus, number> = { NEW: 0, STARTED: 0, PENDING: 0, COMPLETED: 0 }
    for (const t of tasks ?? []) statusCounts[t.status as TaskStatus] += 1

    results.push({
      managerId,
      periodMonth,
      statusCounts,
      taskCount: tasks?.length ?? 0,
      projectNames: projects.map((p) => p.name),
    })
  }

  return results.sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))
}
```

Update the `UnreportedMonth` type at the top of the file to match: replace `departmentId`/`departmentName` with `managerId: string` and `projectNames: string[]`.

Note `tasks.project_id` has exactly one FK to `projects` and `tasks.department_id` has exactly one FK to `departments` — this embed pattern (`departments(name)`) is the same safe, unambiguous shape already used elsewhere; it is not the Phase 2 ambiguous-embed bug (that was specifically `employees`↔`departments`, which had two paths — `tasks`↔`departments` only ever had one).

- [ ] **Step 3: Update the caller**

`/manager/page.tsx` still exists at this point in the plan — Task 13 is what deletes it, and that hasn't run yet — so leave it untouched in this task. Add the new monthly-report call to `portal/app/projects/page.tsx` instead: fetch the caller's `created_at` (add this to the `AuthorizedEmployee` type / `loadCallerOrThrow()`'s select if not already present — check `lib/auth.ts` first), the caller's projects (`listProjects`), call `getUnreportedPriorMonths(supabase, caller.id, caller.created_at, projects)` when `caller.role === 'manager'`, and render `<MonthlyReportModal months={...} />` at the top of the returned fragment, same placement pattern as Phase 2's `/manager` page used.

- [ ] **Step 4: Update `submitMonthlyReportAction`**

In `portal/app/manager/actions.ts`, `submitMonthlyReportAction` currently takes `(departmentId, periodMonth)`. Change its signature to `(periodMonth: string)` only (no department), and change its insert to aggregate across the caller's projects instead of one department:
```ts
export async function submitMonthlyReportAction(periodMonth: string): Promise<ActionState> {
  let caller
  try {
    caller = await requireManagerOrAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  if (caller.role !== 'manager') {
    return { error: 'Only a department manager can submit its monthly report' }
  }

  const supabase = await createClient()
  const { data: memberships } = await supabase.from('project_members').select('project_id').eq('employee_id', caller.id)
  const projectIds = (memberships ?? []).map((m) => m.project_id)

  const { start, end } = periodMonthRange(periodMonth)
  const { data: tasks } = projectIds.length
    ? await supabase.from('tasks').select('*').in('project_id', projectIds).gte('created_at', start).lt('created_at', end)
    : { data: [] }

  const statusCounts: Record<string, number> = { NEW: 0, STARTED: 0, PENDING: 0, COMPLETED: 0 }
  for (const t of tasks ?? []) statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1

  const { error } = await supabase.from('monthly_reports').insert({
    manager_id: caller.id,
    period_month: periodMonth,
    stats: { statusCounts, tasks: tasks ?? [] },
  })

  if (error) return { error: error.message }
  revalidatePath('/projects')
  return { success: 'Report submitted' }
}
```

- [ ] **Step 5: Update `MonthlyReportModal.tsx`**

Read the current file (Phase 2 Task 12) — update its `UnreportedMonth`-shaped prop usage to display `projectNames.join(', ')` instead of `departmentName`, and update its call to `submitMonthlyReportAction(current.periodMonth)` (one argument now, not two).

- [ ] **Step 6: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Temporarily adjust `previousMonthStart()` to the current month (same technique Phase 2 used), confirm the popup shows aggregated stats across a manager's projects, submit, confirm a `monthly_reports` row exists keyed by `manager_id`. Revert the temporary change before committing. Stop the dev server after.

- [ ] **Step 7: Commit**

```bash
git add portal/lib/reports.ts portal/app/manager/actions.ts portal/components/MonthlyReportModal.tsx portal/app/projects/page.tsx portal/supabase/migrations/0006_reports_per_manager.sql
git commit -m "Re-scope monthly reporting from per-department to per-manager"
```

---

### Task 12: Admin — view submitted reports (update for the new model)

**Files:**
- Modify: `portal/app/admin/reports/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: updates the existing admin reports table to show manager + projects instead of department + manager.

- [ ] **Step 1: Update the query and table**

Read `portal/app/admin/reports/page.tsx` in full (Phase 2 Task 13). Change the query's embed from `departments(name), employees!monthly_reports_manager_id_fkey(name)` to just `employees!monthly_reports_manager_id_fkey(name)` (department is gone from `monthly_reports` after Task 11's migration). Update the table: drop the "Department" column, and render the project names from `report.stats.tasks` — group the tasks by `project_id`, look up each `project_id`'s name via a `Map` built from a `listProjects(supabase, { includeArchived: true })` call at the top of the page (archived projects can still show up in historical reports), and display the resulting project name list as a column instead of the old single department name.

- [ ] **Step 2: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Visit `/admin/reports`, confirm it renders without crashing (empty state is fine if no reports exist yet — same as Phase 2's live verification of this page). Stop the dev server after.

- [ ] **Step 3: Commit**

```bash
git add portal/app/admin/reports
git commit -m "Update admin reports view for per-manager reporting"
```

---

### Task 13: Drop Phase 2's department-scoped restrictions

**Files:**
- Create: `portal/supabase/migrations/0007_drop_department_scoping.sql`
- Modify: `portal/app/manager/page.tsx` (delete — replaced by `/projects`)
- Modify: `portal/app/manager/actions.ts` (remove now-dead code, keep `updateTaskStatusAction`/`submitMonthlyReportAction`/`assignTaskAction` — these are still used, just move them or leave in place, your call, note which in your report)
- Modify: `portal/components/Sidebar.tsx` (remove the `/manager` nav item if `/manager` is deleted)
- Modify: `portal/middleware.ts` (remove the `/manager` protection block if the route no longer exists)
- Modify: `portal/lib/departments.ts` (remove `listManagedDepartmentIds`/`setManagedDepartments`/`parseManagedDepartmentIds` — no longer called by anything once `/manager`'s old page is gone; confirm with a repo-wide grep before deleting each one, the same verification discipline Phase 2 Task 6 used before dropping the legacy `department` column)

**Interfaces:**
- Produces: the live database no longer has `department_managers`, `is_manager_of()`, or the old cross-department-rejecting version of `validate_task_assignment()`.

**This is the one destructive task in this plan — do not run it until every other task is committed, reviewed, and confirmed working, exactly like Phase 2 Task 6's column drop.**

- [ ] **Step 1: Repo-wide grep before writing the migration**

Before touching any schema, grep the whole `portal/` tree for `is_manager_of`, `department_managers`, `listManagedDepartmentIds`, `setManagedDepartments`, `parseManagedDepartmentIds` — confirm every application-code reference has already been removed or replaced (Tasks 5–12 should have made `/manager`'s old page the only remaining caller). If anything still references them, stop and fix that call site as part of this task before proceeding to the migration.

- [ ] **Step 2: Write the migration**

`portal/supabase/migrations/0007_drop_department_scoping.sql`:
```sql
drop policy "employees_select_managed_department" on employees;
drop policy "tasks_manager_admin_write" on tasks;
drop policy "tasks_employee_update_own" on tasks; -- recreated below, unchanged in substance, dropped only because it's redundant with tasks_manager_unrestricted_write's coverage — actually keep this one if it still serves the employee-self-update path independent of the manager policy; verify before dropping (see note)

drop trigger "tasks_validate_assignment" on tasks;
drop function public.validate_task_assignment();

create or replace function public.stamp_task_department()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from employees where id = new.assigned_to;
  return new;
end;
$$;

create trigger tasks_stamp_department
  before insert or update of assigned_to on tasks
  for each row execute function public.stamp_task_department();

drop view if exists manager_roster;
create view manager_roster
with (security_invoker = true) as
select id, employee_id, name, department_id, status
from employees
where archived = false;
grant select on manager_roster to authenticated;

drop table department_managers;
drop function public.is_manager_of(uuid);
```

**Before running this**, re-verify the note left inline above about `tasks_employee_update_own` — read the current live RLS policy list on `tasks` via `\d+ tasks` in the SQL Editor (or `select policyname, cmd, qual from pg_policies where tablename = 'tasks'`) and confirm whether `tasks_employee_update_own` is still needed alongside `tasks_manager_unrestricted_write` (added in Task 1) before dropping it — if employees still need their own narrower update path (they do — `tasks_manager_unrestricted_write` only grants managers/admins, not the assignee themselves), **do not drop `tasks_employee_update_own`**, remove that line from the migration.

- [ ] **Step 3: Delete `/manager`'s old page and prune dead code**

Delete `portal/app/manager/page.tsx`. Remove the now-unused `is_manager_of`-dependent code paths from `portal/app/manager/actions.ts` if any remain (there shouldn't be, if Task 7 rewrote `assignTaskAction` correctly — confirm by reading the file, don't blindly delete). Remove `listManagedDepartmentIds`/`setManagedDepartments`/`parseManagedDepartmentIds` from `portal/lib/departments.ts` per Step 1's grep confirmation. Update `Sidebar.tsx` and `middleware.ts` to drop the `/manager` route entirely (redirect `/manager` to `/projects` in middleware instead of just removing the block, so any bookmarked links don't 404 — add `if (path === '/manager') return NextResponse.redirect(new URL('/projects', request.url))` near the top of the middleware function).

- [ ] **Step 4: Type-check, lint, test**

```bash
cd portal
npx tsc --noEmit
npm run lint
npm test
```

- [ ] **Step 5: Apply the migration live and verify**

The controller (not this task's implementer) applies this migration to the live Supabase project via the SQL Editor, the same way every prior migration in this codebase has been applied — implementer, prepare the file and stop here; do not attempt to apply it yourself.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Drop Phase 2 department-scoped task/roster restrictions"
```

---

### Task 14: RLS isolation tests for the Projects model

**Files:**
- Create: `portal/e2e/phase3-projects-isolation.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–13.

- [ ] **Step 1: Write the tests**

`portal/e2e/phase3-projects-isolation.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'
import { employeeIdToEmail } from '../lib/employeeAuth'
import { createProject, addProjectMember } from '../lib/projects'

test('a non-member cannot see or comment on a project they were never added to', async () => {
  const adminClient = createAdminClient()

  const memberId = `pm-member-${Date.now()}`
  const { employeeRowId: memberRowId } = await createEmployeeRecord(adminClient, {
    employeeId: memberId,
    password: 'password-member-123',
    name: 'Project Member',
    role: 'employee',
  })

  const outsiderId = `pm-outsider-${Date.now()}`
  const { employeeRowId: outsiderRowId } = await createEmployeeRecord(adminClient, {
    employeeId: outsiderId,
    password: 'password-outsider-123',
    name: 'Project Outsider',
    role: 'employee',
  })

  const { projectId } = await createProject(adminClient, {
    name: `Isolation-Test-${Date.now()}`,
    createdBy: memberRowId,
    memberIds: [memberRowId],
  })
  expect(projectId).toBeTruthy()

  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await anonClient.auth.signInWithPassword({ email: employeeIdToEmail(outsiderId), password: 'password-outsider-123' })

  const { data: visibleProjects } = await anonClient.from('projects').select('*').eq('id', projectId)
  expect(visibleProjects).toHaveLength(0)

  const { error: commentError } = await anonClient
    .from('task_comments')
    .insert({ task_id: '00000000-0000-0000-0000-000000000000', author_id: outsiderRowId, body: 'should fail' })
  expect(commentError).not.toBeNull()
})

test('any manager can assign a task to any employee regardless of department', async () => {
  const adminClient = createAdminClient()

  const deptA = await adminClient.from('departments').insert({ name: `Dept-A3-${Date.now()}` }).select('id').single()
  const deptB = await adminClient.from('departments').insert({ name: `Dept-B3-${Date.now()}` }).select('id').single()

  const managerId = `pm-mgr-${Date.now()}`
  const { employeeRowId: managerRowId } = await createEmployeeRecord(adminClient, {
    employeeId: managerId,
    password: 'password-mgr3-123',
    name: 'Cross-Dept Manager',
    role: 'manager',
    departmentId: deptA.data!.id,
  })

  const employeeInB = `pm-emp-b-${Date.now()}`
  const { employeeRowId: employeeInBRowId } = await createEmployeeRecord(adminClient, {
    employeeId: employeeInB,
    password: 'password-empb3-123',
    name: 'Employee In Other Dept',
    role: 'employee',
    departmentId: deptB.data!.id,
  })

  const { projectId } = await createProject(adminClient, {
    name: `CrossDept-Project-${Date.now()}`,
    createdBy: managerRowId,
    memberIds: [managerRowId],
  })

  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await anonClient.auth.signInWithPassword({ email: employeeIdToEmail(managerId), password: 'password-mgr3-123' })

  const { error } = await anonClient.from('tasks').insert({
    project_id: projectId,
    assigned_to: employeeInBRowId,
    assigned_by: managerRowId,
    title: 'Cross-department assignment should succeed',
  })

  expect(error).toBeNull()
})
```

- [ ] **Step 2: Run the tests**

```bash
cd portal
npx playwright test e2e/phase3-projects-isolation.spec.ts
```

Expected: PASS, 2 tests. If either fails, fix the RLS policy from Task 1 or Task 13 — never loosen the test's assertions to make it pass.

- [ ] **Step 3: Commit**

```bash
git add portal/e2e/phase3-projects-isolation.spec.ts
git commit -m "Add Phase 3 Projects RLS isolation tests"
```

---

## Self-Review Notes

- **Spec coverage:** Projects as a new entity spanning departments ✓ (Task 1), project creation by admin/superadmin/manager ✓ (Task 5), unrestricted task assignment ✓ (Task 7 + Task 1's `tasks_manager_unrestricted_write` policy), Board/List/Calendar with a per-user switcher available to every role ✓ (Tasks 6, 9), priority/labels/subtasks/comments ✓ (Tasks 1, 3, 4, 8), employee task creation scoped to their own projects ✓ (Task 10), per-manager monthly reporting ✓ (Task 11), admin report viewing updated ✓ (Task 12), old department-scoped restrictions removed only after everything else is live ✓ (Task 13), RLS isolation tests ✓ (Task 14).
- **Sequencing safety:** Tasks 1–12 are additive — Phase 2's `/manager` page, `department_managers`, and `is_manager_of()` all keep working throughout, so the build is never in a broken state. Task 13 is the only destructive step and is explicitly gated on everything else being done first, mirroring Phase 2 Task 6's proven pattern for the same kind of cutover.
- **Type consistency checked:** `Task` type (Task 3) gains `project_id`/`priority`/`labels`, used identically by `BoardView`/`ListView`/`CalendarView` (Task 6), `MyTasksBoardView`/`MyTasksListView`/`MyTasksCalendarView` (Task 9), and `AssignTaskForm` (Task 7). `ViewMode`/`useViewMode`/`ViewSwitcher` (Task 6) are defined once in `components/ViewSwitcher.tsx` and reused verbatim by Task 9, not redefined. `UnreportedMonth`'s shape change (Task 11) is applied consistently to `MonthlyReportModal.tsx` and `submitMonthlyReportAction`'s new single-argument signature in the same task.
