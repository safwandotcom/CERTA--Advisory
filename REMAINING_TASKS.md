# Employee Management System — Remaining Tasks

Status tracker for the internal employee management / office system (`portal/`), deployed as its own Vercel project separate from the marketing site (`index.html`). Target subdomain: `portal.certaadvisory.com`.

Last updated: 2026-08-05.

## Completed

### Foundation — Admin/Employee accounts, roles, staff directory, admin-managed documents ✅
Spec/plan: `docs/superpowers/specs/2026-07-30-employee-management-phase1-foundation-design.md`, `docs/superpowers/plans/2026-07-30-employee-management-phase1-foundation.md`
- Admin login, Employee login (Employee ID + password, no self-service reset)
- Roles (Admin / Employee)
- Central staff directory (admin-managed)
- Departments (admin-managed)
- Per-employee document storage — **admin-uploads-for-employee only**; employee can view/download their own. (No employee-initiated upload yet — see new item under Attendance & Onboarding below.)

### Portal Phase 2 — Roles, Departments, baseline Tasks, Reporting ✅
Spec/plan: `docs/superpowers/specs/2026-07-31-portal-phase2-roles-departments-tasks-reporting-design.md`, `docs/superpowers/plans/2026-07-31-portal-phase2-roles-departments-tasks-reporting.md`
- Manager role, department-scoped task assignment (early model)
- Monthly reporting (later re-scoped, see below)

### Portal Phase 3 — Full Project & Task Management ✅
Spec/plan: `docs/superpowers/specs/2026-08-01-portal-phase3-project-management-design.md`, `docs/superpowers/plans/2026-08-01-portal-phase3-project-management.md`
All 14 planned tasks shipped, plus post-review fixes (commit `4d52b73` is the latest):
- Projects (admin/manager-created), project membership, Board/List/Calendar views
- Unrestricted task assignment with priority/labels/auto-membership
- Subtasks and comments on tasks
- Employee personal task view + self-service task creation within own projects
- Reporting re-scoped from per-department to per-manager
- Phase 2's department-scoped restrictions dropped in favor of the Projects model
- RLS isolation tests for the Projects model
- Review-driven fixes: task-detail access for employees, project-peer visibility, task-insert assignee scoping, null-guards, e2e test fix

**Not yet done from Foundation-era planning:** none — Foundation is fully covered above.

## Priority order (revised 2026-08-05)

| Priority | Phase | Why this order |
|---|---|---|
| P1 | **Onboarding & Attendance** | Day-one needs: new hires must be able to submit required HR info/documents, then clock in/out and request leave. |
| P2 | **IT Support Ticketing** | New requirement — employees need a way to report IT issues once they're actively working in the portal day to day. |
| P3 | **Contracts & E-Signature** | Important but paper/manual signing can still bridge the gap. |
| P4 | **Document Generator** (letterhead → PDF/DOCX) | Convenience feature, not operationally blocking. |
| P5 | **Payroll Processing** | Highest compliance/legal risk if rushed — deserves the most care, least time pressure. |

## Open decisions (need your input before design)

- [ ] **Onboarding document checklist**: what exact details/documents does HR need from a new employee (ID, tax forms, bank details for payroll, emergency contact, certifications, signed policies, etc.)? Full list needed before spec.
- [ ] **Onboarding gating**: should the portal *block* a new employee from the rest of the dashboard until onboarding is complete, or just nag/remind (banner, checklist widget) while still allowing access?
- [ ] **IT Support routing model**: does every member of the "IT" department see all open tickets and self-assign (queue model), or does one designated person (e.g. IT manager) triage and assign tickets to specific staff?
- [ ] **IT ticket fields**: category (hardware/software/account/other)? Priority? Attachments (e.g. screenshot of an error)?
- [ ] Payroll scope: just recording pay amounts/history, or actual tax withholding calculation (jurisdiction-specific, higher complexity/risk)?
- [ ] E-signature: build vs. integrate an existing e-signature service (recommended, for legal validity reasons).

## Phase breakdown (remaining)

### P1 — Onboarding & Attendance (not started)
- [ ] **New**: Employee onboarding flow — on first login, employee is prompted to fill in HR-required details and upload required documents (self-service upload; today only admins can upload to `employee_documents`)
- [ ] **New**: Admin/HR review of submitted onboarding info (approve, request re-upload, mark complete)
- [ ] Clock in / clock out — **desktop only**
- [ ] Timesheets
- [ ] Leave requests
- [ ] Leave approval workflow

### P2 — IT Support Ticketing (not started, new)
- [ ] Employee creates a ticket (description, category, priority — pending decision above)
- [ ] Ticket routed to the IT department
- [ ] Responsible IT staff member works the ticket (assignment model pending decision above), status tracking (open → in progress → resolved)
- [ ] IT staff resolves and closes the ticket; employee can see resolution/status
- [ ] Notifications on status change (at minimum: ticket opened, ticket resolved)

### P3 — Contracts & E-Signature (not started)
- [ ] Assign contracts/documents to employees for signing
- [ ] Digital signature capture (Adobe Sign–style, or upload-a-signature)

### P4 — Document Generator (not started)
- [ ] Company letterhead template (JPG provided by user, hardcoded)
- [ ] Free-text input → generate PDF/DOCX on letterhead

### P5 — Payroll Processing (not started)
- [ ] Scope TBD pending open decision above

## Process note

Each phase gets its own design (spec) → implementation plan → build cycle, following the same pattern as Foundation and Portal Phases 2–3 (spec in `docs/superpowers/specs/`, plan in `docs/superpowers/plans/`, then TDD implementation with RLS tests where relevant). Next up: **P1 — Onboarding & Attendance**, pending the open decisions above.
