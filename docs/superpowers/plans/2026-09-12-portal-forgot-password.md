# Portal Self-Service Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any CERTA& Portal employee reset their own forgotten password via a real email they control, with no admin/human step required.

**Architecture:** A public `/forgot-password` page collects an Employee ID and, via a server action using the Supabase service-role client, resolves a recovery email (an admin-set `employees.personal_email` for admin/superadmin accounts, or the existing `employee_onboarding.personal_email` for everyone else), generates a Supabase recovery token, and emails a link to it via Resend. That link hits a new `/auth/confirm` route which verifies the token and establishes a session, then `/reset-password` lets the employee set a new password. The response to the initial request is always identical regardless of whether the Employee ID exists, to avoid account enumeration.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase Auth (`@supabase/supabase-js` admin client, `@supabase/ssr` for cookie-based sessions), Resend (new dependency) for email delivery, Vitest for pure-logic unit tests, Playwright for e2e — matching this repo's existing split (pure functions get unit tests; anything touching Supabase/routes gets e2e coverage only, per the existing `lib/onboarding.test.ts` / `e2e/*.spec.ts` pattern).

**Spec:** `docs/superpowers/specs/2026-09-12-portal-forgot-password-design.md`

## Global Constraints

- **No account enumeration:** `requestPasswordRecoveryAction`'s response must be the exact same generic message regardless of whether the Employee ID exists, has no recovery email on file, is throttled, or Resend/generateLink fails. Never let an error surface a different message to the client.
- **Throttle only, no broader rate limiting:** a 2-minute cooldown per account (`RECOVERY_THROTTLE_MS` in `lib/passwordRecovery.ts`) is the entire abuse mitigation for this feature — proportionate to a 12-account internal tool. Do not add IP-based limiting or CAPTCHAs.
- **No DB-level email format validation:** `employees.personal_email` has no `check` constraint — only client-side `type="email"`.
- **Site URL is hardcoded** as `https://portal.certaadvisory.com` (confirmed live via DNS) — no new env var for it.
- **Recovery email source priority:** `employees.personal_email` (if set) always wins over `employee_onboarding.personal_email` — see `resolveRecoveryEmail` in Task 2.
- **`internal/` stays git-ignored** — Task 9 adds a column to `scripts/export-roster.ts`'s output; never remove that directory from `.gitignore` or commit its output.
- **Manual prerequisite before end-to-end production testing:** the `certaadvisory.com` sending domain must be verified in the Resend dashboard and a `RESEND_API_KEY` issued — this blocks only the final manual QA step (Task 10), not any automated test in Tasks 1-9, which all use a mocked/fake key.

---

## File Structure

New files:
- `supabase/migrations/0021_password_recovery.sql` — schema change
- `lib/passwordRecovery.ts` + `lib/passwordRecovery.test.ts` — pure lookup/throttle logic
- `lib/email.ts` + `lib/email.test.ts` — Resend wrapper
- `app/forgot-password/page.tsx` — request form (client component, mirrors `app/login/page.tsx`)
- `app/forgot-password/actions.ts` — `requestPasswordRecoveryAction`
- `app/auth/confirm/route.ts` — GET handler that verifies the recovery token
- `app/reset-password/page.tsx` — server-guarded page
- `app/reset-password/ResetPasswordForm.tsx` — client form component
- `app/reset-password/actions.ts` — `updateOwnPasswordAction`
- `e2e/forgot-password.spec.ts` — full-loop + generic-message e2e coverage

Modified files:
- `app/admin/employees/[id]/EditEmployeeClient.tsx` + `actions.ts` — new "Personal email" field
- `app/admin/employees/new/NewEmployeeClient.tsx` + `actions.ts` — same, at creation
- `lib/employees.ts` — `createEmployeeRecord` accepts `personalEmail`
- `app/login/page.tsx` — "Forgot password?" link, and later a post-reset success notice
- `scripts/export-roster.ts` — adds a resolved `personal_email` column
- `.env.example`, `README.md` — new env vars + setup docs
- `package.json` — new `resend` dependency
- `e2e/admin-edit-employee.spec.ts` — covers the new admin-facing field

---

### Task 1: Migration — `personal_email` and throttle columns

**Files:**
- Create: `supabase/migrations/0021_password_recovery.sql`

**Interfaces:**
- Produces: `employees.personal_email` (`text`, nullable), `employees.last_recovery_requested_at` (`timestamptz`, nullable) — every later task that reads/writes these column names depends on this exact naming.

- [ ] **Step 1: Write the migration file**

```sql
-- Self-service password reset (docs/superpowers/specs/2026-09-12-portal-forgot-password-design.md).
-- personal_email: admin-set recovery address, primarily for admin/superadmin
-- accounts (they never have an employee_onboarding row to fall back to).
-- last_recovery_requested_at: throttle marker, see lib/passwordRecovery.ts.
alter table employees add column personal_email text;
alter table employees add column last_recovery_requested_at timestamptz;
```

- [ ] **Step 2: Apply the migration to the live database**

Open the Supabase SQL Editor for this project
(`https://supabase.com/dashboard/project/gipkcjirdscznlwhpmfg/sql/new`),
paste the file's contents, and run it.

- [ ] **Step 3: Verify the columns exist**

In the same SQL Editor, run:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'employees' and column_name in ('personal_email', 'last_recovery_requested_at');
```

Expected: two rows, both `is_nullable = 'YES'`, `personal_email` is `text`,
`last_recovery_requested_at` is `timestamp with time zone`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0021_password_recovery.sql
git commit -m "Add employees.personal_email and last_recovery_requested_at columns"
```

---

### Task 2: Pure recovery-email resolution and throttle logic

**Files:**
- Create: `lib/passwordRecovery.ts`
- Test: `lib/passwordRecovery.test.ts`

**Interfaces:**
- Produces: `RECOVERY_THROTTLE_MS: number`, `resolveRecoveryEmail(input: { employeePersonalEmail: string | null; onboardingPersonalEmail: string | null }): string | null`, `isRecoveryThrottled(lastRequestedAt: string | null, now?: Date): boolean` — Task 5's server action calls these three exactly.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/passwordRecovery.test.ts
import { describe, it, expect } from 'vitest'
import { resolveRecoveryEmail, isRecoveryThrottled, RECOVERY_THROTTLE_MS } from './passwordRecovery'

describe('resolveRecoveryEmail', () => {
  it('prefers the employee-set personal email over the onboarding one', () => {
    expect(
      resolveRecoveryEmail({
        employeePersonalEmail: 'admin@example.com',
        onboardingPersonalEmail: 'onboarding@example.com',
      })
    ).toBe('admin@example.com')
  })

  it('falls back to the onboarding email when the employee one is not set', () => {
    expect(
      resolveRecoveryEmail({ employeePersonalEmail: null, onboardingPersonalEmail: 'onboarding@example.com' })
    ).toBe('onboarding@example.com')
  })

  it('returns null when neither source has an email', () => {
    expect(resolveRecoveryEmail({ employeePersonalEmail: null, onboardingPersonalEmail: null })).toBeNull()
  })

  it('treats an empty string as not set', () => {
    expect(
      resolveRecoveryEmail({ employeePersonalEmail: '', onboardingPersonalEmail: 'onboarding@example.com' })
    ).toBe('onboarding@example.com')
  })
})

describe('isRecoveryThrottled', () => {
  it('is not throttled when there is no prior request', () => {
    expect(isRecoveryThrottled(null, new Date('2026-01-01T00:00:00Z'))).toBe(false)
  })

  it('is throttled just inside the window', () => {
    const last = new Date('2026-01-01T00:00:00Z')
    const now = new Date(last.getTime() + RECOVERY_THROTTLE_MS - 1000)
    expect(isRecoveryThrottled(last.toISOString(), now)).toBe(true)
  })

  it('is not throttled once the window has fully elapsed', () => {
    const last = new Date('2026-01-01T00:00:00Z')
    const now = new Date(last.getTime() + RECOVERY_THROTTLE_MS + 1000)
    expect(isRecoveryThrottled(last.toISOString(), now)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- passwordRecovery`
Expected: FAIL — `Cannot find module './passwordRecovery'`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/passwordRecovery.ts
export const RECOVERY_THROTTLE_MS = 2 * 60 * 1000 // 2 minutes

export function resolveRecoveryEmail(input: {
  employeePersonalEmail: string | null
  onboardingPersonalEmail: string | null
}): string | null {
  return input.employeePersonalEmail || input.onboardingPersonalEmail || null
}

export function isRecoveryThrottled(lastRequestedAt: string | null, now: Date = new Date()): boolean {
  if (!lastRequestedAt) return false
  const elapsed = now.getTime() - new Date(lastRequestedAt).getTime()
  return elapsed < RECOVERY_THROTTLE_MS
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- passwordRecovery`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add lib/passwordRecovery.ts lib/passwordRecovery.test.ts
git commit -m "Add pure recovery-email resolution and throttle logic"
```

---

### Task 3: Resend email wrapper

**Files:**
- Create: `lib/email.ts`
- Test: `lib/email.test.ts`
- Modify: `.env.example`, `package.json`

**Interfaces:**
- Consumes: `process.env.RESEND_API_KEY`, `process.env.EMAIL_FROM`
- Produces: `sendRecoveryEmail(to: string, resetLink: string): Promise<{ error?: string }>` — Task 5's server action calls this exactly.

- [ ] **Step 1: Install the dependency**

Run: `npm install resend`

- [ ] **Step 2: Write the failing tests**

```typescript
// lib/email.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}))

import { sendRecoveryEmail } from './email'

describe('sendRecoveryEmail', () => {
  beforeEach(() => {
    sendMock.mockReset()
    process.env.RESEND_API_KEY = 'test-key'
    process.env.EMAIL_FROM = 'CERTA& Portal <no-reply@certaadvisory.com>'
  })

  it('sends via Resend with the reset link in the body', async () => {
    sendMock.mockResolvedValue({ data: { id: 'abc' }, error: null })

    const result = await sendRecoveryEmail(
      'person@example.com',
      'https://portal.certaadvisory.com/auth/confirm?token_hash=xyz&type=recovery'
    )

    expect(result.error).toBeUndefined()
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'person@example.com',
        from: 'CERTA& Portal <no-reply@certaadvisory.com>',
        html: expect.stringContaining(
          'https://portal.certaadvisory.com/auth/confirm?token_hash=xyz&type=recovery'
        ),
      })
    )
  })

  it('returns an error when RESEND_API_KEY is missing, without calling Resend', async () => {
    delete process.env.RESEND_API_KEY

    const result = await sendRecoveryEmail('person@example.com', 'https://example.com/link')

    expect(result.error).toMatch(/not configured/i)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('surfaces a Resend API error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'invalid domain' } })

    const result = await sendRecoveryEmail('person@example.com', 'https://example.com/link')

    expect(result.error).toBe('invalid domain')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- email`
Expected: FAIL — `Cannot find module './email'`

- [ ] **Step 4: Write the implementation**

```typescript
// lib/email.ts
import { Resend } from 'resend'

export async function sendRecoveryEmail(to: string, resetLink: string): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    return { error: 'Email is not configured (RESEND_API_KEY/EMAIL_FROM missing)' }
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to,
    subject: 'Reset your CERTA& Portal password',
    html: `<p>A password reset was requested for your CERTA& Portal account.</p><p><a href="${resetLink}">Click here to set a new password</a>. This link expires soon and can only be used once.</p><p>If you didn't request this, you can safely ignore this email.</p>`,
  })

  if (error) return { error: error.message }
  return {}
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- email`
Expected: PASS, 3 tests

- [ ] **Step 6: Document the new env vars**

Add to `.env.example`, after the existing `SEED_ADMIN_*` block:

```
# Password recovery email (see docs/superpowers/specs/2026-09-12-portal-forgot-password-design.md).
# Requires a verified sending domain in the Resend dashboard.
RESEND_API_KEY=
EMAIL_FROM=
```

- [ ] **Step 7: Commit**

```bash
git add lib/email.ts lib/email.test.ts .env.example package.json package-lock.json
git commit -m "Add Resend email wrapper for password recovery"
```

---

### Task 4: Admin-editable personal email field

**Files:**
- Modify: `app/admin/employees/[id]/EditEmployeeClient.tsx`
- Modify: `app/admin/employees/[id]/actions.ts:14-61` (`updateEmployeeAction`)
- Modify: `app/admin/employees/new/NewEmployeeClient.tsx`
- Modify: `app/admin/employees/new/actions.ts`
- Modify: `lib/employees.ts`
- Modify: `e2e/admin-edit-employee.spec.ts`

**Interfaces:**
- Consumes: `employees.personal_email` (Task 1)
- Produces: nothing new consumed by later tasks — Task 5's server action reads `employees.personal_email` directly via its own query, not through this UI code.

- [ ] **Step 1: Add the field to the Edit Employee form**

In `app/admin/employees/[id]/EditEmployeeClient.tsx`, add `personal_email: string | null` to the `Employee` type (after `contact_info: string | null`):

```typescript
  contact_info: string | null
  personal_email: string | null
```

Then add a field right after the existing "Contact info" block (after the closing `</div>` at line 246, before the "Join date" block):

```tsx
            <div>
              <label htmlFor="personalEmail" className={labelClass}>
                Personal email (for password recovery)
              </label>
              <input
                id="personalEmail"
                name="personalEmail"
                type="email"
                defaultValue={employee.personal_email ?? ''}
                className={input}
              />
            </div>
```

- [ ] **Step 2: Persist it in `updateEmployeeAction`**

In `app/admin/employees/[id]/actions.ts`, add `personal_email` to the `.update({...})` call (after `contact_info`):

```typescript
      contact_info: String(formData.get('contactInfo') ?? '') || null,
      personal_email: String(formData.get('personalEmail') ?? '') || null,
```

- [ ] **Step 3: Add the field to the New Employee form**

In `app/admin/employees/new/NewEmployeeClient.tsx`, add a field after the existing "Contact info" block:

```tsx
          <div>
            <label htmlFor="personalEmail" className={labelClass}>
              Personal email (for password recovery)
            </label>
            <input id="personalEmail" name="personalEmail" type="email" className={input} />
          </div>
```

- [ ] **Step 4: Wire it through creation**

In `lib/employees.ts`, add `personalEmail?: string` to `NewEmployeeInput` (after `contactInfo?: string`), and add it to the insert in `createEmployeeRecord` (after `contact_info`):

```typescript
      contact_info: input.contactInfo ?? null,
      personal_email: input.personalEmail ?? null,
```

In `app/admin/employees/new/actions.ts`, pass it through in the `createEmployeeRecord` call (after `contactInfo`):

```typescript
      contactInfo: String(formData.get('contactInfo') ?? '') || undefined,
      personalEmail: String(formData.get('personalEmail') ?? '') || undefined,
```

- [ ] **Step 5: Extend the e2e coverage**

In `e2e/admin-edit-employee.spec.ts`, extend the existing test (the one that fills "Position" and clicks "Save changes") to also cover the new field — replace:

```typescript
  await page.getByLabel('Position').fill('Senior Accountant')
  // Exact match: Task 7 (Attendance & Leave phase) added a second "Save
  // salary" button to this same page, making the old /save/i regex
  // ambiguous.
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByLabel('Position')).toHaveValue('Senior Accountant')
```

with:

```typescript
  await page.getByLabel('Position').fill('Senior Accountant')
  await page.getByLabel('Personal email (for password recovery)').fill('edit-target@example.com')
  // Exact match: Task 7 (Attendance & Leave phase) added a second "Save
  // salary" button to this same page, making the old /save/i regex
  // ambiguous.
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByLabel('Position')).toHaveValue('Senior Accountant')
  await expect(page.getByLabel('Personal email (for password recovery)')).toHaveValue('edit-target@example.com')
```

- [ ] **Step 6: Run the e2e spec to verify it passes**

Run: `npm run test:e2e -- admin-edit-employee`
Expected: PASS

- [ ] **Step 7: Run the full unit suite and lint to make sure nothing else broke**

Run: `npm test && npm run lint`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add app/admin/employees lib/employees.ts e2e/admin-edit-employee.spec.ts
git commit -m "Add admin-editable personal email field for password recovery"
```

---

### Task 5: Forgot-password request page and action

**Files:**
- Create: `app/forgot-password/actions.ts`
- Create: `app/forgot-password/page.tsx`
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: `resolveRecoveryEmail`, `isRecoveryThrottled` (Task 2, from `@/lib/passwordRecovery`), `sendRecoveryEmail` (Task 3, from `@/lib/email`), `employeeIdToEmail` (`@/lib/employeeAuth`), `createAdminClient` (`@/lib/supabase/admin`)
- Produces: `requestPasswordRecoveryAction(prevState: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState>` where `ForgotPasswordState = { success?: string }` — Task 8's e2e spec drives this via the page form, not by importing it directly.

- [ ] **Step 1: Write the server action**

```typescript
// app/forgot-password/actions.ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { employeeIdToEmail } from '@/lib/employeeAuth'
import { resolveRecoveryEmail, isRecoveryThrottled } from '@/lib/passwordRecovery'
import { sendRecoveryEmail } from '@/lib/email'

export type ForgotPasswordState = { success?: string }

// Always the same message regardless of outcome -- an attacker must not be
// able to tell a real Employee ID from a fake one, or one with a recovery
// email on file from one without. See spec: "No account enumeration".
const GENERIC_MESSAGE = "If that Employee ID has a recovery email on file, we've sent a reset link."

const SITE_URL = 'https://portal.certaadvisory.com'

export async function requestPasswordRecoveryAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const employeeId = String(formData.get('employeeId') ?? '').trim()

  if (!employeeId) {
    return { success: GENERIC_MESSAGE }
  }

  try {
    const admin = createAdminClient()

    const { data: employee } = await admin
      .from('employees')
      .select('id, employee_id, personal_email, last_recovery_requested_at')
      .ilike('employee_id', employeeId)
      .eq('status', 'active')
      .maybeSingle()

    if (!employee) {
      return { success: GENERIC_MESSAGE }
    }

    const { data: onboarding } = await admin
      .from('employee_onboarding')
      .select('personal_email')
      .eq('employee_id', employee.id)
      .maybeSingle()

    const recoveryEmail = resolveRecoveryEmail({
      employeePersonalEmail: employee.personal_email,
      onboardingPersonalEmail: onboarding?.personal_email ?? null,
    })

    if (!recoveryEmail || isRecoveryThrottled(employee.last_recovery_requested_at)) {
      return { success: GENERIC_MESSAGE }
    }

    const authEmail = employeeIdToEmail(employee.employee_id)

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: authEmail,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('generateLink failed for password recovery:', linkError?.message)
      return { success: GENERIC_MESSAGE }
    }

    const resetLink = `${SITE_URL}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=recovery&next=/reset-password`

    const { error: emailError } = await sendRecoveryEmail(recoveryEmail, resetLink)
    if (emailError) {
      console.error('sendRecoveryEmail failed:', emailError)
      return { success: GENERIC_MESSAGE }
    }

    await admin
      .from('employees')
      .update({ last_recovery_requested_at: new Date().toISOString() })
      .eq('id', employee.id)
  } catch (err) {
    console.error('requestPasswordRecoveryAction failed:', err)
  }

  return { success: GENERIC_MESSAGE }
}
```

- [ ] **Step 2: Write the request page**

```tsx
// app/forgot-password/page.tsx
'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { requestPasswordRecoveryAction, type ForgotPasswordState } from './actions'
import { input, label as labelClass, buttonPrimary, successText } from '@/lib/ui'

const initialState: ForgotPasswordState = {}

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordRecoveryAction, initialState)

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-tint px-4 py-12">
      <div className="w-full max-w-sm rounded-[16px] bg-white p-8 sm:p-10">
        <Image
          src="/brand/certa-mark.png"
          alt=""
          width={40}
          height={40}
          priority
          className="h-10 w-10"
        />

        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-ink">
          Reset your password
        </h1>
        <p className="mt-1.5 text-[0.9375rem] text-ink-muted">
          Enter your Employee ID and we&apos;ll email a reset link to the recovery address on file for it.
        </p>

        {state.success ? (
          <p className={`${successText} mt-8`}>{state.success}</p>
        ) : (
          <form action={formAction} className="mt-8 flex flex-col gap-5">
            <div>
              <label htmlFor="employeeId" className={labelClass}>
                Employee ID
              </label>
              <input
                id="employeeId"
                name="employeeId"
                type="text"
                required
                autoFocus
                autoComplete="username"
                className={input}
              />
            </div>

            <button type="submit" disabled={pending} className={`${buttonPrimary} mt-1 w-full`}>
              {pending ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Back to sign in
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Link to it from the login page**

In `app/login/page.tsx`, add `import Link from 'next/link'` alongside the existing `Image` import, then add a link right after the password field's closing `</div>` (before the `{state.error && (...)}` block):

```tsx
          <div className="-mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-[0.8125rem] font-semibold text-certa-green-deep hover:underline"
            >
              Forgot password?
            </Link>
          </div>
```

- [ ] **Step 4: Verify it builds and type-checks**

Run: `npm run build`
Expected: succeeds, `/forgot-password` listed in the route output

- [ ] **Step 5: Commit**

```bash
git add app/forgot-password app/login/page.tsx
git commit -m "Add forgot-password request page and server action"
```

---

### Task 6: `/auth/confirm` token verification route

**Files:**
- Create: `app/auth/confirm/route.ts`

**Interfaces:**
- Consumes: `createClient` (`@/lib/supabase/server`)
- Produces: a `GET` route at `/auth/confirm` — Task 8's e2e spec navigates to it directly; no other task imports from this file.

- [ ] **Step 1: Write the route handler**

```typescript
// app/auth/confirm/route.ts
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Only ever redirect to a same-origin relative path here -- `next` comes
// from the query string of a link we email out, but nothing stops someone
// crafting their own /auth/confirm?...&next=https://evil.example link, so
// an absolute/protocol-relative value must never be honored (open redirect).
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/reset-password'
  }
  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNextPath(searchParams.get('next'))

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  return NextResponse.redirect(new URL('/forgot-password?error=expired', origin))
}
```

- [ ] **Step 2: Verify it builds and type-checks**

Run: `npm run build`
Expected: succeeds, `/auth/confirm` listed in the route output

- [ ] **Step 3: Commit**

```bash
git add app/auth/confirm
git commit -m "Add /auth/confirm recovery-token verification route"
```

---

### Task 7: Reset-password page and action

**Files:**
- Create: `app/reset-password/page.tsx`
- Create: `app/reset-password/ResetPasswordForm.tsx`
- Create: `app/reset-password/actions.ts`
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: `requireEmployee` (`@/lib/auth`), `createClient` (`@/lib/supabase/server`)
- Produces: `updateOwnPasswordAction(prevState: ResetPasswordState, formData: FormData): Promise<ResetPasswordState>` where `ResetPasswordState = { error?: string }` — consumed only by `ResetPasswordForm.tsx` in this same task.

- [ ] **Step 1: Write the server action**

```typescript
// app/reset-password/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ResetPasswordState = { error?: string }

export async function updateOwnPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get('password') ?? '')

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }

  await supabase.auth.signOut()
  redirect('/login?reset=success')
}
```

- [ ] **Step 2: Write the server-guarded page**

```tsx
// app/reset-password/page.tsx
import { redirect } from 'next/navigation'
import { requireEmployee } from '@/lib/auth'
import ResetPasswordForm from './ResetPasswordForm'

export default async function ResetPasswordPage() {
  try {
    await requireEmployee()
  } catch {
    redirect('/login')
  }

  return <ResetPasswordForm />
}
```

- [ ] **Step 3: Write the client form**

```tsx
// app/reset-password/ResetPasswordForm.tsx
'use client'

import { useActionState } from 'react'
import Image from 'next/image'
import { AlertCircle } from 'lucide-react'
import { updateOwnPasswordAction, type ResetPasswordState } from './actions'
import { input, label as labelClass, buttonPrimary, errorText } from '@/lib/ui'

const initialState: ResetPasswordState = {}

export default function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updateOwnPasswordAction, initialState)

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-tint px-4 py-12">
      <div className="w-full max-w-sm rounded-[16px] bg-white p-8 sm:p-10">
        <Image
          src="/brand/certa-mark.png"
          alt=""
          width={40}
          height={40}
          priority
          className="h-10 w-10"
        />

        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight text-ink">
          Set a new password
        </h1>

        <form action={formAction} className="mt-8 flex flex-col gap-5">
          <div>
            <label htmlFor="password" className={labelClass}>
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="new-password"
              className={input}
            />
          </div>

          {state.error && (
            <p role="alert" className={errorText}>
              <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
              {state.error}
            </p>
          )}

          <button type="submit" disabled={pending} className={`${buttonPrimary} mt-1 w-full`}>
            {pending ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Show a success notice on the login page after a reset**

In `app/login/page.tsx`, add `useSearchParams` to the existing `'use client'`/React imports (`import { useActionState } from 'react'` becomes two named hooks via `'react'` for state and `'next/navigation'` for the query param):

```tsx
import { useSearchParams } from 'next/navigation'
```

Inside the `LoginPage` component, before the `return`:

```tsx
  const searchParams = useSearchParams()
  const justReset = searchParams.get('reset') === 'success'
```

Then, right after the intro paragraph (`<p className="mt-1.5 ...">Use the Employee ID...</p>`), add:

```tsx
        {justReset && (
          <p className={`${successText} mt-4`}>Password updated — sign in with your new password.</p>
        )}
```

Add `successText` to the existing `from '@/lib/ui'` import list alongside `input, label as labelClass, buttonPrimary, errorText`.

- [ ] **Step 5: Verify it builds and type-checks**

Run: `npm run build`
Expected: succeeds, `/reset-password` listed in the route output

- [ ] **Step 6: Commit**

```bash
git add app/reset-password app/login/page.tsx
git commit -m "Add reset-password page and self-service password update action"
```

---

### Task 8: End-to-end coverage

**Files:**
- Create: `e2e/forgot-password.spec.ts`

**Interfaces:**
- Consumes: `createAdminClient` (`@/lib/supabase/admin`), `createEmployeeRecord` (`@/lib/employees`) — same pattern as `e2e/admin-edit-employee.spec.ts`

- [ ] **Step 1: Write the e2e spec**

```typescript
// e2e/forgot-password.spec.ts
import { test, expect } from '@playwright/test'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'

test('shows the same generic message for a real Employee ID with no recovery email and a nonexistent one', async ({
  page,
}) => {
  // No personal_email set and no onboarding row completed, so neither
  // request actually triggers a Resend call -- safe to run in CI.
  const employeeId = `no-recovery-email-${Date.now()}`
  const adminClient = createAdminClient()
  await createEmployeeRecord(adminClient, {
    employeeId,
    password: 'password-no-recovery-123',
    name: 'No Recovery Email',
    role: 'employee',
  })

  await page.goto('/forgot-password')
  await page.getByLabel('Employee ID').fill(employeeId)
  await page.getByRole('button', { name: /send reset link/i }).click()
  const realIdMessage = await page.getByText(/if that employee id has a recovery email on file/i).textContent()

  await page.goto('/forgot-password')
  await page.getByLabel('Employee ID').fill(`does-not-exist-${Date.now()}`)
  await page.getByRole('button', { name: /send reset link/i }).click()
  const fakeIdMessage = await page.getByText(/if that employee id has a recovery email on file/i).textContent()

  expect(realIdMessage).toBe(fakeIdMessage)
})

test('resets a password end to end via a recovery link', async ({ page }) => {
  // Throwaway employee, never the seeded admin -- see the identical caution
  // in e2e/admin-edit-employee.spec.ts.
  const employeeId = `recovery-target-${Date.now()}`
  const adminClient = createAdminClient()
  const { employeeRowId } = await createEmployeeRecord(adminClient, {
    employeeId,
    password: 'original-password-123',
    name: 'Recovery Target',
    role: 'employee',
  })
  await adminClient
    .from('employees')
    .update({ personal_email: 'recovery-target@example.com' })
    .eq('id', employeeRowId)

  // Generated directly via the admin client, mirroring exactly what
  // requestPasswordRecoveryAction does server-side -- this avoids sending a
  // real email through Resend during the test run.
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: `emp-${employeeId.toLowerCase().replace(/[^a-z0-9]/g, '')}@internal.certaadvisory.com`,
  })
  expect(linkError).toBeNull()

  await page.goto(`/auth/confirm?token_hash=${linkData!.properties.hashed_token}&type=recovery&next=/reset-password`)
  await expect(page).toHaveURL(/\/reset-password/)

  await page.getByLabel('New password').fill('brand-new-recovered-password-789')
  await page.getByRole('button', { name: /save new password/i }).click()
  await expect(page).toHaveURL(/\/login\?reset=success/)
  await expect(page.getByText(/password updated/i)).toBeVisible()

  await page.getByLabel('Employee ID').fill(employeeId)
  await page.getByLabel('Password').fill('brand-new-recovered-password-789')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/dashboard|\/onboarding/)
})

test('an expired or invalid recovery link redirects back to forgot-password with a notice', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=not-a-real-token&type=recovery&next=/reset-password')
  await expect(page).toHaveURL(/\/forgot-password\?error=expired/)
})
```

- [ ] **Step 2: Run the spec**

Run: `npm run test:e2e -- forgot-password`
Expected: PASS, 3 tests

- [ ] **Step 3: Run the full e2e suite to confirm nothing else regressed**

Run: `npm run test:e2e`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add e2e/forgot-password.spec.ts
git commit -m "Add end-to-end coverage for self-service password reset"
```

---

### Task 9: Roster export gets the resolved recovery email

**Files:**
- Modify: `portal/scripts/export-roster.ts`

**Interfaces:**
- Consumes: `resolveRecoveryEmail` (Task 2, from `../lib/passwordRecovery`)

- [ ] **Step 1: Add `personal_email` and `id` to the employees query**

In `scripts/export-roster.ts`, change the `.select(...)` call to also fetch `id` and `personal_email`:

```typescript
    .select(
      'id, employee_id, name, role, status, contact_info, personal_email, position, department_id, join_date, created_at, auth_user_id, departments(name)'
    )
```

And add `personal_email: string | null` and `id: string` to the local `Row` type at the top of the file.

- [ ] **Step 2: Fetch onboarding emails and resolve per row**

Add this import at the top:

```typescript
import { resolveRecoveryEmail } from '../lib/passwordRecovery'
```

After the existing `emailByAuthId` map is built, add:

```typescript
  const { data: onboardingRows } = await admin.from('employee_onboarding').select('employee_id, personal_email')
  const onboardingEmailByEmployeeRowId = new Map(
    (onboardingRows ?? []).map((o) => [o.employee_id, o.personal_email as string | null])
  )
```

Then, inside the `rows` mapping, add a `recoveryEmail` field:

```typescript
    recoveryEmail:
      resolveRecoveryEmail({
        employeePersonalEmail: e.personal_email,
        onboardingPersonalEmail: onboardingEmailByEmployeeRowId.get(e.id) ?? null,
      }) ?? '',
```

- [ ] **Step 3: Add the column to the markdown output**

Add `'Recovery email'` to the `header` array (after `'Contact info'`), and add `r.recoveryEmail` to the corresponding position in each row's template string.

- [ ] **Step 4: Run it against the live database and confirm the column appears**

Run: `npm run roster:export`
Expected: `Wrote 12 accounts to .../internal/employee-roster.md` (or 13+, if more were added since); open the file and confirm the new "Recovery email" column is populated for `superadmin` (from Task-1-era manual testing, if a personal_email was set on it) and for anyone who's completed onboarding.

- [ ] **Step 5: Commit**

```bash
git add scripts/export-roster.ts
git commit -m "Add resolved recovery email column to roster export"
```

---

### Task 10: Documentation and manual production QA

**Files:**
- Modify: `README.md`

**Interfaces:** none — final task, nothing else depends on it.

- [ ] **Step 1: Document the Resend setup requirement**

Add a new section to `README.md`, after the existing "Bootstrapping the first admin" section:

```markdown
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
```

- [ ] **Step 2: Commit the docs**

```bash
git add README.md
git commit -m "Document Resend setup for self-service password reset"
```

- [ ] **Step 3: Manual QA once Resend is configured (not automatable — requires the real dashboard setup)**

Once `RESEND_API_KEY`/`EMAIL_FROM` are set in Vercel and the domain is
verified:

1. Set a real `personal_email` on a real account via Admin → Employees.
2. Visit `https://portal.certaadvisory.com/forgot-password`, enter that
   account's Employee ID, submit.
3. Confirm the email actually arrives (check spam too) and the link works
   end to end: click it → land on `/reset-password` → set a password →
   redirected to `/login?reset=success` → log in with the new password.
4. Submit the forgot-password form twice in a row for the same account and
   confirm only one email arrives (throttle working).

- [ ] **Step 4: Push everything**

```bash
git push origin main
```
