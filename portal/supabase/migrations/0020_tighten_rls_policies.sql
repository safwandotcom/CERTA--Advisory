-- Final-review findings (Fix 6a, 6b): two independent RLS tightenings.

-- 6a. company_settings_select_all, company_holidays_select_all, and
-- leave_types_select_all (0015, 0015, 0017) all granted select to `public`
-- (including the unauthenticated `anon` role), deviating from this
-- codebase's established convention of scoping reads to
-- `auth.uid() is not null` (see departments_select_authenticated in
-- 0002_phase2_roles_departments_tasks.sql for the precedent pattern).
-- leave_allocations_select_self_or_admin and leave_requests_select_self_or_admin
-- are already correctly scoped and are not touched here.

drop policy "company_settings_select_all" on company_settings;

create policy "company_settings_select_authenticated" on company_settings
  for select using (auth.uid() is not null);

drop policy "company_holidays_select_all" on company_holidays;

create policy "company_holidays_select_authenticated" on company_holidays
  for select using (auth.uid() is not null);

drop policy "leave_types_select_all" on leave_types;

create policy "leave_types_select_authenticated" on leave_types
  for select using (auth.uid() is not null);

-- 6b. leave_requests_insert_self (0018) didn't pin reviewed_by/reviewed_at/
-- review_note to null on self-insert, so a raw API caller could
-- self-populate review metadata on their own pending request (no authority
-- gained -- status is still forced to 'pending' by the same policy -- but
-- the admin review table would display attacker-controlled text as if it
-- were real review data).

drop policy "leave_requests_insert_self" on leave_requests;

create policy "leave_requests_insert_self" on leave_requests
  for insert with check (
    exists (select 1 from employees e where e.id = leave_requests.employee_id and e.auth_user_id = auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and review_note is null
  );
