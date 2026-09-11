# Portal Self-Service Password Reset — Design

**Date:** 2026-09-12
**Status:** Approved for planning

## Context

The CERTA& Advisory portal (`portal/`, Next.js + Supabase Auth) has no self-service
password recovery. Every account logs in with an Employee ID that maps to a
**synthetic** auth email (`emp-<id>@internal.certaadvisory.com`, see
`lib/employeeAuth.ts`) — not a real inbox. The only existing reset path is an
in-app admin action (`resetPasswordAction` in
`app/admin/employees/[id]/actions.ts`) that itself requires being logged in as
`admin`/`superadmin` — circular if the only such account locks out, which is
what happened to trigger this work (the superadmin password was forgotten and
had to be recovered manually via the Supabase dashboard/service-role key).

None of the 12 existing accounts has a verified personal email on file today.
Several employees have informally typed their real email address into the
*Employee ID* field itself (e.g. `rakin@certaadvisory.com`), which just gets
mangled into the synthetic login email rather than stored anywhere usable —
confirmed by inspecting the live `employees` table. No email-sending provider
exists in the codebase (`lib/notifications.ts` is in-app DB notifications
only).

Goal: let any employee reset their own password via a real email they
control, without a human in the loop — while keeping the added scope
proportionate to a 12-account internal tool.

## Scope

`portal/` only. New: one migration, one npm-installed dependency (`resend`),
three new routes/pages, one new field on the existing employee create/edit
forms, two new env vars. No changes to the marketing site or other E:\ drive
projects.

## Design

### Data model

New migration (next number after `0020_tighten_rls_policies.sql`, so
`0021_...`), adding two nullable columns to `employees`:

- `personal_email text` — the real address recovery links get sent to.
  Nullable: an employee with none set simply can't self-serve yet (falls back
  to the existing admin-reset path).
- `last_recovery_requested_at timestamptz` — throttle marker, see Error
  handling.

No format validation at the DB level (a `check` constraint on email shape is
easy to get wrong and this is a low-stakes internal field); the admin-facing
input uses `type="email"` for basic browser-level validation.

### Admin UI

One new field, "Personal email (for password recovery)", added next to the
existing "Contact info" field on both:
- `app/admin/employees/[id]/EditEmployeeClient.tsx` + its `actions.ts` (edit)
- `app/admin/employees/new/NewEmployeeClient.tsx` + its `actions.ts` (create)

No new page. `scripts/export-roster.ts` gets `personal_email` added to its
output columns so `npm run roster:export` doubles as a quick way to see who
still needs one backfilled.

### Email delivery — Resend

New dependency: `resend` (npm). New env vars:
- `RESEND_API_KEY`
- `EMAIL_FROM` (e.g. `CERTA& Portal <no-reply@certaadvisory.com>`)

**Manual prerequisite (user, not code):** verify the `certaadvisory.com`
sending domain in the Resend dashboard (adds a couple of DNS records) and
issue an API key. Implementation can't proceed past this step until it's
done, since local/e2e testing needs a working key.

### Flow, end to end

```
Login page ("Forgot password?" link)
  → /forgot-password  (employee types Employee ID, submits)
  → forgotPasswordAction (server action):
      - look up employees row by employee_id
      - ALWAYS returns the same generic message, regardless of outcome:
        "If that Employee ID has a recovery email on file, we've sent a reset link."
      - if found, has personal_email, and not inside the 2-minute throttle:
          - admin.auth.admin.generateLink({ type: 'recovery', email: <synthetic auth email> })
          - build our own link from the response's token_hash:
              https://portal.certaadvisory.com/auth/confirm?token_hash=...&type=recovery&next=/reset-password
          - send it via Resend to personal_email
          - stamp last_recovery_requested_at = now()
      - otherwise: do nothing further (still same generic response)
  → employee opens the email, clicks the link
  → /auth/confirm (new route handler, GET):
      - reads token_hash + type from the query string
      - supabase.auth.verifyOtp({ type, token_hash }) via the server client
      - success → sets a short-lived session cookie, redirect to /reset-password
      - failure (expired/used token) → redirect to /forgot-password?error=expired
  → /reset-password (new page, requires the session from the previous step):
      - simple "set new password" form
      - resetPasswordSelfAction (server action) → supabase.auth.updateUser({ password })
      - success → redirect to /login with a confirmation notice
```

`middleware.ts` needs no changes: its matcher only covers
`/dashboard`, `/admin`, `/manager`, `/projects`, `/onboarding`, and
`/api/employees`, so `/forgot-password`, `/auth/confirm`, and
`/reset-password` are public by default, same as `/login` today.

### Security notes

- **No account enumeration:** the forgot-password response is identical
  whether the Employee ID exists, has no `personal_email`, or is throttled —
  matching the existing generic-error convention already used for login
  (`Invalid Employee ID or password`) and authorization (`NOT_AUTHORIZED`).
- **Throttle, not full rate limiting:** `last_recovery_requested_at` blocks a
  second *successful send* to the same account within 2 minutes. This is
  deliberately simple (one column, one `where` check) rather than a general
  IP-based rate limiter — proportionate to a 12-account internal tool, not a
  public-facing product. Revisit if abuse is ever observed.
- **`generateLink` bypasses Supabase's own auth rate limits** (those apply to
  `resetPasswordForEmail`, not the admin API), which is exactly why the
  throttle column above exists — without it there'd be no limit at all.
- Recovery tokens are single-use and short-lived by Supabase default
  (`verifyOtp` invalidates them on use); no additional expiry logic needed.

## Error handling

| Case | Behavior |
|---|---|
| Employee ID doesn't exist | Generic success message, nothing sent |
| Employee exists, no `personal_email` set | Generic success message, nothing sent |
| Throttled (< 2 min since last send) | Generic success message, nothing sent |
| Resend API call fails | Generic success message shown to user regardless (don't leak delivery failures); error logged server-side for follow-up |
| Recovery link expired/already used | `/auth/confirm` redirects to `/forgot-password` with a visible "That link expired — request a new one" notice (this one *is* shown, since by this point the person has already proven Employee ID + email-inbox access) |
| `/reset-password` visited without a valid recovery session | Redirect to `/login` |

## Testing

- Unit tests (vitest) for the lookup/throttle logic in the forgot-password
  server action — found/not-found/throttled all produce the same response
  shape; only found-and-eligible triggers the Resend call (mocked).
- Playwright e2e spec (`e2e/forgot-password.spec.ts`), mirroring the existing
  `login.spec.ts` pattern: request a reset for the seeded e2e admin, stub/
  intercept the Resend call to capture the generated link instead of sending
  a real email, follow it, set a new password, then log in with it to
  confirm the full loop.
- Manual: confirm the generic message truly never varies by trying a real
  Employee ID with no `personal_email` vs. a nonexistent one side by side.
