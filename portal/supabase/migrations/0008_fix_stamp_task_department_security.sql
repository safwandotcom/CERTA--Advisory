-- stamp_task_department() (0007) was created without security definer /
-- set search_path, unlike every other trigger function in this schema
-- (including validate_task_assignment(), the one it replaced). Running
-- under caller RLS meant its own `select department_id into new.department_id
-- from employees where id = new.assigned_to` was blocked by
-- employees_select_self_or_admin whenever the caller wasn't the assignee
-- themselves — e.g. an employee assigning a task to a fellow project member
-- (createOwnTaskAction, Task 10) got department_id silently set to NULL,
-- violating tasks.department_id's NOT NULL constraint and rejecting the
-- insert. It also unconditionally overwrote the departmentId that
-- createOwnTaskAction deliberately pre-computes via an admin client for
-- exactly this reason. Found by Task 13's review, verified live (prosecdef
-- was false, proconfig NULL) before this fix.
create or replace function public.stamp_task_department()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select department_id into new.department_id from employees where id = new.assigned_to;
  return new;
end;
$$;
