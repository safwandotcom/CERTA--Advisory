drop policy "employees_select_managed_department" on employees;
drop policy "tasks_manager_admin_write" on tasks;

drop trigger "tasks_validate_assignment" on tasks;
drop function public.validate_task_assignment();

create or replace function public.stamp_task_department()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from employees where id = new.assigned_to;
  return new;
end;
$$;

create trigger tasks_stamp_department
  before insert or update of assigned_to on tasks
  for each row execute function public.stamp_task_department();

-- manager_roster (0004) existed solely to back the old /manager page's
-- roster display; that page is deleted by this migration and nothing else
-- queries this view (confirmed via repo-wide grep) — drop it outright
-- rather than pointlessly recreating an identical, now-unused view.
drop view if exists manager_roster;

drop table department_managers;
drop function public.is_manager_of(uuid);
