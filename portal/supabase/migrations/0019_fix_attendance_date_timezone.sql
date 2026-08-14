-- Bug found via live testing (Task 11 integration pass): attendance_insert_self
-- and attendance_update_self compared the row's `date` against Postgres's bare
-- `current_date`, which is evaluated in the database's session timezone (UTC on
-- this Supabase project). The app computes "today" via toDateKey(new Date()) in
-- the caller's LOCAL timezone (this company's staff are Bangladesh-based --
-- confirmed by the marketing site's own UK/Bangladesh dual clock feature,
-- 2026-08-08-brand-refresh-and-uk-time). Asia/Dhaka is UTC+6 with no DST, so for
-- roughly six hours every day (00:00-05:59 Dhaka time), UTC's calendar date is
-- still "yesterday" while the app and every Dhaka-based employee call it "today"
-- -- a clock-in/clock-out attempt during that window was silently rejected by
-- RLS. Comparing against the Dhaka-local date instead of bare current_date fixes
-- this for both policies.

drop policy "attendance_insert_self" on attendance_records;
drop policy "attendance_update_self" on attendance_records;

create policy "attendance_insert_self" on attendance_records
  for insert with check (
    date = (now() at time zone 'Asia/Dhaka')::date
    and exists (select 1 from employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
  );

create policy "attendance_update_self" on attendance_records
  for update using (
    date = (now() at time zone 'Asia/Dhaka')::date
    and exists (select 1 from employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
  ) with check (
    date = (now() at time zone 'Asia/Dhaka')::date
    and exists (select 1 from employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
  );
