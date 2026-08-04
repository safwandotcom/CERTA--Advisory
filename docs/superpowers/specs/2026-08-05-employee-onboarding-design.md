# Employee Portal — Onboarding Design

## Context

This is the first of three new subsystems requested together (Onboarding, Attendance & Leave, IT Support Ticketing — see `REMAINING_TASKS.md`), split into separate specs because each has its own data model, trigger, and owner. This spec covers only Onboarding: collecting the HR information and documents a new employee must provide, gating portal access until it's done, and letting admin review it.

Foundation, Portal Phase 2, and Portal Phase 3 are already built (directory, roles, departments, projects/tasks). This phase adds onboarding on top of the existing `employees` table without touching it.

## Scope

- A new employee, on first login, is shown only an onboarding form until they submit it — every other route is gated.
- The form collects fixed HR-required fields (listed below) plus three document uploads (National ID copy, signed offer letter, a photo).
- Submitting unlocks the rest of the portal immediately — admin review happens after, not as a gate.
- Admin/superadmin review the submission, either mark it complete or send it back with a correction note, which re-gates the employee until they fix and resubmit.
- Once marked complete, the data becomes admin-managed: future corrections go through the existing admin employee-edit screen, not employee self-service.
- No grandfather-migration for currently active employees: the account holder is recreating all employee accounts before this ships, so every employee row will naturally start at `not_started`. No special-casing needed in the migration or gating logic for "already active" accounts.

Out of scope for this phase (separate future specs):
- Attendance & Leave (clock in/out, timesheets, leave requests/approval).
- IT Support Ticketing.
- Payroll processing — this phase only *stores* bank details; no payroll logic reads them yet.
- Any employee self-editing of onboarding data after it's marked complete.
- Per-field reopen on correction (see Submission & Review below — corrections reopen the whole form, not individual fields).

## Data Model

**`employee_onboarding`** (new) — one row per employee, created automatically when the employee account is created (extends the existing admin "create employee" action)
- `employee_id` (FK → employees, unique, cascade delete)
- `status` (`not_started` | `submitted` | `needs_correction` | `complete`, default `not_started`)
- Personal: `date_of_birth` (date), `fathers_name` (text), `mothers_name` (text), `blood_group` (text), `phone` (text), `personal_email` (text), `present_address` (text), `permanent_address` (text)
- Emergency contact: `emergency_contact_name` (text), `emergency_contact_relationship` (text), `emergency_contact_phone` (text)
- Bank: `bank_name` (text), `account_holder_name` (text), `account_number` (text), `branch_code` (text)
- Documents (storage paths, nullable until uploaded): `national_id_path`, `offer_letter_path`, `photo_path`
- Review: `reviewed_by` (FK → employees, nullable), `reviewed_at` (timestamptz, nullable), `correction_notes` (text, nullable — admin's free-text explanation of what to fix, cleared on next submit)
- `submitted_at` (timestamptz, nullable), `updated_at` (timestamptz, auto)

All personal/emergency-contact/bank fields above are required before submit. `employees.name` (already exists) is shown read-only on the form for the employee to confirm; it is not duplicated into this table.

**Storage**: new private bucket `onboarding-documents`. Accepted types: PDF, JPG, PNG. Max 5MB per file. Path convention: `{employee_id}/{national-id|offer-letter|photo}.{ext}`, one current file per slot (re-upload replaces, no version history — matches how `employee-documents` already handles files).

## Gating

Server-side middleware checks the caller's `employee_onboarding.status` on every request (superadmin/admin are never gated — this only applies to the `employee` and `manager` roles, since admin accounts are the ones doing the onboarding-creation and don't onboard themselves).

| Status | Behavior |
|---|---|
| `not_started` | Every route except `/onboarding` redirects to `/onboarding`. |
| `submitted` | Full portal access. Admin has a pending review. |
| `needs_correction` | Every route except `/onboarding` redirects to `/onboarding` — same as `not_started`, until they resubmit. |
| `complete` | Full portal access, form no longer editable by the employee. |

Submitting (not admin approval) is what lifts the gate the first time — matches the "block until complete" decision, where "complete" for gating purposes means the employee has submitted, and admin review is a background process layered on top.

## Submission & Review

1. Employee fills the form. Can save progress per-section as they go (a plain update to their `employee_onboarding` row); nothing is validated as "final" until they hit **Submit**, which requires every required field and all three documents to be present.
2. On submit: `status → submitted`, `submitted_at` set. A notification is emitted to every active admin/superadmin via the shared notification center (`2026-08-05-notification-center-design.md`).
3. Admin opens the submission (new "Onboarding" tab on the existing employee-edit page at `/admin/employees/[id]`) — sees all fields and can view/download the three documents via signed URLs, same pattern as `employee_documents` today.
4. Admin action: **Mark Complete** (`status → complete`, `reviewed_by`/`reviewed_at` set) or **Request Correction** (`status → needs_correction`, `correction_notes` set to the admin's explanation, `reviewed_by`/`reviewed_at` set).
5. If `needs_correction`: employee is re-gated to `/onboarding`, sees the correction note at the top of the form, form is pre-filled with their prior answers (whole form re-editable, not just flagged fields — kept simple deliberately, see Non-goals). A notification is emitted to the employee. Resubmitting clears `correction_notes` and returns to step 2.
6. Once `complete`: the employee no longer has write access to `employee_onboarding` (enforced at RLS, not just hidden in the UI). Any future change goes through admin editing the employee record — the existing `/admin/employees/[id]` edit screen gets extended to include these fields.

## Access Control (RLS)

- **Employee or manager (own row)**: `select`/`update` only their own `employee_onboarding` row, and only while `status` is `not_started` or `needs_correction`. Cannot set `status` to `complete` or write `reviewed_by`/`reviewed_at`/`correction_notes` (column-level restriction via a check in the update policy or a trigger that rejects employee-originated changes to those columns). Storage: can upload only to their own `{employee_id}/` prefix in `onboarding-documents`, only while status allows editing. A `manager`-role account onboards the same way as an `employee`-role account — this section governs access to one's *own* row, regardless of role.
- **Admin/superadmin**: full read/write on all rows and all files, reusing the existing `is_admin()` helper.
- **Manager (other employees' rows)**: no access — reviewing onboarding submissions is admin/superadmin-only, consistent with how `employee_documents` is scoped today. A manager cannot see or review a report's onboarding data even for people on their own projects.

## Testing

1. A brand-new employee is redirected to `/onboarding` from every route until they submit.
2. Submitting with a required field or document missing is rejected (server-side, not just client validation).
3. After submit, the employee can reach the rest of the portal; status is `submitted`.
4. Employee cannot read or write another employee's `employee_onboarding` row or documents (RLS-level test).
5. Employee cannot set their own status to `complete`, nor write `reviewed_by`/`correction_notes`.
6. Manager has no access to any `employee_onboarding` row (RLS-level test).
7. Admin marking a submission `needs_correction` re-gates that employee to `/onboarding` on their next request; the correction note is visible; resubmission clears it and returns to `submitted`.
8. Admin marking `complete` removes the employee's write access to the row and files.
9. A new employee account created via the existing admin "create employee" action automatically gets an `employee_onboarding` row at `not_started`.

## Non-goals for this phase

- No per-field reopen on correction — a correction always re-opens the whole form.
- No employee self-editing after `complete` — corrections go through admin.
- No configurable/admin-editable field list — the field set is fixed by this spec; a future "form builder" is out of scope (YAGNI).
- No payroll processing against the bank details collected here.
- No retroactive onboarding requirement for existing employee accounts — moot, since those accounts will be recreated before this ships.
- No email/push notifications — submit and correction events surface via the shared in-app notification center (`2026-08-05-notification-center-design.md`), not email.
