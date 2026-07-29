# Employee Management System — Phase 1 (Foundation) Design

## Context

CERTA& Advisory needs an internal employee management system to run office operations: attendance/leave, staff records, contracts with e-signature, task tracking, document generation, and payroll. This is a large, multi-subsystem project, decomposed into phases (see `REMAINING_TASKS.md` in the repo root for the full phase list and priority order). This spec covers **Phase 1 only: the foundation** — login, roles, staff directory, and per-employee document storage — which every later phase depends on.

Employees are starting immediately, so later phases (especially Attendance & Leave) are prioritized right after this foundation ships.

## Scope

In scope for Phase 1:
- Admin and employee login
- Two roles: `admin`, `employee`
- Central staff directory, entered manually by admin
- Per-employee document storage, admin-managed
- Admin-only password reset

Out of scope for Phase 1 (later phases): attendance/timesheets, leave requests, task/project tracking, contracts/e-signature, letterhead document generation, payroll.

## Architecture

A Next.js application living in a `portal/` subdirectory of this same git repository (monorepo style), using Supabase for Postgres, Auth, and file storage. It is deployed as its own, separate Vercel project with its root directory set to `portal/`, so it builds and deploys independently of the existing static site — a change to one does not trigger or affect a deploy of the other. It will live on its own subdomain (e.g. `portal.certaadvisory.com`). The public marketing site (`index.html`) is not modified by this work.

## Authentication

Login is **Employee ID + password only** — no email is ever shown or requested on the login screen.

Under the hood, Supabase Auth (which is email/password-based) is used for session and JWT handling: each employee is assigned an internal synthetic email at creation time (e.g. `emp1023@internal.certaadvisory.com`), generated from their Employee ID and never exposed in any UI. The login form collects Employee ID + password, the backend maps Employee ID → synthetic email, and authenticates against Supabase Auth with that email behind the scenes.

There is no self-service "forgot password" flow and no password-reset email is ever sent. Only an admin can reset a password, via Supabase's admin API (service-role key, server-side only). This is intentional, not a gap: with ~15 employees, admin-mediated reset is simpler and removes an entire class of email-delivery/account-recovery complexity.

Failed login shows a generic "invalid Employee ID or password" message (no hint which part was wrong). No account lockout at this scale — admin can reset a stuck password directly.

## Roles & permissions

Two roles: `admin` and `employee`, stored on each employee's record.

Enforced with Supabase Row-Level Security (RLS) at the database level, not just in application code:
- An `employee` can only read their own row in `employees` and their own rows in `employee_documents`.
- `admin` can read and write all rows.

RLS is the backstop: even a bug in the Next.js app cannot leak one employee's data to another, because the database itself refuses the query.

## Data model

**`employees`**
- `id` (uuid, PK)
- `employee_id` (text, unique, human-facing login identifier)
- `auth_user_id` (uuid, FK to Supabase Auth user)
- `name`
- `contact_info` (phone/personal email, for HR reference — not used for login)
- `role` (`admin` | `employee`)
- `position` / `department`
- `join_date`
- `status` (`active` | `inactive`)

**`employee_documents`**
- `id` (uuid, PK)
- `employee_id` (FK to `employees`)
- `file_path` (Supabase Storage path, one bucket, folder-per-employee)
- `label` (admin-provided description, e.g. "Signed contract", "ID copy")
- `uploaded_at`

## UI

**Employee-facing (Phase 1 scope only):** Login → dashboard showing their own profile info and their own documents (view/download only). No other functionality yet — attendance, leave, etc. arrive in later phases.

**Admin-facing:** Login → dashboard listing all employees → create employee (assigns Employee ID + initial password) → edit employee → upload/manage documents for an employee → reset an employee's password.

## Testing

Manual verification pass before calling Phase 1 done:
1. Admin creates a new employee (Employee ID + initial password).
2. That employee logs in with Employee ID + password and sees only their own profile/documents.
3. That employee cannot access another employee's data or any admin screen (verify both via UI and by attempting a direct API/RLS bypass).
4. Admin resets the employee's password; the old password no longer works and the new one does.

## Non-goals for this phase

- No self-service password reset or account recovery.
- No employee self-editing of their own profile (admin-entered/managed only, per original requirement).
- No attendance, leave, task, contract, payroll, or document-generation functionality — those are later phases with their own specs.
