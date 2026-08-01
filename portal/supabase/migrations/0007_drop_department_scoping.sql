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

-- tasks_select and task_status_history_select (0002) both reference
-- is_manager_of() in their qual — is_manager_of(uuid) cannot be dropped
-- while either policy still depends on it (error 2BP01, caught by actually
-- running this migration before it was assumed complete).
-- tasks_project_member_select (Task 1) already covers project-based
-- visibility as a separate, additional permissive policy, so removing the
-- is_manager_of() clause here only drops now-redundant department-manager
-- visibility; the remaining is_admin() and assigned_to=self clauses are
-- unchanged from the original.
drop policy "tasks_select" on tasks;
create policy "tasks_select" on tasks
  for select using (
    public.is_admin()
    or exists (select 1 from employees e where e.id = tasks.assigned_to and e.auth_user_id = auth.uid())
  );

drop policy "task_status_history_select" on task_status_history;
create policy "task_status_history_select" on task_status_history
  for select using (
    exists (
      select 1 from tasks t
      where t.id = task_status_history.task_id
      and (
        public.is_admin()
        or exists (select 1 from employees e where e.id = t.assigned_to and e.auth_user_id = auth.uid())
      )
    )
  );

drop table department_managers;
drop function public.is_manager_of(uuid);
