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

## Tests

```bash
npm test          # unit tests (vitest)
npm run test:e2e  # end-to-end tests (playwright)
npm run lint
```

The e2e suite needs a live Supabase project and a seeded admin;
`e2e/route-protection.spec.ts` is the exception and runs without either.
