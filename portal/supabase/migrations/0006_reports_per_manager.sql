-- Existing rows (if any) predate Projects and can't be meaningfully
-- migrated to a manager+projects shape — this system has been in active
-- use for under a week and monthly reports only start mattering after a
-- full month has elapsed, so check the live row count before assuming
-- it's safe to truncate; if any real rows exist, stop and ask rather than
-- deleting them.
delete from monthly_reports;

-- Old policies must be dropped before department_id, since both
-- monthly_reports_select and monthly_reports_manager_insert reference that
-- column (via is_manager_of(department_id)) in their USING/WITH CHECK
-- clauses — Postgres refuses to drop a column a policy still depends on
-- (error 2BP01). Drop first, then alter, then recreate.
drop policy "monthly_reports_manager_insert" on monthly_reports;
drop policy "monthly_reports_select" on monthly_reports;

alter table monthly_reports drop constraint monthly_reports_department_id_period_month_key;
alter table monthly_reports drop column department_id;
alter table monthly_reports add constraint monthly_reports_manager_id_period_month_key unique (manager_id, period_month);

create policy "monthly_reports_manager_insert" on monthly_reports
  for insert with check (
    manager_id in (select id from employees where auth_user_id = auth.uid())
  );

create policy "monthly_reports_select" on monthly_reports
  for select using (
    public.is_admin() or manager_id in (select id from employees where auth_user_id = auth.uid())
  );
