create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_id text unique not null,
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  name text not null,
  contact_info text,
  role text not null check (role in ('admin', 'employee')),
  position text,
  department text,
  join_date date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  file_path text not null,
  label text not null,
  uploaded_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from employees e
    where e.auth_user_id = auth.uid() and e.role = 'admin'
  );
$$;

alter table employees enable row level security;
alter table employee_documents enable row level security;

-- Employees can read their own row; admins can read every row.
create policy "employees_select_self_or_admin" on employees
  for select using (
    auth_user_id = auth.uid()
    or public.is_admin()
  );

-- Only admins can insert/update/delete employee rows (no self-editing).
create policy "employees_admin_write" on employees
  for all using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );

-- Employees can read documents that belong to them; admins can read all.
create policy "documents_select_self_or_admin" on employee_documents
  for select using (
    exists (
      select 1 from employees e
      where e.id = employee_documents.employee_id and e.auth_user_id = auth.uid()
    )
    or public.is_admin()
  );

-- Only admins can upload/edit/delete document metadata.
create policy "documents_admin_write" on employee_documents
  for all using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );

-- Storage bucket for document files, private by default.
insert into storage.buckets (id, name, public) values ('employee-documents', 'employee-documents', false);

create policy "documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'employee-documents'
    and (
      exists (
        select 1 from employees e
        where e.auth_user_id = auth.uid()
        and (storage.foldername(name))[1] = e.id::text
      )
      or public.is_admin()
    )
  );

create policy "documents_storage_admin_write" on storage.objects
  for all using (
    bucket_id = 'employee-documents'
    and public.is_admin()
  ) with check (
    bucket_id = 'employee-documents'
    and public.is_admin()
  );
