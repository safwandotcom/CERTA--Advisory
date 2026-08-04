create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references employees(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_id_idx on notifications (recipient_id);
create index notifications_recipient_unread_idx on notifications (recipient_id) where read_at is null;

alter table notifications enable row level security;

-- Employees can read and mark-read only their own notifications. Deliberately
-- no insert or delete policy for the authenticated/anon role at all — every
-- notification is created by a Server Action using createAdminClient()
-- (service-role, bypasses RLS), which is where the "am I allowed to notify
-- this person" check already lives (e.g. only a requireAdmin()-gated action
-- can trigger the onboarding-correction notification). This is what makes
-- it structurally impossible for one employee to spam another — there is no
-- RLS-permitted insert path to even attempt it via a direct POST.
create policy "notifications_select_own" on notifications
  for select using (
    exists (
      select 1 from employees e
      where e.id = notifications.recipient_id and e.auth_user_id = auth.uid()
    )
  );

create policy "notifications_update_own" on notifications
  for update using (
    exists (
      select 1 from employees e
      where e.id = notifications.recipient_id and e.auth_user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from employees e
      where e.id = notifications.recipient_id and e.auth_user_id = auth.uid()
    )
  );
