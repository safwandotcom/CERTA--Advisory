create table leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_paid boolean not null,
  default_annual_quota numeric
);

insert into leave_types (name, is_paid, default_annual_quota) values
  ('Casual', true, null),
  ('Sick', true, null),
  ('Earned', true, null),
  ('Unpaid', false, null);

alter table leave_types enable row level security;

create policy "leave_types_select_all" on leave_types
  for select using (true);

create policy "leave_types_admin_write" on leave_types
  for all using (public.is_admin()) with check (public.is_admin());

create table leave_allocations (
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id) on delete cascade,
  year int not null,
  allocated_days numeric not null default 0,
  primary key (employee_id, leave_type_id, year)
);

alter table leave_allocations enable row level security;

create policy "leave_allocations_select_self_or_admin" on leave_allocations
  for select using (
    exists (select 1 from employees e where e.id = leave_allocations.employee_id and e.auth_user_id = auth.uid())
    or public.is_admin()
  );

-- No self-write policy at all — an employee's own leave balance is entirely
-- admin-set, matching the spec's permission table ("Set/override an
-- employee's leave allocation": admin/superadmin only, employee: no access).
create policy "leave_allocations_admin_write" on leave_allocations
  for all using (public.is_admin()) with check (public.is_admin());

-- monthly_salary: admin/superadmin write-only, per spec Data Model note on `employees`.
--
-- Verified against the migration history (0001_init.sql through 0016_attendance.sql)
-- rather than a live `select * from pg_policies` (no DB connection available to this
-- task): `employees` carries exactly two policies, both from 0001_init.sql —
-- `employees_select_self_or_admin` (select-only, self-or-admin) and
-- `employees_admin_write` (`for all using (public.is_admin()) with check (public.is_admin())`).
-- No migration between 0001 and 0016 adds a self-update policy on `employees` (confirmed
-- by grepping every migration for `on employees` write policies). Since RLS is
-- default-deny and `employees_admin_write` is the *only* policy covering UPDATE, an
-- employee's self-update of their own row — any column, including this new
-- `monthly_salary` — is already rejected outright; there is no gap for this column to
-- fall through. A `security definer` trigger analogous to
-- `enforce_onboarding_self_edit_columns()` (0011_employee_onboarding.sql) is therefore
-- unnecessary here: that trigger exists because `employee_onboarding` has a genuine
-- self-update policy for non-admins to guard column-by-column; `employees` has no such
-- policy to guard against.
alter table employees add column monthly_salary numeric;
