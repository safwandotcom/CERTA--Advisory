create table employee_onboarding (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references employees(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'submitted', 'needs_correction', 'complete')),
  date_of_birth date,
  fathers_name text,
  mothers_name text,
  blood_group text,
  phone text,
  personal_email text,
  present_address text,
  permanent_address text,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  bank_name text,
  account_holder_name text,
  account_number text,
  branch_code text,
  national_id_path text,
  offer_letter_path text,
  photo_path text,
  reviewed_by uuid references employees(id),
  reviewed_at timestamptz,
  correction_notes text,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index employee_onboarding_employee_id_idx on employee_onboarding (employee_id);

alter table employee_onboarding enable row level security;

-- Own row (or admin) can read.
create policy "employee_onboarding_select_self_or_admin" on employee_onboarding
  for select using (
    exists (
      select 1 from employees e
      where e.id = employee_onboarding.employee_id and e.auth_user_id = auth.uid()
    )
    or public.is_admin()
  );

-- Own row can be updated by its employee, but only while status is
-- not_started or needs_correction — once submitted or complete, the USING
-- clause (evaluated against the row's CURRENT/old state) stops matching, so
-- no further self-updates are possible until an admin sets it back to
-- needs_correction. Column-level restrictions (no self-completing, no
-- writing the review fields) are enforced by the trigger below, not here —
-- RLS's `with check` can express row ownership but not "which columns
-- changed."
create policy "employee_onboarding_update_self" on employee_onboarding
  for update using (
    exists (
      select 1 from employees e
      where e.id = employee_onboarding.employee_id and e.auth_user_id = auth.uid()
    )
    and status in ('not_started', 'needs_correction')
  ) with check (
    exists (
      select 1 from employees e
      where e.id = employee_onboarding.employee_id and e.auth_user_id = auth.uid()
    )
  );

create policy "employee_onboarding_admin_write" on employee_onboarding
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.enforce_onboarding_self_edit_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    new.updated_at = now();
    return new;
  end if;

  if new.status = 'complete' then
    raise exception 'Only an admin can mark onboarding complete';
  end if;

  if new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.correction_notes is distinct from old.correction_notes then
    raise exception 'Only an admin can set onboarding review fields';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create trigger employee_onboarding_enforce_self_edit
  before update on employee_onboarding
  for each row execute function public.enforce_onboarding_self_edit_columns();

-- Storage bucket for onboarding documents, private by default — same
-- convention as employee-documents in 0001_init.sql.
insert into storage.buckets (id, name, public) values ('onboarding-documents', 'onboarding-documents', false);

create policy "onboarding_documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'onboarding-documents'
    and (
      exists (
        select 1 from employees e
        where e.auth_user_id = auth.uid()
        and (storage.foldername(name))[1] = e.id::text
      )
      or public.is_admin()
    )
  );

-- The employee may only upload/replace their own onboarding documents while
-- their row is still editable (not_started or needs_correction) — mirrors
-- the employee_onboarding_update_self row-level restriction, applied here
-- to the storage side of the same workflow.
create policy "onboarding_documents_storage_self_insert" on storage.objects
  for insert with check (
    bucket_id = 'onboarding-documents'
    and exists (
      select 1 from employees e
      join employee_onboarding eo on eo.employee_id = e.id
      where e.auth_user_id = auth.uid()
      and (storage.foldername(name))[1] = e.id::text
      and eo.status in ('not_started', 'needs_correction')
    )
  );

create policy "onboarding_documents_storage_self_update" on storage.objects
  for update using (
    bucket_id = 'onboarding-documents'
    and exists (
      select 1 from employees e
      join employee_onboarding eo on eo.employee_id = e.id
      where e.auth_user_id = auth.uid()
      and (storage.foldername(name))[1] = e.id::text
      and eo.status in ('not_started', 'needs_correction')
    )
  ) with check (
    bucket_id = 'onboarding-documents'
    and exists (
      select 1 from employees e
      join employee_onboarding eo on eo.employee_id = e.id
      where e.auth_user_id = auth.uid()
      and (storage.foldername(name))[1] = e.id::text
      and eo.status in ('not_started', 'needs_correction')
    )
  );

create policy "onboarding_documents_storage_admin_write" on storage.objects
  for all using (
    bucket_id = 'onboarding-documents'
    and public.is_admin()
  ) with check (
    bucket_id = 'onboarding-documents'
    and public.is_admin()
  );
