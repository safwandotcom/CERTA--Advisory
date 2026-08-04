# Employee Portal — Shared Notification Center Design

## Context

While spec'ing Onboarding, Attendance & Leave, and IT Support Ticketing, each one independently designed its own "pending" indicator (an admin badge, a per-user status). Rather than building three bespoke indicators and reworking them later, this small shared piece is built first: one generic notifications mechanism the other three subsystems emit into.

This does not replace any RLS/business-logic boundary already defined in the other three specs — it's a read-only-to-the-user, write-only-by-server-actions signal layer on top of them.

## Scope

- A generic `notifications` table: any server action can write a notification for any employee, using the same service-role (`createAdminClient()`) pattern already used for cross-employee writes elsewhere in this codebase (e.g. `createEmployeeRecord`).
- A bell icon with unread count in the shared layout header, present for every logged-in role.
- Clicking the bell opens a dropdown of the most recent ~20 notifications; each links to the relevant page and marks itself read on click. A "mark all read" action clears the whole list.
- Computed fresh on each page load — no realtime subscription, no polling.

Out of scope for this phase:
- Email or push delivery — in-app only, matching the "no external notifications" decision already made in the Onboarding, Attendance & Leave, and IT Support Ticketing specs (which this spec now supersedes on that one point — see the amendment note in each).
- Per-notification-type mute/preference settings.
- Realtime/websocket delivery — unread count and list are only as fresh as the last page load, which is acceptable at this scale (~15 employees, no expectation of instant push).

## Data Model

**`notifications`** (new)
- `id` (uuid, PK)
- `recipient_id` (FK → employees, cascade delete)
- `title` (text, not null)
- `body` (text, nullable)
- `link` (text, nullable — a relative in-app path, e.g. `/admin/employees/{id}?tab=onboarding`)
- `read_at` (timestamptz, nullable)
- `created_at` (timestamptz, not null, default now())

No `type` column — the three consuming subsystems don't need to filter/group notifications by type for anything in this phase (YAGNI); `title`/`body`/`link` fully describe each one to a human reader.

## Emission

Notifications are inserted directly inside the same server action that causes the triggering event — no separate job, queue, or database trigger. Each consuming spec's server actions gain one extra step: after the state-changing write succeeds, insert the corresponding `notifications` row(s) via `createAdminClient()`.

The concrete emission points (defined here so each subsystem's implementation plan can reference exact copy):
- **Onboarding submitted** → one row per employee with `role in ('admin','superadmin')` and `status = 'active'`: title `"New onboarding submission: {employee name}"`, link to that employee's admin edit page onboarding tab.
- **Onboarding sent back for correction** → one row for the submitting employee: title `"Your onboarding needs a correction"`, link `/onboarding`.
- **Leave request submitted** → one row per active admin/superadmin: title `"New leave request: {employee name}"`, link to the leave-review page.
- **Leave request approved** → one row for the requesting employee: title `"Your leave request was approved"`, link to their leave history.
- **Leave request rejected** → one row for the requesting employee: title `"Your leave request was rejected"`, link to their leave history.
- **Support ticket created** → one row per active employee whose `department_id` matches `company_settings.it_support_department_id`: title `"New support ticket: {ticket title}"`, link to the ticket.
- **Support ticket resolved** → one row for the requester: title `"Your ticket was resolved: {ticket title}"`, link to the ticket.
- **Support ticket reopened** → one row for the assignee: title `"Ticket reopened: {ticket title}"`, link to the ticket.

## UI

A bell icon in the shared header (used by both `/dashboard` and `/admin` layouts) shows the caller's unread count (`select count(*) from notifications where recipient_id = <self> and read_at is null`), fetched as part of that layout's existing server-side data load — no new client-side polling. Clicking it opens a dropdown listing the most recent 20 `notifications` rows for the caller, newest first. Clicking an individual entry sets its `read_at` and navigates to `link` (if present). A "mark all read" control sets `read_at = now()` on every currently-unread row for the caller.

## Access Control (RLS)

- Any authenticated employee: `select` and `update` (limited to setting `read_at`) only rows where `recipient_id` matches their own employee row. No `insert` policy for the anon/authenticated role at all — every insert goes through a server action using the service-role client, which is where the "am I allowed to notify this person" check already lives (e.g. only the onboarding-review action can trigger the "needs correction" notification, and it already runs under `requireAdmin()`).
- No `delete` policy needed for this phase — notifications aren't manually cleared, only marked read.

## Testing

1. An employee cannot read another employee's `notifications` rows (RLS-level test).
2. An employee cannot mark another employee's notification as read.
3. An employee cannot insert a `notifications` row directly via the anon/authenticated client (no insert policy exists) — confirms the service-role-only emission path is actually enforced, not just a convention.
4. Marking one notification read doesn't affect the `read_at` of others.
5. "Mark all read" clears every unread row for the caller and none for anyone else.

## Non-goals for this phase

- No email or push delivery.
- No realtime/websocket updates — unread count and list reflect the state as of the last page load.
- No per-type mute/preference settings.
- No notification history pruning/archival — rows accumulate; if this becomes a real problem at scale, a retention policy can be added later (not a concern at ~15 employees).

## Amendment to prior specs

This supersedes the "no email/external notifications" non-goal in the Onboarding, Attendance & Leave, and IT Support Ticketing specs on one point only: those subsystems now emit **in-app** notifications via this shared mechanism, per the Emission list above. Email/push remain out of scope, unchanged from what those specs already said.
