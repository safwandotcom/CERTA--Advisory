# Employee Management System — Remaining Tasks

Status tracker for the internal employee management / office system (`portal/`), deployed as its own Vercel project separate from the marketing site (`index.html`). Target subdomain: `portal.certaadvisory.com`.

Last updated: 2026-08-06.

## Completed

### Foundation — Admin/Employee accounts, roles, staff directory, admin-managed documents ✅
Spec/plan: `docs/superpowers/specs/2026-07-30-employee-management-phase1-foundation-design.md`, `docs/superpowers/plans/2026-07-30-employee-management-phase1-foundation.md`
- Admin login, Employee login (Employee ID + password, no self-service reset)
- Roles (Admin / Employee)
- Central staff directory (admin-managed)
- Departments (admin-managed)
- Per-employee document storage — admin-uploads-for-employee only; employee can view/download their own.

### Portal Phase 2 — Roles, Departments, baseline Tasks, Reporting ✅
Spec/plan: `docs/superpowers/specs/2026-07-31-portal-phase2-roles-departments-tasks-reporting-design.md`, `docs/superpowers/plans/2026-07-31-portal-phase2-roles-departments-tasks-reporting.md`
- Manager role, department-scoped task assignment (early model)
- Monthly reporting (later re-scoped, see below)

### Portal Phase 3 — Full Project & Task Management ✅
Spec/plan: `docs/superpowers/specs/2026-08-01-portal-phase3-project-management-design.md`, `docs/superpowers/plans/2026-08-01-portal-phase3-project-management.md`
All 14 planned tasks shipped, plus post-review fixes (commit `4d52b73`):
- Projects (admin/manager-created), project membership, Board/List/Calendar views
- Unrestricted task assignment with priority/labels/auto-membership
- Subtasks and comments on tasks
- Employee personal task view + self-service task creation within own projects
- Reporting re-scoped from per-department to per-manager
- Phase 2's department-scoped restrictions dropped in favor of the Projects model
- RLS isolation tests for the Projects model
- Review-driven fixes: task-detail access for employees, project-peer visibility, task-insert assignee scoping, null-guards, e2e test fix

### Notification Center + Employee Onboarding ✅
Spec/plan: `docs/superpowers/specs/2026-08-05-notification-center-design.md`, `docs/superpowers/specs/2026-08-05-employee-onboarding-design.md`, `docs/superpowers/plans/2026-08-05-employee-onboarding.md`
Built and merged to `main` 2026-08-06 (10 planned tasks + 2 fix tasks + a final-review fix wave, all individually reviewed; full test suite green — tsc/lint clean, vitest 8/8, e2e 22/22):
- **Notification Center**: generic `notifications` table, bell-icon UI with unread badge in the shared Sidebar, in-app only (no email/push). Built first so Onboarding (and future Attendance/IT Ticketing phases) emit into shared infra instead of each inventing its own indicator.
- **Onboarding**: HR-required personal/emergency-contact/bank fields, three document uploads (National ID, signed offer letter, photo), gated on first login until submitted, admin review with a request-correction loop, notifications on submit/correction.
- New employees get an onboarding row automatically on creation; a one-time backfill (migration `0014`) covered the employees that existed before this shipped.
- Two real bugs were found via live testing and fixed during the build (both now part of the shipped migrations): a storage-RLS policy that silently rejected all employee document uploads (cross-table subqueries don't reliably evaluate in this Supabase project's storage policies — fixed by re-keying to a plain `auth.uid()` check), and an admin-review trigger that didn't recognize the app's service-role writes as trusted.
- Final whole-branch review (Opus) found and a follow-up fix wave resolved: the pre-existing-employee backfill (above), a gap letting an employee overwrite an already-reviewed document via the form, `correction_notes` not being cleared on resubmit or shown to admins, and several silent-failure/"reports success but nothing happened" bugs in the onboarding save/submit path. Two new e2e tests cover the document-storage isolation and submitted-row self-edit boundaries.

**Known follow-up items, not blocking, tracked here rather than fixed ad hoc:**
- [ ] Spec asked for a post-"complete" admin-edit path for onboarding fields (so HR can fix a typo without raw SQL); only a read-only admin view was ever planned/built. Needs its own small follow-up spec/plan.
- [ ] A determined employee could still bypass the app-layer "no re-upload after submit" guard by calling the Storage API directly (the storage RLS policy itself doesn't gate on status, for the same cross-table-subquery reason noted above). Self-scoped only, not a cross-employee issue — worth a dedicated fix once there's a reliable way to express a status check in this project's storage policies.
- [ ] The onboarding-documents storage `select` policy's admin branch (`is_admin()`) is unverified and likely has the same reliability issue — doesn't block anything today since the admin review UI reads documents via the service-role client instead, bypassing that branch entirely.

## Priority order

| Priority | Phase | Status |
|---|---|---|
| P1 | **Onboarding** | ✅ Shipped |
| P1 | **Attendance & Leave** (incl. salary deduction estimate) | Spec'd; plan not started |
| P2 | **IT Support Ticketing** | Spec'd; plan not started |
| P3 | **Contracts & E-Signature** | Not started, not spec'd |
| P4 | **Document Generator** (letterhead → PDF/DOCX) | Not started, not spec'd |
| P5 | **Payroll Processing** | Not started, not spec'd — still has an open scope question (see below) |

## Open decisions (need your input before design)

- [ ] Payroll scope: just recording pay amounts/history, or actual tax withholding calculation (jurisdiction-specific, higher complexity/risk)? (Note: basic salary recording + a simple unpaid-leave/absence deduction estimate is already covered by the Attendance & Leave spec — this question is about full payroll *processing* beyond that.)
- [ ] E-signature: build vs. integrate an existing e-signature service (recommended, for legal validity reasons).

## Future / Backlog (raised 2026-08-05, not yet spec'd)

Came up while discussing what a genuinely complete, automation-forward HRMS needs beyond the above. Not scheduled into a priority tier yet.

**Small, high-leverage additions (cheap, build on infra already planned):**
- [ ] Company holiday calendar as a visible page — `company_holidays` is already being built for the Attendance & Leave deduction math; surfacing it as an actual page employees can see is a small addition to that same phase.
- [ ] Birthday / work-anniversary reminders — trivial once `employees.join_date` (already exists) and onboarding's date-of-birth field are in place — a small dashboard touch, not its own phase.
- [ ] Audit log on sensitive changes (salary, role, leave allocation edits — who changed what, when).

**Bigger modules — genuinely new scope, each would need its own spec:**
- [ ] Offboarding — resignation/termination workflow, access revocation, asset return, final settlement. Natural mirror of Onboarding.
- [ ] Asset management — laptops/phones/access cards assigned per employee, tracked for return on exit. Pairs with IT Support Ticketing (same IT department).
- [ ] Performance reviews — appraisal cycles, goal-setting, manager+self feedback tied to promotion/raise decisions.
- [ ] Benefits administration — insurance, provident fund/gratuity, other perks.
- [ ] Recruitment / ATS — job postings → candidate pipeline → interview → hire, could auto-create the Onboarding record.
- [ ] HR analytics dashboard — headcount, attrition, leave trends, attendance patterns, ticket volume in one admin view.
- [ ] Company announcements/news feed.

**Deliberately not recommended right now:** an org chart / "reports to" hierarchy, or multi-level approval chains — explicitly rejected for Attendance & Leave (admin-only approval, no manager relationship) given the current ~15-employee headcount. Revisit if headcount grows a lot.

## Phase breakdown (remaining)

### P1 — Attendance & Leave (spec'd, plan not started)
See `docs/superpowers/specs/2026-08-05-attendance-leave-salary-deduction-design.md`: daily clock in/out (desktop-first, no special enforcement), timesheets computed from clock records, four leave types (Casual/Sick/Earned/Unpaid) with per-employee-per-year quota allocation, admin-only approval, and a live-computed monthly salary-deduction estimate (unpaid leave + over-quota leave + unexplained absences) for HR reference — not full payroll processing.

### P2 — IT Support Ticketing (spec'd, plan not started)
See `docs/superpowers/specs/2026-08-05-it-support-ticketing-design.md`: ticket creation with category/priority/attachments, open-queue self-assignment scoped to an admin-designated IT department, comment thread, assignee resolves with a required note, requester can reopen.

### P3 — Contracts & E-Signature (not started)
- [ ] Assign contracts/documents to employees for signing
- [ ] Digital signature capture (Adobe Sign–style, or upload-a-signature)

### P4 — Document Generator (not started)
- [ ] Company letterhead template (JPG provided by user, hardcoded)
- [ ] Free-text input → generate PDF/DOCX on letterhead

### P5 — Payroll Processing (not started)
- [ ] Scope TBD pending open decision above (full tax withholding vs. simpler processing — note the Attendance & Leave phase already covers salary recording + a deduction estimate)

## Process note

Each phase gets its own design (spec) → implementation plan → build cycle, following the same pattern as Foundation and Portal Phases 2–3 (spec in `docs/superpowers/specs/`, plan in `docs/superpowers/plans/`, then TDD implementation with RLS tests where relevant). Notification Center + Onboarding just shipped this way, including two live-testing-driven fix tasks and a final whole-branch review, all folded back into the shipped migrations. Next up: **P1 — Attendance & Leave** implementation plan.
