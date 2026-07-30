-- ── Roles ────────────────────────────────────────────────────────────────
alter table employees drop constraint employees_role_check;
alter table employees add constraint employees_role_check
  check (role in ('superadmin', 'admin', 'manager', 'employee'));

-- Migrate the existing seeded account in place.
update employees set role = 'superadmin' where employee_id = 'admin' and role = 'admin';

-- At most one superadmin can ever exist.
create unique index employees_single_superadmin_idx on employees (role) where role = 'superadmin';

-- Additive columns (department text column stays for now — dropped in a later migration
-- once no application code reads/writes it, see Task 6).
alter table employees add column archived boolean not null default false;

-- ── Departments ──────────────────────────────────────────────────────────
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table employees add column department_id uuid references departments(id);

create table department_managers (
  department_id uuid not null references departments(id) on delete cascade,
  manager_id uuid not null references employees(id) on delete cascade,
  primary key (department_id, manager_id)
);

-- ── RLS helper functions ─────────────────────────────────────────────────
-- Redefine is_admin() (from Phase 1) so every existing policy that already
-- calls it automatically grants superadmin the same access, with no policy
-- rewrites needed.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from employees e
    where e.auth_user_id = auth.uid() and e.role in ('admin', 'superadmin')
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from employees e
    where e.auth_user_id = auth.uid() and e.role = 'superadmin'
  );
$$;

create or replace function public.is_manager_of(dept_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from employees e
    join department_managers dm on dm.manager_id = e.id
    where e.auth_user_id = auth.uid() and e.role = 'manager' and dm.department_id = dept_id
  );
$$;

-- ── Departments RLS ──────────────────────────────────────────────────────
alter table departments enable row level security;
alter table department_managers enable row level security;

create policy "departments_select_authenticated" on departments
  for select using (auth.uid() is not null);

create policy "departments_admin_write" on departments
  for all using (public.is_admin()) with check (public.is_admin());

create policy "department_managers_select" on department_managers
  for select using (
    public.is_admin()
    or exists (
      select 1 from employees e
      where e.id = department_managers.manager_id and e.auth_user_id = auth.uid()
    )
  );

create policy "department_managers_admin_write" on department_managers
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Employees: managers can see their department's roster ───────────────
create policy "employees_select_managed_department" on employees
  for select using (
    department_id is not null and public.is_manager_of(department_id)
  );

-- ── Tasks ────────────────────────────────────────────────────────────────
create table tasks (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id),
  assigned_to uuid not null references employees(id),
  assigned_by uuid not null references employees(id),
  title text not null,
  description text,
  status text not null default 'NEW' check (status in ('NEW', 'STARTED', 'PENDING', 'COMPLETED')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete restrict,
  old_status text,
  new_status text not null,
  changed_by uuid not null references employees(id),
  changed_at timestamptz not null default now()
);

-- A task's assignee must belong to the task's own department — enforced at
-- the database level, not trusted to application code.
create or replace function public.validate_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from employees e
    where e.id = new.assigned_to and e.department_id = new.department_id
  ) then
    raise exception 'assigned_to employee must belong to the task''s department';
  end if;
  return new;
end;
$$;

create trigger tasks_validate_assignment
  before insert or update of assigned_to, department_id on tasks
  for each row execute function public.validate_task_assignment();

-- Bump updated_at when a task's status changes. This must run BEFORE so the
-- mutation to NEW takes effect in the stored row.
create or replace function public.touch_task_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

create trigger tasks_touch_updated_at
  before update on tasks
  for each row execute function public.touch_task_updated_at();

-- Automatic, un-bypassable status audit trail. Runs as the table owner
-- (security definer), so it can insert into task_status_history even
-- though no role is granted an INSERT policy on it below. Must run AFTER:
-- task_status_history.task_id has a FK to tasks(id), and at BEFORE-trigger
-- time the tasks row hasn't been written to the heap yet, so an INSERT here
-- would fail the FK check on every new task. By AFTER-trigger time the
-- parent row exists and the FK is satisfied.
create or replace function public.record_task_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
begin
  select e.id into actor from employees e where e.auth_user_id = auth.uid();

  if tg_op = 'INSERT' then
    insert into task_status_history (task_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, coalesce(actor, new.assigned_by));
  elsif new.status is distinct from old.status then
    insert into task_status_history (task_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, coalesce(actor, new.assigned_by));
  end if;
  return null;
end;
$$;

create trigger tasks_record_status_history
  after insert or update on tasks
  for each row execute function public.record_task_status_history();

alter table tasks enable row level security;
alter table task_status_history enable row level security;

create policy "tasks_select" on tasks
  for select using (
    public.is_admin()
    or public.is_manager_of(department_id)
    or exists (select 1 from employees e where e.id = tasks.assigned_to and e.auth_user_id = auth.uid())
  );

create policy "tasks_manager_admin_write" on tasks
  for all using (
    public.is_admin() or public.is_manager_of(department_id)
  ) with check (
    public.is_admin() or public.is_manager_of(department_id)
  );

-- Employees may update their own assigned tasks (the UI only exposes a
-- status control to them — see Task 11 — matching how employees_admin_write
-- in Phase 1 already trusts the UI/action layer to scope which fields get
-- submitted, rather than enforcing column-level restrictions in RLS).
create policy "tasks_employee_update_own" on tasks
  for update using (
    exists (select 1 from employees e where e.id = tasks.assigned_to and e.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from employees e where e.id = tasks.assigned_to and e.auth_user_id = auth.uid())
  );

-- No INSERT/UPDATE/DELETE policy on task_status_history for any role: only
-- the SECURITY DEFINER trigger above (running as the table owner) can
-- write to it. Read access mirrors the parent task's visibility.
create policy "task_status_history_select" on task_status_history
  for select using (
    exists (
      select 1 from tasks t
      where t.id = task_status_history.task_id
      and (
        public.is_admin()
        or public.is_manager_of(t.department_id)
        or exists (select 1 from employees e where e.id = t.assigned_to and e.auth_user_id = auth.uid())
      )
    )
  );

-- ── Monthly reports ──────────────────────────────────────────────────────
create table monthly_reports (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id),
  manager_id uuid not null references employees(id),
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  stats jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (department_id, period_month)
);

alter table monthly_reports enable row level security;

create policy "monthly_reports_select" on monthly_reports
  for select using (
    public.is_admin() or public.is_manager_of(department_id)
  );

create policy "monthly_reports_manager_insert" on monthly_reports
  for insert with check (
    public.is_manager_of(department_id)
  );

create policy "monthly_reports_admin_write" on monthly_reports
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Indexes ──────────────────────────────────────────────────────────────
create index tasks_assigned_to_idx on tasks (assigned_to);
create index tasks_department_id_idx on tasks (department_id);
create index task_status_history_task_id_idx on task_status_history (task_id);
create index employees_department_id_idx on employees (department_id);
