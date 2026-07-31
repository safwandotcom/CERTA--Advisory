-- employees_select_managed_department (0002) is a row-level policy — it
-- correctly restricts WHICH employee rows a manager can see, but grants
-- every column on those rows (contact_info, join_date, auth_user_id
-- included), wider than the design spec's manager-visibility scope
-- (name, Employee ID, status only). Postgres RLS has no column-level
-- restriction, so the fix is a narrow view instead: security_invoker
-- keeps the underlying table's RLS in force for whoever queries it, while
-- the view itself only ever exposes the columns listed here.
create view manager_roster
with (security_invoker = true) as
select id, employee_id, name, department_id, status
from employees
where archived = false;

grant select on manager_roster to authenticated;
