# Employee Portal — Phase 2 (Roles, Departments, Tasks & Reporting) Design

## Context

Phase 1 (Foundation) shipped a two-role (`admin`/`employee`) portal: login, staff directory, per-employee documents. This phase adds the organisational structure and workflow the office actually needs day-to-day: a real department structure, a `manager` role that sits between admin and employee, department-scoped task assignment with an automatic audit trail, an automatic monthly reporting cycle from manager to admin, and the ability to remove an employee from the system (currently impossible — only active/inactive toggling exists).

This is a large, multi-subsystem addition, built as three dependent sub-phases in one plan (mirroring how Phase 1 was decomposed), since 2B and 2C both need 2A's data model to exist first:

- **2A — Roles & Departments**: the `superadmin` role, real `departments` entities, manager↔department assignment, employee archiving.
- **2B — Task assignment & status tracking**: managers assign tasks to employees in their department(s); every status change is recorded automatically.
- **2C — Monthly reporting**: a login-triggered check surfaces an unsubmitted prior-month report to the manager, who submits it to admin.

## Scope

In scope:
- Four-tier role system: `superadmin` (exactly one, seeded not created), `admin`, `manager`, `employee`.
- Real `departments` table; each employee belongs to exactly one department; each manager oversees one or more departments (many-to-many).
- Manager visibility limited to the roster (name, Employee ID, status) of their own department(s) — not documents.
- Task assignment: manager → employee within the manager's own department(s) only. Statuses: `NEW`, `STARTED`, `PENDING`, `COMPLETED`. Every status change recorded automatically (who, when, old→new) via a database trigger — not application-layer logging, so it can't be bypassed by any code path that updates a task row.
- Monthly reporting: when a manager logs in and a full prior month has no submitted report for one of their departments, a summary (task counts by status, list of tasks) is shown and a "Submit to admin" action creates the report record. This fires regardless of whether all tasks are complete.
- Employee archiving: admin/superadmin can archive an employee (revokes login, hides from the active roster, keeps all historical data — tasks, reports, documents — intact). Gated by the acting admin re-entering their own password.

Out of scope for this phase: real-time notifications/email, task comments/attachments, department deletion (archive only), any change to the existing document-storage or contracts/payroll roadmap items.

## Architecture

Extends the existing Next.js (App Router) + Supabase app in `portal/`. No new services. RLS remains the enforcement backstop, extended with new helper functions and policies; the existing `requireAdmin()`-style server-only guard pattern is extended with a `requireSuperAdmin()` variant for the one superadmin-only action (granting the `admin` role).

## Data model

**Migration to `employees`:**
- `role` check constraint becomes `role in ('superadmin', 'admin', 'manager', 'employee')`.
- A partial unique index enforces at most one `superadmin` row ever exists.
- The existing seeded account (Employee ID `admin`) is migrated in place: `update employees set role = 'superadmin' where employee_id = 'admin'`.
- `department` (free text) is dropped; replaced by `department_id uuid references departments(id)`, nullable (existing employees have none yet; admin assigns going forward).
- New `archived boolean not null default false`. Archiving also forces `status = 'inactive'` (reusing the existing login-blocking mechanism) so no separate login-gate logic is needed.

**`departments`**
- `id` (uuid, PK)
- `name` (text, unique, not null)
- `archived` (boolean, default false — departments are archived, never hard-deleted, so historical task/report references stay valid)
- `created_at`

**`department_managers`** (join table, many-to-many)
- `department_id` (FK → departments)
- `manager_id` (FK → employees.id)
- Primary key on `(department_id, manager_id)`

**`tasks`**
- `id` (uuid, PK)
- `department_id` (FK → departments)
- `assigned_to` (FK → employees.id — must be an employee in `department_id`)
- `assigned_by` (FK → employees.id — the manager or admin who created it)
- `title` (text, not null)
- `description` (text, nullable)
- `status` (text, check in `('NEW','STARTED','PENDING','COMPLETED')`, default `'NEW'`)
- `due_date` (date, nullable)
- `created_at`, `updated_at`
- A `BEFORE INSERT OR UPDATE` trigger validates `assigned_to`'s `department_id` matches the task's `department_id` — a task can never be assigned to someone outside the department it belongs to, enforced at the database level rather than trusted to application code.

**`task_status_history`**
- `id` (uuid, PK)
- `task_id` (FK → tasks)
- `old_status` (text, nullable — null for the task's initial creation row)
- `new_status` (text, not null)
- `changed_by` (FK → employees.id — resolved server-side from the authenticated user, not client-supplied)
- `changed_at` (timestamptz, default now)
- Populated automatically by an `AFTER INSERT OR UPDATE OF status ON tasks` trigger — no application code path writes to this table directly, so the audit trail can't be skipped or forged by a bug elsewhere in the app.

**`monthly_reports`**
- `id` (uuid, PK)
- `department_id` (FK → departments)
- `manager_id` (FK → employees.id — who submitted it)
- `period_month` (date — first-of-month marker, e.g. `2026-07-01`, unique together with `department_id`)
- `stats` (jsonb — task counts by status and the task list snapshot at submission time)
- `submitted_at` (timestamptz)

## Roles & permissions

| Action | superadmin | admin | manager | employee |
|---|---|---|---|---|
| Create `admin` account | ✅ | ❌ | ❌ | ❌ |
| Create `manager`/`employee` account | ✅ | ✅ | ❌ | ❌ |
| Manage departments (create/rename/archive) | ✅ | ✅ | ❌ | ❌ |
| Assign employees/managers to departments | ✅ | ✅ | ❌ | ❌ |
| Archive an employee | ✅ | ✅ | ❌ | ❌ |
| View/manage documents | ✅ | ✅ | ❌ | own only |
| Assign tasks | ✅ (any dept) | ✅ (any dept) | ✅ (own dept(s) only) | ❌ |
| View department roster | ✅ (all) | ✅ (all) | ✅ (own dept(s) only) | ❌ |
| Update task status | — | — | own dept's tasks | own tasks only |
| Submit monthly report | — | — | ✅ (own dept(s)) | ❌ |
| View submitted reports | ✅ (all) | ✅ (all) | own dept(s) only | ❌ |

The create-employee role dropdown only ever offers `admin`/`manager`/`employee` (never `superadmin` — that account is seeded once, not created through the UI), and only shows `admin` as a choice when the person creating the account is themselves the superadmin. Enforced server-side by a `requireSuperAdmin()` guard on that branch — not just hidden in the UI — since the actual employee-creation call uses the service-role client and bypasses RLS.

RLS: `is_admin()` is redefined to check `role in ('admin','superadmin')`, so every existing policy that already calls it (unchanged) now correctly grants `superadmin` the same access `admin` had. A new `is_manager_of(dept_id uuid)` helper scopes manager policies to departments they're linked to via `department_managers`.

## UI

**Departments (admin/superadmin only):** `/admin/departments` — list, create, archive. Archiving a department doesn't touch its employees' `department_id` (they simply belong to an archived department until reassigned — admin reassigns them manually; no cascading auto-reassignment).

**Employee form (create/edit):** department becomes a dropdown sourced from active departments (replacing free text). Role dropdown conditionally includes `admin` for superadmin. Editing a `manager`'s record additionally shows a multi-select of departments they oversee. Edit page gains an "Archive employee" action requiring the acting admin to re-enter their own password.

**Manager dashboard** (new role, new nav): a `/manager` section — roster of their department(s)' employees, task list (assign new, filter by status), and the monthly-report popup when triggered.

**Employee dashboard:** existing profile/documents unchanged, plus a new "Your tasks" card — list with a status control the employee can change themselves among the 4 values.

**Monthly report popup:** triggered on manager login when a fully-elapsed prior month has no `monthly_reports` row for one of their departments. Shows status counts + task list for that month; "Submit to admin" writes the report row. Fires unconditionally (even if tasks are still `NEW`/`STARTED`).

## Testing

Manual + automated verification before calling Phase 2 done:
1. Superadmin migration: seeded account has `role = 'superadmin'`; attempting to insert a second superadmin row fails.
2. Admin (non-super) cannot see "Admin" as a role option when creating an employee; superadmin can.
3. A manager assigned to Department X can see and assign tasks only to Department X's roster; cannot see Department Y's employees or tasks (RLS-level test, not just UI).
4. An employee can update their own task's status; every change appears in `task_status_history` with the correct actor and timestamp, even if that employee tries to update history directly (RLS should block direct writes to `task_status_history`).
5. Archiving an employee blocks their login and hides them from the active list, without deleting their tasks/reports/documents.
6. Logging in as a manager after a full month has elapsed with no submitted report shows the popup; submitting creates the correct `monthly_reports` row.

## Non-goals for this phase

- No email/push notifications for task assignment, status changes, or report submission — everything is visible in-app only.
- No department hard-delete.
- No sequential enforcement of task status transitions (an employee may set any of the 4 values in any order) — `PENDING` is a convention meaning "awaiting review," not a system-enforced gate.
- No changes to the payroll, contracts/e-signature, or document-generator roadmap items.
