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
- Per-employee document storage — admin-uploads-for-employee only; employee can view/download their own.

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

## Spec'd, implementation in progress

Four specs written and committed 2026-08-05, covering the P1/P2 scope below plus one shared piece discovered while spec'ing them:

- `docs/superpowers/specs/2026-08-05-employee-onboarding-design.md` — **implementation plan being written now**
- `docs/superpowers/specs/2026-08-05-attendance-leave-salary-deduction-design.md`
- `docs/superpowers/specs/2026-08-05-it-support-ticketing-design.md`
- `docs/superpowers/specs/2026-08-05-notification-center-design.md` — shared in-app notification infra (bell icon, generic `notifications` table), built first so the other three emit into it instead of each inventing a bespoke pending-indicator. Build order: Notification Center → Onboarding → Attendance & Leave → IT Support Ticketing.

All prior open decisions for these three (onboarding document checklist, onboarding gating, IT routing model, IT ticket fields, leave quota/deduction rules) are resolved — see each spec's Scope/Data Model sections rather than tracking them here.

## Priority order

| Priority | Phase | Status |
|---|---|---|
| P1 | **Onboarding** | Spec'd; implementation plan in progress |
| P1 | **Attendance & Leave** (incl. salary deduction estimate) | Spec'd; plan not started |
| P2 | **IT Support Ticketing** | Spec'd; plan not started |
| P3 | **Contracts & E-Signature** | Not started, not spec'd |
| P4 | **Document Generator** (letterhead → PDF/DOCX) | Not started, not spec'd |
| P5 | **Payroll Processing** | Not started, not spec'd — still has an open scope question (see below) |

## Open decisions (need your input before design)

- [ ] Payroll scope: just recording pay amounts/history, or actual tax withholding calculation (jurisdiction-specific, higher complexity/risk)? (Note: basic salary recording + a simple unpaid-leave/absence deduction estimate is already covered by the Attendance & Leave spec — this question is about full payroll *processing* beyond that.)
- [ ] E-signature: build vs. integrate an existing e-signature service (recommended, for legal validity reasons).

## Future / Backlog (raised 2026-08-05, not yet spec'd)

Came up while discussing what a genuinely complete, automation-forward HRMS needs beyond the above. Not scheduled into a priority tier yet — revisit once P1/P2 ship.

**Small, high-leverage additions (cheap, build on infra already planned):**
- [ ] Company holiday calendar as a visible page — `company_holidays` is already being built for the Attendance & Leave deduction math; surfacing it as an actual page employees can see is a small addition to that same phase.
- [ ] Birthday / work-anniversary reminders — trivial once Onboarding captures date of birth and `employees.join_date` (already exists) — a small dashboard touch, not its own phase.
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

### P1 — Onboarding (spec'd, plan in progress)
See `docs/superpowers/specs/2026-08-05-employee-onboarding-design.md` for full detail: HR-required personal/emergency-contact/bank fields, three document uploads (National ID, signed offer letter, photo), gated on first login until submitted, admin review with a request-correction loop, emits into the shared Notification Center.

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

Each phase gets its own design (spec) → implementation plan → build cycle, following the same pattern as Foundation and Portal Phases 2–3 (spec in `docs/superpowers/specs/`, plan in `docs/superpowers/plans/`, then TDD implementation with RLS tests where relevant). Currently writing the implementation plan for the Notification Center + Onboarding (built together, since Onboarding is the first consumer of the shared notification infra); Attendance & Leave and IT Support Ticketing plans follow the same spec, one at a time.
