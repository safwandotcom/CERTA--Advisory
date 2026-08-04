# Employee Portal — IT Support Ticketing Design

## Context

Third of three new subsystems requested together (see `REMAINING_TASKS.md`; siblings: `2026-08-05-employee-onboarding-design.md`, `2026-08-05-attendance-leave-salary-deduction-design.md`). Lets any employee raise an IT issue, have it picked up and worked by IT department staff, and resolved — a lightweight internal helpdesk, not a general-purpose ticketing platform.

This is a straightforward extension of patterns already established in the codebase — comment threads (`task_comments` from Phase 3), private-bucket file attachments (`employee_documents`, `onboarding-documents`), and the `company_settings` key/value table introduced in the Attendance/Leave spec — rather than a new architectural approach.

## Scope

- Any employee can open a ticket: title, description, category, priority, optional attachment(s).
- Tickets route to whichever department is admin-designated as the IT support department (via `company_settings`), not a hardcoded department name.
- Open queue model: any member of that department can claim an unassigned ticket; the claimant is the sole assignee.
- Comment thread on each ticket between requester, assignee, and other IT-department members.
- Assignee resolves their own claimed ticket with a required resolution note; requester can reopen a resolved ticket if the issue isn't actually fixed.
- Admin/superadmin have full oversight: view, comment on, reassign, or force-resolve any ticket.

Out of scope for this phase (deliberately deferred):
- SLA timers, due dates, or auto-escalation on tickets.
- Category/priority driving any routing or notification logic — both are informational/sortable only.
- Email or other external notifications — same in-portal-only indicator approach used for onboarding review and leave approval.
- Multi-department ticketing (HR tickets, Facilities tickets, etc.) — this system is IT-specific by design; generalizing to "any department can run a ticket queue" is materially bigger scope than what was requested.
- Reassignment by IT-department members themselves — only admin/superadmin can reassign, to avoid queue-stealing disputes.
- A confirmation step before reopening a resolved ticket — the requester reopening it is itself the signal, no extra approval gate.

## Data Model

**`support_tickets`** (new)
- `id`, `requester_id` (FK → employees)
- `title` (text), `description` (text)
- `category` (`hardware` | `software` | `account` | `network` | `other`)
- `priority` (`low` | `medium` | `high` | `urgent`)
- `status` (`open` | `in_progress` | `resolved`, default `open`)
- `assigned_to` (FK → employees, nullable — set only once claimed)
- `resolution_note` (text, nullable — required at the point of resolving)
- `created_at`, `resolved_at` (nullable)

**`support_ticket_comments`** (new) — same shape as `task_comments`
- `id`, `ticket_id` (FK → support_tickets, cascade delete), `author_id` (FK → employees), `body` (text), `created_at`

**`support_ticket_attachments`** (new)
- `id`, `ticket_id` (FK → support_tickets, cascade delete), `file_path` (text), `uploaded_by` (FK → employees), `uploaded_at`
- New private storage bucket `support-ticket-attachments`, signed-URL read pattern matching `employee-documents`/`onboarding-documents`. Accepted types/size limits match the onboarding spec's convention (PDF, JPG, PNG, 5MB max).

**`company_settings`** (existing table, from the Attendance/Leave spec) += one more row: `it_support_department_id` (references `departments.id`). No new table — this is exactly the generic setting that table exists for.

## Lifecycle

1. **Create**: employee fills title, description, category, priority, optional attachment(s). Row created at `status = open`, `assigned_to = null`.
2. **Claim**: any employee whose `employees.department_id` matches `company_settings.it_support_department_id` sees the open/unassigned queue and can claim a ticket. Claiming sets `status = in_progress`, `assigned_to = <claimant>`. Claiming an already-claimed ticket is rejected at the database level — first claim wins, no race where two people end up assigned.
3. **Discuss**: while `open` or `in_progress`, the requester, the assignee (once claimed), and any other IT-department member can post comments — covers "can you send a screenshot" / "tried restarting, still broken" back-and-forth.
4. **Resolve**: the assignee (or admin/superadmin) sets `status = resolved`, `resolved_at = now()`, and must supply `resolution_note` — resolving without a note is rejected.
5. **Reopen**: the requester (or admin/superadmin) can reopen a `resolved` ticket. This sets `status = in_progress`, keeps the same `assigned_to`, clears `resolved_at` and `resolution_note`. No separate confirmation step — reopening is itself the signal that it needs more work.

## Permissions

| Action | Superadmin/Admin | IT-department member | Any other employee |
|---|---|---|---|
| Create a ticket | ✅ | ✅ | ✅ |
| View own submitted tickets | ✅ (all tickets) | ✅ (own + entire IT queue) | ✅ (own only) |
| View the open/unassigned queue | ✅ | ✅ | ❌ |
| Claim a ticket | ✅ | ✅ | ❌ |
| Resolve / reopen a ticket | ✅ (any) | ✅ (only ones they're assigned to) | ❌ (except reopening their own, as requester) |
| Comment on a ticket | ✅ (any) | ✅ (if requester, assignee, or IT-dept. member) | ✅ (only if they're the requester) |
| Reassign a ticket to someone else | ✅ | ❌ | ❌ |
| Set `it_support_department_id` | ✅ | ❌ | ❌ |

Admin/superadmin have blanket oversight — same pattern as every other subsystem in this portal (onboarding review, leave approval, document management).

## Testing

1. A non-IT, non-requester employee cannot see a ticket that isn't their own — not the queue, not the ticket detail, not its comments or attachments (RLS-level test).
2. Claiming an already-claimed ticket is rejected; only one `assigned_to` ever sticks.
3. Resolving without a `resolution_note` is rejected.
4. Only the assignee or admin/superadmin can resolve a ticket; an unrelated IT-department member cannot resolve someone else's claimed ticket.
5. The requester can reopen a resolved ticket; `assigned_to` is unchanged, `status` returns to `in_progress`, `resolved_at`/`resolution_note` are cleared.
6. Changing `company_settings.it_support_department_id` immediately changes who can see/claim the queue, with no migration needed on existing `support_tickets` rows (the department reference lives in the setting, not duplicated onto each ticket).
7. An IT-department member cannot reassign a ticket to a different person; only admin/superadmin can.

## Non-goals for this phase

- No SLA timers, due dates, or auto-escalation.
- No routing/notification logic driven by category or priority — sortable/informational only.
- No email or external notifications.
- No multi-department ticketing beyond IT.
- No IT-member-initiated reassignment.
- No confirmation gate before reopening a resolved ticket.
