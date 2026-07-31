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
-- Deliberately split from SELECT: the design spec scopes task/project
-- *visibility* to "own projects" for managers (they see a project's board
-- only if they're a member), while *assignment* is unrestricted (any
-- manager can assign into any project, any employee, any department, per
-- the spec's permission table). A single FOR ALL policy here would grant
-- unconditional SELECT too, silently widening visibility past what the
-- spec intends — caught in Task 1's review, fixed before this ever
-- touched a live database.
create policy "tasks_manager_unrestricted_insert" on tasks
  for insert with check (public.is_admin() or public.is_manager_or_admin());

create policy "tasks_manager_unrestricted_update" on tasks
  for update using (public.is_admin() or public.is_manager_or_admin())
  with check (public.is_admin() or public.is_manager_or_admin());

create policy "tasks_project_member_select" on tasks
  for select using (public.is_admin() or public.is_project_member(project_id));

-- A plain employee has no path to INSERT a task under any policy above
-- (tasks_manager_unrestricted_insert and Phase 2's tasks_manager_admin_write
-- are both role-gated to admin/manager) — but the design spec requires
-- employees to be able to create tasks within projects they already
-- belong to. Scoped to the caller's own membership, not the assignee's:
-- the assignee-must-also-be-a-member constraint is enforced by the
-- assign-task UI only ever offering fellow project members as options,
-- not by this policy, consistent with how assignment scope is enforced
-- elsewhere in this migration.
create policy "tasks_project_member_insert" on tasks
  for insert with check (public.is_project_member(project_id));

create index projects_status_idx on projects (status);
create index project_members_employee_id_idx on project_members (employee_id);
create index tasks_project_id_idx on tasks (project_id);
create index subtasks_task_id_idx on subtasks (task_id);
create index task_comments_task_id_idx on task_comments (task_id);
