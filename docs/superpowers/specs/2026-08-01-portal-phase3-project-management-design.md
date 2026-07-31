# Employee Portal — Phase 3 (Project Management) Design

## Context

The portal is being repositioned from a pure employee-management system into three combined systems: **EMS** (what exists — directory, roles, archiving), **Project Management** (Jira/ClickUp-style — this spec), and **HRMS** (attendance, leave, payroll, performance — a separate future phase). This spec covers only Project Management, chosen as the first piece to build because it's the most concrete, most visible change requested, and the other pieces (a universal edit/change-request workflow, the HRMS modules, and loading-performance work) are largely independent of it.

Phase 2 built department-scoped task assignment: a manager could only see and assign tasks within department(s) they were explicitly assigned to manage, and a task's `department_id` was validated at the database level to match its assignee's department. This phase removes that restriction entirely and introduces **Projects** as the real unit of work, replacing departments as the thing tasks belong to.

## Scope

- Departments become informational only — still shown on an employee's profile and usable for filtering/reporting, but they no longer gate who can see or assign what. `department_managers`, `is_manager_of()`, and the cross-department assignment block from Phase 2 are removed.
- **Projects**: a new top-level entity. A project can include any employees from any department. Tasks live inside a project.
- **Views**: Board (kanban by status), List (sortable table), Calendar (by due date) — all three, available to every user (including employees viewing their own tasks), with a switcher that remembers the last-used view per user.
- **Task fields**: existing (title, description, assignee, assigned-by, status, due date) plus new priority, labels, subtasks (simple checklist), and comments.
- **Reporting**: the monthly report becomes one submission per manager per month covering every task across every project they're a member of, instead of one per department.
- Statuses stay the fixed 4 from Phase 2 (`NEW`, `STARTED`, `PENDING`, `COMPLETED`) — no per-project custom workflows.

Out of scope for this phase (separate future work, already discussed and deliberately deferred):
- The universal "admin edits anything directly, employee requests a change, admin approves" workflow.
- HRMS modules: attendance, leave, payroll, performance reviews.
- Loading-performance work and the logo preloader.
- Clearing the existing departments/employees — held until this phase's data model is finalized, so nothing has to be re-entered twice.

## Data Model

**`projects`**
- `id` (uuid, PK)
- `name` (text, not null)
- `description` (text, nullable)
- `status` (`active` | `archived`, default `active` — archived not deleted, same convention as everywhere else in this system)
- `created_by` (FK → employees, not null)
- `created_at`

**`project_members`** (many-to-many, no restriction on department)
- `project_id` (FK → projects, cascade delete)
- `employee_id` (FK → employees, cascade delete)
- `added_at`
- PK (project_id, employee_id)

**`tasks`** (changes from Phase 2)
- \+ `project_id` (FK → projects, not null) — every task now belongs to a project
- \+ `priority` (`low` | `medium` | `high` | `urgent`, default `medium`)
- \+ `labels` (text array, default `{}`) — free-form tags, no separate label-management table (YAGNI: a controlled vocabulary can be added later if it turns out to matter)
- `department_id` stays, but changes meaning: it's now an informational snapshot of the assignee's department at assignment time, auto-stamped by a trigger, never used for access control or validation. Still used for report filtering/tagging.
- `status`, `due_date`, `title`, `description`, `assigned_to`, `assigned_by` unchanged from Phase 2.

**`subtasks`** (new)
- `id` (uuid, PK)
- `task_id` (FK → tasks, cascade delete)
- `title` (text, not null)
- `done` (boolean, default false)
- `created_at`

**`task_comments`** (new)
- `id` (uuid, PK)
- `task_id` (FK → tasks, cascade delete)
- `author_id` (FK → employees)
- `body` (text, not null)
- `created_at`

**`monthly_reports`** (changes from Phase 2)
- Was keyed by (`department_id`, `period_month`); becomes keyed by (`manager_id`, `period_month`).
- `department_id` column removed — a report now covers every project the manager belongs to, and each task line within `stats` carries its own `project_id`/`project_name`/`department_id`/`department_name`, rather than the whole report being scoped to one department.

**Removed / made inert from Phase 2**
- `department_managers` table — dropped outright. Nothing in this phase reads it, and it carries no historical value worth preserving (it only ever recorded a current-state assignment, not a log).
- `is_manager_of(department_id)` — dropped; superseded by `is_project_member(project_id)`.
- `validate_task_assignment()` trigger — the cross-department rejection logic is removed. Replaced by a trigger that only stamps `tasks.department_id` from the assignee's current `employees.department_id`, with no validation/rejection.

## Permissions

| Action | Superadmin | Admin | Manager | Employee |
|---|---|---|---|---|
| Create a project | ✅ | ✅ | ✅ | ❌ |
| Add members to a project | ✅ (any) | ✅ (any) | own projects | ❌ |
| Assign a task (any project, any employee, any department) | ✅ | ✅ | ✅ | ❌ |
| Create a task, assign to self/fellow project member | ✅ | ✅ | ✅ | ✅ (within their own projects only) |
| View a project's Board/List/Calendar | ✅ (all) | ✅ (all) | own projects | own projects (as a member) |
| Comment on a task | any project member | | | |
| Manage subtasks on a task | whoever can edit that task (assignee, assigner, admin, manager) | | | |
| Submit monthly report | — | — | ✅ (own projects) | ❌ |
| View submitted reports | ✅ (all) | ✅ (all) | own | ❌ |

Assigning a task to someone not yet on the project auto-adds them as a member — a manager never needs a separate "add to project" step before assigning.

## Views

**`/projects`** (new section, replaces the department-scoped roster/task-assignment content of the old `/manager` page): a list of projects the caller belongs to (admin/superadmin see all). Opening a project shows its Board/List/Calendar, switchable, showing every task in that project regardless of assignee — visible to every project member.

**Personal task view** (replaces the current "Your tasks" card on the employee dashboard): the same Board/List/Calendar switcher, scoped to every task assigned to the current user across every project they're in. Available to every role, including plain employees — this is the "employees can shift their view" requirement.

View choice persists per user (e.g. a `preferred_view` value stored client-side or on the employee record) so it doesn't reset on every visit.

## Reporting

Detection stays login-triggered, same mechanism as Phase 2 (`getUnreportedPriorMonths`-equivalent), but re-scoped: for each manager, for each fully-elapsed month since they first became a manager (or since their earliest project membership), check whether a report exists for (manager, month); if not, prompt. The report's `stats` now aggregate every task across every project that manager belongs to, each entry tagged with its project and department, rather than one department's task list.

## Testing

1. A manager can assign a task to any employee in any department, in a project the manager belongs to — no rejection based on department.
2. An employee can create a task in a project they're a member of, assigning it to themselves or another member of that same project — but cannot create a task in a project they don't belong to.
3. Assigning a task to a non-member auto-adds them to the project.
4. Board/List/Calendar all show the same underlying task set for a project; switching views doesn't lose data or state.
5. An employee's personal task view shows tasks from every project they're in, not just one.
6. A manager's monthly report includes tasks from every project they belong to, each correctly tagged with its project and department; submitting creates one row keyed by (manager, month).
7. Comments and subtask checklists are scoped correctly — a non-member cannot read or write either (RLS-level test, not just UI).
8. Archiving a project hides it from the default `/projects` list without deleting its tasks/comments/subtasks.

## Non-goals for this phase

- No per-project custom status workflows (Kanban columns are always the same 4 statuses).
- No task dependencies/blocking relationships.
- No time tracking / estimates on tasks (that belongs to a future HRMS/attendance phase if ever built).
- No @mentions or notifications on comments — reading a project's comments is opt-in (visit the task), not pushed to anyone.
- No sprints/backlogs/epics — "Projects" are the only grouping level above tasks in this phase.
