# Employee Management System — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of the employee management system — Employee ID/password login, admin & employee roles, a central staff directory, and per-employee document storage — as a Next.js + Supabase app living in this repo's `portal/` subfolder.

**Architecture:** Next.js (App Router) in `portal/`, deployed as its own Vercel project rooted at `portal/`. Supabase provides Postgres (staff directory + document metadata), Auth (session/JWT handling, with an Employee ID → internal synthetic email mapping so no email is ever shown to users), and Storage (document files). Row-Level Security in Postgres is the authorization backstop — an employee's Postgres session can only ever read their own rows, enforced by the database itself, not just app code.

**Tech Stack:** Next.js 15 (App Router, TypeScript), React 19, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Vitest (unit tests), Playwright (e2e tests), deployed on Vercel.

## Global Constraints

- Login shows **only** Employee ID + Password fields — no email is ever exposed in any UI.
- No self-service password reset or email-based reset flow; **only admin** can reset a password (via Supabase's admin API, server-side only, using the service-role key).
- Exactly two roles: `admin`, `employee`.
- Row-Level Security enforced at the database level for all employee data — an `employee` can only read their own row(s); only `admin` can read/write all rows.
- No employee self-editing of their own profile — records are admin-entered/managed only.
- Failed login shows a generic `"Invalid Employee ID or password"` message; no account lockout at this scale (~15 employees).
- The portal lives in the `portal/` subfolder of this repo and deploys as its **own, separate** Vercel project — it must not affect the existing static site's build or deploy.

Spec reference: `docs/superpowers/specs/2026-07-30-employee-management-phase1-foundation-design.md`

---

### Task 1: Scaffold the Next.js app

**Files:**
- Create: `portal/` (entire Next.js project, via `create-next-app`)

**Interfaces:**
- Produces: a working Next.js dev server at `portal/`, App Router (`portal/app/`), TypeScript, Tailwind CSS.

- [ ] **Step 1: Scaffold the project**

```bash
cd "E:/CERTA ADVISORY"
npx create-next-app@latest portal --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Verify the dev server runs**

```bash
cd portal
npm run dev &
sleep 3
curl -s http://localhost:3000 | grep -qi "next" && echo "OK: dev server responded"
kill %1
```

Expected: `OK: dev server responded` printed.

- [ ] **Step 3: Commit**

```bash
cd "E:/CERTA ADVISORY"
git add portal/
git commit -m "Scaffold portal/ Next.js app for employee management system"
```

---

### Task 2: Testing infrastructure

**Files:**
- Modify: `portal/package.json` (add scripts + dev dependencies)
- Create: `portal/vitest.config.ts`
- Create: `portal/playwright.config.ts`

**Interfaces:**
- Consumes: the `portal/` project from Task 1.
- Produces: `npm test` (Vitest, unit tests) and `npm run test:e2e` (Playwright, e2e tests) commands, usable by every later task.

- [ ] **Step 1: Install test dependencies**

```bash
cd portal
npm install -D vitest @vitejs/plugin-react jsdom @playwright/test tsx
npx playwright install chromium
```

- [ ] **Step 2: Write Vitest config**

`portal/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 3: Write Playwright config**

`portal/playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
})
```

- [ ] **Step 4: Add npm scripts**

In `portal/package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:e2e": "playwright test"
```

- [ ] **Step 5: Commit**

```bash
git add portal/package.json portal/package-lock.json portal/vitest.config.ts portal/playwright.config.ts
git commit -m "Add Vitest and Playwright test infrastructure to portal/"
```

---

### Task 3: Supabase project and client libraries

**Files:**
- Create: `portal/.env.local` (gitignored — not committed)
- Create: `portal/.env.example`
- Create: `portal/lib/supabase/client.ts`
- Create: `portal/lib/supabase/server.ts`
- Create: `portal/lib/supabase/admin.ts`
- Modify: `portal/.gitignore` (confirm `.env*.local` is ignored — `create-next-app` includes this by default)

**Interfaces:**
- Produces:
  - `createClient(): SupabaseClient` from `@/lib/supabase/client` (browser)
  - `createClient(): Promise<SupabaseClient>` from `@/lib/supabase/server` (server component/action, async)
  - `createAdminClient(): SupabaseClient` from `@/lib/supabase/admin` (service-role, server-only — never import from a Client Component)

- [ ] **Step 1 (manual, you): create the Supabase project**

Go to https://supabase.com/dashboard, create a new project (e.g. `certa-portal`). Once it's provisioned, from Project Settings → API, collect:
- Project URL
- `anon` public key
- `service_role` key (secret — never expose client-side)

- [ ] **Step 2: Install the Supabase packages**

```bash
cd portal
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: Write env files**

`portal/.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`portal/.env.local` (fill in with the real values from Step 1 — this file is gitignored):
```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

- [ ] **Step 4: Write the browser client**

`portal/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 5: Write the server client**

`portal/lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component render; middleware refreshes the session instead.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 6: Write the admin client**

`portal/lib/supabase/admin.ts`:
```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client. Bypasses Row-Level Security — only ever import this
// from server-only code (server actions, route handlers, scripts).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 7: Verify env vars load**

```bash
cd portal
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.NEXT_PUBLIC_SUPABASE_URL ? 'OK: env loaded' : 'MISSING')"
```

Expected: `OK: env loaded` (install `dotenv` as a dev dependency first if missing: `npm install -D dotenv`).

- [ ] **Step 8: Commit**

```bash
git add portal/lib/supabase portal/.env.example
git commit -m "Add Supabase client, server, and admin client factories"
```

(`.env.local` is not committed — it's gitignored by the `create-next-app` default.)

---

### Task 4: Database schema and Row-Level Security

**Files:**
- Create: `portal/supabase/migrations/0001_init.sql`

**Interfaces:**
- Consumes: the Supabase project from Task 3.
- Produces: `employees` and `employee_documents` tables, and an `employee-documents` storage bucket, all with RLS policies that every later task's queries rely on.

- [ ] **Step 1: Write the migration SQL**

`portal/supabase/migrations/0001_init.sql`:
```sql
create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_id text unique not null,
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  name text not null,
  contact_info text,
  role text not null check (role in ('admin', 'employee')),
  position text,
  department text,
  join_date date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  file_path text not null,
  label text not null,
  uploaded_at timestamptz not null default now()
);

alter table employees enable row level security;
alter table employee_documents enable row level security;

-- Employees can read their own row; admins can read every row.
create policy "employees_select_self_or_admin" on employees
  for select using (
    auth_user_id = auth.uid()
    or exists (select 1 from employees e where e.auth_user_id = auth.uid() and e.role = 'admin')
  );

-- Only admins can insert/update/delete employee rows (no self-editing).
create policy "employees_admin_write" on employees
  for all using (
    exists (select 1 from employees e where e.auth_user_id = auth.uid() and e.role = 'admin')
  ) with check (
    exists (select 1 from employees e where e.auth_user_id = auth.uid() and e.role = 'admin')
  );

-- Employees can read documents that belong to them; admins can read all.
create policy "documents_select_self_or_admin" on employee_documents
  for select using (
    exists (
      select 1 from employees e
      where e.id = employee_documents.employee_id and e.auth_user_id = auth.uid()
    )
    or exists (select 1 from employees e where e.auth_user_id = auth.uid() and e.role = 'admin')
  );

-- Only admins can upload/edit/delete document metadata.
create policy "documents_admin_write" on employee_documents
  for all using (
    exists (select 1 from employees e where e.auth_user_id = auth.uid() and e.role = 'admin')
  ) with check (
    exists (select 1 from employees e where e.auth_user_id = auth.uid() and e.role = 'admin')
  );

-- Storage bucket for document files, private by default.
insert into storage.buckets (id, name, public) values ('employee-documents', 'employee-documents', false);

create policy "documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'employee-documents'
    and (
      exists (
        select 1 from employees e
        where e.auth_user_id = auth.uid()
        and (storage.foldername(name))[1] = e.id::text
      )
      or exists (select 1 from employees e where e.auth_user_id = auth.uid() and e.role = 'admin')
    )
  );

create policy "documents_storage_admin_write" on storage.objects
  for all using (
    bucket_id = 'employee-documents'
    and exists (select 1 from employees e where e.auth_user_id = auth.uid() and e.role = 'admin')
  ) with check (
    bucket_id = 'employee-documents'
    and exists (select 1 from employees e where e.auth_user_id = auth.uid() and e.role = 'admin')
  );
```

- [ ] **Step 2 (manual, you): run the migration**

In the Supabase dashboard → SQL Editor, paste the contents of `0001_init.sql` and run it.

Expected: no errors; the Table Editor now shows `employees` and `employee_documents`, and Storage shows an `employee-documents` bucket.

- [ ] **Step 3: Verify RLS is enabled**

In the SQL Editor, run:
```sql
select relname, relrowsecurity from pg_class where relname in ('employees', 'employee_documents');
```
Expected: both rows show `relrowsecurity = true`.

- [ ] **Step 4: Commit**

```bash
git add portal/supabase/migrations/0001_init.sql
git commit -m "Add employees/employee_documents schema and RLS policies"
```

---

### Task 5: Employee ID to internal email mapping

**Files:**
- Create: `portal/lib/employeeAuth.ts`
- Test: `portal/lib/employeeAuth.test.ts`

**Interfaces:**
- Produces: `employeeIdToEmail(employeeId: string): string`, used by the login action (Task 7) and the employee-creation logic (Task 6) to bridge Employee-ID-based login onto Supabase Auth's email/password model.

- [ ] **Step 1: Write the failing test**

`portal/lib/employeeAuth.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { employeeIdToEmail } from './employeeAuth'

describe('employeeIdToEmail', () => {
  it('maps a simple numeric ID to a stable internal email', () => {
    expect(employeeIdToEmail('1023')).toBe('emp-1023@internal.certaadvisory.com')
  })

  it('lowercases and strips non-alphanumeric characters', () => {
    expect(employeeIdToEmail(' EMP-007 ')).toBe('emp-emp007@internal.certaadvisory.com')
  })

  it('throws on an ID with no alphanumeric characters', () => {
    expect(() => employeeIdToEmail('   ---   ')).toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd portal
npx vitest run lib/employeeAuth.test.ts
```

Expected: FAIL — `employeeAuth.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

`portal/lib/employeeAuth.ts`:
```ts
export function employeeIdToEmail(employeeId: string): string {
  const sanitized = employeeId.trim().toLowerCase().replace(/[^a-z0-9]/g, '')

  if (!sanitized) {
    throw new Error('Employee ID must contain at least one letter or digit')
  }

  return `emp-${sanitized}@internal.certaadvisory.com`
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run lib/employeeAuth.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add portal/lib/employeeAuth.ts portal/lib/employeeAuth.test.ts
git commit -m "Add Employee ID to internal email mapping"
```

---

### Task 6: Employee creation logic and admin bootstrap script

**Files:**
- Create: `portal/lib/employees.ts`
- Create: `portal/scripts/seed-admin.ts`

**Interfaces:**
- Consumes: `createAdminClient()` from `@/lib/supabase/admin` (Task 3), `employeeIdToEmail()` from `@/lib/employeeAuth` (Task 5).
- Produces: `createEmployeeRecord(adminClient: SupabaseClient, input: NewEmployeeInput): Promise<{ employeeRowId: string }>` — the single place that creates an auth user + `employees` row together. Used by this task's seed script AND by the admin "create employee" UI (Task 11), so the two never duplicate this logic.
  - `NewEmployeeInput = { employeeId: string; password: string; name: string; role: 'admin' | 'employee'; contactInfo?: string; position?: string; department?: string; joinDate?: string }`

- [ ] **Step 1: Write the employee creation function**

`portal/lib/employees.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { employeeIdToEmail } from './employeeAuth'

export type NewEmployeeInput = {
  employeeId: string
  password: string
  name: string
  role: 'admin' | 'employee'
  contactInfo?: string
  position?: string
  department?: string
  joinDate?: string
}

export async function createEmployeeRecord(
  adminClient: SupabaseClient,
  input: NewEmployeeInput
): Promise<{ employeeRowId: string }> {
  const email = employeeIdToEmail(input.employeeId)

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    throw new Error(`Failed to create auth user: ${authError?.message}`)
  }

  const { data: employeeRow, error: dbError } = await adminClient
    .from('employees')
    .insert({
      employee_id: input.employeeId,
      auth_user_id: authUser.user.id,
      name: input.name,
      role: input.role,
      contact_info: input.contactInfo ?? null,
      position: input.position ?? null,
      department: input.department ?? null,
      join_date: input.joinDate ?? null,
      status: 'active',
    })
    .select('id')
    .single()

  if (dbError || !employeeRow) {
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    throw new Error(`Failed to create employee record: ${dbError?.message}`)
  }

  return { employeeRowId: employeeRow.id }
}
```

- [ ] **Step 2: Write the bootstrap seed script**

`portal/scripts/seed-admin.ts`:
```ts
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'

async function main() {
  const employeeId = process.env.SEED_ADMIN_EMPLOYEE_ID
  const password = process.env.SEED_ADMIN_PASSWORD
  const name = process.env.SEED_ADMIN_NAME ?? 'Admin'

  if (!employeeId || !password) {
    throw new Error(
      'Set SEED_ADMIN_EMPLOYEE_ID and SEED_ADMIN_PASSWORD env vars before running this script'
    )
  }

  const adminClient = createAdminClient()
  const { employeeRowId } = await createEmployeeRecord(adminClient, {
    employeeId,
    password,
    name,
    role: 'admin',
  })

  console.log(`Created admin employee row ${employeeRowId} for Employee ID ${employeeId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

Add to `portal/package.json` `"scripts"`:
```json
"seed:admin": "tsx --env-file=.env.local scripts/seed-admin.ts"
```

- [ ] **Step 3 (manual, you): run the seed script to create the first admin**

```bash
cd portal
SEED_ADMIN_EMPLOYEE_ID=1001 SEED_ADMIN_PASSWORD="<choose-a-password>" SEED_ADMIN_NAME="Your Name" npm run seed:admin
```

Expected: prints `Created admin employee row <uuid> for Employee ID 1001`.

- [ ] **Step 4: Verify in Supabase dashboard**

In the Table Editor, confirm one row exists in `employees` with `employee_id = 1001` and `role = admin`, and in Authentication → Users, confirm one user exists with email `emp-1001@internal.certaadvisory.com`.

- [ ] **Step 5: Commit**

```bash
git add portal/lib/employees.ts portal/scripts/seed-admin.ts portal/package.json
git commit -m "Add employee creation logic and admin bootstrap script"
```

---

### Task 7: Login page and server action

**Files:**
- Create: `portal/app/login/page.tsx`
- Create: `portal/app/login/actions.ts`
- Test: `portal/e2e/login.spec.ts`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server` (Task 3), `employeeIdToEmail()` (Task 5), the seeded admin from Task 6.
- Produces: `/login` route; `loginAction(prevState: LoginState, formData: FormData): Promise<LoginState>` where `LoginState = { error?: string }`.

- [ ] **Step 1: Write the failing e2e test**

`portal/e2e/login.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('rejects an invalid Employee ID / password', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill('9999999')
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid Employee ID or password')
})

test('logs in a seeded admin and redirects to /admin', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/admin/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd portal
npx playwright test e2e/login.spec.ts
```

Expected: FAIL — `/login` route does not exist (404).

- [ ] **Step 3: Write the server action**

`portal/app/login/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { employeeIdToEmail } from '@/lib/employeeAuth'

export type LoginState = { error?: string }

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const employeeId = String(formData.get('employeeId') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!employeeId || !password) {
    return { error: 'Invalid Employee ID or password' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: employeeIdToEmail(employeeId),
    password,
  })

  if (error || !data.user) {
    return { error: 'Invalid Employee ID or password' }
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('role')
    .eq('auth_user_id', data.user.id)
    .single()

  redirect(employee?.role === 'admin' ? '/admin' : '/dashboard')
}
```

- [ ] **Step 4: Write the login page**

`portal/app/login/page.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { loginAction, type LoginState } from './actions'

const initialState: LoginState = {}

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState)

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">CERTA&amp; Portal</h1>
      <form action={formAction} className="flex flex-col gap-3">
        <label htmlFor="employeeId">Employee ID</label>
        <input id="employeeId" name="employeeId" type="text" required autoFocus className="border p-2" />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required className="border p-2" />

        {state.error && (
          <p role="alert" className="text-red-600">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className="border p-2">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
SEED_ADMIN_EMPLOYEE_ID=1001 SEED_ADMIN_PASSWORD="<the password you seeded>" npx playwright test e2e/login.spec.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add portal/app/login portal/e2e/login.spec.ts
git commit -m "Add Employee ID + password login"
```

---

### Task 8: Route protection middleware

**Files:**
- Create: `portal/middleware.ts`

**Interfaces:**
- Consumes: the `employees` table + RLS from Task 4, the auth session from Task 7.
- Produces: unauthenticated visitors to `/dashboard/*` or `/admin/*` are redirected to `/login`; authenticated non-admins visiting `/admin/*` are redirected to `/dashboard`.

- [ ] **Step 1: Write the middleware**

`portal/middleware.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (!user && (path.startsWith('/dashboard') || path.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && path.startsWith('/admin')) {
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (employee?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}
```

- [ ] **Step 2: Write the e2e test**

`portal/e2e/route-protection.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('redirects an unauthenticated visitor from /dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('redirects an unauthenticated visitor from /admin to /login', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})
```

- [ ] **Step 3: Run the test**

```bash
cd portal
npx playwright test e2e/route-protection.spec.ts
```

Expected: PASS, 2 tests. (`/dashboard` and `/admin` pages don't exist yet as full pages — Tasks 9–10 add them — but the middleware matcher fires before the route is resolved, so the redirect still happens even against a 404 target.)

- [ ] **Step 4: Commit**

```bash
git add portal/middleware.ts portal/e2e/route-protection.spec.ts
git commit -m "Add role-based route protection middleware"
```

---

### Task 9: Employee dashboard (own profile + documents)

**Files:**
- Create: `portal/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server` (Task 3); relies on the `employees_select_self_or_admin` and `documents_select_self_or_admin` RLS policies (Task 4) to scope results to the logged-in user automatically — no manual `employee_id` filter needed in the query.
- Produces: `/dashboard` route showing the logged-in employee's own profile and documents.

- [ ] **Step 1: Write the failing e2e test**

`portal/e2e/dashboard.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('a logged-in employee sees their own profile on /dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /sign in/i }).click()
  // The seeded account is an admin, so it lands on /admin — navigate to /dashboard directly.
  await page.goto('/dashboard')
  await expect(page.getByText(process.env.SEED_ADMIN_NAME ?? 'Admin')).toBeVisible()
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd portal
npx playwright test e2e/dashboard.spec.ts
```

Expected: FAIL — `/dashboard` page doesn't render profile content yet.

- [ ] **Step 3: Write the dashboard page**

`portal/app/dashboard/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('auth_user_id', user!.id)
    .single()

  const { data: documents } = await supabase
    .from('employee_documents')
    .select('*')
    .eq('employee_id', employee!.id)

  const { data: signedUrls } = documents?.length
    ? await supabase.storage
        .from('employee-documents')
        .createSignedUrls(documents.map((d) => d.file_path), 60 * 10)
    : { data: [] as { path: string; signedUrl: string }[] }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">{employee?.name}</h1>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <dt>Employee ID</dt>
        <dd>{employee?.employee_id}</dd>
        <dt>Position</dt>
        <dd>{employee?.position ?? '—'}</dd>
        <dt>Department</dt>
        <dd>{employee?.department ?? '—'}</dd>
        <dt>Status</dt>
        <dd>{employee?.status}</dd>
      </dl>

      <h2 className="mt-6 font-semibold">Your documents</h2>
      <ul className="mt-2">
        {documents?.map((doc, i) => (
          <li key={doc.id}>
            <a href={signedUrls?.[i]?.signedUrl} target="_blank" rel="noreferrer">
              {doc.label}
            </a>
          </li>
        ))}
        {documents?.length === 0 && <li>No documents yet.</li>}
      </ul>
    </main>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
SEED_ADMIN_EMPLOYEE_ID=1001 SEED_ADMIN_PASSWORD="<the password you seeded>" SEED_ADMIN_NAME="Your Name" npx playwright test e2e/dashboard.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portal/app/dashboard portal/e2e/dashboard.spec.ts
git commit -m "Add employee dashboard showing own profile and documents"
```

---

### Task 10: Admin dashboard (employee list)

**Files:**
- Create: `portal/app/admin/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (Task 3); relies on the `employees_select_self_or_admin` RLS policy (Task 4), which permits an admin to read every row.
- Produces: `/admin` route listing all employees, with links to each employee's detail page (`/admin/employees/[id]`, built in Task 12).

- [ ] **Step 1: Write the failing e2e test**

`portal/e2e/admin-dashboard.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('admin sees the full employee list on /admin', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByText(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')).toBeVisible()
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd portal
npx playwright test e2e/admin-dashboard.spec.ts
```

Expected: FAIL — `/admin` doesn't list employees yet.

- [ ] **Step 3: Write the admin dashboard page**

`portal/app/admin/page.tsx`:
```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .order('employee_id')

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Employees</h1>
        <Link href="/admin/employees/new" className="border px-3 py-1">
          + New employee
        </Link>
      </div>
      <table className="mt-4 w-full text-left">
        <thead>
          <tr>
            <th>Employee ID</th>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {employees?.map((emp) => (
            <tr key={emp.id}>
              <td>
                <Link href={`/admin/employees/${emp.id}`}>{emp.employee_id}</Link>
              </td>
              <td>{emp.name}</td>
              <td>{emp.role}</td>
              <td>{emp.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
SEED_ADMIN_EMPLOYEE_ID=1001 SEED_ADMIN_PASSWORD="<the password you seeded>" npx playwright test e2e/admin-dashboard.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add portal/app/admin/page.tsx portal/e2e/admin-dashboard.spec.ts
git commit -m "Add admin dashboard listing all employees"
```

---

### Task 11: Admin — create employee

**Files:**
- Create: `portal/app/admin/employees/new/page.tsx`
- Create: `portal/app/admin/employees/new/actions.ts`

**Interfaces:**
- Consumes: `createAdminClient()` (Task 3), `createEmployeeRecord()` (Task 6).
- Produces: `/admin/employees/new` route; after successful creation, redirects to `/admin`.

- [ ] **Step 1: Write the failing e2e test**

`portal/e2e/admin-create-employee.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('admin creates a new employee', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.goto('/admin/employees/new')
  const newId = `test-${Date.now()}`
  await page.getByLabel('Employee ID').fill(newId)
  await page.getByLabel('Full name').fill('Test Employee')
  await page.getByLabel('Initial password').fill('temporary-password-123')
  await page.getByRole('button', { name: /create employee/i }).click()

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByText(newId)).toBeVisible()
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd portal
npx playwright test e2e/admin-create-employee.spec.ts
```

Expected: FAIL — `/admin/employees/new` doesn't exist yet.

- [ ] **Step 3: Write the server action**

`portal/app/admin/employees/new/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createEmployeeRecord } from '@/lib/employees'

export type CreateEmployeeState = { error?: string }

export async function createEmployeeAction(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  const employeeId = String(formData.get('employeeId') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const role = formData.get('role') === 'admin' ? 'admin' : 'employee'

  if (!employeeId || !name || !password) {
    return { error: 'Employee ID, full name, and initial password are all required' }
  }

  try {
    const adminClient = createAdminClient()
    await createEmployeeRecord(adminClient, { employeeId, name, password, role })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create employee' }
  }

  redirect('/admin')
}
```

- [ ] **Step 4: Write the page**

`portal/app/admin/employees/new/page.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { createEmployeeAction, type CreateEmployeeState } from './actions'

const initialState: CreateEmployeeState = {}

export default function NewEmployeePage() {
  const [state, formAction, pending] = useActionState(createEmployeeAction, initialState)

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">New employee</h1>
      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <label htmlFor="employeeId">Employee ID</label>
        <input id="employeeId" name="employeeId" required className="border p-2" />

        <label htmlFor="name">Full name</label>
        <input id="name" name="name" required className="border p-2" />

        <label htmlFor="password">Initial password</label>
        <input id="password" name="password" type="password" required className="border p-2" />

        <label htmlFor="role">Role</label>
        <select id="role" name="role" className="border p-2">
          <option value="employee">Employee</option>
          <option value="admin">Admin</option>
        </select>

        {state.error && (
          <p role="alert" className="text-red-600">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className="border p-2">
          {pending ? 'Creating…' : 'Create employee'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
SEED_ADMIN_EMPLOYEE_ID=1001 SEED_ADMIN_PASSWORD="<the password you seeded>" npx playwright test e2e/admin-create-employee.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add portal/app/admin/employees/new portal/e2e/admin-create-employee.spec.ts
git commit -m "Add admin create-employee flow"
```

---

### Task 12: Admin — edit employee, upload documents, reset password

**Files:**
- Create: `portal/app/admin/employees/[id]/page.tsx`
- Create: `portal/app/admin/employees/[id]/actions.ts`

**Interfaces:**
- Consumes: `createClient()` (Task 3, for reads), `createAdminClient()` (Task 3, for the password reset and storage upload), the `employees`/`employee_documents` schema (Task 4).
- Produces: `/admin/employees/[id]` route with three server actions: `updateEmployeeAction`, `uploadDocumentAction`, `resetPasswordAction`.

- [ ] **Step 1: Write the failing e2e test**

`portal/e2e/admin-edit-employee.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('admin edits an employee and resets their password', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001')
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD ?? '')
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.goto('/admin')
  await page.getByText(process.env.SEED_ADMIN_EMPLOYEE_ID ?? '1001').click()

  await page.getByLabel('Position').fill('Senior Accountant')
  await page.getByRole('button', { name: /save/i }).click()
  await expect(page.getByLabel('Position')).toHaveValue('Senior Accountant')

  await page.getByLabel('New password').fill('brand-new-password-456')
  await page.getByRole('button', { name: /reset password/i }).click()
  await expect(page.getByText(/password reset/i)).toBeVisible()
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd portal
npx playwright test e2e/admin-edit-employee.spec.ts
```

Expected: FAIL — `/admin/employees/[id]` doesn't exist yet.

- [ ] **Step 3: Write the server actions**

`portal/app/admin/employees/[id]/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ActionState = { error?: string; success?: string }

export async function updateEmployeeAction(
  employeeRowId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('employees')
    .update({
      name: String(formData.get('name') ?? ''),
      position: String(formData.get('position') ?? '') || null,
      department: String(formData.get('department') ?? '') || null,
      status: formData.get('status') === 'inactive' ? 'inactive' : 'active',
    })
    .eq('id', employeeRowId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/employees/${employeeRowId}`)
  return { success: 'Saved' }
}

export async function uploadDocumentAction(
  employeeRowId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const file = formData.get('file') as File
  const label = String(formData.get('label') ?? '')

  if (!file || !label) {
    return { error: 'A file and a label are both required' }
  }

  const adminClient = createAdminClient()
  const filePath = `${employeeRowId}/${Date.now()}-${file.name}`

  const { error: uploadError } = await adminClient.storage
    .from('employee-documents')
    .upload(filePath, file)

  if (uploadError) return { error: uploadError.message }

  const { error: dbError } = await adminClient.from('employee_documents').insert({
    employee_id: employeeRowId,
    file_path: filePath,
    label,
  })

  if (dbError) return { error: dbError.message }

  revalidatePath(`/admin/employees/${employeeRowId}`)
  return { success: 'Uploaded' }
}

export async function resetPasswordAction(
  authUserId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const newPassword = String(formData.get('newPassword') ?? '')

  if (!newPassword) {
    return { error: 'A new password is required' }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.updateUserById(authUserId, {
    password: newPassword,
  })

  if (error) return { error: error.message }

  return { success: 'Password reset' }
}
```

- [ ] **Step 4: Write the page**

`portal/app/admin/employees/[id]/page.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { useEffect, useState } from 'react'
import {
  updateEmployeeAction,
  uploadDocumentAction,
  resetPasswordAction,
  type ActionState,
} from './actions'

type Employee = {
  id: string
  auth_user_id: string
  employee_id: string
  name: string
  position: string | null
  department: string | null
  status: 'active' | 'inactive'
}

type Document = { id: string; label: string; file_path: string }

const initialState: ActionState = {}

export default function EditEmployeePage({ params }: { params: { id: string } }) {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])

  useEffect(() => {
    fetch(`/api/employees/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setEmployee(data.employee)
        setDocuments(data.documents)
      })
  }, [params.id])

  const [updateState, updateAction] = useActionState(
    updateEmployeeAction.bind(null, params.id),
    initialState
  )
  const [uploadState, uploadAction] = useActionState(
    uploadDocumentAction.bind(null, params.id),
    initialState
  )
  const [resetState, resetAction] = useActionState(
    resetPasswordAction.bind(null, employee?.auth_user_id ?? ''),
    initialState
  )

  if (!employee) return <main className="p-6">Loading…</main>

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">{employee.employee_id}</h1>

      <form action={updateAction} className="mt-4 flex flex-col gap-3">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={employee.name} className="border p-2" />

        <label htmlFor="position">Position</label>
        <input id="position" name="position" defaultValue={employee.position ?? ''} className="border p-2" />

        <label htmlFor="department">Department</label>
        <input
          id="department"
          name="department"
          defaultValue={employee.department ?? ''}
          className="border p-2"
        />

        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={employee.status} className="border p-2">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {updateState.error && <p role="alert">{updateState.error}</p>}
        {updateState.success && <p>{updateState.success}</p>}
        <button type="submit" className="border p-2">
          Save
        </button>
      </form>

      <h2 className="mt-6 font-semibold">Documents</h2>
      <ul>
        {documents.map((doc) => (
          <li key={doc.id}>{doc.label}</li>
        ))}
      </ul>
      <form action={uploadAction} className="mt-2 flex flex-col gap-3">
        <label htmlFor="label">Label</label>
        <input id="label" name="label" required className="border p-2" />
        <label htmlFor="file">File</label>
        <input id="file" name="file" type="file" required className="border p-2" />
        {uploadState.error && <p role="alert">{uploadState.error}</p>}
        {uploadState.success && <p>{uploadState.success}</p>}
        <button type="submit" className="border p-2">
          Upload
        </button>
      </form>

      <h2 className="mt-6 font-semibold">Reset password</h2>
      <form action={resetAction} className="mt-2 flex flex-col gap-3">
        <label htmlFor="newPassword">New password</label>
        <input id="newPassword" name="newPassword" type="password" required className="border p-2" />
        {resetState.error && <p role="alert">{resetState.error}</p>}
        {resetState.success && <p>{resetState.success}</p>}
        <button type="submit" className="border p-2">
          Reset password
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Write the read API route the page fetches from**

`portal/app/api/employees/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: employee } = await supabase.from('employees').select('*').eq('id', params.id).single()
  const { data: documents } = await supabase
    .from('employee_documents')
    .select('*')
    .eq('employee_id', params.id)

  return NextResponse.json({ employee, documents: documents ?? [] })
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd portal
SEED_ADMIN_EMPLOYEE_ID=1001 SEED_ADMIN_PASSWORD="<the password you seeded>" npx playwright test e2e/admin-edit-employee.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add portal/app/admin/employees/\[id\] portal/app/api/employees portal/e2e/admin-edit-employee.spec.ts
git commit -m "Add admin employee edit, document upload, and password reset"
```

---

### Task 13: RLS isolation test between two employees

**Files:**
- Test: `portal/e2e/rls-isolation.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 4–12. This task adds no new application code — it's the spec's required verification (spec Testing item 3) that a bug in the app can't leak data across employees, because it checks the database policy directly, not just the UI.

- [ ] **Step 1: Write the test**

`portal/e2e/rls-isolation.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'
import { employeeIdToEmail } from '../lib/employeeAuth'

test('an employee cannot read another employee row via the API', async () => {
  const adminClient = createAdminClient()

  const a = `rls-a-${Date.now()}`
  const b = `rls-b-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId: a,
    password: 'password-a-123',
    name: 'Employee A',
    role: 'employee',
  })
  await createEmployeeRecord(adminClient, {
    employeeId: b,
    password: 'password-b-123',
    name: 'Employee B',
    role: 'employee',
  })

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await anonClient.auth.signInWithPassword({
    email: employeeIdToEmail(a),
    password: 'password-a-123',
  })

  const { data, error } = await anonClient.from('employees').select('*').eq('employee_id', b)

  // RLS must return zero rows for another employee's data, not an error and not the row.
  expect(error).toBeNull()
  expect(data).toHaveLength(0)
})

test('an employee is redirected away from /admin in the UI', async ({ page }) => {
  const employeeId = `rls-ui-${Date.now()}`
  const adminClient = createAdminClient()
  await createEmployeeRecord(adminClient, {
    employeeId,
    password: 'password-ui-123',
    name: 'UI Employee',
    role: 'employee',
  })

  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(employeeId)
  await page.getByLabel('Password').fill('password-ui-123')
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/dashboard/)
})
```

- [ ] **Step 2: Run the test**

```bash
cd portal
npx playwright test e2e/rls-isolation.spec.ts
```

Expected: PASS, 2 tests. If the first test fails with `data` containing Employee B's row, the RLS policy from Task 4 is misconfigured — fix the policy, not the test.

- [ ] **Step 3: Commit**

```bash
git add portal/e2e/rls-isolation.spec.ts
git commit -m "Add RLS cross-employee isolation test"
```

---

### Task 14: Deploy to Vercel

**Files:**
- Create: `portal/vercel.json` (only if a custom build/output setting is needed — see Step 2)

**Interfaces:**
- Consumes: the complete `portal/` app from Tasks 1–13.
- Produces: a live deployment at `portal.certaadvisory.com`, as its own Vercel project separate from the existing static-site project.

- [ ] **Step 1 (manual, you): create a new Vercel project**

In the Vercel dashboard, "Add New Project," import the same GitHub repo (`safwandotcom/CERTA--Advisory`) again as a **second, separate project**. Set:
- Root Directory: `portal`
- Framework Preset: Next.js (should auto-detect)

- [ ] **Step 2 (manual, you): set environment variables**

In the new Vercel project's Settings → Environment Variables, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (same values as `portal/.env.local`) for the Production environment.

- [ ] **Step 3 (manual, you): deploy and verify**

Trigger a deploy (push to `main`, or "Deploy" in the dashboard). Once live, visit the assigned `*.vercel.app` URL and confirm `/login` renders.

- [ ] **Step 4 (manual, you): attach the subdomain**

In the new Vercel project's Settings → Domains, add `portal.certaadvisory.com` and follow Vercel's DNS instructions (add the CNAME/A record it shows at your DNS provider). Confirm the existing marketing site's domain/project is untouched.

- [ ] **Step 5: Verify the existing site still deploys independently**

Push any trivial change to `index.html` (or just check recent deploy history) and confirm it triggers a deploy on the **original** Vercel project only, not the `portal` one, and vice versa.

- [ ] **Step 6: Commit** (only if Step 1 required a `vercel.json`; otherwise skip — there's nothing new to commit)

```bash
git add portal/vercel.json
git commit -m "Configure portal/ for standalone Vercel deployment"
```

---

## Self-Review Notes

- **Spec coverage:** Admin/employee login (Tasks 7–8) ✓, two roles (Task 4, enforced Task 8) ✓, staff directory admin-entered (Tasks 6, 11, 12) ✓, per-employee document storage admin-managed (Task 4 bucket, Task 12 upload, Task 9 employee view) ✓, admin-only password reset with no email flow (Task 12 `resetPasswordAction`) ✓, RLS as the enforcement backstop (Task 4, verified Task 13) ✓, generic invalid-login message (Task 7) ✓, separate Vercel deploy (Task 14) ✓.
- **Bootstrap gap closed:** Task 6's seed script solves the chicken-and-egg problem of creating the first admin account before any admin UI exists, and is reused by every later test as a fixture-creation path.
- **Type consistency checked:** `createEmployeeRecord` (Task 6) is used with the same signature in the seed script (Task 6), the create-employee action (Task 11), and the RLS test (Task 13). `employeeIdToEmail` (Task 5) is used identically in the login action (Task 7), employee creation (Task 6), and the RLS test (Task 13).
