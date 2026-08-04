# Employee Onboarding (+ Shared Notification Center) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared in-app Notification Center (bell icon + generic `notifications` table), then the Employee Onboarding subsystem on top of it — HR-required fields and document uploads, gated on first login, admin review with a correction loop.

**Architecture:** Additive-only — no existing table, RLS policy, or page is modified in a breaking way; everything here is new tables, new routes, and small, isolated additions to three existing files (`middleware.ts`, `lib/employees.ts`, `components/Sidebar.tsx`, both dashboard/admin `layout.tsx` files, and the admin employee-edit page). The Notification Center is built first (Tasks 1–3) because Onboarding's own "admin gets notified on submit" and "employee gets notified on correction" steps depend on it. Onboarding itself follows the same shape as every other admin-reviewed submission already in this codebase (`employee_documents`, Phase 3's task/subtask/comment tables): one table per employee, RLS as the real access boundary, a service-role client (`createAdminClient()`) for the one cross-employee write path (creating the row at employee-creation time, and notifying other employees).

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Supabase (Postgres + Auth + Storage), Tailwind, Vitest (unit), Playwright (e2e/RLS). No local Supabase emulator in this project — migrations are applied to the live Supabase project via the SQL Editor by the controller between tasks (same convention Phase 3 used), not by the task implementer and not via a CLI push.

## Global Constraints

- This is **not the Next.js you know** (see `portal/AGENTS.md`) — if any step needs a Next.js API not already demonstrated by an existing file referenced in this plan, read `portal/node_modules/next/dist/docs/` before writing it; do not rely on training-data assumptions about App Router/Server Action behavior.
- DB columns: `snake_case`. TypeScript: `camelCase` for function params/locals, matching every existing `lib/*.ts` file.
- Every new table gets RLS enabled and explicit policies — no table is ever left with RLS off or a blanket `true` policy, matching every migration since `0001_init.sql`.
- Every private file upload goes through a private (`public: false`) storage bucket with its own `storage.objects` policies scoped by the uploader's employee id in the object path — the exact pattern `0001_init.sql` established for `employee-documents`.
- Cross-employee writes (inserting/updating a row that isn't the caller's own) always go through `createAdminClient()` (service-role, bypasses RLS) from inside a Server Action that has already run the correct `require*()` guard from `lib/auth.ts` — never by loosening RLS to permit it directly. This is the pattern `createEmployeeRecord`, `uploadDocumentAction`, and every Phase 3 admin action already follow.
- No email/push/realtime for notifications — in-app only, unread count computed fresh per page load (see Task 3).
- Run `npx tsc --noEmit` and `npm run lint` from `portal/` after every task that touches `.ts`/`.tsx` files; run `npm test` (Vitest) after any task with a `.test.ts` file. `npm run test:e2e` (Playwright) only after Task 10, which needs the full schema live.

---

### Task 1: Notifications data model — migration

**Files:**
- Create: `portal/supabase/migrations/0010_notifications.sql`

**Interfaces:**
- Produces: `notifications` table (`id`, `recipient_id`, `title`, `body`, `link`, `read_at`, `created_at`), with RLS granting the owning employee `select`/`update` on their own rows only, and **no insert or delete policy for the `authenticated` role at all** — every insert must go through the service-role client.

- [ ] **Step 1: Write the migration**

`portal/supabase/migrations/0010_notifications.sql`:
```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references employees(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_id_idx on notifications (recipient_id);
create index notifications_recipient_unread_idx on notifications (recipient_id) where read_at is null;

alter table notifications enable row level security;

-- Employees can read and mark-read only their own notifications. Deliberately
-- no insert or delete policy for the authenticated/anon role at all — every
-- notification is created by a Server Action using createAdminClient()
-- (service-role, bypasses RLS), which is where the "am I allowed to notify
-- this person" check already lives (e.g. only a requireAdmin()-gated action
-- can trigger the onboarding-correction notification). This is what makes
-- it structurally impossible for one employee to spam another — there is no
-- RLS-permitted insert path to even attempt it via a direct POST.
create policy "notifications_select_own" on notifications
  for select using (
    exists (
      select 1 from employees e
      where e.id = notifications.recipient_id and e.auth_user_id = auth.uid()
    )
  );

create policy "notifications_update_own" on notifications
  for update using (
    exists (
      select 1 from employees e
      where e.id = notifications.recipient_id and e.auth_user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from employees e
      where e.id = notifications.recipient_id and e.auth_user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Type-check**

```bash
cd portal
npx tsc --noEmit
```

Expected: no errors (pure SQL, no app code touched yet).

- [ ] **Step 3: Commit**

```bash
git add portal/supabase/migrations/0010_notifications.sql
git commit -m "Add notifications table for the shared notification center"
```

*(Controller applies this migration to the live Supabase project via the SQL Editor before Task 2 begins — the `lib/notifications.ts` helpers in Task 2 need the table to exist to be manually verified.)*

---

### Task 2: `lib/notifications.ts` helpers

**Files:**
- Create: `portal/lib/notifications.ts`

**Interfaces:**
- Consumes: `notifications` table from Task 1.
- Produces: `type Notification = { id: string; recipient_id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }`; `listNotifications()`, `countUnreadNotifications()`, `markNotificationRead()`, `markAllNotificationsRead()`, `notifyEmployees()`, `listActiveAdminIds()` — every later task (Onboarding, and eventually Attendance/IT Ticketing) calls `notifyEmployees()` and `listActiveAdminIds()` to emit notifications; the bell UI (Task 3) calls the first four.

No `.test.ts` for this file: every function is a thin, direct wrapper over a single Supabase call with no branching logic to unit test — same reasoning already applied to `lib/subtasks.ts` and `lib/comments.ts`, neither of which has a test file. Verification happens via manual testing (Task 3) and the e2e RLS tests (Task 10).

- [ ] **Step 1: Write `lib/notifications.ts`**

`portal/lib/notifications.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type Notification = {
  id: string
  recipient_id: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export async function listNotifications(supabase: SupabaseClient, limit = 20): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('id, recipient_id, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function countUnreadNotifications(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  return count ?? 0
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  notificationId: string
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
  return { error: error?.message }
}

export async function markAllNotificationsRead(supabase: SupabaseClient): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  return { error: error?.message }
}

// Cross-employee write — must be called with an admin client (service-role),
// never the caller's own RLS-scoped client. See notifications_select_own /
// notifications_update_own in 0010_notifications.sql: there is no insert
// policy for the authenticated role at all.
export async function notifyEmployees(
  adminClient: SupabaseClient,
  recipientIds: string[],
  input: { title: string; body?: string; link?: string }
): Promise<{ error?: string }> {
  if (recipientIds.length === 0) return {}
  const { error } = await adminClient.from('notifications').insert(
    recipientIds.map((recipientId) => ({
      recipient_id: recipientId,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    }))
  )
  return { error: error?.message }
}

export async function listActiveAdminIds(adminClient: SupabaseClient): Promise<string[]> {
  const { data } = await adminClient
    .from('employees')
    .select('id')
    .in('role', ['admin', 'superadmin'])
    .eq('status', 'active')
  return (data ?? []).map((row) => row.id)
}
```

- [ ] **Step 2: Type-check**

```bash
cd portal
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add portal/lib/notifications.ts
git commit -m "Add lib/notifications.ts helpers"
```

---

### Task 3: Notification bell UI

**Files:**
- Create: `portal/components/NotificationBell.tsx`
- Modify: `portal/app/actions.ts` (add three thin Server Actions wrapping Task 2's helpers)
- Modify: `portal/components/Sidebar.tsx` (render the bell in the header, thread an `unreadCount` prop through)
- Modify: `portal/app/dashboard/layout.tsx` (fetch unread count, pass to `Sidebar`)
- Modify: `portal/app/admin/layout.tsx` (same)

**Interfaces:**
- Consumes: `Notification` type and all four read/write helpers from `lib/notifications.ts` (Task 2).
- Produces: `<NotificationBell initialUnreadCount={number} />`, importable and usable by any future layout (Attendance & Leave and IT Ticketing plans will not need to touch this component again — it's generic).

- [ ] **Step 1: Add notification Server Actions to `app/actions.ts`**

`portal/app/actions.ts` (full file — add the three new exports below `signOutAction`):
```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from '@/lib/notifications'

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function listNotificationsAction(): Promise<Notification[]> {
  const supabase = await createClient()
  return listNotifications(supabase)
}

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const supabase = await createClient()
  await markNotificationRead(supabase, notificationId)
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const supabase = await createClient()
  await markAllNotificationsRead(supabase)
}
```

- [ ] **Step 2: Write `components/NotificationBell.tsx`**

`portal/components/NotificationBell.tsx`:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import {
  listNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/app/actions'
import type { Notification } from '@/lib/notifications'

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [notifications, setNotifications] = useState<Notification[] | null>(null)
  const [, startTransition] = useTransition()

  async function toggleOpen() {
    if (!open && notifications === null) {
      const list = await listNotificationsAction()
      setNotifications(list)
    }
    setOpen((o) => !o)
  }

  function handleSelect(notification: Notification) {
    startTransition(async () => {
      if (!notification.read_at) {
        await markNotificationReadAction(notification.id)
        setUnreadCount((c) => Math.max(0, c - 1))
      }
      setOpen(false)
      if (notification.link) router.push(notification.link)
    })
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction()
      setUnreadCount(0)
      setNotifications(
        (list) => list?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null
      )
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-white hover:text-ink"
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-signal-coral text-[0.625rem] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-[10px] border border-border bg-white shadow-[0_8px_20px_rgba(35,31,32,0.12)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-[0.8125rem] font-semibold text-ink">Notifications</span>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[0.75rem] font-semibold text-certa-green-deep hover:underline"
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifications === null || notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-[0.8125rem] text-ink-muted">
                {notifications === null ? 'Loading…' : 'No notifications yet.'}
              </li>
            ) : (
              notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(n)}
                    className={`block w-full px-4 py-3 text-left text-[0.8125rem] transition-colors hover:bg-surface-tint ${
                      n.read_at ? 'text-ink-muted' : 'font-semibold text-ink'
                    }`}
                  >
                    {n.title}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire it into `Sidebar.tsx`**

In `portal/components/Sidebar.tsx`, add the import:
```ts
import { NotificationBell } from '@/components/NotificationBell'
```

Change `SidebarContent`'s props and header block from:
```tsx
function SidebarContent({
  variant,
  name,
  roleLabel,
  onNavigate,
}: {
  variant: 'employee' | 'admin' | 'manager'
  name: string
  roleLabel: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const nav = variant === 'admin' ? ADMIN_NAV : variant === 'manager' ? MANAGER_NAV : EMPLOYEE_NAV

  return (
    <>
      <div className="flex h-16 items-center px-6">
        <Image
          src="/brand/certa-lockup.png"
          alt="CERTA& Advisory"
          width={140}
          height={44}
          priority
          className="h-7 w-auto"
        />
      </div>
```
to:
```tsx
function SidebarContent({
  variant,
  name,
  roleLabel,
  unreadCount,
  onNavigate,
}: {
  variant: 'employee' | 'admin' | 'manager'
  name: string
  roleLabel: string
  unreadCount: number
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const nav = variant === 'admin' ? ADMIN_NAV : variant === 'manager' ? MANAGER_NAV : EMPLOYEE_NAV

  return (
    <>
      <div className="flex h-16 items-center justify-between px-6">
        <Image
          src="/brand/certa-lockup.png"
          alt="CERTA& Advisory"
          width={140}
          height={44}
          priority
          className="h-7 w-auto"
        />
        <NotificationBell initialUnreadCount={unreadCount} />
      </div>
```

Thread `unreadCount` through the two call sites inside `SidebarContent` (the mobile drawer) and the exported `Sidebar` function — `Sidebar`'s own props gain `unreadCount: number`, and both places it renders `<SidebarContent ... />` (mobile drawer and desktop `<aside>`) pass `unreadCount={unreadCount}` alongside the existing `variant`/`name`/`roleLabel`.

- [ ] **Step 4: Fetch unread count in both layouts**

`portal/app/dashboard/layout.tsx` — add the import `import { countUnreadNotifications } from '@/lib/notifications'`, fetch it alongside the existing employee lookup, and pass it to `Sidebar`:
```tsx
  if (!employee) redirect('/login')

  const unreadCount = await countUnreadNotifications(supabase)

  return (
    <div className="flex h-screen">
      <Sidebar variant="employee" name={employee.name} roleLabel="Employee" unreadCount={unreadCount} />
```

Apply the identical change to `portal/app/admin/layout.tsx` (same import, same `countUnreadNotifications(supabase)` call, same prop added to its `<Sidebar variant="admin" .../>` call).

- [ ] **Step 5: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run lint
```

Manual check: `npm run dev`, sign in as the seed admin, confirm the bell renders in the header with no unread badge (count is 0, table is empty). In the Supabase SQL Editor, run:
```sql
insert into notifications (recipient_id, title, link)
select id, 'Test notification', '/admin' from employees where employee_id = 'admin' or role = 'superadmin' limit 1;
```
Reload the page — the badge should show "1". Click the bell, confirm the dropdown lists it; click it, confirm it navigates and the badge clears. Click "Mark all read" after inserting a second test row, confirm both clear. Delete the test rows afterward.

- [ ] **Step 6: Commit**

```bash
git add portal/app/actions.ts portal/components/NotificationBell.tsx portal/components/Sidebar.tsx portal/app/dashboard/layout.tsx portal/app/admin/layout.tsx
git commit -m "Add notification bell UI to the shared Sidebar/layouts"
```

---

### Task 4: Onboarding data model — migration

**Files:**
- Create: `portal/supabase/migrations/0011_employee_onboarding.sql`

**Interfaces:**
- Produces: `employee_onboarding` table (one row per employee, per the Onboarding spec's field list); `onboarding-documents` storage bucket; RLS + a `before update` trigger enforcing that a non-admin caller can never set `status = 'complete'` or write the review-only columns (`reviewed_by`, `reviewed_at`, `correction_notes`) themselves.

- [ ] **Step 1: Write the migration**

`portal/supabase/migrations/0011_employee_onboarding.sql`:
```sql
create table employee_onboarding (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references employees(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'submitted', 'needs_correction', 'complete')),
  date_of_birth date,
  fathers_name text,
  mothers_name text,
  blood_group text,
  phone text,
  personal_email text,
  present_address text,
  permanent_address text,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  bank_name text,
  account_holder_name text,
  account_number text,
  branch_code text,
  national_id_path text,
  offer_letter_path text,
  photo_path text,
  reviewed_by uuid references employees(id),
  reviewed_at timestamptz,
  correction_notes text,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index employee_onboarding_employee_id_idx on employee_onboarding (employee_id);

alter table employee_onboarding enable row level security;

-- Own row (or admin) can read.
create policy "employee_onboarding_select_self_or_admin" on employee_onboarding
  for select using (
    exists (
      select 1 from employees e
      where e.id = employee_onboarding.employee_id and e.auth_user_id = auth.uid()
    )
    or public.is_admin()
  );

-- Own row can be updated by its employee, but only while status is
-- not_started or needs_correction — once submitted or complete, the USING
-- clause (evaluated against the row's CURRENT/old state) stops matching, so
-- no further self-updates are possible until an admin sets it back to
-- needs_correction. Column-level restrictions (no self-completing, no
-- writing the review fields) are enforced by the trigger below, not here —
-- RLS's `with check` can express row ownership but not "which columns
-- changed."
create policy "employee_onboarding_update_self" on employee_onboarding
  for update using (
    exists (
      select 1 from employees e
      where e.id = employee_onboarding.employee_id and e.auth_user_id = auth.uid()
    )
    and status in ('not_started', 'needs_correction')
  ) with check (
    exists (
      select 1 from employees e
      where e.id = employee_onboarding.employee_id and e.auth_user_id = auth.uid()
    )
  );

create policy "employee_onboarding_admin_write" on employee_onboarding
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.enforce_onboarding_self_edit_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    new.updated_at = now();
    return new;
  end if;

  if new.status = 'complete' then
    raise exception 'Only an admin can mark onboarding complete';
  end if;

  if new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.correction_notes is distinct from old.correction_notes then
    raise exception 'Only an admin can set onboarding review fields';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create trigger employee_onboarding_enforce_self_edit
  before update on employee_onboarding
  for each row execute function public.enforce_onboarding_self_edit_columns();

-- Storage bucket for onboarding documents, private by default — same
-- convention as employee-documents in 0001_init.sql.
insert into storage.buckets (id, name, public) values ('onboarding-documents', 'onboarding-documents', false);

create policy "onboarding_documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'onboarding-documents'
    and (
      exists (
        select 1 from employees e
        where e.auth_user_id = auth.uid()
        and (storage.foldername(name))[1] = e.id::text
      )
      or public.is_admin()
    )
  );

-- The employee may only upload/replace their own onboarding documents while
-- their row is still editable (not_started or needs_correction) — mirrors
-- the employee_onboarding_update_self row-level restriction, applied here
-- to the storage side of the same workflow.
create policy "onboarding_documents_storage_self_insert" on storage.objects
  for insert with check (
    bucket_id = 'onboarding-documents'
    and exists (
      select 1 from employees e
      join employee_onboarding eo on eo.employee_id = e.id
      where e.auth_user_id = auth.uid()
      and (storage.foldername(name))[1] = e.id::text
      and eo.status in ('not_started', 'needs_correction')
    )
  );

create policy "onboarding_documents_storage_self_update" on storage.objects
  for update using (
    bucket_id = 'onboarding-documents'
    and exists (
      select 1 from employees e
      join employee_onboarding eo on eo.employee_id = e.id
      where e.auth_user_id = auth.uid()
      and (storage.foldername(name))[1] = e.id::text
      and eo.status in ('not_started', 'needs_correction')
    )
  ) with check (
    bucket_id = 'onboarding-documents'
    and exists (
      select 1 from employees e
      join employee_onboarding eo on eo.employee_id = e.id
      where e.auth_user_id = auth.uid()
      and (storage.foldername(name))[1] = e.id::text
      and eo.status in ('not_started', 'needs_correction')
    )
  );

create policy "onboarding_documents_storage_admin_write" on storage.objects
  for all using (
    bucket_id = 'onboarding-documents'
    and public.is_admin()
  ) with check (
    bucket_id = 'onboarding-documents'
    and public.is_admin()
  );
```

- [ ] **Step 2: Type-check**

```bash
cd portal
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add portal/supabase/migrations/0011_employee_onboarding.sql
git commit -m "Add employee_onboarding schema, RLS, and storage bucket"
```

*(Controller applies this migration live before Task 5 begins.)*

---

### Task 5: `lib/onboarding.ts` helpers

**Files:**
- Create: `portal/lib/onboarding.ts`
- Test: `portal/lib/onboarding.test.ts`

**Interfaces:**
- Consumes: `employee_onboarding` table from Task 4.
- Produces: `type OnboardingStatus`, `type EmployeeOnboarding`, `type OnboardingFieldsInput`; `getOnboarding()`, `createOnboardingRow()`, `saveOnboardingFields()`, `findMissingOnboardingFields()`, `submitOnboarding()`, `markOnboardingComplete()`, `requestOnboardingCorrection()` — consumed by Task 6 (employee creation hook), Task 8 (onboarding page/actions), and Task 9 (admin review actions).

`findMissingOnboardingFields()` is the one piece of real branching logic in this file (everything else is a thin Supabase wrapper, same reasoning as Task 2) — it gets a proper TDD cycle.

- [ ] **Step 1: Write the failing test**

`portal/lib/onboarding.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { findMissingOnboardingFields, type OnboardingFieldsInput } from './onboarding'

const COMPLETE_FIELDS: OnboardingFieldsInput = {
  dateOfBirth: '1990-01-01',
  fathersName: 'Father Name',
  mothersName: 'Mother Name',
  bloodGroup: 'O+',
  phone: '01700000000',
  personalEmail: 'person@example.com',
  presentAddress: '123 Present St',
  permanentAddress: '456 Permanent Rd',
  emergencyContactName: 'Contact Name',
  emergencyContactRelationship: 'Sibling',
  emergencyContactPhone: '01800000000',
  bankName: 'Test Bank',
  accountHolderName: 'Account Holder',
  accountNumber: '00112233',
  branchCode: 'BR001',
}

const COMPLETE_DOCS = { nationalIdPath: 'emp-1/national-id.pdf', offerLetterPath: 'emp-1/offer-letter.pdf', photoPath: 'emp-1/photo.jpg' }

describe('findMissingOnboardingFields', () => {
  it('returns an empty array when every field and document is present', () => {
    expect(findMissingOnboardingFields(COMPLETE_FIELDS, COMPLETE_DOCS)).toEqual([])
  })

  it('lists a missing text field by its key', () => {
    const fields = { ...COMPLETE_FIELDS, bloodGroup: '' }
    expect(findMissingOnboardingFields(fields, COMPLETE_DOCS)).toContain('bloodGroup')
  })

  it('lists missing documents by name', () => {
    const docs = { nationalIdPath: null, offerLetterPath: null, photoPath: COMPLETE_DOCS.photoPath }
    const missing = findMissingOnboardingFields(COMPLETE_FIELDS, docs)
    expect(missing).toContain('nationalId')
    expect(missing).toContain('offerLetter')
    expect(missing).not.toContain('photo')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
cd portal
npm test -- onboarding.test.ts
```

Expected: FAIL — `./onboarding` module doesn't exist yet.

- [ ] **Step 3: Write `lib/onboarding.ts`**

`portal/lib/onboarding.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type OnboardingStatus = 'not_started' | 'submitted' | 'needs_correction' | 'complete'

export type EmployeeOnboarding = {
  id: string
  employee_id: string
  status: OnboardingStatus
  date_of_birth: string | null
  fathers_name: string | null
  mothers_name: string | null
  blood_group: string | null
  phone: string | null
  personal_email: string | null
  present_address: string | null
  permanent_address: string | null
  emergency_contact_name: string | null
  emergency_contact_relationship: string | null
  emergency_contact_phone: string | null
  bank_name: string | null
  account_holder_name: string | null
  account_number: string | null
  branch_code: string | null
  national_id_path: string | null
  offer_letter_path: string | null
  photo_path: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  correction_notes: string | null
  submitted_at: string | null
}

const ONBOARDING_COLUMNS =
  'id, employee_id, status, date_of_birth, fathers_name, mothers_name, blood_group, phone, personal_email, present_address, permanent_address, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, bank_name, account_holder_name, account_number, branch_code, national_id_path, offer_letter_path, photo_path, reviewed_by, reviewed_at, correction_notes, submitted_at'

export async function getOnboarding(
  supabase: SupabaseClient,
  employeeId: string
): Promise<EmployeeOnboarding | null> {
  const { data } = await supabase
    .from('employee_onboarding')
    .select(ONBOARDING_COLUMNS)
    .eq('employee_id', employeeId)
    .single()
  return data
}

// Cross-employee write during employee creation — always called with an
// admin client, same as createEmployeeRecord() itself.
export async function createOnboardingRow(
  adminClient: SupabaseClient,
  employeeId: string
): Promise<{ error?: string }> {
  const { error } = await adminClient.from('employee_onboarding').insert({ employee_id: employeeId })
  return { error: error?.message }
}

export type OnboardingFieldsInput = {
  dateOfBirth?: string
  fathersName?: string
  mothersName?: string
  bloodGroup?: string
  phone?: string
  personalEmail?: string
  presentAddress?: string
  permanentAddress?: string
  emergencyContactName?: string
  emergencyContactRelationship?: string
  emergencyContactPhone?: string
  bankName?: string
  accountHolderName?: string
  accountNumber?: string
  branchCode?: string
}

export async function saveOnboardingFields(
  supabase: SupabaseClient,
  employeeId: string,
  fields: OnboardingFieldsInput
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('employee_onboarding')
    .update({
      date_of_birth: fields.dateOfBirth || null,
      fathers_name: fields.fathersName || null,
      mothers_name: fields.mothersName || null,
      blood_group: fields.bloodGroup || null,
      phone: fields.phone || null,
      personal_email: fields.personalEmail || null,
      present_address: fields.presentAddress || null,
      permanent_address: fields.permanentAddress || null,
      emergency_contact_name: fields.emergencyContactName || null,
      emergency_contact_relationship: fields.emergencyContactRelationship || null,
      emergency_contact_phone: fields.emergencyContactPhone || null,
      bank_name: fields.bankName || null,
      account_holder_name: fields.accountHolderName || null,
      account_number: fields.accountNumber || null,
      branch_code: fields.branchCode || null,
    })
    .eq('employee_id', employeeId)
  return { error: error?.message }
}

const REQUIRED_FIELD_KEYS: (keyof OnboardingFieldsInput)[] = [
  'dateOfBirth',
  'fathersName',
  'mothersName',
  'bloodGroup',
  'phone',
  'personalEmail',
  'presentAddress',
  'permanentAddress',
  'emergencyContactName',
  'emergencyContactRelationship',
  'emergencyContactPhone',
  'bankName',
  'accountHolderName',
  'accountNumber',
  'branchCode',
]

export function findMissingOnboardingFields(
  fields: OnboardingFieldsInput,
  documents: { nationalIdPath: string | null; offerLetterPath: string | null; photoPath: string | null }
): string[] {
  const missing: string[] = []
  for (const key of REQUIRED_FIELD_KEYS) {
    if (!fields[key]) missing.push(key)
  }
  if (!documents.nationalIdPath) missing.push('nationalId')
  if (!documents.offerLetterPath) missing.push('offerLetter')
  if (!documents.photoPath) missing.push('photo')
  return missing
}

export async function submitOnboarding(supabase: SupabaseClient, employeeId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('employee_onboarding')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('employee_id', employeeId)
  return { error: error?.message }
}

// Cross-employee write (admin reviewing someone else's row) — admin client.
export async function markOnboardingComplete(
  adminClient: SupabaseClient,
  employeeId: string,
  reviewerId: string
): Promise<{ error?: string }> {
  const { error } = await adminClient
    .from('employee_onboarding')
    .update({
      status: 'complete',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      correction_notes: null,
    })
    .eq('employee_id', employeeId)
  return { error: error?.message }
}

export async function requestOnboardingCorrection(
  adminClient: SupabaseClient,
  employeeId: string,
  reviewerId: string,
  note: string
): Promise<{ error?: string }> {
  const { error } = await adminClient
    .from('employee_onboarding')
    .update({
      status: 'needs_correction',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      correction_notes: note,
    })
    .eq('employee_id', employeeId)
  return { error: error?.message }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd portal
npm test -- onboarding.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add portal/lib/onboarding.ts portal/lib/onboarding.test.ts
git commit -m "Add lib/onboarding.ts helpers"
```

---

### Task 6: Hook onboarding row creation into employee creation

**Files:**
- Modify: `portal/lib/employees.ts`

**Interfaces:**
- Consumes: `createOnboardingRow()` from Task 5.
- Produces: every employee created via `createEmployeeRecord()` (admin "new employee" form, and the e2e test helper used throughout `portal/e2e/*.spec.ts`) automatically gets an `employee_onboarding` row at `not_started` — no separate step anywhere else in the app ever needs to create one.

- [ ] **Step 1: Read the current file in full**

Re-read `portal/lib/employees.ts` (shown in full in this plan's research, reproduced here for reference — confirm it hasn't changed before editing):
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { employeeIdToEmail } from './employeeAuth'

export type NewEmployeeInput = {
  employeeId: string
  password: string
  name: string
  role: 'admin' | 'manager' | 'employee'
  contactInfo?: string
  position?: string
  departmentId?: string
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
      department_id: input.departmentId ?? null,
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

- [ ] **Step 2: Update the file**

Add the import and the onboarding-row-creation step, with full rollback on failure (matching the existing rollback-on-`dbError` pattern):
```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { employeeIdToEmail } from './employeeAuth'
import { createOnboardingRow } from './onboarding'

export type NewEmployeeInput = {
  employeeId: string
  password: string
  name: string
  role: 'admin' | 'manager' | 'employee'
  contactInfo?: string
  position?: string
  departmentId?: string
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
      department_id: input.departmentId ?? null,
      join_date: input.joinDate ?? null,
      status: 'active',
    })
    .select('id')
    .single()

  if (dbError || !employeeRow) {
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    throw new Error(`Failed to create employee record: ${dbError?.message}`)
  }

  const { error: onboardingError } = await createOnboardingRow(adminClient, employeeRow.id)

  if (onboardingError) {
    await adminClient.from('employees').delete().eq('id', employeeRow.id)
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    throw new Error(`Failed to create onboarding record: ${onboardingError}`)
  }

  return { employeeRowId: employeeRow.id }
}
```

- [ ] **Step 3: Type-check**

```bash
cd portal
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add portal/lib/employees.ts
git commit -m "Create an employee_onboarding row automatically on employee creation"
```

---

### Task 7: Middleware gating on onboarding status

**Files:**
- Modify: `portal/middleware.ts`

**Interfaces:**
- Consumes: `employee_onboarding.status` (Task 4's schema), `employees.role`.
- Produces: any authenticated `employee`/`manager`-role user whose onboarding status is `not_started` or `needs_correction` is redirected to `/onboarding` from every other protected route; conversely, visiting `/onboarding` once status is `submitted` or `complete` redirects to `/dashboard` (nothing to do there).

- [ ] **Step 1: Read the current file in full**

Already reproduced in full during this plan's research — confirm `portal/middleware.ts` still matches before editing (no other task in this plan touches it, so it should be unchanged since the last commit on `main`).

- [ ] **Step 2: Update the file**

Full replacement of `portal/middleware.ts`:
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
  const isApi = path.startsWith('/api/')

  // /manager was replaced by the project-scoped /projects section — redirect
  // rather than 404 so any bookmarked links still land somewhere useful.
  if (path === '/manager') {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  if (
    !user &&
    (path.startsWith('/dashboard') ||
      path.startsWith('/admin') ||
      path.startsWith('/projects') ||
      path.startsWith('/onboarding') ||
      isApi)
  ) {
    // API callers get a status code, not an HTML login page.
    return isApi
      ? NextResponse.json({ error: 'Not authorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (path.startsWith('/admin') || isApi)) {
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (employee?.role !== 'admin' && employee?.role !== 'superadmin') {
      return isApi
        ? NextResponse.json({ error: 'Not authorized' }, { status: 403 })
        : NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (user && path.startsWith('/projects')) {
    const isTaskDetail = /^\/projects\/[^/]+\/tasks\//.test(path)
    if (!isTaskDetail) {
      const { data: employee } = await supabase
        .from('employees')
        .select('role')
        .eq('auth_user_id', user.id)
        .single()

      if (!['superadmin', 'admin', 'manager'].includes(employee?.role ?? '')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  // Onboarding gate: an employee/manager whose onboarding isn't at least
  // submitted is redirected to /onboarding from every other protected route.
  // Admin/superadmin never onboard themselves (they're the ones creating
  // other accounts), so this block only runs for /dashboard and /projects,
  // never /admin. Conversely, once onboarding is submitted or complete,
  // visiting /onboarding itself redirects away — the form isn't editable in
  // either of those states (see employee_onboarding_update_self RLS).
  if (user && (path.startsWith('/dashboard') || path.startsWith('/projects') || path.startsWith('/onboarding'))) {
    const { data: employee } = await supabase
      .from('employees')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (employee && (employee.role === 'employee' || employee.role === 'manager')) {
      const { data: onboarding } = await supabase
        .from('employee_onboarding')
        .select('status')
        .eq('employee_id', employee.id)
        .single()

      const needsOnboarding = !onboarding || onboarding.status === 'not_started' || onboarding.status === 'needs_correction'

      if (needsOnboarding && !path.startsWith('/onboarding')) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
      if (!needsOnboarding && path.startsWith('/onboarding')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

// Defence in depth only — the real authorization boundary for admin Server
// Actions and route handlers is requireAdmin() in lib/auth.ts, since actions are
// reachable by direct POST and several use the RLS-bypassing service-role key.
// '/admin/:path*' already covers /admin/employees/** and the Server Actions
// POSTed to those page URLs.
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/manager/:path*',
    '/projects/:path*',
    '/onboarding/:path*',
    '/api/employees/:path*',
  ],
}
```

- [ ] **Step 3: Type-check**

```bash
cd portal
npx tsc --noEmit
```

Expected: errors referencing `/onboarding` having no matching route yet are fine at this point — the route is created in Task 8. If `tsc` reports unrelated errors, stop and investigate before continuing.

- [ ] **Step 4: Commit**

```bash
git add portal/middleware.ts
git commit -m "Gate /dashboard and /projects on onboarding status"
```

---

### Task 8: Onboarding page — layout, page, actions, form

**Files:**
- Create: `portal/app/onboarding/layout.tsx`
- Create: `portal/app/onboarding/page.tsx`
- Create: `portal/app/onboarding/actions.ts`
- Create: `portal/app/onboarding/OnboardingForm.tsx`

**Interfaces:**
- Consumes: `getOnboarding`, `saveOnboardingFields`, `findMissingOnboardingFields`, `submitOnboarding`, `type EmployeeOnboarding`, `type OnboardingFieldsInput` (Task 5); `notifyEmployees`, `listActiveAdminIds` (Task 2); `requireEmployee`, `NOT_AUTHORIZED` (`lib/auth.ts`, already exists); `card`, `input`, `label`, `buttonPrimary`, `buttonGhost`, `errorText`, `successText` (`lib/ui.ts`, already exists).
- Produces: the `/onboarding` route the middleware (Task 7) redirects to.

- [ ] **Step 1: Write `app/onboarding/actions.ts`**

`portal/app/onboarding/actions.ts`:
```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEmployee, NOT_AUTHORIZED } from '@/lib/auth'
import {
  saveOnboardingFields,
  submitOnboarding,
  getOnboarding,
  findMissingOnboardingFields,
  type OnboardingFieldsInput,
} from '@/lib/onboarding'
import { notifyEmployees, listActiveAdminIds } from '@/lib/notifications'

export type OnboardingActionState = { error?: string; success?: string }

export async function saveOrSubmitOnboardingAction(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  let employee
  try {
    employee = await requireEmployee()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const supabase = await createClient()

  const fields: OnboardingFieldsInput = {
    dateOfBirth: String(formData.get('dateOfBirth') ?? ''),
    fathersName: String(formData.get('fathersName') ?? ''),
    mothersName: String(formData.get('mothersName') ?? ''),
    bloodGroup: String(formData.get('bloodGroup') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    personalEmail: String(formData.get('personalEmail') ?? ''),
    presentAddress: String(formData.get('presentAddress') ?? ''),
    permanentAddress: String(formData.get('permanentAddress') ?? ''),
    emergencyContactName: String(formData.get('emergencyContactName') ?? ''),
    emergencyContactRelationship: String(formData.get('emergencyContactRelationship') ?? ''),
    emergencyContactPhone: String(formData.get('emergencyContactPhone') ?? ''),
    bankName: String(formData.get('bankName') ?? ''),
    accountHolderName: String(formData.get('accountHolderName') ?? ''),
    accountNumber: String(formData.get('accountNumber') ?? ''),
    branchCode: String(formData.get('branchCode') ?? ''),
  }

  const { error: saveError } = await saveOnboardingFields(supabase, employee.id, fields)
  if (saveError) return { error: saveError }

  revalidatePath('/onboarding')

  const intent = formData.get('intent')
  if (intent !== 'submit') {
    return { success: 'Progress saved' }
  }

  const onboarding = await getOnboarding(supabase, employee.id)
  const missing = findMissingOnboardingFields(fields, {
    nationalIdPath: onboarding?.national_id_path ?? null,
    offerLetterPath: onboarding?.offer_letter_path ?? null,
    photoPath: onboarding?.photo_path ?? null,
  })

  if (missing.length > 0) {
    return { error: `Please complete: ${missing.join(', ')}` }
  }

  const { error: submitError } = await submitOnboarding(supabase, employee.id)
  if (submitError) return { error: submitError }

  const adminClient = createAdminClient()
  const adminIds = await listActiveAdminIds(adminClient)
  await notifyEmployees(adminClient, adminIds, {
    title: `New onboarding submission: ${employee.name}`,
    link: `/admin/employees/${employee.id}`,
  })

  redirect('/dashboard')
}

const UPLOAD_SLOT_FILE_NAMES = {
  national_id: 'national-id',
  offer_letter: 'offer-letter',
  photo: 'photo',
} as const

const UPLOAD_SLOT_COLUMNS = {
  national_id: 'national_id_path',
  offer_letter: 'offer_letter_path',
  photo: 'photo_path',
} as const

const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export async function uploadOnboardingDocumentAction(
  slot: keyof typeof UPLOAD_SLOT_FILE_NAMES,
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  let employee
  try {
    employee = await requireEmployee()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { error: 'Choose a file first' }
  }
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return { error: 'Only PDF, JPG, or PNG files are allowed' }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: 'File must be 5MB or smaller' }
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const filePath = `${employee.id}/${UPLOAD_SLOT_FILE_NAMES[slot]}.${ext}`

  const supabase = await createClient()

  const { error: uploadError } = await supabase.storage
    .from('onboarding-documents')
    .upload(filePath, file, { upsert: true })

  if (uploadError) return { error: uploadError.message }

  const { error: dbError } = await supabase
    .from('employee_onboarding')
    .update({ [UPLOAD_SLOT_COLUMNS[slot]]: filePath })
    .eq('employee_id', employee.id)

  if (dbError) return { error: dbError.message }

  revalidatePath('/onboarding')
  return { success: 'Uploaded' }
}
```

- [ ] **Step 2: Write `app/onboarding/OnboardingForm.tsx`**

`portal/app/onboarding/OnboardingForm.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react'
import {
  saveOrSubmitOnboardingAction,
  uploadOnboardingDocumentAction,
  type OnboardingActionState,
} from './actions'
import { card, input, label as labelClass, buttonPrimary, buttonGhost, errorText, successText } from '@/lib/ui'
import type { EmployeeOnboarding } from '@/lib/onboarding'

const initialState: OnboardingActionState = {}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

function FormMessage({ state }: { state: OnboardingActionState }) {
  if (state.error) {
    return (
      <p role="alert" className={`${errorText} mt-4`}>
        <AlertCircle size={16} strokeWidth={2} className="shrink-0" />
        {state.error}
      </p>
    )
  }
  if (state.success) {
    return (
      <p className={`${successText} mt-4`}>
        <CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />
        {state.success}
      </p>
    )
  }
  return null
}

function DocumentUpload({
  slot,
  title,
  currentUrl,
}: {
  slot: 'national_id' | 'offer_letter' | 'photo'
  title: string
  currentUrl: string | null
}) {
  const [state, action] = useActionState(uploadOnboardingDocumentAction.bind(null, slot), initialState)

  return (
    <div className="rounded-[10px] border border-border p-4">
      <p className="text-[0.8125rem] font-semibold text-ink">{title}</p>
      {currentUrl && (
        <a
          href={currentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-[0.8125rem] font-semibold text-certa-green-deep hover:underline"
        >
          View current file
        </a>
      )}
      <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
        <input
          name="file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          required
          className={`${input} max-w-xs file:mr-3 file:rounded-[6px] file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-semibold file:text-ink`}
        />
        <button type="submit" className={buttonGhost}>
          <Upload size={15} strokeWidth={2} />
          Upload
        </button>
      </form>
      <FormMessage state={state} />
    </div>
  )
}

export default function OnboardingForm({
  onboarding,
  documentUrls,
  correctionNote,
}: {
  onboarding: EmployeeOnboarding | null
  documentUrls: { nationalId: string | null; offerLetter: string | null; photo: string | null }
  correctionNote: string | null
}) {
  const [state, formAction] = useActionState(saveOrSubmitOnboardingAction, initialState)

  return (
    <div className="flex flex-col gap-6">
      {correctionNote && (
        <div className={`${card} border border-signal-coral`}>
          <p className="text-[0.8125rem] font-semibold text-signal-coral-deep">
            Your submission needs a correction
          </p>
          <p className="mt-1 text-[0.9375rem] text-ink">{correctionNote}</p>
        </div>
      )}

      <form action={formAction} className={card}>
        <h2 className="font-display text-base font-semibold text-ink">Personal details</h2>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="dateOfBirth" className={labelClass}>Date of birth</label>
            <input id="dateOfBirth" name="dateOfBirth" type="date" required defaultValue={onboarding?.date_of_birth ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="fathersName" className={labelClass}>Father&apos;s name</label>
            <input id="fathersName" name="fathersName" required defaultValue={onboarding?.fathers_name ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="mothersName" className={labelClass}>Mother&apos;s name</label>
            <input id="mothersName" name="mothersName" required defaultValue={onboarding?.mothers_name ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="bloodGroup" className={labelClass}>Blood group</label>
            <select id="bloodGroup" name="bloodGroup" required defaultValue={onboarding?.blood_group ?? ''} className={input}>
              <option value="">Select blood group</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>Phone number</label>
            <input id="phone" name="phone" required defaultValue={onboarding?.phone ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="personalEmail" className={labelClass}>Personal email</label>
            <input id="personalEmail" name="personalEmail" type="email" required defaultValue={onboarding?.personal_email ?? ''} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="presentAddress" className={labelClass}>Present address</label>
            <textarea id="presentAddress" name="presentAddress" required rows={2} defaultValue={onboarding?.present_address ?? ''} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="permanentAddress" className={labelClass}>Permanent address</label>
            <textarea id="permanentAddress" name="permanentAddress" required rows={2} defaultValue={onboarding?.permanent_address ?? ''} className={input} />
          </div>
        </div>

        <h2 className="mt-8 font-display text-base font-semibold text-ink">Emergency contact</h2>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="emergencyContactName" className={labelClass}>Contact name</label>
            <input id="emergencyContactName" name="emergencyContactName" required defaultValue={onboarding?.emergency_contact_name ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="emergencyContactRelationship" className={labelClass}>Relationship</label>
            <input id="emergencyContactRelationship" name="emergencyContactRelationship" required defaultValue={onboarding?.emergency_contact_relationship ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="emergencyContactPhone" className={labelClass}>Contact phone number</label>
            <input id="emergencyContactPhone" name="emergencyContactPhone" required defaultValue={onboarding?.emergency_contact_phone ?? ''} className={input} />
          </div>
        </div>

        <h2 className="mt-8 font-display text-base font-semibold text-ink">Bank details</h2>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="bankName" className={labelClass}>Bank name</label>
            <input id="bankName" name="bankName" required defaultValue={onboarding?.bank_name ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="accountHolderName" className={labelClass}>Account holder name</label>
            <input id="accountHolderName" name="accountHolderName" required defaultValue={onboarding?.account_holder_name ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="accountNumber" className={labelClass}>Account number</label>
            <input id="accountNumber" name="accountNumber" required defaultValue={onboarding?.account_number ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="branchCode" className={labelClass}>Branch / routing code</label>
            <input id="branchCode" name="branchCode" required defaultValue={onboarding?.branch_code ?? ''} className={input} />
          </div>
        </div>

        <FormMessage state={state} />

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" name="intent" value="save" className={buttonGhost}>
            Save progress
          </button>
          <button type="submit" name="intent" value="submit" className={buttonPrimary}>
            Submit for review
          </button>
        </div>
      </form>

      <div className={`${card} flex flex-col gap-4`}>
        <h2 className="font-display text-base font-semibold text-ink">Documents</h2>
        <DocumentUpload slot="national_id" title="National ID copy" currentUrl={documentUrls.nationalId} />
        <DocumentUpload slot="offer_letter" title="Signed offer letter" currentUrl={documentUrls.offerLetter} />
        <DocumentUpload slot="photo" title="Passport-size photo" currentUrl={documentUrls.photo} />
      </div>
    </div>
  )
}
```

Both submit buttons live inside the one `<form>` and share `formAction` (the form's own `action`); each sets `name="intent" value="save"` / `value="submit"` so `formData.get('intent')` in the Server Action tells them apart. This is plain HTML multi-submit-button behavior — deliberately not using per-button `formAction` overrides, to avoid depending on a newer React 19 form-action feature this plan hasn't otherwise exercised (see the `AGENTS.md` warning in Global Constraints).

- [ ] **Step 3: Write `app/onboarding/page.tsx`**

`portal/app/onboarding/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { getOnboarding } from '@/lib/onboarding'
import OnboardingForm from './OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('id, name')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee) redirect('/login')

  const onboarding = await getOnboarding(supabase, employee.id)

  const paths = [onboarding?.national_id_path, onboarding?.offer_letter_path, onboarding?.photo_path].filter(
    (p): p is string => Boolean(p)
  )

  const { data: signedUrls } = paths.length
    ? await supabase.storage.from('onboarding-documents').createSignedUrls(paths, 60 * 10)
    : { data: [] as { path: string; signedUrl: string }[] }

  function urlFor(path: string | null | undefined) {
    if (!path) return null
    return signedUrls?.find((s) => s.path === path)?.signedUrl ?? null
  }

  return (
    <>
      <PageHeader
        title={`Welcome, ${employee.name.split(' ')[0]}`}
        subtitle="Complete your onboarding details before continuing to the rest of the portal"
      />
      <OnboardingForm
        onboarding={onboarding}
        documentUrls={{
          nationalId: urlFor(onboarding?.national_id_path),
          offerLetter: urlFor(onboarding?.offer_letter_path),
          photo: urlFor(onboarding?.photo_path),
        }}
        correctionNote={onboarding?.correction_notes ?? null}
      />
    </>
  )
}
```

- [ ] **Step 4: Write `app/onboarding/layout.tsx`**

`portal/app/onboarding/layout.tsx` — deliberately minimal (no `Sidebar`/nav, since everything else is gated away while this page is reachable):
```tsx
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { signOutAction } from '@/app/actions'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-white">
      <header className="flex h-16 items-center justify-between border-b border-border px-6">
        <Image
          src="/brand/certa-lockup.png"
          alt="CERTA& Advisory"
          width={140}
          height={44}
          priority
          className="h-7 w-auto"
        />
        <form action={signOutAction}>
          <button type="submit" className="text-[0.8125rem] font-semibold text-ink-muted hover:text-ink">
            Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-10">{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run lint
```

Manual check: `npm run dev`. Using the SQL Editor, create a fresh employee via the admin "new employee" form (so Task 6's hook creates its `employee_onboarding` row), sign in as that employee — confirm you land on `/onboarding` regardless of which URL you try (`/dashboard`, `/projects`). Fill in a few fields, click "Save progress," confirm the success message and that reloading the page keeps the saved values. Click "Submit for review" with fields still missing — confirm the error message lists what's missing. Upload all three documents, fill every field, click "Submit for review" — confirm redirect to `/dashboard`, and that `/dashboard` now loads instead of bouncing back to `/onboarding`. Confirm the seed admin now has an unread notification (bell badge) linking to that employee's admin page.

- [ ] **Step 6: Commit**

```bash
git add portal/app/onboarding
git commit -m "Add employee-facing onboarding form and gating flow"
```

---

### Task 9: Admin review UI

**Files:**
- Modify: `portal/app/api/employees/[id]/route.ts` (return onboarding data + signed document URLs)
- Modify: `portal/app/admin/employees/[id]/actions.ts` (add `markOnboardingCompleteAction`, `requestOnboardingCorrectionAction`)
- Modify: `portal/app/admin/employees/[id]/EditEmployeeClient.tsx` (add an "Onboarding" card section)

**Interfaces:**
- Consumes: `markOnboardingComplete`, `requestOnboardingCorrection`, `type EmployeeOnboarding` (Task 5); `notifyEmployees` (Task 2).
- Produces: nothing further consumed elsewhere in this plan — this is the last functional piece before RLS tests.

This plan renders the admin's onboarding review as another stacked `card` section on the existing single-page employee-edit screen (matching how Profile/Documents/Reset password/Archive are already laid out), not as a separate tab — this codebase has no tab component anywhere, and introducing one for a single section would be new UI infrastructure for no real benefit over the existing stacked-card convention.

- [ ] **Step 1: Extend the API route**

`portal/app/api/employees/[id]/route.ts` — add the import and the onboarding fetch/signed-URL block, and include both in the JSON response:
```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { listDepartments } from '@/lib/departments'
import { getOnboarding } from '@/lib/onboarding'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only the admin edit page consumes this route — the employee dashboard
  // queries Supabase directly — so admin-only is the correct scope here.
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: NOT_AUTHORIZED }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { data: employee } = await supabase.from('employees').select('*').eq('id', id).single()
  const { data: documents } = await supabase
    .from('employee_documents')
    .select('*')
    .eq('employee_id', id)

  const departments = await listDepartments(supabase)

  const onboarding = await getOnboarding(supabase, id)
  const onboardingPaths = [onboarding?.national_id_path, onboarding?.offer_letter_path, onboarding?.photo_path].filter(
    (p): p is string => Boolean(p)
  )
  const { data: onboardingSignedUrls } = onboardingPaths.length
    ? await supabase.storage.from('onboarding-documents').createSignedUrls(onboardingPaths, 60 * 10)
    : { data: [] as { path: string; signedUrl: string }[] }

  function onboardingUrlFor(path: string | null | undefined) {
    if (!path) return null
    return onboardingSignedUrls?.find((s) => s.path === path)?.signedUrl ?? null
  }

  return NextResponse.json({
    employee,
    documents: documents ?? [],
    departments,
    onboarding,
    onboardingDocumentUrls: {
      nationalId: onboardingUrlFor(onboarding?.national_id_path),
      offerLetter: onboardingUrlFor(onboarding?.offer_letter_path),
      photo: onboardingUrlFor(onboarding?.photo_path),
    },
  })
}
```

- [ ] **Step 2: Add the two review actions**

In `portal/app/admin/employees/[id]/actions.ts`, add the imports and the two new exports (after the existing `archiveEmployeeAction`, everything else in the file is unchanged):
```ts
import { markOnboardingComplete, requestOnboardingCorrection } from '@/lib/onboarding'
import { notifyEmployees } from '@/lib/notifications'
```
```ts
export async function markOnboardingCompleteAction(
  employeeRowId: string,
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  let reviewer
  try {
    reviewer = await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const adminClient = createAdminClient()
  const { error } = await markOnboardingComplete(adminClient, employeeRowId, reviewer.id)
  if (error) return { error }

  revalidatePath(`/admin/employees/${employeeRowId}`)
  return { success: 'Onboarding marked complete' }
}

export async function requestOnboardingCorrectionAction(
  employeeRowId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let reviewer
  try {
    reviewer = await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const note = String(formData.get('correctionNote') ?? '').trim()
  if (!note) {
    return { error: 'Explain what needs to be corrected' }
  }

  const adminClient = createAdminClient()
  const { error } = await requestOnboardingCorrection(adminClient, employeeRowId, reviewer.id, note)
  if (error) return { error }

  await notifyEmployees(adminClient, [employeeRowId], {
    title: 'Your onboarding needs a correction',
    link: '/onboarding',
  })

  revalidatePath(`/admin/employees/${employeeRowId}`)
  return { success: 'Correction requested' }
}
```

- [ ] **Step 3: Add the Onboarding card to `EditEmployeeClient.tsx`**

Add the imports:
```ts
import {
  updateEmployeeAction,
  uploadDocumentAction,
  resetPasswordAction,
  archiveEmployeeAction,
  markOnboardingCompleteAction,
  requestOnboardingCorrectionAction,
  type ActionState,
} from './actions'
```
Add an `Onboarding` type and extend the fetched-state shape:
```ts
type Onboarding = {
  status: 'not_started' | 'submitted' | 'needs_correction' | 'complete'
  date_of_birth: string | null
  fathers_name: string | null
  mothers_name: string | null
  blood_group: string | null
  phone: string | null
  personal_email: string | null
  present_address: string | null
  permanent_address: string | null
  emergency_contact_name: string | null
  emergency_contact_relationship: string | null
  emergency_contact_phone: string | null
  bank_name: string | null
  account_holder_name: string | null
  account_number: string | null
  branch_code: string | null
  correction_notes: string | null
}
```
In the component, add state and wire the fetch (`onboarding`/`onboardingDocumentUrls` are already in the API response from Step 1):
```tsx
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null)
  const [onboardingDocumentUrls, setOnboardingDocumentUrls] = useState<{
    nationalId: string | null
    offerLetter: string | null
    photo: string | null
  }>({ nationalId: null, offerLetter: null, photo: null })
```
In the existing `useEffect`'s `.then((data) => { ... })` callback, add:
```tsx
        setOnboarding(data.onboarding)
        setOnboardingDocumentUrls(data.onboardingDocumentUrls)
```
Add the two new `useActionState` hooks alongside the existing four:
```tsx
  const [completeState, completeAction] = useActionState(
    markOnboardingCompleteAction.bind(null, id),
    initialState
  )
  const [correctionState, correctionAction] = useActionState(
    requestOnboardingCorrectionAction.bind(null, id),
    initialState
  )
```
Add a new card section, placed after the existing "Documents" card and before "Reset password":
```tsx
        <div className={`${card} max-w-2xl`}>
          <h2 className="font-display text-base font-semibold text-ink">Onboarding</h2>

          {!onboarding || onboarding.status === 'not_started' ? (
            <p className="mt-4 text-[0.9375rem] text-ink-muted">Not yet submitted.</p>
          ) : (
            <>
              <p className="mt-1 text-[0.8125rem] font-semibold uppercase tracking-[0.04em] text-ink-muted">
                Status: {onboarding.status.replace('_', ' ')}
              </p>

              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                {[
                  { label: 'Date of birth', value: onboarding.date_of_birth },
                  { label: "Father's name", value: onboarding.fathers_name },
                  { label: "Mother's name", value: onboarding.mothers_name },
                  { label: 'Blood group', value: onboarding.blood_group },
                  { label: 'Phone', value: onboarding.phone },
                  { label: 'Personal email', value: onboarding.personal_email },
                  { label: 'Present address', value: onboarding.present_address },
                  { label: 'Permanent address', value: onboarding.permanent_address },
                  { label: 'Emergency contact', value: onboarding.emergency_contact_name },
                  { label: 'Relationship', value: onboarding.emergency_contact_relationship },
                  { label: 'Emergency phone', value: onboarding.emergency_contact_phone },
                  { label: 'Bank name', value: onboarding.bank_name },
                  { label: 'Account holder', value: onboarding.account_holder_name },
                  { label: 'Account number', value: onboarding.account_number },
                  { label: 'Branch / routing code', value: onboarding.branch_code },
                ].map((field) => (
                  <div key={field.label}>
                    <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                      {field.label}
                    </dt>
                    <dd className="mt-1 text-[0.9375rem] text-ink">{field.value ?? '—'}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex flex-wrap gap-4">
                {onboardingDocumentUrls.nationalId && (
                  <a href={onboardingDocumentUrls.nationalId} target="_blank" rel="noreferrer" className="text-[0.8125rem] font-semibold text-certa-green-deep hover:underline">
                    National ID copy
                  </a>
                )}
                {onboardingDocumentUrls.offerLetter && (
                  <a href={onboardingDocumentUrls.offerLetter} target="_blank" rel="noreferrer" className="text-[0.8125rem] font-semibold text-certa-green-deep hover:underline">
                    Signed offer letter
                  </a>
                )}
                {onboardingDocumentUrls.photo && (
                  <a href={onboardingDocumentUrls.photo} target="_blank" rel="noreferrer" className="text-[0.8125rem] font-semibold text-certa-green-deep hover:underline">
                    Photo
                  </a>
                )}
              </div>

              {onboarding.status === 'submitted' && (
                <div className="mt-6 flex flex-col gap-4 border-t border-border pt-5 sm:max-w-sm">
                  <form action={completeAction}>
                    <FormMessage state={completeState} />
                    <button type="submit" className={`${buttonPrimary} mt-2`}>
                      Mark complete
                    </button>
                  </form>

                  <form action={correctionAction} className="flex flex-col gap-3">
                    <label htmlFor="correctionNote" className={labelClass}>
                      Request a correction
                    </label>
                    <textarea id="correctionNote" name="correctionNote" required rows={2} className={input} />
                    <FormMessage state={correctionState} />
                    <button type="submit" className={`${buttonCoral} w-fit`}>
                      Send back for correction
                    </button>
                  </form>
                </div>
              )}

              {onboarding.status === 'complete' && (
                <p className="mt-4 text-[0.8125rem] font-medium text-certa-green-deep">
                  Reviewed and marked complete.
                </p>
              )}
            </>
          )}
        </div>
```

- [ ] **Step 4: Type-check and manually verify**

```bash
cd portal
npx tsc --noEmit
npm run lint
```

Manual check: as admin, open the just-onboarded employee's edit page from Task 8's manual test — confirm the Onboarding card shows every field and both document links. Click "Send back for correction" with a note — confirm the employee, on next login, is redirected back to `/onboarding` with that note shown and has a new unread notification. Resubmit as that employee, then as admin click "Mark complete" — confirm the status updates and the correction UI disappears.

- [ ] **Step 5: Commit**

```bash
git add portal/app/api/employees/[id]/route.ts portal/app/admin/employees/[id]/actions.ts portal/app/admin/employees/[id]/EditEmployeeClient.tsx
git commit -m "Add admin onboarding review UI"
```

---

### Task 10: RLS isolation tests + gating redirect test

**Files:**
- Create: `portal/e2e/onboarding-isolation.spec.ts`
- Modify: `portal/e2e/route-protection.spec.ts` (add the gating redirect test — this file already holds the "visiting a protected route redirects you" style of test via real `page.goto()` navigation, which is what the middleware's onboarding gate needs; `onboarding-isolation.spec.ts` is for the RLS-via-direct-client style instead, matching `phase3-projects-isolation.spec.ts`'s precedent)

**Interfaces:**
- Consumes: everything from Tasks 1–9.

- [ ] **Step 1: Add the gating redirect test to `route-protection.spec.ts`**

Append to `portal/e2e/route-protection.spec.ts` (add the import at the top alongside the existing `@playwright/test` import):
```ts
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'
```
```ts
test('a not-yet-onboarded employee is redirected to /onboarding from /dashboard', async ({ page }) => {
  const adminClient = createAdminClient()
  const employeeId = `gate-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId,
    password: 'password-gate-123',
    name: 'Gate Test Employee',
    role: 'employee',
  })

  await page.goto('/login')
  await page.getByLabel('Employee ID').fill(employeeId)
  await page.getByLabel('Password').fill('password-gate-123')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/onboarding/)

  // Trying to force-navigate elsewhere still bounces back.
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/onboarding/)
})
```

- [ ] **Step 2: Write the RLS isolation tests**

`portal/e2e/onboarding-isolation.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'
import { employeeIdToEmail } from '../lib/employeeAuth'

test('an employee cannot read or write another employee\'s onboarding row', async () => {
  const adminClient = createAdminClient()

  const ownerId = `ob-owner-${Date.now()}`
  const { employeeRowId: ownerRowId } = await createEmployeeRecord(adminClient, {
    employeeId: ownerId,
    password: 'password-owner-123',
    name: 'Onboarding Owner',
    role: 'employee',
  })

  const outsiderId = `ob-outsider-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId: outsiderId,
    password: 'password-outsider-123',
    name: 'Onboarding Outsider',
    role: 'employee',
  })

  const outsiderClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await outsiderClient.auth.signInWithPassword({ email: employeeIdToEmail(outsiderId), password: 'password-outsider-123' })

  const { data: visibleRows } = await outsiderClient
    .from('employee_onboarding')
    .select('*')
    .eq('employee_id', ownerRowId)
  expect(visibleRows).toHaveLength(0)

  const { error: writeError } = await outsiderClient
    .from('employee_onboarding')
    .update({ phone: 'should-fail' })
    .eq('employee_id', ownerRowId)
  // RLS silently filters rows the caller can't see rather than raising —
  // the correctness signal is that the row is unchanged, checked next.
  expect(writeError).toBeNull()

  const { data: unchanged } = await adminClient
    .from('employee_onboarding')
    .select('phone')
    .eq('employee_id', ownerRowId)
    .single()
  expect(unchanged?.phone).toBeNull()
})

test('an employee cannot self-complete onboarding or set review fields', async () => {
  const adminClient = createAdminClient()

  const selfId = `ob-self-${Date.now()}`
  const { employeeRowId: selfRowId } = await createEmployeeRecord(adminClient, {
    employeeId: selfId,
    password: 'password-self-123',
    name: 'Self Completer',
    role: 'employee',
  })

  const selfClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await selfClient.auth.signInWithPassword({ email: employeeIdToEmail(selfId), password: 'password-self-123' })

  const { error: completeError } = await selfClient
    .from('employee_onboarding')
    .update({ status: 'complete' })
    .eq('employee_id', selfRowId)
  expect(completeError).not.toBeNull()

  const { error: reviewFieldError } = await selfClient
    .from('employee_onboarding')
    .update({ correction_notes: 'self-authored, should fail' })
    .eq('employee_id', selfRowId)
  expect(reviewFieldError).not.toBeNull()
})

test('a manager has no elevated access to another employee\'s onboarding row', async () => {
  const adminClient = createAdminClient()

  const managerId = `ob-mgr-${Date.now()}`
  const { employeeRowId: managerRowId } = await createEmployeeRecord(adminClient, {
    employeeId: managerId,
    password: 'password-mgr-123',
    name: 'Onboarding Manager',
    role: 'manager',
  })

  const staffId = `ob-staff-${Date.now()}`
  const { employeeRowId: staffRowId } = await createEmployeeRecord(adminClient, {
    employeeId: staffId,
    password: 'password-staff-123',
    name: 'Onboarding Staff',
    role: 'employee',
  })

  const managerClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await managerClient.auth.signInWithPassword({ email: employeeIdToEmail(managerId), password: 'password-mgr-123' })

  const { data: visibleRows } = await managerClient
    .from('employee_onboarding')
    .select('*')
    .eq('employee_id', staffRowId)
  expect(visibleRows).toHaveLength(0)

  // Sanity check: the manager's OWN row is visible (own-row access still
  // works for a manager, only cross-employee access is denied).
  const { data: ownRow } = await managerClient
    .from('employee_onboarding')
    .select('status')
    .eq('employee_id', managerRowId)
    .single()
  expect(ownRow?.status).toBe('not_started')
})

test('an employee cannot read, mark-read, or create a notification belonging to another employee', async () => {
  const adminClient = createAdminClient()

  const senderId = `notif-sender-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId: senderId,
    password: 'password-sender-123',
    name: 'Notification Sender',
    role: 'employee',
  })

  const targetId = `notif-target-${Date.now()}`
  const { employeeRowId: targetRowId } = await createEmployeeRecord(adminClient, {
    employeeId: targetId,
    password: 'password-target-123',
    name: 'Notification Target',
    role: 'employee',
  })

  const { data: targetNotification } = await adminClient
    .from('notifications')
    .insert({ recipient_id: targetRowId, title: 'For target only' })
    .select('id')
    .single()

  const senderClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await senderClient.auth.signInWithPassword({ email: employeeIdToEmail(senderId), password: 'password-sender-123' })

  // Cannot read it.
  const { data: visibleToSender } = await senderClient
    .from('notifications')
    .select('id')
    .eq('id', targetNotification!.id)
  expect(visibleToSender).toHaveLength(0)

  // Cannot mark it read.
  await senderClient
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', targetNotification!.id)
  const { data: stillUnread } = await adminClient
    .from('notifications')
    .select('read_at')
    .eq('id', targetNotification!.id)
    .single()
  expect(stillUnread?.read_at).toBeNull()

  // Cannot create a new one for someone else.
  const { error: insertError } = await senderClient
    .from('notifications')
    .insert({ recipient_id: targetRowId, title: 'Should fail' })
  expect(insertError).not.toBeNull()
})
```

- [ ] **Step 3: Run the new tests**

```bash
cd portal
npm run test:e2e -- onboarding-isolation.spec.ts route-protection.spec.ts
```

Expected: all 4 RLS tests plus the 3 route-protection tests (2 pre-existing + the new gating one) PASS against the live schema from Tasks 1–9.

- [ ] **Step 4: Full verification pass**

```bash
cd portal
npx tsc --noEmit
npm run lint
npm test
npm run test:e2e
```

Expected: everything passes, including the pre-existing suites (`phase3-projects-isolation.spec.ts`, `admin-create-employee.spec.ts`, etc.) — confirms nothing in Tasks 1–9 regressed prior behavior (in particular, `admin-create-employee.spec.ts` now implicitly exercises Task 6's onboarding-row-creation hook on every run).

- [ ] **Step 5: Commit**

```bash
git add portal/e2e/onboarding-isolation.spec.ts portal/e2e/route-protection.spec.ts
git commit -m "Add RLS isolation tests and onboarding gating redirect test"
```
