create table company_settings (
  key text primary key,
  value text not null
);

insert into company_settings (key, value) values ('weekly_off_days', 'sat,sun');

alter table company_settings enable row level security;

create policy "company_settings_select_all" on company_settings
  for select using (true);

create policy "company_settings_admin_write" on company_settings
  for all using (public.is_admin()) with check (public.is_admin());

create table company_holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null
);

alter table company_holidays enable row level security;

create policy "company_holidays_select_all" on company_holidays
  for select using (true);

create policy "company_holidays_admin_write" on company_holidays
  for all using (public.is_admin()) with check (public.is_admin());
