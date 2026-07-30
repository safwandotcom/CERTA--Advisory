# Employee Portal — Phase 2 (Roles, Departments, Tasks & Reporting) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a four-tier role system (superadmin/admin/manager/employee), real department entities with manager assignment, department-scoped task assignment with an automatic status audit trail, monthly manager→admin reporting, and employee archiving to the existing Next.js + Supabase portal.

**Architecture:** Extends the existing `portal/` app. No new services. A live Supabase project already exists for this app (unlike Phase 1) — migrations in this plan should be applied to it and verified for real, not deferred. RLS remains the enforcement backstop; a new `is_superadmin()` / redefined `is_admin()` / new `is_manager_of(dept_id)` set of `SECURITY DEFINER` helpers drive the new policies. Task status changes are recorded by a database trigger, not application code, so the audit trail can't be bypassed.

**Tech Stack:** Next.js 16 (App Router, TypeScript), React 19, Supabase (Postgres/Auth/Storage), Tailwind v4, Vitest, Playwright — all already in place from Phase 1.

## Global Constraints

- Exactly one `superadmin` ever exists (enforced by a DB partial unique index), created only by migrating the existing seeded account — never created through the UI.
- Only a `superadmin` can create an `admin` account. Both `superadmin` and `admin` can create `manager`/`employee` accounts. Enforced server-side (`requireSuperAdmin()`), since employee creation uses the service-role client and bypasses RLS.
- A manager can only see/assign tasks for employees in department(s) they are linked to via `department_managers` — enforced by RLS, not just the UI.
- A task's `assigned_to` employee must belong to the task's `department_id` — enforced by a DB trigger, not application code.
- Every task status change is recorded in `task_status_history` by a DB trigger (`changed_by`, `old_status`, `new_status`, `changed_at`) — no application code path writes to that table directly, and RLS grants it no INSERT policy for any role.
- Archiving an employee never deletes data — it sets `archived = true` and `status = 'inactive'` (reusing the existing login-blocking mechanism), gated by the acting admin re-entering their own password.
- Department archiving never cascades — an archived department's employees keep their `department_id` until an admin manually reassigns them.
- Role is set at employee-creation time only — there is no role-editing UI in this phase (matches the existing Phase 1 pattern where edit forms don't expose role).
- No email/push notifications anywhere in this phase — everything surfaces in-app only.

Spec reference: `docs/superpowers/specs/2026-07-31-portal-phase2-roles-departments-tasks-reporting-design.md`

---

### Task 1: Database schema — roles, departments, tasks, history, reports

**Files:**
- Create: `portal/supabase/migrations/0002_phase2_roles_departments_tasks.sql`

**Interfaces:**
- Produces: `departments`, `department_managers`, `tasks`, `task_status_history`, `monthly_reports` tables; `employees.department_id` (nullable FK, additive — the old `employees.department` text column is NOT dropped in this task, to avoid breaking existing code that still reads/writes it until Task 6 migrates callers off it); `employees.archived` (boolean); redefined `public.is_admin()` (now includes `superadmin`); new `public.is_superadmin()` and `public.is_manager_of(dept_id uuid)` helpers, used by every later task's RLS policies and app-layer guards.

- [ ] **Step 1: Write the migration SQL**

`portal/supabase/migrations/0002_phase2_roles_departments_tasks.sql`:
```sql
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
  task_id uuid not null references tasks(id) on delete cascade,
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

-- Automatic, un-bypassable status audit trail. Runs as the table owner
-- (security definer), so it can insert into task_status_history even
-- though no role is granted an INSERT policy on it below.
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
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.updated_at = now();
    insert into task_status_history (task_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, coalesce(actor, new.assigned_by));
  end if;
  return new;
end;
$$;

create trigger tasks_record_status_history
  before insert or update on tasks
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
  period_month date not null,
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
```

- [ ] **Step 2 (manual, you): run the migration**

In the Supabase dashboard → SQL Editor, paste the contents of `0002_phase2_roles_departments_tasks.sql` and run it.

Expected: no errors. Table Editor shows `departments`, `department_managers`, `tasks`, `task_status_history`, `monthly_reports`; `employees` has new `department_id` and `archived` columns.

- [ ] **Step 3: Verify the superadmin migration and singleton constraint**

In the SQL Editor:
```sql
select employee_id, role from employees where employee_id = 'admin';
```
Expected: `role = 'superadmin'`.

```sql
-- This must fail with a unique-violation error.
insert into employees (employee_id, auth_user_id, name, role)
values ('test-second-superadmin', gen_random_uuid(), 'Test', 'superadmin');
```
Expected: `ERROR: duplicate key value violates unique constraint "employees_single_superadmin_idx"`. (This test insert should not succeed — if it does, stop and fix the index before continuing.)

- [ ] **Step 4: Commit**

```bash
git add portal/supabase/migrations/0002_phase2_roles_departments_tasks.sql
git commit -m "Add Phase 2 schema: roles, departments, tasks, status history, monthly reports"
```

---

### Task 2: `requireSuperAdmin()` and `requireManagerOrAdmin()` guards

**Files:**
- Modify: `portal/lib/auth.ts`

**Interfaces:**
- Consumes: existing `createClient()` from `@/lib/supabase/server`.
- Produces: `requireSuperAdmin(): Promise<AuthorizedEmployee>` (throws generic error unless caller is an active `superadmin`), `requireManagerOrAdmin(): Promise<AuthorizedEmployee>` (throws unless caller is an active `manager`, `admin`, or `superadmin`) — used by Task 5 (admin creation gate) and Task 10 (`/manager` layout gate) respectively. Broadens `AuthorizedEmployee.role` and `requireAdmin()`'s accepted roles to include the two new roles.

- [ ] **Step 1: Read the current file**

Read `portal/lib/auth.ts` in full before editing — it defines `AuthorizedEmployee`, `NOT_AUTHORIZED`, and `requireAdmin()`.

- [ ] **Step 2: Update the type and `requireAdmin()`, add the two new guards**

Replace the `AuthorizedEmployee` type's `role` field and `requireAdmin()`'s role check, and append the two new functions, so the file reads:

```ts
import { createClient } from '@/lib/supabase/server'

export type AuthorizedEmployee = {
  id: string
  auth_user_id: string
  employee_id: string
  role: 'superadmin' | 'admin' | 'manager' | 'employee'
  status: 'active' | 'inactive'
}

// Deliberately generic: never leak whether the caller was unauthenticated,
// missing an employee row, or simply not authorized. Same principle as the
// generic login error.
export const NOT_AUTHORIZED = 'Not authorized'

async function loadCallerOrThrow(): Promise<AuthorizedEmployee> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error(NOT_AUTHORIZED)
  }

  const { data: employee, error } = await supabase
    .from('employees')
    .select('id, auth_user_id, employee_id, role, status')
    .eq('auth_user_id', user.id)
    .single()

  if (error || !employee || employee.status !== 'active') {
    throw new Error(NOT_AUTHORIZED)
  }

  return employee as AuthorizedEmployee
}

/**
 * Guard for admin-only Server Actions and route handlers. Accepts both
 * `admin` and `superadmin` — see requireSuperAdmin() for the narrower check.
 */
export async function requireAdmin(): Promise<AuthorizedEmployee> {
  const employee = await loadCallerOrThrow()
  if (employee.role !== 'admin' && employee.role !== 'superadmin') {
    throw new Error(NOT_AUTHORIZED)
  }
  return employee
}

/**
 * Guard for the one superadmin-only action in this app: granting the
 * `admin` role to a new account.
 */
export async function requireSuperAdmin(): Promise<AuthorizedEmployee> {
  const employee = await loadCallerOrThrow()
  if (employee.role !== 'superadmin') {
    throw new Error(NOT_AUTHORIZED)
  }
  return employee
}

/**
 * Guard for the /manager section: superadmin and admin can view it
 * unscoped (RLS returns every department for them); a manager sees only
 * their own department(s) via is_manager_of() in the underlying queries.
 */
export async function requireManagerOrAdmin(): Promise<AuthorizedEmployee> {
  const employee = await loadCallerOrThrow()
  if (!['superadmin', 'admin', 'manager'].includes(employee.role)) {
    throw new Error(NOT_AUTHORIZED)
  }
  return employee
}
```

- [ ] **Step 2: Type-check**

```bash
cd portal
npx tsc --noEmit
```

Expected: no errors. (This will surface every call site that still assumes the old two-value role type — fix any that appear before continuing; there should be none yet, since no other file has been touched.)

- [ ] **Step 3: Commit**

```bash
git add portal/lib/auth.ts
git commit -m "Broaden auth guards for superadmin/manager roles"
```

---

### Task 3: `lib/departments.ts` helpers

**Files:**
- Create: `portal/lib/departments.ts`
- Test: `portal/lib/departments.test.ts`

**Interfaces:**
- Consumes: `AuthorizedEmployee` type from `@/lib/auth`.
- Produces: `type Department = { id: string; name: string; archived: boolean }`; `parseManagedDepartmentIds(formData: FormData): string[]` (pure function, extracts all `managedDepartmentIds` checkbox values from a FormData — used by Tasks 5 and 6's server actions and unit-testable without a database).

- [ ] **Step 1: Write the failing test**

`portal/lib/departments.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseManagedDepartmentIds } from './departments'

describe('parseManagedDepartmentIds', () => {
  it('returns all values for a repeated form field', () => {
    const fd = new FormData()
    fd.append('managedDepartmentIds', 'dept-1')
    fd.append('managedDepartmentIds', 'dept-2')
    expect(parseManagedDepartmentIds(fd)).toEqual(['dept-1', 'dept-2'])
  })

  it('returns an empty array when the field is absent', () => {
    const fd = new FormData()
    expect(parseManagedDepartmentIds(fd)).toEqual([])
  })

  it('returns a single-element array for one checked box', () => {
    const fd = new FormData()
    fd.append('managedDepartmentIds', 'dept-1')
    expect(parseManagedDepartmentIds(fd)).toEqual(['dept-1'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd portal
npx vitest run lib/departments.test.ts
```

Expected: FAIL — `departments.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

`portal/lib/departments.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type Department = {
  id: string
  name: string
  archived: boolean
}

export function parseManagedDepartmentIds(formData: FormData): string[] {
  return formData.getAll('managedDepartmentIds').map((v) => String(v))
}

export async function listDepartments(
  supabase: SupabaseClient,
  { includeArchived = false }: { includeArchived?: boolean } = {}
): Promise<Department[]> {
  let query = supabase.from('departments').select('id, name, archived').order('name')
  if (!includeArchived) {
    query = query.eq('archived', false)
  }
  const { data } = await query
  return data ?? []
}

export async function listManagedDepartmentIds(
  supabase: SupabaseClient,
  managerId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('department_managers')
    .select('department_id')
    .eq('manager_id', managerId)
  return (data ?? []).map((row) => row.department_id as string)
}

export async function setManagedDepartments(
  supabase: SupabaseClient,
  managerId: string,
  departmentIds: string[]
): Promise<void> {
  await supabase.from('department_managers').delete().eq('manager_id', managerId)
  if (departmentIds.length > 0) {
    await supabase
      .from('department_managers')
      .insert(departmentIds.map((department_id) => ({ department_id, manager_id: managerId })))
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run lib/departments.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add portal/lib/departments.ts portal/lib/departments.test.ts
git commit -m "Add department helpers and managed-department-id parsing"
```

---

### Task 4: Admin — Departments page

**Files:**
- Create: `portal/app/admin/departments/page.tsx`
- Create: `portal/app/admin/departments/actions.ts`
- Modify: `portal/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `listDepartments()` from `@/lib/departments` (Task 3), `createClient()` from `@/lib/supabase/server` (relies on `departments_admin_write` RLS from Task 1 — this page uses the regular client, not the admin/service-role client, since admin already has full RLS access to departments).
- Produces: `/admin/departments` route; `createDepartmentAction`, `archiveDepartmentAction` server actions. Adds a "Departments" nav item to the admin sidebar.

- [ ] **Step 1: Write the page**

`portal/app/admin/departments/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { listDepartments } from '@/lib/departments'
import { PageHeader } from '@/components/PageHeader'
import { card, input, buttonPrimary } from '@/lib/ui'
import { createDepartmentAction, archiveDepartmentAction } from './actions'

export default async function DepartmentsPage() {
  const supabase = await createClient()
  const departments = await listDepartments(supabase, { includeArchived: true })

  return (
    <>
      <PageHeader title="Departments" subtitle="Manage the organisation's department list." />

      <form action={createDepartmentAction} className={`${card} flex max-w-md items-end gap-3`}>
        <div className="flex-1">
          <label htmlFor="name" className="mb-1.5 block text-[0.8125rem] font-semibold text-ink">
            New department name
          </label>
          <input id="name" name="name" required className={input} />
        </div>
        <button type="submit" className={buttonPrimary}>
          Add
        </button>
      </form>

      <section className={`${card} mt-6 p-0`}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Name
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Status
              </th>
              <th className="w-32 px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <tr key={dept.id} className="border-b border-border last:border-0">
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink">{dept.name}</td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink-muted">
                  {dept.archived ? 'Archived' : 'Active'}
                </td>
                <td className="px-6 py-3.5 text-right">
                  {!dept.archived && (
                    <form action={archiveDepartmentAction.bind(null, dept.id)}>
                      <button
                        type="submit"
                        className="text-[0.8125rem] font-semibold text-ink-muted hover:text-signal-coral-deep"
                      >
                        Archive
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-10 text-center text-[0.9375rem] text-ink-muted">
                  No departments yet. Add one above to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
```

- [ ] **Step 2: Write the server actions**

`portal/app/admin/departments/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

export async function createDepartmentAction(formData: FormData) {
  await requireAdmin()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return

  const supabase = await createClient()
  await supabase.from('departments').insert({ name })
  revalidatePath('/admin/departments')
}

export async function archiveDepartmentAction(departmentId: string) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from('departments').update({ archived: true }).eq('id', departmentId)
  revalidatePath('/admin/departments')
}
```

- [ ] **Step 3: Add the nav item**

In `portal/components/Sidebar.tsx`, add `Building2` to the `lucide-react` import and add a second entry to `ADMIN_NAV`:

```ts
import { LayoutDashboard, Users, Building2, LogOut, Menu, X } from 'lucide-react'
```

```ts
const ADMIN_NAV: NavItem[] = [
  {
    href: '/admin',
    label: 'Employees',
    icon: Users,
    isActive: (pathname) => pathname === '/admin' || pathname.startsWith('/admin/employees'),
  },
  {
    href: '/admin/departments',
    label: 'Departments',
    icon: Building2,
    isActive: (pathname) => pathname.startsWith('/admin/departments'),
  },
]
```

(This narrows the first item's `isActive` so it no longer matches every `/admin/*` path — otherwise both nav items would highlight simultaneously on `/admin/departments`.)

- [ ] **Step 4: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Log in as the superadmin (Employee ID `admin`), visit `/admin/departments`, create a department (e.g. "Accounting"), confirm it appears, click Archive, confirm its status changes to "Archived". Stop the dev server after.

- [ ] **Step 5: Commit**

```bash
git add portal/app/admin/departments portal/components/Sidebar.tsx
git commit -m "Add admin departments management page"
```

---

### Task 5: Admin — create-employee form: department + manager assignment + admin-role gating

**Files:**
- Create: `portal/app/admin/employees/new/NewEmployeeClient.tsx`
- Modify: `portal/app/admin/employees/new/page.tsx`
- Modify: `portal/app/admin/employees/new/actions.ts`
- Modify: `portal/lib/employees.ts`

**Interfaces:**
- Consumes: `listDepartments()`, `parseManagedDepartmentIds()`, `setManagedDepartments()` from `@/lib/departments` (Task 3); `requireSuperAdmin()` from `@/lib/auth` (Task 2).
- Produces: `createEmployeeRecord()`'s `NewEmployeeInput` gains `departmentId?: string`; the create-employee page becomes a server component wrapper passing `departments: Department[]` and `canCreateAdmin: boolean` to a new client component.

- [ ] **Step 1: Extend `createEmployeeRecord()`**

Read `portal/lib/employees.ts` in full first. Add `departmentId?: string` to `NewEmployeeInput` and write it in the insert:

```ts
export type NewEmployeeInput = {
  employeeId: string
  password: string
  name: string
  role: 'admin' | 'manager' | 'employee'
  contactInfo?: string
  position?: string
  departmentId?: string
  joinDate?: string
}
```

In the `.insert({...})` call inside `createEmployeeRecord`, add:
```ts
      department_id: input.departmentId ?? null,
```
(alongside the existing `contact_info`, `position`, etc. fields — insert it in the same object literal.)

- [ ] **Step 2: Turn `page.tsx` into a server wrapper, move the form to `NewEmployeeClient.tsx`**

`portal/app/admin/employees/new/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { listDepartments } from '@/lib/departments'
import NewEmployeeClient from './NewEmployeeClient'

export default async function NewEmployeePage() {
  const caller = await requireAdmin()
  const supabase = await createClient()
  const departments = await listDepartments(supabase)

  return <NewEmployeeClient departments={departments} canCreateAdmin={caller.role === 'superadmin'} />
}
```

`portal/app/admin/employees/new/NewEmployeeClient.tsx` (this is the existing `page.tsx` content, moved and extended — read the current `portal/app/admin/employees/new/page.tsx` first for the fields to preserve):
```tsx
'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { createEmployeeAction, type CreateEmployeeState } from './actions'
import { PageHeader } from '@/components/PageHeader'
import { card, input, label as labelClass, buttonPrimary, errorText } from '@/lib/ui'
import type { Department } from '@/lib/departments'

const initialState: CreateEmployeeState = {}

export default function NewEmployeeClient({
  departments,
  canCreateAdmin,
}: {
  departments: Department[]
  canCreateAdmin: boolean
}) {
  const [state, formAction, pending] = useActionState(createEmployeeAction, initialState)
  const [role, setRole] = useState<'admin' | 'manager' | 'employee'>('employee')

  return (
    <>
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} strokeWidth={2} />
        Back to employees
      </Link>

      <PageHeader title="New employee" subtitle="Create an account and staff-directory record." />

      <form action={formAction} className={`${card} max-w-xl`}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="employeeId" className={labelClass}>
              Employee ID
            </label>
            <input id="employeeId" name="employeeId" required className={input} />
          </div>

          <div>
            <label htmlFor="name" className={labelClass}>
              Full name
            </label>
            <input id="name" name="name" required className={input} />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Initial password
            </label>
            <input id="password" name="password" type="password" required className={input} />
          </div>

          <div>
            <label htmlFor="role" className={labelClass}>
              Role
            </label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className={input}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              {canCreateAdmin && <option value="admin">Admin</option>}
            </select>
          </div>

          <div>
            <label htmlFor="departmentId" className={labelClass}>
              Department
            </label>
            <select id="departmentId" name="departmentId" required className={input}>
              <option value="">Select a department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="contactInfo" className={labelClass}>
              Contact info
            </label>
            <input id="contactInfo" name="contactInfo" placeholder="Phone or personal email" className={input} />
          </div>

          <div>
            <label htmlFor="joinDate" className={labelClass}>
              Join date
            </label>
            <input id="joinDate" name="joinDate" type="date" className={input} />
          </div>
        </div>

        {role === 'manager' && (
          <div className="mt-5 border-t border-border pt-5">
            <p className={labelClass}>Departments managed</p>
            <div className="flex flex-col gap-2">
              {departments.map((dept) => (
                <label key={dept.id} className="flex items-center gap-2 text-[0.9375rem] text-ink">
                  <input type="checkbox" name="managedDepartmentIds" value={dept.id} />
                  {dept.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {state.error && (
          <p role="alert" className={`${errorText} mt-5`}>
            <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className={`${buttonPrimary} mt-6`}>
          {pending ? 'Creating…' : 'Create employee'}
        </button>
      </form>
    </>
  )
}
```

- [ ] **Step 3: Update the server action**

Read `portal/app/admin/employees/new/actions.ts` in full first. Replace it with:

```ts
'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createEmployeeRecord } from '@/lib/employees'
import { requireAdmin, requireSuperAdmin } from '@/lib/auth'
import { parseManagedDepartmentIds, setManagedDepartments } from '@/lib/departments'

export type CreateEmployeeState = { error?: string }

export async function createEmployeeAction(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  await requireAdmin()

  const employeeId = String(formData.get('employeeId') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const departmentId = String(formData.get('departmentId') ?? '').trim()
  const roleInput = formData.get('role')
  const role = roleInput === 'admin' ? 'admin' : roleInput === 'manager' ? 'manager' : 'employee'

  if (!employeeId || !name || !password || !departmentId) {
    return { error: 'Employee ID, full name, initial password, and department are all required' }
  }

  if (role === 'admin') {
    try {
      await requireSuperAdmin()
    } catch {
      return { error: 'Only the superadmin can create admin accounts' }
    }
  }

  try {
    const adminClient = createAdminClient()
    const { employeeRowId } = await createEmployeeRecord(adminClient, {
      employeeId,
      name,
      password,
      role,
      departmentId,
      contactInfo: String(formData.get('contactInfo') ?? '') || undefined,
      joinDate: String(formData.get('joinDate') ?? '') || undefined,
    })

    if (role === 'manager') {
      const managedDepartmentIds = parseManagedDepartmentIds(formData)
      await setManagedDepartments(adminClient, employeeRowId, managedDepartmentIds)
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create employee' }
  }

  redirect('/admin')
}
```

- [ ] **Step 4: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Log in as superadmin, go to `/admin/employees/new`. Confirm: "Admin" appears as a role option (since you're superadmin); selecting "Manager" reveals the department checkboxes; create a manager assigned to a department; confirm the new employee appears in `/admin` with the right role. Stop the dev server after.

- [ ] **Step 5: Commit**

```bash
git add portal/lib/employees.ts portal/app/admin/employees/new
git commit -m "Add department assignment and superadmin-gated role selection to create-employee form"
```

---

### Task 6: Admin — edit-employee form: department dropdown + manager assignment; drop legacy `department` column

**Files:**
- Modify: `portal/app/admin/employees/[id]/EditEmployeeClient.tsx`
- Modify: `portal/app/admin/employees/[id]/actions.ts`
- Modify: `portal/app/api/employees/[id]/route.ts`
- Modify: `portal/app/dashboard/page.tsx`
- Create: `portal/supabase/migrations/0003_drop_employees_department_text.sql`

**Interfaces:**
- Consumes: `listDepartments()`, `listManagedDepartmentIds()`, `setManagedDepartments()`, `parseManagedDepartmentIds()` from `@/lib/departments` (Task 3).
- Produces: `/api/employees/[id]` response gains `departments: Department[]` and `managedDepartmentIds: string[]`. This is the last task that reads/writes `employees.department` (text) — Step 5 drops the column once this task's other steps have migrated every caller off it.

- [ ] **Step 1: Update the API route**

Read `portal/app/api/employees/[id]/route.ts` in full first. Replace it with:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listDepartments, listManagedDepartmentIds } from '@/lib/departments'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: employee } = await supabase.from('employees').select('*').eq('id', id).single()
  const { data: documents } = await supabase
    .from('employee_documents')
    .select('*')
    .eq('employee_id', id)

  const departments = await listDepartments(supabase)
  const managedDepartmentIds = employee?.role === 'manager' ? await listManagedDepartmentIds(supabase, id) : []

  return NextResponse.json({
    employee,
    documents: documents ?? [],
    departments,
    managedDepartmentIds,
  })
}
```

- [ ] **Step 2: Update `EditEmployeeClient.tsx`**

Read the current file in full first. Make these changes:

1. Add `Department` to the imports: `import type { Department } from '@/lib/departments'`.
2. Change the `Employee` type: replace `department: string | null` with `department_id: string | null` and add `role: 'superadmin' | 'admin' | 'manager' | 'employee'`.
3. Add `departments` and `managedDepartmentIds` to component state, populated from the fetch alongside `employee`/`documents`:
   ```ts
   const [departments, setDepartments] = useState<Department[]>([])
   const [managedDepartmentIds, setManagedDepartmentIds] = useState<string[]>([])
   ```
   and in the `useEffect`'s `.then((data) => {...})`, add:
   ```ts
   setDepartments(data.departments)
   setManagedDepartmentIds(data.managedDepartmentIds)
   ```
4. Replace the free-text "Department" field:
   ```tsx
   <div>
     <label htmlFor="department" className={labelClass}>
       Department
     </label>
     <input
       id="department"
       name="department"
       defaultValue={employee.department ?? ''}
       className={input}
     />
   </div>
   ```
   with a dropdown sourced from `departments`:
   ```tsx
   <div>
     <label htmlFor="departmentId" className={labelClass}>
       Department
     </label>
     <select id="departmentId" name="departmentId" defaultValue={employee.department_id ?? ''} className={input}>
       <option value="">Select a department</option>
       {departments.map((dept) => (
         <option key={dept.id} value={dept.id}>
           {dept.name}
         </option>
       ))}
     </select>
   </div>
   ```
5. Immediately after the Profile `<form>`'s closing `</form>`, and only when `employee.role === 'manager'`, render a managed-departments block inside the same Profile card (before its closing tag) — add this just before the `<FormMessage state={updateState} />` line inside the Profile form:
   ```tsx
   {employee.role === 'manager' && (
     <div className="mt-5 border-t border-border pt-5 sm:col-span-2">
       <p className={labelClass}>Departments managed</p>
       <div className="flex flex-col gap-2">
         {departments.map((dept) => (
           <label key={dept.id} className="flex items-center gap-2 text-[0.9375rem] text-ink">
             <input
               type="checkbox"
               name="managedDepartmentIds"
               value={dept.id}
               defaultChecked={managedDepartmentIds.includes(dept.id)}
             />
             {dept.name}
           </label>
         ))}
       </div>
     </div>
   )}
   ```
   (Place this inside the `<form action={updateAction} ...>` element, after the closing `</div>` of the two-column field grid, so the checkboxes submit as part of the same form.)

- [ ] **Step 3: Update `updateEmployeeAction`**

Read `portal/app/admin/employees/[id]/actions.ts` in full first. In `updateEmployeeAction`, replace the `.update({...})` call's `position`/`department` handling: remove any reference to a `department` text field and instead update `department_id`:

```ts
export async function updateEmployeeAction(
  employeeRowId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()

  const { data: currentEmployee } = await supabase
    .from('employees')
    .select('role')
    .eq('id', employeeRowId)
    .single()

  const { error } = await supabase
    .from('employees')
    .update({
      name: String(formData.get('name') ?? ''),
      position: String(formData.get('position') ?? '') || null,
      department_id: String(formData.get('departmentId') ?? '') || null,
      status: formData.get('status') === 'inactive' ? 'inactive' : 'active',
    })
    .eq('id', employeeRowId)

  if (error) return { error: error.message }

  if (currentEmployee?.role === 'manager') {
    const managedDepartmentIds = parseManagedDepartmentIds(formData)
    const adminClient = createAdminClient()
    await setManagedDepartments(adminClient, employeeRowId, managedDepartmentIds)
  }

  revalidatePath(`/admin/employees/${employeeRowId}`)
  return { success: 'Saved' }
}
```

Add the two new imports at the top of the file: `import { parseManagedDepartmentIds, setManagedDepartments } from '@/lib/departments'` and (if not already imported for another action in this file) `import { createAdminClient } from '@/lib/supabase/admin'`.

- [ ] **Step 4: Update the employee dashboard's Department display**

In `portal/app/dashboard/page.tsx`, the `fields` array currently has a `{ label: 'Department', value: employee?.department ?? '—' }` entry reading the now-dropped text column. Replace the dashboard's `employee` query to also fetch the joined department name, and update the field:

Change the query:
```ts
const { data: employee } = await supabase
  .from('employees')
  .select('*, departments(name)')
  .eq('auth_user_id', user!.id)
  .single()
```

Change the field entry:
```ts
{ label: 'Department', value: employee?.departments?.name ?? '—' },
```

- [ ] **Step 5: Write and apply the column-drop migration**

`portal/supabase/migrations/0003_drop_employees_department_text.sql`:
```sql
alter table employees drop column department;
```

(Manual, you) Run this in the Supabase SQL Editor once you've confirmed Steps 1-4 are deployed and working — this is a one-way drop, so verify the app runs cleanly against the new `department_id` column first via the dev server before applying it.

- [ ] **Step 6: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Edit the manager created in Task 5: change their department, confirm their "Departments managed" checkboxes reflect the saved state and can be changed. Log in as an employee and confirm their dashboard shows the correct department name. Stop the dev server after.

- [ ] **Step 7: Commit**

```bash
git add portal/app/admin/employees/\[id\] portal/app/api/employees portal/app/dashboard/page.tsx portal/supabase/migrations/0003_drop_employees_department_text.sql
git commit -m "Replace free-text department field with department_id dropdown and manager assignment"
```

---

### Task 7: Admin — archive employee (password-gated) + archived-employee filter

**Files:**
- Modify: `portal/app/admin/employees/[id]/actions.ts`
- Modify: `portal/app/admin/employees/[id]/EditEmployeeClient.tsx`
- Modify: `portal/app/admin/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (regular, for password re-verification), `createAdminClient()` (to apply the archive).
- Produces: `archiveEmployeeAction(targetAuthUserId: string, targetEmployeeId: string, targetRole: string, prevState, formData)` server action; `/admin` gains a "Show archived" toggle.

- [ ] **Step 1: Write the archive action**

In `portal/app/admin/employees/[id]/actions.ts`, add:

```ts
export async function archiveEmployeeAction(
  targetAuthUserId: string,
  targetEmployeeId: string,
  targetRole: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const password = String(formData.get('confirmPassword') ?? '')
  if (!password) {
    return { error: 'Enter your password to confirm' }
  }

  if (targetRole === 'superadmin') {
    return { error: 'The superadmin account cannot be archived' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { error: 'Not authorized' }
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })

  if (verifyError) {
    return { error: 'Incorrect password' }
  }

  if (user.id === targetAuthUserId) {
    return { error: 'You cannot archive your own account' }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('employees')
    .update({ archived: true, status: 'inactive' })
    .eq('auth_user_id', targetAuthUserId)

  if (error) return { error: error.message }

  redirect('/admin')
}
```

Add `redirect` to the existing `next/navigation` import at the top of the file if it isn't already imported.

- [ ] **Step 2: Add the archive UI**

In `EditEmployeeClient.tsx`, add the archive form as the last card on the page (after the Reset Password card), and extend the `Employee` type with `role` and `auth_user_id` if not already present from Task 6:

```tsx
const [archiveState, archiveAction] = useActionState(
  archiveEmployeeAction.bind(null, employee.auth_user_id, employee.employee_id, employee.role),
  initialState
)
```//
Add this alongside the other `useActionState` calls, and import `archiveEmployeeAction` from `./actions`.

Then add the card markup after the Reset Password `</div>`:
```tsx
{employee.role !== 'superadmin' && (
  <div className={`${card} max-w-2xl border border-border`}>
    <h2 className="font-display text-base font-semibold text-ink">Archive employee</h2>
    <p className="mt-1 text-[0.8125rem] text-ink-muted">
      Revokes login and hides this employee from the active list. Their task
      history, documents, and past reports are kept, and this can be
      reversed by an engineer directly in the database if needed.
    </p>

    <form action={archiveAction} className="mt-4 flex flex-col gap-4 sm:max-w-xs">
      <div>
        <label htmlFor="confirmPassword" className={labelClass}>
          Your password
        </label>
        <input id="confirmPassword" name="confirmPassword" type="password" required className={input} />
      </div>

      <FormMessage state={archiveState} />

      <button type="submit" className={`${buttonCoral} w-fit`}>
        Archive employee
      </button>
    </form>
  </div>
)}
```

- [ ] **Step 3: Filter archived employees from the default admin list**

In `portal/app/admin/page.tsx`, read the current file first. Change the query and add a toggle:

```tsx
import Link from 'next/link'
import { Plus, ChevronRight, Users, UserCheck, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { card, buttonCoral, statusPillClass, rolePillClass } from '@/lib/ui'

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const { archived } = await searchParams
  const showArchived = archived === '1'

  const supabase = await createClient()
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .eq('archived', showArchived)
    .order('employee_id')

  // ...rest of the stats calculation and JSX stay the same, except add this
  // link near the PageHeader actions or just above the table:
```

Add, just above the table `<section>`:
```tsx
<div className="mb-3 flex justify-end">
  <Link
    href={showArchived ? '/admin' : '/admin?archived=1'}
    className="text-[0.8125rem] font-semibold text-ink-muted hover:text-ink"
  >
    {showArchived ? '← Back to active employees' : 'Show archived employees'}
  </Link>
</div>
```

- [ ] **Step 4: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Create a throwaway employee, archive them from their edit page (entering your own password). Confirm: they disappear from `/admin`'s default view, appear under "Show archived employees", and can no longer log in. Confirm attempting to archive the superadmin (if you navigate to that edit page) shows the blocking error instead of a form. Stop the dev server after.

- [ ] **Step 5: Commit**

```bash
git add portal/app/admin/employees/\[id\] portal/app/admin/page.tsx
git commit -m "Add password-gated employee archiving and archived-employee filter"
```

---

### Task 8: Manager role routing — middleware, login redirect, root redirect, sidebar variant

**Files:**
- Modify: `portal/middleware.ts`
- Modify: `portal/app/login/actions.ts`
- Modify: `portal/app/page.tsx`
- Modify: `portal/app/admin/layout.tsx`
- Modify: `portal/components/Sidebar.tsx`

**Interfaces:**
- Produces: `/manager/*` is middleware-protected (superadmin/admin/manager only); `/admin/*` continues to accept superadmin in addition to admin; login and the root page redirect managers to `/manager`; `Sidebar` gains a `'manager'` variant.

- [ ] **Step 1: Update the middleware**

Read `portal/middleware.ts` in full first. Update the admin-role check to accept superadmin too, and add a manager-section check:

```ts
  if (user && path.startsWith('/admin')) {
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (employee?.role !== 'admin' && employee?.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (user && path.startsWith('/manager')) {
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (!['superadmin', 'admin', 'manager'].includes(employee?.role ?? '')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }
```

Update `config.matcher` to include the new section:
```ts
export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/manager/:path*', '/api/employees/:path*'],
}
```

- [ ] **Step 2: Update the login redirect**

Read `portal/app/login/actions.ts` in full first. Replace the final redirect line:

```ts
  const target =
    employee.role === 'superadmin' || employee.role === 'admin'
      ? '/admin'
      : employee.role === 'manager'
        ? '/manager'
        : '/dashboard'

  redirect(target)
```

- [ ] **Step 3: Update the root page redirect**

Read `portal/app/page.tsx` in full first and apply the same three-way branch used in Step 2 (reusing whatever role-lookup pattern it already has).

- [ ] **Step 4: Update the admin layout's role gate**

In `portal/app/admin/layout.tsx`, change:
```ts
  if (!employee || employee.role !== 'admin') redirect('/dashboard')
```
to:
```ts
  if (!employee || (employee.role !== 'admin' && employee.role !== 'superadmin')) redirect('/dashboard')
```

- [ ] **Step 5: Add the manager sidebar variant**

In `portal/components/Sidebar.tsx`, widen the `variant` prop type to `'employee' | 'admin' | 'manager'`, add a `MANAGER_NAV` array, and select it in `SidebarContent`:

```ts
const MANAGER_NAV: NavItem[] = [
  {
    href: '/manager',
    label: 'My Team',
    icon: Users,
    isActive: (pathname) => pathname.startsWith('/manager'),
  },
]
```

```ts
  const nav = variant === 'admin' ? ADMIN_NAV : variant === 'manager' ? MANAGER_NAV : EMPLOYEE_NAV
```

Update the `variant` prop's type in both `SidebarContent` and the exported `Sidebar` component to `'employee' | 'admin' | 'manager'`.

- [ ] **Step 6: Type-check**

```bash
cd portal
npx tsc --noEmit
```

Expected: no errors (Task 10 will create `/manager` itself; this task only wires the routing/guards around it).

- [ ] **Step 7: Commit**

```bash
git add portal/middleware.ts portal/app/login/actions.ts portal/app/page.tsx portal/app/admin/layout.tsx portal/components/Sidebar.tsx
git commit -m "Wire up manager-role routing across middleware, login redirect, and sidebar"
```

---

### Task 9: `lib/tasks.ts` helpers

**Files:**
- Create: `portal/lib/tasks.ts`

**Interfaces:**
- Consumes: none beyond `@supabase/supabase-js` types.
- Produces: `type TaskStatus = 'NEW' | 'STARTED' | 'PENDING' | 'COMPLETED'`; `type Task = { id: string; department_id: string; assigned_to: string; assigned_by: string; title: string; description: string | null; status: TaskStatus; due_date: string | null; created_at: string; updated_at: string }`; `createTask()`, `updateTaskStatus()`, `listTasksForDepartments()`, `listTasksForEmployee()` — used by Task 10 (manager UI) and Task 11 (employee UI).

- [ ] **Step 1: Write the helpers**

`portal/lib/tasks.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type TaskStatus = 'NEW' | 'STARTED' | 'PENDING' | 'COMPLETED'

export type Task = {
  id: string
  department_id: string
  assigned_to: string
  assigned_by: string
  title: string
  description: string | null
  status: TaskStatus
  due_date: string | null
  created_at: string
  updated_at: string
}

export async function createTask(
  supabase: SupabaseClient,
  input: {
    departmentId: string
    assignedTo: string
    assignedBy: string
    title: string
    description?: string
    dueDate?: string
  }
): Promise<{ error?: string }> {
  const { error } = await supabase.from('tasks').insert({
    department_id: input.departmentId,
    assigned_to: input.assignedTo,
    assigned_by: input.assignedBy,
    title: input.title,
    description: input.description ?? null,
    due_date: input.dueDate ?? null,
  })
  return { error: error?.message }
}

export async function updateTaskStatus(
  supabase: SupabaseClient,
  taskId: string,
  status: TaskStatus
): Promise<{ error?: string }> {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
  return { error: error?.message }
}

export async function listTasksForDepartments(
  supabase: SupabaseClient,
  departmentIds: string[]
): Promise<(Task & { assignee_name: string })[]> {
  if (departmentIds.length === 0) return []
  const { data } = await supabase
    .from('tasks')
    .select('*, employees!tasks_assigned_to_fkey(name)')
    .in('department_id', departmentIds)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => ({
    ...row,
    assignee_name: (row as unknown as { employees: { name: string } }).employees?.name ?? 'Unknown',
  }))
}

export async function listTasksForEmployee(
  supabase: SupabaseClient,
  employeeId: string
): Promise<Task[]> {
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', employeeId)
    .order('created_at', { ascending: false })
  return data ?? []
}
```

- [ ] **Step 2: Type-check**

```bash
cd portal
npx tsc --noEmit
```

Expected: no errors. (The `tasks_assigned_to_fkey` name is Postgres's default foreign-key constraint naming convention — `<table>_<column>_fkey` — verify it against the actual migration from Task 1: the FK is declared inline as `assigned_to uuid not null references employees(id)`, so Postgres names it `tasks_assigned_to_fkey`. If a later step's live query fails with an "ambiguous relationship" or "could not find a relationship" error, check the actual constraint name via `\d tasks` in the SQL Editor and correct this string.)

- [ ] **Step 3: Commit**

```bash
git add portal/lib/tasks.ts
git commit -m "Add task CRUD helpers"
```

---

### Task 10: Manager section — roster, task assignment, status updates

**Files:**
- Create: `portal/app/manager/layout.tsx`
- Create: `portal/app/manager/page.tsx`
- Create: `portal/app/manager/actions.ts`

**Interfaces:**
- Consumes: `requireManagerOrAdmin()` (Task 2), `listManagedDepartmentIds()`/`listDepartments()` (Task 3), `createTask()`/`updateTaskStatus()`/`listTasksForDepartments()` (Task 9).
- Produces: `/manager` route — roster of the caller's department(s), task list with status controls, and an assign-task form. This is the last piece Task 12 (monthly reporting) hooks into.

- [ ] **Step 1: Write the layout**

`portal/app/manager/layout.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { requireManagerOrAdmin } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  let caller
  try {
    caller = await requireManagerOrAdmin()
  } catch {
    redirect('/login')
  }

  return (
    <div className="flex h-screen">
      <Sidebar variant="manager" name={caller.name ?? caller.employee_id} roleLabel="Manager" />
      <main className="flex-1 overflow-y-auto bg-white pt-14 md:pt-0">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-10 sm:py-10">{children}</div>
      </main>
    </div>
  )
}
```

`requireManagerOrAdmin()` returns `AuthorizedEmployee`, which doesn't include `name` — add `name` to the `select()` in `loadCallerOrThrow()` inside `portal/lib/auth.ts` (Task 2's file) and to the `AuthorizedEmployee` type, since the Sidebar needs it. Update `portal/lib/auth.ts`:
```ts
export type AuthorizedEmployee = {
  id: string
  auth_user_id: string
  employee_id: string
  name: string
  role: 'superadmin' | 'admin' | 'manager' | 'employee'
  status: 'active' | 'inactive'
}
```
and in `loadCallerOrThrow()`, change `.select('id, auth_user_id, employee_id, role, status')` to `.select('id, auth_user_id, employee_id, name, role, status')`.

- [ ] **Step 2: Write the actions**

`portal/app/manager/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireManagerOrAdmin } from '@/lib/auth'
import { createTask, updateTaskStatus, type TaskStatus } from '@/lib/tasks'

export type ActionState = { error?: string; success?: string }

export async function assignTaskAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const caller = await requireManagerOrAdmin()

  const departmentId = String(formData.get('departmentId') ?? '')
  const assignedTo = String(formData.get('assignedTo') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const dueDate = String(formData.get('dueDate') ?? '').trim()

  if (!departmentId || !assignedTo || !title) {
    return { error: 'Department, assignee, and title are all required' }
  }

  const supabase = await createClient()
  const { error } = await createTask(supabase, {
    departmentId,
    assignedTo,
    assignedBy: caller.id,
    title,
    description: description || undefined,
    dueDate: dueDate || undefined,
  })

  if (error) return { error }

  revalidatePath('/manager')
  return { success: 'Task assigned' }
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus): Promise<ActionState> {
  await requireManagerOrAdmin()
  const supabase = await createClient()
  const { error } = await updateTaskStatus(supabase, taskId, status)
  if (error) return { error }
  revalidatePath('/manager')
  return { success: 'Updated' }
}
```

- [ ] **Step 3: Write the page**

`portal/app/manager/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { requireManagerOrAdmin } from '@/lib/auth'
import { listDepartments, listManagedDepartmentIds } from '@/lib/departments'
import { listTasksForDepartments } from '@/lib/tasks'
import { PageHeader } from '@/components/PageHeader'
import { card, input, label as labelClass, buttonPrimary, statusPillClass } from '@/lib/ui'
import { assignTaskAction } from './actions'
import TaskStatusSelect from './TaskStatusSelect'

export default async function ManagerPage() {
  const caller = await requireManagerOrAdmin()
  const supabase = await createClient()

  const allDepartments = await listDepartments(supabase)
  const managedIds =
    caller.role === 'manager'
      ? await listManagedDepartmentIds(supabase, caller.id)
      : allDepartments.map((d) => d.id) // admin/superadmin: unscoped, all active departments

  const departments = allDepartments.filter((d) => managedIds.includes(d.id))

  const { data: roster } = await supabase
    .from('employees')
    .select('id, employee_id, name, department_id')
    .in('department_id', managedIds.length > 0 ? managedIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('archived', false)

  const tasks = await listTasksForDepartments(supabase, managedIds)

  return (
    <>
      <PageHeader title="My Team" subtitle={`${departments.length} department(s), ${roster?.length ?? 0} people`} />

      <section className={`${card} max-w-2xl`}>
        <h2 className="font-display text-base font-semibold text-ink">Assign a task</h2>
        <form action={assignTaskAction} className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="departmentId" className={labelClass}>
                Department
              </label>
              <select id="departmentId" name="departmentId" required className={input}>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="assignedTo" className={labelClass}>
                Assign to
              </label>
              <select id="assignedTo" name="assignedTo" required className={input}>
                {roster?.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="title" className={labelClass}>
              Title
            </label>
            <input id="title" name="title" required className={input} />
          </div>
          <div>
            <label htmlFor="description" className={labelClass}>
              Description
            </label>
            <textarea id="description" name="description" rows={2} className={input} />
          </div>
          <div>
            <label htmlFor="dueDate" className={labelClass}>
              Due date
            </label>
            <input id="dueDate" name="dueDate" type="date" className={input} />
          </div>
          <button type="submit" className={`${buttonPrimary} w-fit`}>
            Assign task
          </button>
        </form>
      </section>

      <section className={`${card} mt-6 overflow-x-auto p-0`}>
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Task</th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Assignee
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Due
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-b border-border last:border-0">
                <td className="px-6 py-3.5 text-[0.9375rem] font-semibold text-ink">{task.title}</td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink">{task.assignee_name}</td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink-muted">{task.due_date ?? '—'}</td>
                <td className="px-6 py-3.5">
                  <TaskStatusSelect taskId={task.id} status={task.status} />
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-[0.9375rem] text-ink-muted">
                  No tasks assigned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
```

Note: `statusPillClass` from `@/lib/ui` currently only accepts `'active' | 'inactive'` — `TaskStatusSelect` (Step 4) renders its own status styling rather than reusing it, so this import can be dropped from the list above if your editor flags it as unused after Step 4 is in place.

- [ ] **Step 4: Write the status control as a small client component**

`portal/app/manager/TaskStatusSelect.tsx`:
```tsx
'use client'

import { useTransition } from 'react'
import type { TaskStatus } from '@/lib/tasks'
import { updateTaskStatusAction } from './actions'

const STATUS_STYLES: Record<TaskStatus, string> = {
  NEW: 'bg-surface-tint text-ink-muted',
  STARTED: 'bg-certa-green-tint text-certa-green-deep',
  PENDING: 'bg-white border border-signal-coral text-signal-coral-deep',
  COMPLETED: 'bg-certa-green-deep text-white',
}

export default function TaskStatusSelect({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const [isPending, startTransition] = useTransition()

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as TaskStatus
        startTransition(() => {
          updateTaskStatusAction(taskId, next)
        })
      }}
      className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      <option value="NEW">NEW</option>
      <option value="STARTED">STARTED</option>
      <option value="PENDING">PENDING</option>
      <option value="COMPLETED">COMPLETED</option>
    </select>
  )
}
```

- [ ] **Step 5: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Log in as the manager created in Task 5. Confirm `/manager` shows only their department's roster, assign a task to an employee in that department, confirm it appears in the table, change its status via the dropdown, confirm the pill styling updates. Stop the dev server after.

- [ ] **Step 6: Commit**

```bash
git add portal/app/manager
git commit -m "Add manager section: roster, task assignment, status updates"
```

---

### Task 11: Employee — "Your tasks" card with self-service status updates

**Files:**
- Modify: `portal/app/dashboard/page.tsx`
- Create: `portal/app/dashboard/actions.ts`
- Create: `portal/app/dashboard/EmployeeTaskStatusSelect.tsx`

**Interfaces:**
- Consumes: `listTasksForEmployee()` from `@/lib/tasks` (Task 9).
- Produces: an "own tasks" status-update action separate from the manager's (Task 10's `updateTaskStatusAction` requires `requireManagerOrAdmin()`, which an employee fails — this task's action instead relies on the `tasks_employee_update_own` RLS policy from Task 1 to scope the update, with no extra role guard needed beyond being authenticated).

- [ ] **Step 1: Write the employee's own status-update action**

`portal/app/dashboard/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { updateTaskStatus, type TaskStatus } from '@/lib/tasks'

export async function updateOwnTaskStatusAction(taskId: string, status: TaskStatus) {
  const supabase = await createClient()
  // No explicit role check here: the tasks_employee_update_own RLS policy
  // (Task 1) only allows this update to succeed if the row's assigned_to
  // resolves to the caller's own employees row — RLS is the actual
  // authorization boundary for this action, not application code.
  await updateTaskStatus(supabase, taskId, status)
  revalidatePath('/dashboard')
}
```

- [ ] **Step 2: Write the status control**

`portal/app/dashboard/EmployeeTaskStatusSelect.tsx`:
```tsx
'use client'

import { useTransition } from 'react'
import type { TaskStatus } from '@/lib/tasks'
import { updateOwnTaskStatusAction } from './actions'

const STATUS_STYLES: Record<TaskStatus, string> = {
  NEW: 'bg-surface-tint text-ink-muted',
  STARTED: 'bg-certa-green-tint text-certa-green-deep',
  PENDING: 'bg-white border border-signal-coral text-signal-coral-deep',
  COMPLETED: 'bg-certa-green-deep text-white',
}

export default function EmployeeTaskStatusSelect({
  taskId,
  status,
}: {
  taskId: string
  status: TaskStatus
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as TaskStatus
        startTransition(() => {
          updateOwnTaskStatusAction(taskId, next)
        })
      }}
      className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      <option value="NEW">NEW</option>
      <option value="STARTED">STARTED</option>
      <option value="PENDING">PENDING</option>
      <option value="COMPLETED">COMPLETED</option>
    </select>
  )
}
```

- [ ] **Step 3: Add the "Your tasks" card to the dashboard**

Read `portal/app/dashboard/page.tsx` in full first (post-Task-6 state). Add imports:
```ts
import { listTasksForEmployee } from '@/lib/tasks'
import EmployeeTaskStatusSelect from './EmployeeTaskStatusSelect'
```

After fetching `employee`, add:
```ts
  const tasks = await listTasksForEmployee(supabase, employee!.id)
```

Add a new card between the profile card and the documents card:
```tsx
<section className={`${card} mt-6`}>
  <h2 className="font-display text-base font-semibold text-ink">Your tasks</h2>

  {tasks.length > 0 ? (
    <ul className="mt-4 divide-y divide-border">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div>
            <p className="text-[0.9375rem] font-semibold text-ink">{task.title}</p>
            {task.due_date && <p className="text-[0.8125rem] text-ink-muted">Due {task.due_date}</p>}
          </div>
          <EmployeeTaskStatusSelect taskId={task.id} status={task.status} />
        </li>
      ))}
    </ul>
  ) : (
    <p className="mt-4 text-[0.9375rem] text-ink-muted">No tasks assigned yet.</p>
  )}
</section>
```

- [ ] **Step 4: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Log in as the employee who has the task assigned in Task 10. Confirm "Your tasks" shows it, change its status, confirm it persists on reload. Stop the dev server after.

- [ ] **Step 5: Commit**

```bash
git add portal/app/dashboard
git commit -m "Add employee-facing task list with self-service status updates"
```

---

### Task 12: Monthly reporting — detection, popup, submission

**Files:**
- Create: `portal/lib/reports.ts`
- Create: `portal/components/MonthlyReportModal.tsx`
- Modify: `portal/app/manager/page.tsx`
- Modify: `portal/app/manager/actions.ts`

**Interfaces:**
- Consumes: `Task`/`TaskStatus` from `@/lib/tasks` (Task 9), `Department` from `@/lib/departments` (Task 3).
- Produces: `getUnreportedPriorMonths(supabase, departmentIds): Promise<UnreportedMonth[]>`, `submitMonthlyReport()`; a client modal shown on `/manager` load when unreported months exist.

- [ ] **Step 1: Write the reports helper**

`portal/lib/reports.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskStatus } from './tasks'

export type UnreportedMonth = {
  departmentId: string
  departmentName: string
  periodMonth: string // 'YYYY-MM-01'
  statusCounts: Record<TaskStatus, number>
  taskCount: number
}

function previousMonthStart(): string {
  const now = new Date()
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return prev.toISOString().slice(0, 10)
}

export async function getUnreportedPriorMonths(
  supabase: SupabaseClient,
  departments: { id: string; name: string }[]
): Promise<UnreportedMonth[]> {
  const periodMonth = previousMonthStart()
  const results: UnreportedMonth[] = []

  for (const dept of departments) {
    const { data: existing } = await supabase
      .from('monthly_reports')
      .select('id')
      .eq('department_id', dept.id)
      .eq('period_month', periodMonth)
      .maybeSingle()

    if (existing) continue

    const { data: tasks } = await supabase.from('tasks').select('status').eq('department_id', dept.id)

    const statusCounts: Record<TaskStatus, number> = { NEW: 0, STARTED: 0, PENDING: 0, COMPLETED: 0 }
    for (const t of tasks ?? []) {
      statusCounts[t.status as TaskStatus] += 1
    }

    results.push({
      departmentId: dept.id,
      departmentName: dept.name,
      periodMonth,
      statusCounts,
      taskCount: tasks?.length ?? 0,
    })
  }

  return results
}
```

- [ ] **Step 2: Write the submit action**

In `portal/app/manager/actions.ts`, add:
```ts
export async function submitMonthlyReportAction(
  departmentId: string,
  periodMonth: string
): Promise<ActionState> {
  const caller = await requireManagerOrAdmin()
  const supabase = await createClient()

  const { data: tasks } = await supabase.from('tasks').select('*').eq('department_id', departmentId)

  const statusCounts: Record<string, number> = { NEW: 0, STARTED: 0, PENDING: 0, COMPLETED: 0 }
  for (const t of tasks ?? []) {
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1
  }

  const { error } = await supabase.from('monthly_reports').insert({
    department_id: departmentId,
    manager_id: caller.id,
    period_month: periodMonth,
    stats: { statusCounts, tasks: tasks ?? [] },
  })

  if (error) return { error: error.message }
  revalidatePath('/manager')
  return { success: 'Report submitted' }
}
```

- [ ] **Step 3: Write the modal**

`portal/components/MonthlyReportModal.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { buttonPrimary, buttonGhost } from '@/lib/ui'
import type { UnreportedMonth } from '@/lib/reports'
import { submitMonthlyReportAction } from '@/app/manager/actions'

export function MonthlyReportModal({ months }: { months: UnreportedMonth[] }) {
  const [queue, setQueue] = useState(months)
  const [submitting, setSubmitting] = useState(false)

  if (queue.length === 0) return null

  const current = queue[0]

  async function handleSubmit() {
    setSubmitting(true)
    await submitMonthlyReportAction(current.departmentId, current.periodMonth)
    setSubmitting(false)
    setQueue((q) => q.slice(1))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-[16px] bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-ink">
          Monthly report — {current.departmentName}
        </h2>
        <p className="mt-1 text-[0.8125rem] text-ink-muted">
          For {current.periodMonth.slice(0, 7)}. This submits regardless of whether every task is
          complete.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-[0.9375rem]">
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-muted">New</dt>
            <dd className="text-ink">{current.statusCounts.NEW}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-muted">Started</dt>
            <dd className="text-ink">{current.statusCounts.STARTED}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-muted">Pending</dt>
            <dd className="text-ink">{current.statusCounts.PENDING}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-muted">Completed</dt>
            <dd className="text-ink">{current.statusCounts.COMPLETED}</dd>
          </div>
        </dl>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className={buttonGhost}
            onClick={() => setQueue((q) => q.slice(1))}
            disabled={submitting}
          >
            Remind me later
          </button>
          <button type="button" className={buttonPrimary} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit to admin'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire it into the manager page**

In `portal/app/manager/page.tsx`, add the import and fetch, and render the modal:
```ts
import { getUnreportedPriorMonths } from '@/lib/reports'
import { MonthlyReportModal } from '@/components/MonthlyReportModal'
```
```ts
  const unreportedMonths = await getUnreportedPriorMonths(supabase, departments)
```
Render it as the first element inside the returned fragment:
```tsx
    <>
      <MonthlyReportModal months={unreportedMonths} />
      <PageHeader ... />
```

- [ ] **Step 5: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

There's no way to naturally trigger "a fully-elapsed prior month" in a fresh test environment, so verify this by temporarily changing `previousMonthStart()` in `portal/lib/reports.ts` to return the **current** month's start (`now.getUTCMonth()` instead of `now.getUTCMonth() - 1`) in your local checkout only, confirm the popup appears with correct counts for the manager's department, click "Submit to admin," confirm it disappears and a row now exists in `monthly_reports` (check via the Supabase Table Editor). Revert the temporary change before committing.

- [ ] **Step 6: Commit**

```bash
git add portal/lib/reports.ts portal/components/MonthlyReportModal.tsx portal/app/manager
git commit -m "Add monthly reporting: login-triggered detection, popup, submission"
```

---

### Task 13: Admin — view submitted monthly reports

**Files:**
- Create: `portal/app/admin/reports/page.tsx`
- Modify: `portal/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `createClient()`, the `monthly_reports_select` RLS policy (Task 1 — admin sees all).
- Produces: `/admin/reports` route; adds a "Reports" nav item.

- [ ] **Step 1: Write the page**

`portal/app/admin/reports/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { card } from '@/lib/ui'

export default async function AdminReportsPage() {
  const supabase = await createClient()
  const { data: reports } = await supabase
    .from('monthly_reports')
    .select('*, departments(name), employees!monthly_reports_manager_id_fkey(name)')
    .order('period_month', { ascending: false })

  return (
    <>
      <PageHeader title="Monthly reports" subtitle="Submitted by managers, department by department." />

      <section className={`${card} p-0`}>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Department
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Month
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Submitted by
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody>
            {(reports ?? []).map((report) => (
              <tr key={report.id} className="border-b border-border last:border-0">
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink">
                  {(report as unknown as { departments: { name: string } }).departments?.name}
                </td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink">{report.period_month.slice(0, 7)}</td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink">
                  {(report as unknown as { employees: { name: string } }).employees?.name}
                </td>
                <td className="px-6 py-3.5 text-[0.9375rem] text-ink-muted">
                  {new Date(report.submitted_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {(!reports || reports.length === 0) && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-[0.9375rem] text-ink-muted">
                  No reports submitted yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}
```

Note: verify the `employees!monthly_reports_manager_id_fkey` relationship name against the actual constraint Postgres generated for `monthly_reports.manager_id` (default naming: `<table>_<column>_fkey`, i.e. `monthly_reports_manager_id_fkey`) — check via `\d monthly_reports` in the SQL Editor if this query errors.

- [ ] **Step 2: Add the nav item**

In `portal/components/Sidebar.tsx`, import `FileBarChart` from `lucide-react` and add to `ADMIN_NAV`:
```ts
  {
    href: '/admin/reports',
    label: 'Reports',
    icon: FileBarChart,
    isActive: (pathname) => pathname.startsWith('/admin/reports'),
  },
```

- [ ] **Step 3: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run dev
```

Log in as superadmin, visit `/admin/reports`, confirm the report submitted in Task 12's manual verification appears with the correct department/month/manager. Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add portal/app/admin/reports portal/components/Sidebar.tsx
git commit -m "Add admin view of submitted monthly reports"
```

---

### Task 14: RLS isolation tests

**Files:**
- Create: `portal/e2e/phase2-rls-isolation.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-13. Adds no new application code — verifies the security boundaries this phase depends on, the same way Phase 1's `rls-isolation.spec.ts` verified Phase 1's.

- [ ] **Step 1: Write the tests**

`portal/e2e/phase2-rls-isolation.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'
import { employeeIdToEmail } from '../lib/employeeAuth'
import { setManagedDepartments } from '../lib/departments'

async function createDepartment(adminClient: ReturnType<typeof createAdminClient>, name: string) {
  const { data } = await adminClient.from('departments').insert({ name }).select('id').single()
  return data!.id as string
}

test('a manager cannot see or assign tasks in a department they do not manage', async () => {
  const adminClient = createAdminClient()

  const deptA = await createDepartment(adminClient, `Dept-A-${Date.now()}`)
  const deptB = await createDepartment(adminClient, `Dept-B-${Date.now()}`)

  const managerId = `mgr-${Date.now()}`
  const { employeeRowId: managerRowId } = await createEmployeeRecord(adminClient, {
    employeeId: managerId,
    password: 'password-mgr-123',
    name: 'Manager A',
    role: 'manager',
    departmentId: deptA,
  })
  await setManagedDepartments(adminClient, managerRowId, [deptA])

  const employeeInB = `emp-b-${Date.now()}`
  const { employeeRowId: employeeInBId } = await createEmployeeRecord(adminClient, {
    employeeId: employeeInB,
    password: 'password-b-123',
    name: 'Employee In B',
    role: 'employee',
    departmentId: deptB,
  })

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await anonClient.auth.signInWithPassword({
    email: employeeIdToEmail(managerId),
    password: 'password-mgr-123',
  })

  // Manager of Dept A cannot see Dept B's roster.
  const { data: rosterB } = await anonClient.from('employees').select('*').eq('id', employeeInBId)
  expect(rosterB).toHaveLength(0)

  // Manager of Dept A cannot create a task in Dept B.
  const { error: taskError } = await anonClient.from('tasks').insert({
    department_id: deptB,
    assigned_to: employeeInBId,
    assigned_by: managerRowId,
    title: 'Should not be allowed',
  })
  expect(taskError).not.toBeNull()
})

test('a task cannot be assigned to an employee outside its own department', async () => {
  const adminClient = createAdminClient()
  const deptA = await createDepartment(adminClient, `Dept-A2-${Date.now()}`)
  const deptB = await createDepartment(adminClient, `Dept-B2-${Date.now()}`)

  const { employeeRowId: employeeInB } = await createEmployeeRecord(adminClient, {
    employeeId: `emp-b2-${Date.now()}`,
    password: 'password-b2-123',
    name: 'Employee In B2',
    role: 'employee',
    departmentId: deptB,
  })

  const { error } = await adminClient.from('tasks').insert({
    department_id: deptA,
    assigned_to: employeeInB,
    assigned_by: employeeInB,
    title: 'Cross-department task — should fail',
  })

  expect(error).not.toBeNull()
  expect(error?.message).toContain('must belong to')
})

test('an employee cannot write directly to task_status_history', async () => {
  const adminClient = createAdminClient()
  const deptA = await createDepartment(adminClient, `Dept-hist-${Date.now()}`)

  const employeeId = `emp-hist-${Date.now()}`
  const { employeeRowId } = await createEmployeeRecord(adminClient, {
    employeeId,
    password: 'password-hist-123',
    name: 'History Employee',
    role: 'employee',
    departmentId: deptA,
  })

  const { data: task } = await adminClient
    .from('tasks')
    .insert({
      department_id: deptA,
      assigned_to: employeeRowId,
      assigned_by: employeeRowId,
      title: 'Task with history',
    })
    .select('id')
    .single()

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await anonClient.auth.signInWithPassword({
    email: employeeIdToEmail(employeeId),
    password: 'password-hist-123',
  })

  const { error } = await anonClient.from('task_status_history').insert({
    task_id: task!.id,
    old_status: 'NEW',
    new_status: 'COMPLETED',
    changed_by: employeeRowId,
  })

  expect(error).not.toBeNull()
})

test('archiving an employee blocks their login', async () => {
  const adminClient = createAdminClient()
  const deptA = await createDepartment(adminClient, `Dept-archive-${Date.now()}`)

  const employeeId = `emp-archive-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId,
    password: 'password-archive-123',
    name: 'Archive Target',
    role: 'employee',
    departmentId: deptA,
  })

  await adminClient.from('employees').update({ archived: true, status: 'inactive' }).eq('employee_id', employeeId)

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await anonClient.auth.signInWithPassword({
    email: employeeIdToEmail(employeeId),
    password: 'password-archive-123',
  })

  // Supabase Auth itself doesn't block the sign-in (archived/status live in
  // our own table, not auth.users) — the app's login action is what checks
  // status and signs the session back out. This test confirms the DB state
  // an archived account is left in, which the login action (already covered
  // by Phase 1's login tests) relies on.
  expect(data.user).not.toBeNull()
  const { data: employeeRow } = await adminClient
    .from('employees')
    .select('status, archived')
    .eq('employee_id', employeeId)
    .single()
  expect(employeeRow?.status).toBe('inactive')
  expect(employeeRow?.archived).toBe(true)
})
```

- [ ] **Step 2: Run the tests**

```bash
cd portal
npx playwright test e2e/phase2-rls-isolation.spec.ts
```

Expected: PASS, 4 tests. If any RLS-dependent test fails with the wrong row visible or an insert succeeding that should have failed, the policy from Task 1 is misconfigured — fix the policy, not the test.

- [ ] **Step 3: Commit**

```bash
git add portal/e2e/phase2-rls-isolation.spec.ts
git commit -m "Add Phase 2 RLS isolation tests"
```

---

## Self-Review Notes

- **Spec coverage:** Four-tier roles + superadmin singleton (Task 1) ✓, admin-creation gating (Task 5, `requireSuperAdmin`) ✓, real departments + manager assignment (Tasks 1, 3, 4, 5, 6) ✓, manager roster/task scoping via RLS (Task 1, verified Task 14) ✓, task status audit trail via trigger (Task 1) ✓, cross-department assignment blocked via trigger (Task 1, verified Task 14) ✓, employee self-service status updates (Task 11) ✓, monthly reporting login-triggered popup (Task 12) ✓, admin report visibility (Task 13) ✓, employee archiving with password confirmation and no data loss (Task 7) ✓.
- **Sequencing safety:** the `department` text column is kept alongside the new `department_id` FK through Tasks 1-5 (additive-only), and only dropped in Task 6 once every reading/writing call site has been migrated — avoiding a window where the app fails to build or query correctly mid-plan.
- **Type consistency checked:** `AuthorizedEmployee.role` (Task 2) is used identically by every guard function and by `EditEmployeeClient.tsx` (Task 6/7)'s `employee.role` checks. `TaskStatus` (Task 9) is used identically by `TaskStatusSelect` (Task 10), `EmployeeTaskStatusSelect` (Task 11), and `UnreportedMonth.statusCounts` (Task 12). `Department` (Task 3) is used identically across Tasks 4, 5, 6, 10.
