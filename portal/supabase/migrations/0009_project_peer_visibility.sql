-- Task 13 removed employees_select_managed_department without providing any
-- replacement broader-than-self visibility for anyone who shares a project
-- with the row being read — silently breaking every employees name embed
-- (listTasksForProject, listComments, the task detail page's assignee name)
-- for any viewer who isn't the row's own owner or an admin. Found by the
-- final whole-branch review, one review cycle after Task 13 shipped.
create or replace function public.is_project_peer(target_employee_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from project_members pm1
    join project_members pm2 on pm1.project_id = pm2.project_id
    join employees caller on caller.id = pm1.employee_id
    where caller.auth_user_id = auth.uid()
    and pm2.employee_id = target_employee_id
  );
$$;

create policy "employees_select_project_peer" on employees
  for select using (public.is_project_peer(id));

-- tasks_project_member_insert only checked the CALLER's own project
-- membership, letting a project member insert a task assigned to literally
-- anyone company-wide via a direct POST (bypassing createOwnTaskAction's
-- UI, which only ever offers fellow project members as assignee options).
-- Add an assignee-membership check so RLS enforces what the UI already
-- assumes, matching this project's "RLS is the real boundary" principle.
drop policy "tasks_project_member_insert" on tasks;
create policy "tasks_project_member_insert" on tasks
  for insert with check (
    public.is_project_member(project_id)
    and exists (
      select 1 from project_members pm
      where pm.project_id = tasks.project_id and pm.employee_id = tasks.assigned_to
    )
  );
