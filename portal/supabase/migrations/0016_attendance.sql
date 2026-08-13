create table attendance_records (
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  primary key (employee_id, date)
);

create index attendance_records_date_idx on attendance_records (date);

alter table attendance_records enable row level security;

create policy "attendance_select_self_or_admin" on attendance_records
  for select using (
    exists (select 1 from employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
    or public.is_admin()
  );

-- Self-insert only for today's own row; clock-out is a self-update of the
-- same row. Both policies pin date = current_date so a caller cannot use a
-- valid session JWT to backdate/postdate a clock-in for any other day —
-- attendance_records is the ground truth Task 8's salary-deduction
-- calculation trusts for "did this employee work this day". No delete
-- policy for anyone but admin — a mistaken clock-in is corrected via
-- clock-out or an admin fix, not deletion by the employee.
create policy "attendance_insert_self" on attendance_records
  for insert with check (
    date = current_date
    and exists (select 1 from employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
  );

create policy "attendance_update_self" on attendance_records
  for update using (
    date = current_date
    and exists (select 1 from employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
  ) with check (
    date = current_date
    and exists (select 1 from employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
  );

create policy "attendance_admin_write" on attendance_records
  for all using (public.is_admin()) with check (public.is_admin());
