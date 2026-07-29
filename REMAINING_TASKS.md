# Employee Management System — Remaining Tasks

Status tracker for the internal employee management / office system. This is a **separate application** from the public marketing site (`index.html`) — it needs its own login, backend, and database, and will live on its own subdomain (e.g. `portal.certaadvisory.com`). It lives in this same git repo, in a `portal/` subfolder, deployed as its own separate Vercel project so it doesn't affect the marketing site's deploy.

Last updated: 2026-07-30. Nothing has been built yet — we are still in the design/spec stage (see brainstorming conversation). This file exists to track what's planned, what's decided, what's open, and in what order we build it.

## Priority order (revised — employees starting immediately)

Because staff are starting right away, day-one operational needs (clocking in, leave) are pulled ahead of things that can still be handled manually short-term (contracts on paper, payroll in a spreadsheet, doc generation by hand).

| Priority | Phase | Why this order |
|---|---|---|
| P0 | **Foundation** | Nothing else works without accounts, roles, and a staff directory. Kept deliberately minimal so it doesn't delay P1. |
| P1 | **Attendance & Leave** | Needed from day one once employees start — clock in/out, timesheets, leave requests/approval. |
| P2 | **Tasks & Project Tracking** | Useful early but not blocking — work can be tracked manually for a short while. |
| P3 | **Contracts & E-Signature** | Important but paper/manual signing can bridge the gap temporarily. |
| P4 | **Document Generator** (letterhead → PDF/DOCX) | Convenience feature, not operationally blocking. |
| P5 | **Payroll Processing** | Highest compliance/legal risk if rushed — deserves the most care, least time pressure. |

## Open decisions (need your input before Phase 1 design is finalized)

- [x] **Employee self-login**: confirmed — employees log in themselves.
- [x] Scale: plan for ~15 employees.
- [x] Stack: Next.js + Supabase + Vercel. Auth: Employee ID + password (not email-based), admin-only password reset (no self-service/email reset flow).
- [ ] Payroll scope: just recording pay amounts/history, or actual tax withholding calculation (jurisdiction-specific, higher complexity/risk)?
- [ ] E-signature: build vs. integrate an existing e-signature service (recommended, for legal validity reasons).

## Phase breakdown

### P0 — Foundation (not started)
- [ ] Admin login
- [ ] Employee login (pending confirmation above)
- [ ] Roles (Admin / Employee, others TBD)
- [ ] Central staff directory (admin manually keys in employee info)
- [ ] Per-employee document storage (admin-managed, employee-requestable)

### P1 — Attendance & Leave (not started)
- [ ] Clock in / clock out — **desktop only**
- [ ] Timesheets
- [ ] Leave requests
- [ ] Leave approval workflow

### P2 — Tasks & Project Tracking (not started)
- [ ] Task assignment
- [ ] Deadlines
- [ ] Status updates

### P3 — Contracts & E-Signature (not started)
- [ ] Assign contracts/documents to employees for signing
- [ ] Digital signature capture (Adobe Sign–style, or upload-a-signature)

### P4 — Document Generator (not started)
- [ ] Company letterhead template (JPG provided by user, hardcoded)
- [ ] Free-text input → generate PDF/DOCX on letterhead

### P5 — Payroll Processing (not started)
- [ ] Scope TBD pending open decision above

## Process note

Each phase gets its own design (spec) → implementation plan → build cycle, starting with P0. We're currently mid-design on P0 (Foundation) in the brainstorming conversation — the open decisions above are what's blocking finishing that spec.
