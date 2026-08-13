create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  start_date date not null,
  end_date date not null,
  start_day_period text not null default 'full' check (start_day_period in ('full', 'half_am', 'half_pm')),
  end_day_period text not null default 'full' check (end_day_period in ('full', 'half_am', 'half_pm')),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references employees(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  -- Single-day requests only ever read start_day_period; this constraint
  -- keeps the two columns from silently disagreeing on such a row.
  check (start_date != end_date or start_day_period = end_day_period)
);

create index leave_requests_employee_id_idx on leave_requests (employee_id);
create index leave_requests_status_idx on leave_requests (status);

alter table leave_requests enable row level security;

create policy "leave_requests_select_self_or_admin" on leave_requests
  for select using (
    exists (select 1 from employees e where e.id = leave_requests.employee_id and e.auth_user_id = auth.uid())
    or public.is_admin()
  );

create policy "leave_requests_insert_self" on leave_requests
  for insert with check (
    exists (select 1 from employees e where e.id = leave_requests.employee_id and e.auth_user_id = auth.uid())
    and status = 'pending'
  );

-- Employee can only touch their own row, and only while it's still pending
-- (the USING clause is evaluated against the row's pre-update state) —
-- this is how "cancel own pending request freely, but cancelling an
-- approved one requires admin" is enforced: an employee's UPDATE simply
-- cannot match a row that's already 'approved'.
create policy "leave_requests_self_cancel_pending" on leave_requests
  for update using (
    exists (select 1 from employees e where e.id = leave_requests.employee_id and e.auth_user_id = auth.uid())
    and status = 'pending'
  ) with check (
    exists (select 1 from employees e where e.id = leave_requests.employee_id and e.auth_user_id = auth.uid())
    and status = 'cancelled'
  );

create policy "leave_requests_admin_write" on leave_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- Reject approving a request that overlaps another already-approved request
-- for the same employee — enforced at the database level per spec, not
-- just in the app layer.
create or replace function public.enforce_no_overlapping_approved_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' then
    if exists (
      select 1 from leave_requests other
      where other.id != new.id
        and other.employee_id = new.employee_id
        and other.status = 'approved'
        and other.start_date <= new.end_date
        and other.end_date >= new.start_date
    ) then
      raise exception 'This employee already has an approved leave request overlapping these dates';
    end if;
  end if;
  return new;
end;
$$;

create trigger leave_requests_enforce_no_overlap
  before insert or update on leave_requests
  for each row execute function public.enforce_no_overlapping_approved_leave();
