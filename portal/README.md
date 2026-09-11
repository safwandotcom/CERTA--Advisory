# CERTA& Portal

Employee portal for CERTA& Advisory. Staff sign in with an Employee ID and
password to view their own profile and documents; admins can create and edit
employee records, upload documents, and reset passwords.

Built with Next.js (App Router) and Supabase (Postgres + Auth + Storage).
Authorization is enforced by Postgres Row-Level Security, with `requireAdmin()`
checks in admin Server Actions and route handlers, plus a route guard in
`middleware.ts`.

## Running locally

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000.

## Environment

Copy `.env.example` to `.env.local` and fill in the values:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the browser/server client.
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key. Bypasses RLS; server-side only, never expose it to the client.

`SEED_ADMIN_*` are only needed locally for the seed script and the e2e suite —
they are not required in Vercel.

## Bootstrapping the first admin

There is no public sign-up. Create the first admin account with:

```bash
npm run seed:admin
```

It reads `SEED_ADMIN_EMPLOYEE_ID`, `SEED_ADMIN_PASSWORD`, and optionally
`SEED_ADMIN_NAME` (defaults to "Admin") from `.env.local`. Every other account
is created from the admin UI.

## Self-service password reset

Employees can reset their own password from `/forgot-password` without
admin help, provided a recovery email is on file for their account (see
`docs/superpowers/specs/2026-09-12-portal-forgot-password-design.md`).

This requires a one-time Resend setup, done outside this repo:

1. In the [Resend dashboard](https://resend.com/domains), add and verify
   the `certaadvisory.com` sending domain (a few DNS records).
2. Create an API key and set `RESEND_API_KEY` in Vercel's project env vars.
3. Set `EMAIL_FROM` (e.g. `CERTA& Portal <no-reply@certaadvisory.com>`).

Without this, `/forgot-password` still responds normally (the generic
message never reveals delivery failures) but no email actually goes out —
check server logs for `sendRecoveryEmail failed` if reports come in that
reset emails aren't arriving.

## Tests

```bash
npm test          # unit tests (vitest)
npm run test:e2e  # end-to-end tests (playwright)
npm run lint
```

The e2e suite needs a live Supabase project and a seeded admin;
`e2e/route-protection.spec.ts` is the exception and runs without either.
