-- Final-review Finding 1: employees created before this branch's Task 6
-- (which hooks employee_onboarding row creation into createEmployeeRecord())
-- have no employee_onboarding row at all. The middleware onboarding gate
-- (Task 7) treats a missing row the same as `not_started` and redirects
-- these employees to /onboarding on every request, where every write
-- silently matches zero rows (see Finding 4) — permanently locking them out.
--
-- Idempotent and safe to run multiple times: only inserts a row for an
-- employee that doesn't already have one.
insert into employee_onboarding (employee_id)
select e.id from employees e
where not exists (select 1 from employee_onboarding eo where eo.employee_id = e.id);
