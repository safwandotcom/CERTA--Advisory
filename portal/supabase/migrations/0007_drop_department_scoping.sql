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

drop view if exists manager_roster;
create view manager_roster
with (security_invoker = true) as
select id, employee_id, name, department_id, status
from employees
where archived = false;
grant select on manager_roster to authenticated;

drop table department_managers;
drop function public.is_manager_of(uuid);
