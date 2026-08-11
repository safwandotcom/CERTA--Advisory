# Attendance, Leave & Salary Deduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build daily clock in/out, leave requests with per-employee quotas, and a read-only computed salary-deduction estimate in the `portal/` employee management system, per `docs/superpowers/specs/2026-08-05-attendance-leave-salary-deduction-design.md`.

**Architecture:** Follows the existing Onboarding/Notification Center pattern exactly: one Supabase migration per task (RLS-protected tables, `public.is_admin()` reused for admin policies), pure calculation logic in colocated-tested `lib/*.ts` files (vitest), Server Actions in `app/**/actions.ts` guarded by `lib/auth.ts`'s `requireAdmin()`/`requireEmployee()`, cross-employee writes via `createAdminClient()`, and RLS/cross-employee isolation verified by Playwright specs in `e2e/`.

**Tech Stack:** Next.js 16 (App Router — **this is not the Next.js you know; read `portal/node_modules/next/dist/docs/` for any API you're not 100% sure of before writing route/action code, per `portal/AGENTS.md`**), React 19, TypeScript strict, Tailwind CSS v4 (styling via `lib/ui.ts`'s shared class strings — `input`, `label`, `card`, `buttonPrimary`, `buttonCoral`, `buttonGhost`, `statusPillClass()`, `rolePillClass()`, `errorText`, `successText` — no shadcn/ui, no new UI library), `lucide-react` icons, Supabase (Postgres + RLS + Storage), Vitest for pure-logic unit tests, Playwright for e2e/RLS isolation tests.

## Global Constraints

- **Work from `portal/`** — this is a separate Next.js app inside the repo (`E:\CERTA ADVISORY\portal`), not the marketing site at the repo root. All file paths below are relative to `portal/` unless stated otherwise.
- **No manager-level authority.** Per the spec: "Departments are informational-only... there is no 'employee's manager' concept... This spec deliberately does not reintroduce one." A `manager`-role account gets identical rights to `employee` for their own data — never add manager-specific branches to any policy or guard in this plan.
- **No payroll processing, no tax withholding, no payslips, no lateness tracking, no multiple clock sessions per day, no mobile-specific handling, no automated leave carry-over** — all explicitly out of scope per the spec's "Non-goals for this phase."
- **`company_holidays` does not exist yet** in this codebase (verified by exploration — the spec's claim that it's "already being built" doesn't match current state). Task 1 creates it from scratch.
- **Migrations are sequential, 4-digit zero-padded, in `supabase/migrations/`.** The last one in the repo is `0014_backfill_employee_onboarding.sql`. This plan's migrations start at `0015` and increment one per task that needs one.
- **RLS is the real authorization boundary; Server Action guards are defense-in-depth.** Every new table gets `enable row level security` plus explicit policies, reusing `public.is_admin()` (already defined) for admin-write policies. Every admin-only Server Action still calls `requireAdmin()` from `lib/auth.ts` first — never rely on RLS alone to stop an admin-triggered cross-employee mutation, since `createAdminClient()` (service-role) bypasses RLS entirely by design and is only safe because the app-layer guard runs first.
- **RLS silently filters rather than raising.** Every Server Action that performs an UPDATE/INSERT expected to be blocked by RLS for the wrong caller must check `.select('id')` result length (`if (!data || data.length === 0) return { error: ... }`), matching the existing pattern in `app/onboarding/actions.ts:150-151` — a denied write returns `{ error: null, data: [] }`, not a thrown error.
- **Server Action shape:** `'use server'` file, `export async function actionName(_prevState: ActionState, formData: FormData): Promise<ActionState>` where `type ActionState = { error?: string; success?: string }`, matching `app/onboarding/actions.ts`. Guard first (`try { employee = await requireX() } catch { return { error: NOT_AUTHORIZED } }`), then act, then `revalidatePath(...)`.
- **No test framework changes.** Reuse the existing `vitest.config.ts` and `playwright.config.ts` as-is — do not add new config, new test runners, or new dependencies.
- **All money values are numeric (BDT), no currency formatting library** — format with a plain `Intl.NumberFormat` call inline where displayed, matching how `employees.monthly_salary` is specified as "numeric" with no separate formatting infra mentioned anywhere else in the codebase.

---

## Task 1: Company settings & holidays (foundation for working-day math)

**Files:**
- Create: `supabase/migrations/0015_company_settings_and_holidays.sql`
- Create: `lib/companySettings.ts`
- Create: `lib/companySettings.test.ts`
- Create: `app/admin/settings/page.tsx`
- Create: `app/admin/settings/actions.ts`
- Modify: `components/Sidebar.tsx` (add an admin-only "Settings" nav link)

**Interfaces:**
- Produces: `parseWeeklyOffDays(value: string): number[]` (0=Sunday..6=Saturday, JS `Date.getDay()` convention), `isWorkingDay(date: Date, weeklyOffDays: number[], holidayDates: Set<string>): boolean`, `getCompanySetting(supabase, key): Promise<string | null>`, `listCompanyHolidays(supabase, yearOrRange?): Promise<{id:string;date:string;name:string}[]>` — all consumed by Task 2 (attendance), Task 4 (leave), and Task 8 (salary deduction).

- [ ] **Step 1: Write the migration**

```sql
create table company_settings (
  key text primary key,
  value text not null
);

insert into company_settings (key, value) values ('weekly_off_days', 'sat,sun');

alter table company_settings enable row level security;

create policy "company_settings_select_all" on company_settings
  for select using (true);

create policy "company_settings_admin_write" on company_settings
  for all using (public.is_admin()) with check (public.is_admin());

create table company_holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null
);

alter table company_holidays enable row level security;

create policy "company_holidays_select_all" on company_holidays
  for select using (true);

create policy "company_holidays_admin_write" on company_holidays
  for all using (public.is_admin()) with check (public.is_admin());
```

Both tables are readable by any authenticated employee (weekly off-days and holidays are non-sensitive, needed by every employee's own attendance/leave views) and writable only by admins.

- [ ] **Step 2: Write the failing tests for the pure date-math helpers**

```typescript
// lib/companySettings.test.ts
import { describe, it, expect } from 'vitest'
import { parseWeeklyOffDays, isWorkingDay } from './companySettings'

describe('parseWeeklyOffDays', () => {
  it('parses comma-separated weekday abbreviations into JS getDay() numbers', () => {
    expect(parseWeeklyOffDays('sat,sun')).toEqual([6, 0])
  })

  it('handles whitespace and mixed case', () => {
    expect(parseWeeklyOffDays(' Fri , Sat ')).toEqual([5, 6])
  })

  it('returns an empty array for an empty string', () => {
    expect(parseWeeklyOffDays('')).toEqual([])
  })
})

describe('isWorkingDay', () => {
  const holidays = new Set(['2026-12-16'])

  it('returns false for a weekly off-day', () => {
    // 2026-08-15 is a Saturday
    expect(isWorkingDay(new Date('2026-08-15'), [6, 0], holidays)).toBe(false)
  })

  it('returns false for a holiday even if not a weekly off-day', () => {
    // 2026-12-16 is a Wednesday
    expect(isWorkingDay(new Date('2026-12-16'), [6, 0], holidays)).toBe(false)
  })

  it('returns true for an ordinary weekday with no holiday', () => {
    // 2026-08-12 is a Wednesday
    expect(isWorkingDay(new Date('2026-08-12'), [6, 0], holidays)).toBe(true)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd portal && npx vitest run lib/companySettings.test.ts`
Expected: FAIL — `lib/companySettings.ts` does not exist yet.

- [ ] **Step 4: Implement `lib/companySettings.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

const WEEKDAY_ABBREVIATIONS: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

export function parseWeeklyOffDays(value: string): number[] {
  if (!value.trim()) return []
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part in WEEKDAY_ABBREVIATIONS)
    .map((part) => WEEKDAY_ABBREVIATIONS[part])
}

// Formats a Date as a local (not UTC) YYYY-MM-DD string — Postgres `date`
// columns and this app's date-range math are both calendar-day-oriented,
// so using toISOString() (UTC) here would shift dates near midnight.
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isWorkingDay(date: Date, weeklyOffDays: number[], holidayDates: Set<string>): boolean {
  if (weeklyOffDays.includes(date.getDay())) return false
  if (holidayDates.has(toDateKey(date))) return false
  return true
}

export type CompanyHoliday = { id: string; date: string; name: string }

export async function getCompanySetting(supabase: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await supabase.from('company_settings').select('value').eq('key', key).maybeSingle()
  return data?.value ?? null
}

export async function setCompanySetting(
  supabase: SupabaseClient,
  key: string,
  value: string
): Promise<{ error?: string }> {
  const { error } = await supabase.from('company_settings').upsert({ key, value })
  return { error: error?.message }
}

export async function listCompanyHolidays(supabase: SupabaseClient): Promise<CompanyHoliday[]> {
  const { data } = await supabase.from('company_holidays').select('id, date, name').order('date', { ascending: true })
  return data ?? []
}

export async function addCompanyHoliday(
  supabase: SupabaseClient,
  input: { date: string; name: string }
): Promise<{ error?: string }> {
  const { error } = await supabase.from('company_holidays').insert(input)
  return { error: error?.message }
}

export async function deleteCompanyHoliday(supabase: SupabaseClient, id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('company_holidays').delete().eq('id', id)
  return { error: error?.message }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd portal && npx vitest run lib/companySettings.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 6: Admin settings page — weekly off-days + holiday calendar management**

`app/admin/settings/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { setCompanySetting, addCompanyHoliday, deleteCompanyHoliday } from '@/lib/companySettings'

export type SettingsActionState = { error?: string; success?: string }

export async function updateWeeklyOffDaysAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const supabase = await createClient()
  const value = String(formData.get('weeklyOffDays') ?? '')
  const { error } = await setCompanySetting(supabase, 'weekly_off_days', value)
  if (error) return { error }
  revalidatePath('/admin/settings')
  return { success: 'Weekly off-days updated' }
}

export async function addHolidayAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const supabase = await createClient()
  const date = String(formData.get('date') ?? '')
  const name = String(formData.get('name') ?? '')
  if (!date || !name) return { error: 'Date and name are required' }
  const { error } = await addCompanyHoliday(supabase, { date, name })
  if (error) return { error }
  revalidatePath('/admin/settings')
  return { success: 'Holiday added' }
}

export async function deleteHolidayAction(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')
  const { error } = await deleteCompanyHoliday(supabase, id)
  if (error) return { error }
  revalidatePath('/admin/settings')
  return { success: 'Holiday removed' }
}
```

`app/admin/settings/page.tsx`: a Server Component that loads `getCompanySetting(supabase, 'weekly_off_days')` and `listCompanyHolidays(supabase)`, and renders: (1) a form with a text input (pre-filled, e.g. `sat,sun`) bound to `updateWeeklyOffDaysAction` via `useActionState`/a client wrapper — mirror the exact client-form-around-server-action wiring used in `app/onboarding/OnboardingForm.tsx` (read that file for the current Next.js version's correct `useActionState` import path and usage before writing this), styled with `lib/ui.ts`'s `input`/`label`/`buttonPrimary`/`errorText`/`successText`; (2) a table of holidays (date, name, delete button posting `deleteHolidayAction` with the row's `id`) below an "add holiday" form (date input + name input, `addHolidayAction`), styled with `card`.

- [ ] **Step 7: Add the admin nav link**

In `components/Sidebar.tsx`, add a "Settings" link (any reasonable `lucide-react` icon, e.g. `Settings`) to the admin-only section of the nav, pointing at `/admin/settings` — follow the exact structure of the existing admin-only links in that file (read it first to match the array/conditional-rendering pattern already there).

- [ ] **Step 8: Manual verification**

Run `cd portal && npm run dev`, sign in as an admin (or `npm run seed:admin` first if no admin exists locally), visit `/admin/settings`.

Pass criteria:
- Weekly off-days field shows `sat,sun`, can be edited and saved.
- Holidays can be added and deleted.
- Visiting `/admin/settings` while signed in as a non-admin employee redirects away (per the existing `middleware.ts` admin-prefix gate) — no code change needed here since `/admin/**` is already gated, just confirm it holds for this new route.

- [ ] **Step 9: Commit**

```bash
cd portal
git add supabase/migrations/0015_company_settings_and_holidays.sql lib/companySettings.ts lib/companySettings.test.ts app/admin/settings/ components/Sidebar.tsx
git commit -m "Add company settings (weekly off-days) and holiday calendar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Attendance — clock in/out

**Files:**
- Create: `supabase/migrations/0016_attendance.sql`
- Create: `lib/attendance.ts`
- Create: `lib/attendance.test.ts`
- Create: `app/dashboard/attendance/actions.ts`
- Create: `app/dashboard/attendance/ClockControl.tsx` (client component)
- Modify: `app/dashboard/page.tsx` (embed `ClockControl`)

**Interfaces:**
- Consumes: `toDateKey` (Task 1).
- Produces: `getTodayAttendance(supabase, employeeId): Promise<{clock_in_at: string; clock_out_at: string | null} | null>`, `clockIn`/`clockOut` Server Actions, `listAttendanceInRange(supabase, employeeId, startDate, endDate): Promise<AttendanceRecord[]>` (consumed by Task 6's timesheet and Task 8's deduction calc).

- [ ] **Step 1: Write the migration**

```sql
create table attendance_records (
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  primary key (employee_id, date)
);

create index attendance_records_date_idx on attendance_records (date);

alter table attendance_records enable row level security;

create policy "attendance_select_self_or_admin" on attendance_records
  for select using (
    exists (select 1 from employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
    or public.is_admin()
  );

-- Self-insert only for today's own row; clock-out is a self-update of the
-- same row. No delete policy for anyone but admin — a mistaken clock-in
-- is corrected via clock-out or an admin fix, not deletion by the employee.
create policy "attendance_insert_self" on attendance_records
  for insert with check (
    exists (select 1 from employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
  );

create policy "attendance_update_self" on attendance_records
  for update using (
    exists (select 1 from employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
  ) with check (
    exists (select 1 from employees e where e.id = attendance_records.employee_id and e.auth_user_id = auth.uid())
  );

create policy "attendance_admin_write" on attendance_records
  for all using (public.is_admin()) with check (public.is_admin());
```

The `primary key (employee_id, date)` is what makes "one session per day, no duplicate rows" a database-level guarantee — a second clock-in attempt for the same day fails on the PK constraint, not just app-layer logic.

- [ ] **Step 2: Write the failing tests**

```typescript
// lib/attendance.test.ts
import { describe, it, expect } from 'vitest'
import { computeUnexplainedAbsenceDates } from './attendance'

describe('computeUnexplainedAbsenceDates', () => {
  it('flags a working day with no attendance row and no approved leave as unexplained absence', () => {
    const result = computeUnexplainedAbsenceDates({
      workingDays: ['2026-08-10', '2026-08-11', '2026-08-12'],
      attendedDates: new Set(['2026-08-10']),
      leaveCoveredDates: new Set(['2026-08-12']),
    })
    expect(result).toEqual(['2026-08-11'])
  })

  it('returns an empty array when every working day is covered', () => {
    const result = computeUnexplainedAbsenceDates({
      workingDays: ['2026-08-10', '2026-08-11'],
      attendedDates: new Set(['2026-08-10']),
      leaveCoveredDates: new Set(['2026-08-11']),
    })
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd portal && npx vitest run lib/attendance.test.ts`
Expected: FAIL — `lib/attendance.ts` does not exist yet.

- [ ] **Step 4: Implement `lib/attendance.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { toDateKey } from './companySettings'

export type AttendanceRecord = {
  employee_id: string
  date: string
  clock_in_at: string
  clock_out_at: string | null
}

export async function getTodayAttendance(
  supabase: SupabaseClient,
  employeeId: string
): Promise<AttendanceRecord | null> {
  const today = toDateKey(new Date())
  const { data } = await supabase
    .from('attendance_records')
    .select('employee_id, date, clock_in_at, clock_out_at')
    .eq('employee_id', employeeId)
    .eq('date', today)
    .maybeSingle()
  return data
}

export async function clockIn(supabase: SupabaseClient, employeeId: string): Promise<{ error?: string }> {
  const today = toDateKey(new Date())
  const { error } = await supabase.from('attendance_records').insert({
    employee_id: employeeId,
    date: today,
    clock_in_at: new Date().toISOString(),
  })
  // Postgres unique_violation on the (employee_id, date) primary key.
  if (error?.code === '23505') return { error: 'Already clocked in today' }
  return { error: error?.message }
}

export async function clockOut(supabase: SupabaseClient, employeeId: string): Promise<{ error?: string }> {
  const today = toDateKey(new Date())
  const { data, error } = await supabase
    .from('attendance_records')
    .update({ clock_out_at: new Date().toISOString() })
    .eq('employee_id', employeeId)
    .eq('date', today)
    .select('employee_id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Clock in first' }
  return {}
}

export async function listAttendanceInRange(
  supabase: SupabaseClient,
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<AttendanceRecord[]> {
  const { data } = await supabase
    .from('attendance_records')
    .select('employee_id, date, clock_in_at, clock_out_at')
    .eq('employee_id', employeeId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
  return data ?? []
}

export function computeUnexplainedAbsenceDates(input: {
  workingDays: string[]
  attendedDates: Set<string>
  leaveCoveredDates: Set<string>
}): string[] {
  return input.workingDays.filter(
    (date) => !input.attendedDates.has(date) && !input.leaveCoveredDates.has(date)
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd portal && npx vitest run lib/attendance.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 6: Server Actions and the clock-control UI**

`app/dashboard/attendance/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireEmployee, NOT_AUTHORIZED } from '@/lib/auth'
import { clockIn as clockInDb, clockOut as clockOutDb } from '@/lib/attendance'

export type AttendanceActionState = { error?: string; success?: string }

export async function clockInAction(
  _prevState: AttendanceActionState,
  _formData: FormData
): Promise<AttendanceActionState> {
  let employee
  try {
    employee = await requireEmployee()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const supabase = await createClient()
  const { error } = await clockInDb(supabase, employee.id)
  if (error) return { error }
  revalidatePath('/dashboard')
  return { success: 'Clocked in' }
}

export async function clockOutAction(
  _prevState: AttendanceActionState,
  _formData: FormData
): Promise<AttendanceActionState> {
  let employee
  try {
    employee = await requireEmployee()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const supabase = await createClient()
  const { error } = await clockOutDb(supabase, employee.id)
  if (error) return { error }
  revalidatePath('/dashboard')
  return { success: 'Clocked out' }
}
```

`app/dashboard/attendance/ClockControl.tsx`: a client component taking `today: { clock_in_at: string; clock_out_at: string | null } | null` as a prop (fetched server-side in `app/dashboard/page.tsx` via `getTodayAttendance` and passed down). Three states: `today === null` → a "Clock In" button (`buttonPrimary` class) wired to `clockInAction` the same `useActionState` way `OnboardingForm.tsx` wires its submit; `today.clock_out_at === null` → shows the clock-in time and a "Clock Out" button (`buttonCoral` class); `today.clock_out_at` set → shows both times, read-only, no button. Use `date-fns`-free plain `new Date(iso).toLocaleTimeString()` for display (no new dependency).

- [ ] **Step 7: Embed in the dashboard**

In `app/dashboard/page.tsx`, call `getTodayAttendance(supabase, employee.id)` alongside whatever it already loads, and render `<ClockControl today={today} />` near the top of the page — read the current file first to match its existing layout/section structure rather than restructuring it.

- [ ] **Step 8: Manual verification**

Run `cd portal && npm run dev`, sign in as an employee, visit `/dashboard`.

Pass criteria:
- "Clock In" button appears if not yet clocked in today; clicking it shows the clock-in time and a "Clock Out" button.
- Clicking "Clock Out" shows both times, read-only.
- Reloading the page preserves the state (it's server-rendered from the DB, not client-only state).
- Attempting to clock in twice via two rapid clicks doesn't create two rows (verify via Supabase table view or `select * from attendance_records where employee_id = '<id>'` — exactly one row for today).

- [ ] **Step 9: Commit**

```bash
cd portal
git add supabase/migrations/0016_attendance.sql lib/attendance.ts lib/attendance.test.ts app/dashboard/attendance/ app/dashboard/page.tsx
git commit -m "Add attendance clock in/out

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Leave types & allocations (admin-managed)

**Files:**
- Create: `supabase/migrations/0017_leave_types_and_allocations.sql`
- Create: `lib/leaveTypes.ts`
- Create: `app/admin/leave-types/page.tsx`
- Create: `app/admin/leave-types/actions.ts`
- Modify: `components/Sidebar.tsx` (add an admin-only "Leave Types" nav link, or fold into the Settings page from Task 1 — implementer's call; if folded, place it as a second section on `/admin/settings` instead of a new route, and skip the Sidebar change)

**Interfaces:**
- Produces: `LeaveType` type (`id`, `name`, `is_paid`, `default_annual_quota`), `listLeaveTypes`, `upsertLeaveTypeAction`-equivalent write path, `getLeaveAllocation(supabase, employeeId, leaveTypeId, year): Promise<number | null>`, `setLeaveAllocation(supabase, employeeId, leaveTypeId, year, days)` — consumed by Task 4 (balance calc) and Task 8 (deduction calc).

- [ ] **Step 1: Write the migration**

```sql
create table leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_paid boolean not null,
  default_annual_quota numeric
);

insert into leave_types (name, is_paid, default_annual_quota) values
  ('Casual', true, null),
  ('Sick', true, null),
  ('Earned', true, null),
  ('Unpaid', false, null);

alter table leave_types enable row level security;

create policy "leave_types_select_all" on leave_types
  for select using (true);

create policy "leave_types_admin_write" on leave_types
  for all using (public.is_admin()) with check (public.is_admin());

create table leave_allocations (
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id) on delete cascade,
  year int not null,
  allocated_days numeric not null default 0,
  primary key (employee_id, leave_type_id, year)
);

alter table leave_allocations enable row level security;

create policy "leave_allocations_select_self_or_admin" on leave_allocations
  for select using (
    exists (select 1 from employees e where e.id = leave_allocations.employee_id and e.auth_user_id = auth.uid())
    or public.is_admin()
  );

-- No self-write policy at all — an employee's own leave balance is entirely
-- admin-set, matching the spec's permission table ("Set/override an
-- employee's leave allocation": admin/superadmin only, employee: no access).
create policy "leave_allocations_admin_write" on leave_allocations
  for all using (public.is_admin()) with check (public.is_admin());

-- monthly_salary: admin/superadmin write-only, per spec Data Model note on `employees`.
alter table employees add column monthly_salary numeric;
```

Note: `employees.monthly_salary` is added here (not deferred to Task 7) because it's a one-line, low-risk column addition and Task 3's admin-only-write RLS reasoning is identical — but `employees` already has row-level policies from earlier migrations (self-select, admin-write) that already cover this new column with no change needed, since RLS is table-level not column-level here. If `0001_init.sql`'s existing `employees` update policy allows employees to self-update non-role columns, verify (`select * from pg_policies where tablename = 'employees'`) whether a self-update policy would let an employee set their own `monthly_salary` — if so, add a `security definer` trigger analogous to `enforce_onboarding_self_edit_columns()` (Task 4's `0011` reference) that blocks non-admins from changing `monthly_salary`. Check this before treating the migration as complete.

- [ ] **Step 2: Implement `lib/leaveTypes.ts`** (no separate test file — thin CRUD wrappers only, no branching logic to unit test; the interesting logic lives in Task 4's balance calculator)

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export type LeaveType = {
  id: string
  name: string
  is_paid: boolean
  default_annual_quota: number | null
}

export async function listLeaveTypes(supabase: SupabaseClient): Promise<LeaveType[]> {
  const { data } = await supabase.from('leave_types').select('id, name, is_paid, default_annual_quota').order('name')
  return data ?? []
}

export async function updateLeaveTypeQuota(
  supabase: SupabaseClient,
  id: string,
  defaultAnnualQuota: number | null
): Promise<{ error?: string }> {
  const { error } = await supabase.from('leave_types').update({ default_annual_quota: defaultAnnualQuota }).eq('id', id)
  return { error: error?.message }
}

export async function getLeaveAllocation(
  supabase: SupabaseClient,
  employeeId: string,
  leaveTypeId: string,
  year: number
): Promise<number | null> {
  const { data } = await supabase
    .from('leave_allocations')
    .select('allocated_days')
    .eq('employee_id', employeeId)
    .eq('leave_type_id', leaveTypeId)
    .eq('year', year)
    .maybeSingle()
  return data?.allocated_days ?? null
}

export async function setLeaveAllocation(
  supabase: SupabaseClient,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  allocatedDays: number
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('leave_allocations')
    .upsert({ employee_id: employeeId, leave_type_id: leaveTypeId, year, allocated_days: allocatedDays })
  return { error: error?.message }
}

export async function listAllocationsForEmployee(
  supabase: SupabaseClient,
  employeeId: string,
  year: number
): Promise<{ leave_type_id: string; allocated_days: number }[]> {
  const { data } = await supabase
    .from('leave_allocations')
    .select('leave_type_id, allocated_days')
    .eq('employee_id', employeeId)
    .eq('year', year)
  return data ?? []
}
```

- [ ] **Step 3: Admin UI — leave types (default quotas) + per-employee allocation editor**

`app/admin/leave-types/actions.ts`: `'use server'`, `requireAdmin()`-guarded `updateDefaultQuotaAction` (wraps `updateLeaveTypeQuota`) and `setAllocationAction` (wraps `setLeaveAllocation`, reading `employeeId`, `leaveTypeId`, `year`, `allocatedDays` from `formData`), each `revalidatePath('/admin/leave-types')` on success — same shape as Task 1's `SettingsActionState` actions.

`app/admin/leave-types/page.tsx`: Server Component. Section 1: table of the 4 leave types (name, paid/unpaid pill via `statusPillClass`-style helper, default annual quota input + save button per row, wired to `updateDefaultQuotaAction`). Section 2: an employee picker (reuse whatever employee-select pattern `app/admin/employees/page.tsx` already uses — read that file first) plus a year input, showing that employee's current allocation per leave type with an editable number input per type, wired to `setAllocationAction`. Style with `card`/`input`/`label`/`buttonPrimary` from `lib/ui.ts`.

- [ ] **Step 4: Manual verification**

Run `cd portal && npm run dev`, sign in as admin, visit `/admin/leave-types`.

Pass criteria:
- Four leave types show (Casual, Sick, Earned, Unpaid), Casual/Sick/Earned marked paid, Unpaid marked unpaid.
- Setting a default quota on Casual and saving persists after reload.
- Picking an employee and setting their Casual allocation for the current year persists after reload.
- Signed in as a non-admin, `/admin/leave-types` redirects away (existing `/admin/**` middleware gate).

- [ ] **Step 5: Commit**

```bash
cd portal
git add supabase/migrations/0017_leave_types_and_allocations.sql lib/leaveTypes.ts app/admin/leave-types/
git commit -m "Add leave types and per-employee leave allocations (admin-managed)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Leave requests — employee submit, cancel, and balance calculation

**Files:**
- Create: `supabase/migrations/0018_leave_requests.sql`
- Create: `lib/leaveRequests.ts`
- Create: `lib/leaveRequests.test.ts`
- Create: `app/dashboard/leave/page.tsx`
- Create: `app/dashboard/leave/LeaveRequestForm.tsx` (client component)
- Create: `app/dashboard/leave/actions.ts`
- Modify: `components/Sidebar.tsx` (add a "Leave" nav link, visible to all roles)

**Interfaces:**
- Consumes: `LeaveType` (Task 3), `getLeaveAllocation`/`listAllocationsForEmployee` (Task 3), `listActiveAdminIds`/`notifyEmployees` (existing `lib/notifications.ts`).
- Produces: `computeDayPeriodDays(startDate, endDate, startPeriod, endPeriod): number`, `computeLeaveBalance(input): { allocated: number; used: number; remaining: number }`, `LeaveRequest` type, `listLeaveRequestsForEmployee`, `submitLeaveRequestAction`, `cancelLeaveRequestAction` — consumed by Task 5 (admin review) and Task 8 (deduction calc, which needs approved requests + their day counts).

- [ ] **Step 1: Write the migration**

```sql
create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  start_date date not null,
  end_date date not null,
  start_day_period text not null default 'full' check (start_day_period in ('full', 'half_am', 'half_pm')),
  end_day_period text not null default 'full' check (end_day_period in ('full', 'half_am', 'half_pm')),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references employees(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  -- Single-day requests only ever read start_day_period; this constraint
  -- keeps the two columns from silently disagreeing on such a row.
  check (start_date != end_date or start_day_period = end_day_period)
);

create index leave_requests_employee_id_idx on leave_requests (employee_id);
create index leave_requests_status_idx on leave_requests (status);

alter table leave_requests enable row level security;

create policy "leave_requests_select_self_or_admin" on leave_requests
  for select using (
    exists (select 1 from employees e where e.id = leave_requests.employee_id and e.auth_user_id = auth.uid())
    or public.is_admin()
  );

create policy "leave_requests_insert_self" on leave_requests
  for insert with check (
    exists (select 1 from employees e where e.id = leave_requests.employee_id and e.auth_user_id = auth.uid())
    and status = 'pending'
  );

-- Employee can only touch their own row, and only while it's still pending
-- (the USING clause is evaluated against the row's pre-update state) —
-- this is how "cancel own pending request freely, but cancelling an
-- approved one requires admin" is enforced: an employee's UPDATE simply
-- cannot match a row that's already 'approved'.
create policy "leave_requests_self_cancel_pending" on leave_requests
  for update using (
    exists (select 1 from employees e where e.id = leave_requests.employee_id and e.auth_user_id = auth.uid())
    and status = 'pending'
  ) with check (
    exists (select 1 from employees e where e.id = leave_requests.employee_id and e.auth_user_id = auth.uid())
    and status = 'cancelled'
  );

create policy "leave_requests_admin_write" on leave_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- Reject approving a request that overlaps another already-approved request
-- for the same employee — enforced at the database level per spec, not
-- just in the app layer.
create or replace function public.enforce_no_overlapping_approved_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' then
    if exists (
      select 1 from leave_requests other
      where other.id != new.id
        and other.employee_id = new.employee_id
        and other.status = 'approved'
        and other.start_date <= new.end_date
        and other.end_date >= new.start_date
    ) then
      raise exception 'This employee already has an approved leave request overlapping these dates';
    end if;
  end if;
  return new;
end;
$$;

create trigger leave_requests_enforce_no_overlap
  before insert or update on leave_requests
  for each row execute function public.enforce_no_overlapping_approved_leave();
```

- [ ] **Step 2: Write the failing tests**

```typescript
// lib/leaveRequests.test.ts
import { describe, it, expect } from 'vitest'
import { computeDayPeriodDays, computeLeaveBalance } from './leaveRequests'

describe('computeDayPeriodDays', () => {
  it('counts a single full day as 1', () => {
    expect(computeDayPeriodDays('2026-08-10', '2026-08-10', 'full', 'full')).toBe(1)
  })

  it('counts a single half day as 0.5', () => {
    expect(computeDayPeriodDays('2026-08-10', '2026-08-10', 'half_am', 'half_am')).toBe(0.5)
  })

  it('counts a 3-day range with a half first day as 2.5', () => {
    expect(computeDayPeriodDays('2026-08-10', '2026-08-12', 'half_pm', 'full')).toBe(2.5)
  })

  it('counts a 5-day range with half first and half last day as 4', () => {
    expect(computeDayPeriodDays('2026-08-10', '2026-08-14', 'half_am', 'half_pm')).toBe(4)
  })
})

describe('computeLeaveBalance', () => {
  it('nets pending and approved days against the allocation', () => {
    const result = computeLeaveBalance({
      allocatedDays: 10,
      requests: [
        { totalDays: 2, status: 'approved' },
        { totalDays: 1.5, status: 'pending' },
        { totalDays: 3, status: 'rejected' }, // rejected days don't count
        { totalDays: 1, status: 'cancelled' }, // cancelled days don't count
      ],
    })
    expect(result).toEqual({ allocated: 10, used: 3.5, remaining: 6.5 })
  })

  it('allows remaining to go negative when requests exceed allocation', () => {
    const result = computeLeaveBalance({
      allocatedDays: 2,
      requests: [{ totalDays: 5, status: 'approved' }],
    })
    expect(result).toEqual({ allocated: 2, used: 5, remaining: -3 })
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd portal && npx vitest run lib/leaveRequests.test.ts`
Expected: FAIL — `lib/leaveRequests.ts` does not exist yet.

- [ ] **Step 4: Implement `lib/leaveRequests.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export type DayPeriod = 'full' | 'half_am' | 'half_pm'
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type LeaveRequest = {
  id: string
  employee_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  start_day_period: DayPeriod
  end_day_period: DayPeriod
  reason: string | null
  status: LeaveRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
}

function calendarDayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export function computeDayPeriodDays(
  startDate: string,
  endDate: string,
  startPeriod: DayPeriod,
  endPeriod: DayPeriod
): number {
  const totalCalendarDays = calendarDayCount(startDate, endDate)
  if (startDate === endDate) {
    return startPeriod === 'full' ? 1 : 0.5
  }
  let days = totalCalendarDays
  if (startPeriod !== 'full') days -= 0.5
  if (endPeriod !== 'full') days -= 0.5
  return days
}

export function computeLeaveBalance(input: {
  allocatedDays: number
  requests: { totalDays: number; status: LeaveRequestStatus }[]
}): { allocated: number; used: number; remaining: number } {
  const used = input.requests
    .filter((r) => r.status === 'pending' || r.status === 'approved')
    .reduce((sum, r) => sum + r.totalDays, 0)
  return { allocated: input.allocatedDays, used, remaining: input.allocatedDays - used }
}

export async function listLeaveRequestsForEmployee(
  supabase: SupabaseClient,
  employeeId: string
): Promise<LeaveRequest[]> {
  const { data } = await supabase
    .from('leave_requests')
    .select(
      'id, employee_id, leave_type_id, start_date, end_date, start_day_period, end_day_period, reason, status, reviewed_by, reviewed_at, review_note, created_at'
    )
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function submitLeaveRequest(
  supabase: SupabaseClient,
  employeeId: string,
  input: {
    leaveTypeId: string
    startDate: string
    endDate: string
    startDayPeriod: DayPeriod
    endDayPeriod: DayPeriod
    reason: string
  }
): Promise<{ error?: string }> {
  const { error } = await supabase.from('leave_requests').insert({
    employee_id: employeeId,
    leave_type_id: input.leaveTypeId,
    start_date: input.startDate,
    end_date: input.endDate,
    start_day_period: input.startDayPeriod,
    end_day_period: input.startDate === input.endDate ? input.startDayPeriod : input.endDayPeriod,
    reason: input.reason,
  })
  return { error: error?.message }
}

export async function cancelLeaveRequest(
  supabase: SupabaseClient,
  employeeId: string,
  requestId: string
): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from('leave_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('employee_id', employeeId)
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Only your own pending requests can be cancelled' }
  return {}
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd portal && npx vitest run lib/leaveRequests.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 6: Server Actions**

`app/dashboard/leave/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEmployee, NOT_AUTHORIZED } from '@/lib/auth'
import { submitLeaveRequest, cancelLeaveRequest, type DayPeriod } from '@/lib/leaveRequests'
import { notifyEmployees, listActiveAdminIds } from '@/lib/notifications'

export type LeaveActionState = { error?: string; success?: string }

export async function submitLeaveRequestAction(
  _prevState: LeaveActionState,
  formData: FormData
): Promise<LeaveActionState> {
  let employee
  try {
    employee = await requireEmployee()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const supabase = await createClient()

  const leaveTypeId = String(formData.get('leaveTypeId') ?? '')
  const startDate = String(formData.get('startDate') ?? '')
  const endDate = String(formData.get('endDate') ?? '')
  const startDayPeriod = String(formData.get('startDayPeriod') ?? 'full') as DayPeriod
  const endDayPeriod = String(formData.get('endDayPeriod') ?? 'full') as DayPeriod
  const reason = String(formData.get('reason') ?? '')

  if (!leaveTypeId || !startDate || !endDate) {
    return { error: 'Leave type and dates are required' }
  }

  const { error } = await submitLeaveRequest(supabase, employee.id, {
    leaveTypeId,
    startDate,
    endDate,
    startDayPeriod,
    endDayPeriod,
    reason,
  })
  if (error) return { error }

  const adminClient = createAdminClient()
  const adminIds = await listActiveAdminIds(adminClient)
  await notifyEmployees(adminClient, adminIds, {
    title: `New leave request: ${employee.name}`,
    link: `/admin/leave`,
  })

  revalidatePath('/dashboard/leave')
  return { success: 'Leave request submitted' }
}

export async function cancelLeaveRequestAction(
  _prevState: LeaveActionState,
  formData: FormData
): Promise<LeaveActionState> {
  let employee
  try {
    employee = await requireEmployee()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const supabase = await createClient()
  const requestId = String(formData.get('requestId') ?? '')
  const { error } = await cancelLeaveRequest(supabase, employee.id, requestId)
  if (error) return { error }
  revalidatePath('/dashboard/leave')
  return { success: 'Request cancelled' }
}
```

- [ ] **Step 7: Employee leave page**

`app/dashboard/leave/page.tsx`: Server Component. Loads `listLeaveTypes`, the employee's `listAllocationsForEmployee(supabase, employee.id, currentYear)`, their `listLeaveRequestsForEmployee`, computes each leave type's balance via `computeLeaveBalance` (feeding it that type's requests with `totalDays` computed via `computeDayPeriodDays`), and renders: a balance summary card per leave type (allocated/used/remaining), the `LeaveRequestForm` client component (leave type select, start/end date inputs, half-day radio/select per spec's "first/last day of a range only" rule, reason textarea, submit button wired to `submitLeaveRequestAction`), and a list of the employee's own requests (dates, type, status pill, a "Cancel" button visible only when `status === 'pending'`, wired to `cancelLeaveRequestAction`).

`app/dashboard/leave/LeaveRequestForm.tsx`: client component, mirrors `OnboardingForm.tsx`'s `useActionState` wiring. When the employee picks a leave type, show that type's current balance (computed server-side and passed as a prop, keyed by leave type id) so the "remaining balance" warning the spec calls for ("They can still submit even if the request would exceed the remaining balance — the UI warns, but doesn't block") can be shown client-side as the dates change, using `computeDayPeriodDays` (import it directly — it's a pure function, safe to use client-side) against the selected balance.

- [ ] **Step 8: Add the Sidebar link**

In `components/Sidebar.tsx`, add a "Leave" link (e.g. `CalendarDays` icon from `lucide-react`) to the section visible to all roles, pointing at `/dashboard/leave` — follow the existing pattern for employee-visible links in that file.

- [ ] **Step 9: Manual verification**

Run `cd portal && npm run dev`, sign in as an employee (with an admin having set a Casual allocation for them via Task 3's UI first).

Pass criteria:
- `/dashboard/leave` shows the Casual balance reflecting the admin-set allocation.
- Submitting a 3-day Casual request (with a half first day) creates a `pending` row and shows in the request list; balance's `used`/`remaining` update to reflect it (as `pending`, per `computeLeaveBalance`).
- Cancelling that pending request removes it from `used`.
- Signed in as an admin, confirm a notification appeared for the submitted request (check `/`'s notification bell, or query `notifications` directly).

- [ ] **Step 10: Commit**

```bash
cd portal
git add supabase/migrations/0018_leave_requests.sql lib/leaveRequests.ts lib/leaveRequests.test.ts app/dashboard/leave/ components/Sidebar.tsx
git commit -m "Add leave requests: submit, cancel, and balance calculation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Admin leave review — approve/reject

**Files:**
- Create: `app/admin/leave/page.tsx`
- Create: `app/admin/leave/actions.ts`
- Modify: `lib/leaveRequests.ts` (add `listPendingLeaveRequests`, `listAllLeaveRequests`, `reviewLeaveRequest`)
- Modify: `components/Sidebar.tsx` (add an admin-only "Review Leave" nav link)

**Interfaces:**
- Consumes: `LeaveRequest` type, `notifyEmployees` (existing).
- Produces: `reviewLeaveRequestAction` — nothing later depends on new exports beyond what Task 4 already produced.

- [ ] **Step 1: Add the admin query/write helpers to `lib/leaveRequests.ts`**

Append to the existing file:

```typescript
export async function listPendingLeaveRequests(supabase: SupabaseClient): Promise<
  (LeaveRequest & { employee_name: string; leave_type_name: string })[]
> {
  const { data } = await supabase
    .from('leave_requests')
    .select(
      'id, employee_id, leave_type_id, start_date, end_date, start_day_period, end_day_period, reason, status, reviewed_by, reviewed_at, review_note, created_at, employees(name), leave_types(name)'
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    employee_name: (row.employees as { name: string })?.name ?? '',
    leave_type_name: (row.leave_types as { name: string })?.name ?? '',
  })) as (LeaveRequest & { employee_name: string; leave_type_name: string })[]
}

export async function reviewLeaveRequest(
  adminClient: SupabaseClient,
  requestId: string,
  reviewerId: string,
  decision: 'approved' | 'rejected',
  reviewNote: string
): Promise<{ error?: string; employeeId?: string }> {
  const { data, error } = await adminClient
    .from('leave_requests')
    .update({ status: decision, reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), review_note: reviewNote || null })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id, employee_id')
  if (error) {
    // Overlap trigger raises a plain exception; surface its message as-is.
    return { error: error.message }
  }
  if (!data || data.length === 0) return { error: 'Request is no longer pending' }
  return { employeeId: data[0].employee_id }
}
```

Note the `.eq('status', 'pending')` filter on the update — this prevents a double-review race (two admins approving the same request near-simultaneously) the same way `.select('id')`-length-checking catches an RLS-denied write elsewhere in this codebase: the second reviewer's update matches zero rows and gets `'Request is no longer pending'` back.

- [ ] **Step 2: Server Action**

`app/admin/leave/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { reviewLeaveRequest } from '@/lib/leaveRequests'
import { notifyEmployees } from '@/lib/notifications'

export type LeaveReviewActionState = { error?: string; success?: string }

export async function reviewLeaveRequestAction(
  _prevState: LeaveReviewActionState,
  formData: FormData
): Promise<LeaveReviewActionState> {
  let reviewer
  try {
    reviewer = await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const requestId = String(formData.get('requestId') ?? '')
  const decision = String(formData.get('decision') ?? '') as 'approved' | 'rejected'
  const reviewNote = String(formData.get('reviewNote') ?? '')

  if (decision !== 'approved' && decision !== 'rejected') {
    return { error: 'Invalid decision' }
  }

  const adminClient = createAdminClient()
  const { error, employeeId } = await reviewLeaveRequest(adminClient, requestId, reviewer.id, decision, reviewNote)
  if (error) return { error }

  if (employeeId) {
    await notifyEmployees(adminClient, [employeeId], {
      title: decision === 'approved' ? 'Your leave request was approved' : 'Your leave request was rejected',
      body: reviewNote || undefined,
      link: '/dashboard/leave',
    })
  }

  revalidatePath('/admin/leave')
  return { success: `Request ${decision}` }
}
```

- [ ] **Step 3: Admin review page**

`app/admin/leave/page.tsx`: Server Component, `requireAdmin()`-implied by its route (already gated by middleware) but call `listPendingLeaveRequests(supabase)` and render a table (employee name, leave type, dates + day-period summary via `computeDayPeriodDays`, reason) with, per row, an approve button and a reject button each posting `reviewLeaveRequestAction` with the row's `requestId` and the corresponding `decision` — an optional review-note textarea per row. Style with `card`/`buttonPrimary` (approve) / `buttonGhost` or a red variant (reject) from `lib/ui.ts`.

- [ ] **Step 4: Add the Sidebar link**

In `components/Sidebar.tsx`, add a "Review Leave" link to the admin-only section, pointing at `/admin/leave`.

- [ ] **Step 5: Manual verification**

With the pending request created in Task 4's verification still present, sign in as admin, visit `/admin/leave`.

Pass criteria:
- The pending request appears with employee name, leave type, and dates.
- Approving it moves it out of the pending list; the employee sees `status: approved` on `/dashboard/leave` and receives a notification.
- Submitting a second, date-overlapping request for the same employee and attempting to approve it fails with the overlap error message from the trigger, surfaced via the action's `{ error }` return.

- [ ] **Step 6: Commit**

```bash
cd portal
git add lib/leaveRequests.ts app/admin/leave/ components/Sidebar.tsx
git commit -m "Add admin leave request review (approve/reject)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Timesheets — read-only computed views

**Files:**
- Create: `app/dashboard/timesheet/page.tsx`
- Create: `app/admin/timesheet/page.tsx`
- Create: `app/admin/timesheet/EmployeeTimesheetPicker.tsx` (client component, if the employee-picker needs client interactivity — otherwise fold into the page via a query-string-driven Server Component, matching whatever pattern `app/admin/employees/[id]/page.tsx` already uses for similar picks)

**Interfaces:**
- Consumes: `listAttendanceInRange` (Task 2), `getCompanySetting`/`parseWeeklyOffDays`/`isWorkingDay`/`toDateKey` (Task 1).
- Produces: nothing new — this task is presentation-only over existing data-access functions, per the spec's "computed over `attendance_records`... no separate manual entry."

- [ ] **Step 1: Employee's own timesheet**

`app/dashboard/timesheet/page.tsx`: Server Component. Accepts a `?month=YYYY-MM` search param (default: current month). Loads `listAttendanceInRange(supabase, employee.id, firstOfMonth, lastOfMonth)`, `getCompanySetting(supabase, 'weekly_off_days')`, `listCompanyHolidays(supabase)`. Renders a simple table: one row per calendar day in the month, columns for date, working-day/weekend/holiday label (via `isWorkingDay`), clock-in time, clock-out time, and computed hours worked (`clock_out_at - clock_in_at`, or blank if not clocked out). A prev/next month link pair adjusting the `?month=` param (plain `<Link>`, no client state needed). Style with `card`/`table`-equivalent classes already used elsewhere (check `app/projects/[id]/page.tsx` or similar for the existing table styling convention before inventing a new one).

- [ ] **Step 2: Admin cross-employee timesheet**

`app/admin/timesheet/page.tsx`: same structure as Step 1, plus an employee picker (mirror whatever selector Task 3's allocation editor used) and accepts `?employeeId=<id>&month=YYYY-MM`. Loads the same data for the selected employee via `createClient()` (RLS already allows admin to read any employee's `attendance_records`, per Task 2's `attendance_select_self_or_admin` policy — no need for `createAdminClient()` here).

- [ ] **Step 3: Manual verification**

Sign in as the employee who clocked in during Task 2's verification, visit `/dashboard/timesheet`.

Pass criteria:
- Today's row shows the clock-in (and clock-out, if completed) time.
- Weekend/holiday days are visually distinguished from working days.
- As admin, `/admin/timesheet?employeeId=<that employee's id>` shows the same data.

- [ ] **Step 4: Commit**

```bash
cd portal
git add app/dashboard/timesheet/ app/admin/timesheet/
git commit -m "Add read-only employee and admin timesheet views

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Employee monthly salary — admin-set field

**Files:**
- Create: `lib/employeeSalary.ts`
- Modify: `app/admin/employees/[id]/EditEmployeeClient.tsx` (add a salary field)
- Modify: `app/admin/employees/[id]/actions.ts` (add `updateMonthlySalaryAction`)

**Interfaces:**
- Produces: `getMonthlySalary(supabase, employeeId): Promise<number | null>`, `setMonthlySalary` — consumed by Task 8.

Note: `employees.monthly_salary` column itself was already added in Task 3's migration (`0017_leave_types_and_allocations.sql`) — this task only adds the read/write helpers and the admin UI field. If Task 3 wasn't merged first, that column addition must land before this task can work; these two tasks are not parallelizable for that reason (Task 7 depends on Task 3's migration).

- [ ] **Step 1: Implement `lib/employeeSalary.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getMonthlySalary(supabase: SupabaseClient, employeeId: string): Promise<number | null> {
  const { data } = await supabase.from('employees').select('monthly_salary').eq('id', employeeId).maybeSingle()
  return data?.monthly_salary ?? null
}

export async function setMonthlySalary(
  supabase: SupabaseClient,
  employeeId: string,
  amount: number
): Promise<{ error?: string }> {
  const { error } = await supabase.from('employees').update({ monthly_salary: amount }).eq('id', employeeId)
  return { error: error?.message }
}
```

- [ ] **Step 2: Wire into the existing employee-edit admin page**

In `app/admin/employees/[id]/actions.ts`, add (following the exact `'use server'`/`requireAdmin()` shape already used by the file's existing `markOnboardingCompleteAction`):

```typescript
export async function updateMonthlySalaryAction(
  _prevState: EditEmployeeActionState,
  formData: FormData
): Promise<EditEmployeeActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }
  const employeeId = String(formData.get('employeeId') ?? '')
  const amount = Number(formData.get('monthlySalary') ?? '')
  if (!employeeId || Number.isNaN(amount) || amount < 0) {
    return { error: 'Enter a valid salary amount' }
  }
  const supabase = await createClient()
  const { error } = await setMonthlySalary(supabase, employeeId, amount)
  if (error) return { error }
  revalidatePath(`/admin/employees/${employeeId}`)
  return { success: 'Salary updated' }
}
```

(Read the actual existing `EditEmployeeActionState` type and import list at the top of that file first — reuse its exact type name rather than inventing a new one, and add the `getMonthlySalary`/`setMonthlySalary` import from `@/lib/employeeSalary`.)

In `app/admin/employees/[id]/EditEmployeeClient.tsx`, add a "Monthly Salary" card (mirror the existing "Onboarding" card's structure at ~line 312-404 for visual consistency) with a number input pre-filled from the employee's current `monthly_salary` (pass it down as a prop from the page's server-side load, which needs one added line calling `getMonthlySalary`) and a save button wired to `updateMonthlySalaryAction`.

- [ ] **Step 3: Manual verification**

Sign in as admin, visit `/admin/employees/<id>`, set a monthly salary, reload — value persists.

- [ ] **Step 4: Commit**

```bash
cd portal
git add lib/employeeSalary.ts app/admin/employees/
git commit -m "Add admin-set monthly salary field on employee record

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Salary deduction calculation (pure logic, TDD)

**Files:**
- Create: `lib/salaryDeduction.ts`
- Create: `lib/salaryDeduction.test.ts`

**Interfaces:**
- Consumes: `isWorkingDay`, `toDateKey` (Task 1), `computeUnexplainedAbsenceDates` (Task 2), `computeDayPeriodDays` (Task 4).
- Produces: `computeWorkingDaysInMonth(year, month, weeklyOffDays, holidayDates): string[]`, `computeSalaryDeductionSummary(input): SalaryDeductionSummary` — consumed by Task 9 (admin summary page). This is the highest-risk logic in the whole phase (the spec's Testing section items 2, 3, 5, 6, 7 are all about this calculation) — give it the most thorough test coverage in this plan.

This task is pure computation with **no database access and no Server Actions** — everything it needs is passed in already-fetched, so it can be fully unit tested without a live Supabase connection, matching `lib/onboarding.test.ts`'s existing pure-function-testing convention.

- [ ] **Step 1: Write the failing tests — covering the spec's Testing section scenarios directly**

```typescript
// lib/salaryDeduction.test.ts
import { describe, it, expect } from 'vitest'
import { computeWorkingDaysInMonth, computeSalaryDeductionSummary } from './salaryDeduction'

describe('computeWorkingDaysInMonth', () => {
  it('excludes weekends and holidays from August 2026', () => {
    // August 2026: 31 days. Sat/Sun off-days. 2026-08-15 is a holiday (also
    // happens to be a Saturday) — included in the weekend count already, so
    // it shouldn't be double-subtracted. Weekends in Aug 2026: 1,2,8,9,15,16,22,23,29,30 = 10 days.
    const result = computeWorkingDaysInMonth(2026, 8, [0, 6], new Set(['2026-08-15', '2026-08-19']))
    // 31 total - 10 weekend days - 1 non-weekend holiday (08-19, a Wednesday) = 20
    expect(result.length).toBe(20)
    expect(result).not.toContain('2026-08-15')
    expect(result).not.toContain('2026-08-19')
    expect(result).not.toContain('2026-08-01') // a Saturday
  })
})

describe('computeSalaryDeductionSummary', () => {
  // Spec Testing item #6: a month containing a company holiday, a weekend,
  // one approved paid-type leave within quota (not deductible), one
  // approved paid-type leave that pushes past quota (partially
  // deductible), one approved Unpaid-type leave (fully deductible), and
  // one unexplained absence.
  it('computes working days, per-day rate, and total deduction correctly for a mixed month', () => {
    // September 2026: 30 days, weekly off-days Sat/Sun.
    // Weekends: 5,6,12,13,19,20,26,27 = 8 days. One holiday: 2026-09-09 (Wed).
    // Working days = 30 - 8 - 1 = 21.
    const result = computeSalaryDeductionSummary({
      year: 2026,
      month: 9,
      weeklyOffDays: [0, 6],
      holidayDates: new Set(['2026-09-09']),
      monthlySalary: 21000, // → per-day rate = 21000 / 21 = 1000
      attendedDates: new Set(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']), // partial month attendance
      approvedLeaveRequests: [
        // Within-quota paid leave: Casual, 2 days (09-07..09-08, both full), remaining balance before this = 3 → fully within quota, 0 deductible.
        {
          leaveTypeId: 'casual', isPaid: true, startDate: '2026-09-07', endDate: '2026-09-08',
          startDayPeriod: 'full', endDayPeriod: 'full', totalDays: 2, remainingBalanceBeforeThisRequest: 3,
        },
        // Over-quota paid leave: Sick, 3 days (09-14..09-16), remaining balance before this = 1 → 1 day within quota, 2 days deductible.
        {
          leaveTypeId: 'sick', isPaid: true, startDate: '2026-09-14', endDate: '2026-09-16',
          startDayPeriod: 'full', endDayPeriod: 'full', totalDays: 3, remainingBalanceBeforeThisRequest: 1,
        },
        // Unpaid leave: fully deductible, 1 day (09-21).
        {
          leaveTypeId: 'unpaid', isPaid: false, startDate: '2026-09-21', endDate: '2026-09-21',
          startDayPeriod: 'full', endDayPeriod: 'full', totalDays: 1, remainingBalanceBeforeThisRequest: 0,
        },
      ],
    })

    // Unexplained absence: working days minus attended minus leave-covered.
    // Working days in Sept 2026 (excluding the 09-07/08, 09-14/15/16, 09-21 leave days and weekends/holiday):
    // 09-22, 09-23, 09-24, 09-25, 09-28, 09-29, 09-30 have no attendance and no leave → unexplained, EXCEPT
    // this test only asserts the totals below, not the exact date list (covered by computeUnexplainedAbsenceDates's own unit tests in lib/attendance.test.ts).

    expect(result.workingDaysInMonth).toBe(21)
    expect(result.perDayRate).toBe(1000)
    expect(result.deductibleDays.overQuotaPaidLeave).toBe(2)
    expect(result.deductibleDays.unpaidLeave).toBe(1)
    expect(result.deductibleDays.unexplainedAbsence).toBeGreaterThan(0)
    const expectedTotalDeductibleDays =
      result.deductibleDays.overQuotaPaidLeave + result.deductibleDays.unpaidLeave + result.deductibleDays.unexplainedAbsence
    expect(result.totalDeductibleDays).toBe(expectedTotalDeductibleDays)
    expect(result.deductionAmount).toBe(expectedTotalDeductibleDays * 1000)
  })

  it('shows "salary not set" instead of a number when monthlySalary is null', () => {
    const result = computeSalaryDeductionSummary({
      year: 2026,
      month: 9,
      weeklyOffDays: [0, 6],
      holidayDates: new Set(),
      monthlySalary: null,
      attendedDates: new Set(),
      approvedLeaveRequests: [],
    })
    expect(result.perDayRate).toBeNull()
    expect(result.deductionAmount).toBeNull()
    expect(result.salaryNotSet).toBe(true)
  })

  it('respects half-day modifiers in deductible-day counts', () => {
    const result = computeSalaryDeductionSummary({
      year: 2026,
      month: 9,
      weeklyOffDays: [0, 6],
      holidayDates: new Set(),
      monthlySalary: 21000,
      attendedDates: new Set(),
      approvedLeaveRequests: [
        {
          leaveTypeId: 'unpaid', isPaid: false, startDate: '2026-09-02', endDate: '2026-09-02',
          startDayPeriod: 'half_am', endDayPeriod: 'half_am', totalDays: 0.5, remainingBalanceBeforeThisRequest: 0,
        },
      ],
    })
    expect(result.deductibleDays.unpaidLeave).toBe(0.5)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd portal && npx vitest run lib/salaryDeduction.test.ts`
Expected: FAIL — `lib/salaryDeduction.ts` does not exist yet.

- [ ] **Step 3: Implement `lib/salaryDeduction.ts`**

```typescript
import { isWorkingDay, toDateKey } from './companySettings'
import { computeUnexplainedAbsenceDates } from './attendance'
import type { DayPeriod } from './leaveRequests'

export function computeWorkingDaysInMonth(
  year: number,
  month: number, // 1-12
  weeklyOffDays: number[],
  holidayDates: Set<string>
): string[] {
  const days: string[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    if (isWorkingDay(date, weeklyOffDays, holidayDates)) {
      days.push(toDateKey(date))
    }
  }
  return days
}

export type ApprovedLeaveForDeduction = {
  leaveTypeId: string
  isPaid: boolean
  startDate: string
  endDate: string
  startDayPeriod: DayPeriod
  endDayPeriod: DayPeriod
  totalDays: number
  // The employee's remaining balance for this leave type, computed BEFORE
  // this specific request is counted against it (i.e. allocated minus every
  // OTHER approved/pending request for the same type/year). Used to split
  // this request's days into "within quota" (0 deductible) vs "over quota"
  // (deductible) — a request can straddle both.
  remainingBalanceBeforeThisRequest: number
}

export type SalaryDeductionSummary = {
  workingDaysInMonth: number
  perDayRate: number | null
  salaryNotSet: boolean
  deductibleDays: {
    unpaidLeave: number
    overQuotaPaidLeave: number
    unexplainedAbsence: number
  }
  totalDeductibleDays: number
  deductionAmount: number | null
}

export function computeSalaryDeductionSummary(input: {
  year: number
  month: number
  weeklyOffDays: number[]
  holidayDates: Set<string>
  monthlySalary: number | null
  attendedDates: Set<string>
  approvedLeaveRequests: ApprovedLeaveForDeduction[]
}): SalaryDeductionSummary {
  const workingDays = computeWorkingDaysInMonth(input.year, input.month, input.weeklyOffDays, input.holidayDates)
  const workingDaysInMonth = workingDays.length

  let unpaidLeave = 0
  let overQuotaPaidLeave = 0
  const leaveCoveredDates = new Set<string>()

  for (const req of input.approvedLeaveRequests) {
    // Mark every calendar day of the request as leave-covered (for the
    // unexplained-absence calc below), regardless of paid/unpaid status.
    const start = new Date(req.startDate)
    const end = new Date(req.endDate)
    for (let t = new Date(start); t <= end; t.setDate(t.getDate() + 1)) {
      leaveCoveredDates.add(toDateKey(t))
    }

    if (!req.isPaid) {
      unpaidLeave += req.totalDays
      continue
    }
    // Paid type: only the portion beyond the remaining balance is deductible.
    const overQuota = Math.max(0, req.totalDays - Math.max(0, req.remainingBalanceBeforeThisRequest))
    overQuotaPaidLeave += overQuota
  }

  const unexplainedAbsenceDates = computeUnexplainedAbsenceDates({
    workingDays,
    attendedDates: input.attendedDates,
    leaveCoveredDates,
  })
  const unexplainedAbsence = unexplainedAbsenceDates.length

  const totalDeductibleDays = unpaidLeave + overQuotaPaidLeave + unexplainedAbsence

  const salaryNotSet = input.monthlySalary === null
  const perDayRate = salaryNotSet ? null : (input.monthlySalary as number) / workingDaysInMonth
  const deductionAmount = perDayRate === null ? null : totalDeductibleDays * perDayRate

  return {
    workingDaysInMonth,
    perDayRate,
    salaryNotSet,
    deductibleDays: { unpaidLeave, overQuotaPaidLeave, unexplainedAbsence },
    totalDeductibleDays,
    deductionAmount,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd portal && npx vitest run lib/salaryDeduction.test.ts`
Expected: PASS, 5/5. If the mixed-month test's `overQuotaPaidLeave`/`unexplainedAbsence` numbers don't match your hand-derived expectation, print `result` and re-derive by hand against the September 2026 calendar (30 days, 2026-09-01 is a Tuesday) rather than adjusting the implementation to match a guessed number — the arithmetic in the test comments above is worked out from the actual calendar, not asserted blind.

- [ ] **Step 5: Commit**

```bash
cd portal
git add lib/salaryDeduction.ts lib/salaryDeduction.test.ts
git commit -m "Add salary deduction calculation (pure logic, TDD)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Admin salary deduction summary page

**Files:**
- Create: `app/admin/salary-deduction/page.tsx`
- Create: `lib/salaryDeductionData.ts` (the DB-fetching glue between Task 4/Task 7's data-access functions and Task 8's pure calculator — kept separate from `lib/salaryDeduction.ts` so that file stays 100% pure/dependency-free and trivially testable)

**Interfaces:**
- Consumes: `computeSalaryDeductionSummary` (Task 8), `listAttendanceInRange` (Task 2), `getMonthlySalary` (Task 7), `getCompanySetting`/`parseWeeklyOffDays`/`listCompanyHolidays` (Task 1), leave data (Task 4/5 tables, queried directly here since no existing helper returns "approved leave overlapping a month with remaining-balance-at-request-time" — that assembly is this task's own job).

- [ ] **Step 1: Implement `lib/salaryDeductionData.ts`**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCompanySetting, listCompanyHolidays, parseWeeklyOffDays, toDateKey } from './companySettings'
import { listAttendanceInRange } from './attendance'
import { getMonthlySalary } from './employeeSalary'
import { computeSalaryDeductionSummary, type SalaryDeductionSummary } from './salaryDeduction'
import { computeDayPeriodDays } from './leaveRequests'

export async function buildSalaryDeductionSummary(
  supabase: SupabaseClient,
  employeeId: string,
  year: number,
  month: number
): Promise<SalaryDeductionSummary> {
  const weeklyOffDaysRaw = (await getCompanySetting(supabase, 'weekly_off_days')) ?? 'sat,sun'
  const weeklyOffDays = parseWeeklyOffDays(weeklyOffDaysRaw)
  const holidays = await listCompanyHolidays(supabase)
  const holidayDates = new Set(holidays.map((h) => h.date))

  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const lastOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const attendance = await listAttendanceInRange(supabase, employeeId, firstOfMonth, lastOfMonth)
  const attendedDates = new Set(attendance.map((a) => a.date))

  const monthlySalary = await getMonthlySalary(supabase, employeeId)

  // Approved leave requests overlapping this month, each paired with the
  // employee's remaining balance for that leave type/year computed from
  // every OTHER approved-or-pending request of the same type/year — this
  // mirrors computeLeaveBalance's "used" definition but excludes the
  // request currently being evaluated, per Task 8's ApprovedLeaveForDeduction contract.
  const { data: allRequestsThisYear } = await supabase
    .from('leave_requests')
    .select('id, leave_type_id, start_date, end_date, start_day_period, end_day_period, status, leave_types(is_paid)')
    .eq('employee_id', employeeId)
    .gte('start_date', `${year}-01-01`)
    .lte('start_date', `${year}-12-31`)
    .in('status', ['approved', 'pending'])

  const { data: allocations } = await supabase
    .from('leave_allocations')
    .select('leave_type_id, allocated_days')
    .eq('employee_id', employeeId)
    .eq('year', year)

  const allocationByType = new Map((allocations ?? []).map((a) => [a.leave_type_id, a.allocated_days]))

  const approvedLeaveRequests = (allRequestsThisYear ?? [])
    .filter((r) => r.status === 'approved' && r.start_date <= lastOfMonth && r.end_date >= firstOfMonth)
    .map((r) => {
      const totalDays = computeDayPeriodDays(r.start_date, r.end_date, r.start_day_period, r.end_day_period)
      const allocated = allocationByType.get(r.leave_type_id) ?? 0
      const usedByOthers = (allRequestsThisYear ?? [])
        .filter((other) => other.leave_type_id === r.leave_type_id && other.id !== r.id)
        .reduce((sum, other) => sum + computeDayPeriodDays(other.start_date, other.end_date, other.start_day_period, other.end_day_period), 0)
      return {
        leaveTypeId: r.leave_type_id,
        isPaid: (r.leave_types as unknown as { is_paid: boolean })?.is_paid ?? true,
        startDate: r.start_date,
        endDate: r.end_date,
        startDayPeriod: r.start_day_period,
        endDayPeriod: r.end_day_period,
        totalDays,
        remainingBalanceBeforeThisRequest: allocated - usedByOthers,
      }
    })

  return computeSalaryDeductionSummary({
    year,
    month,
    weeklyOffDays,
    holidayDates,
    monthlySalary,
    attendedDates,
    approvedLeaveRequests,
  })
}
```

- [ ] **Step 2: Admin page**

`app/admin/salary-deduction/page.tsx`: Server Component. Accepts `?employeeId=<id>&year=YYYY&month=M` (default: current employee list's first entry / current month if unset — or simplest: render only the picker form until both are chosen, matching whatever "pick then show" UX pattern the Task 3 allocation editor used). Calls `buildSalaryDeductionSummary` and renders: working days in month, per-day rate (or "Salary not set" per `salaryNotSet`), a breakdown table (unpaid leave days, over-quota paid leave days, unexplained absence days, total deductible days), and the final deduction amount formatted with `new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT' }).format(amount)` (or plain `amount.toFixed(2)` + "BDT" if `en-BD` isn't a supported locale in the deployment's Node runtime — verify with `node -e "console.log(new Intl.NumberFormat('en-BD',{style:'currency',currency:'BDT'}).format(1000))"` before committing to it, fall back to the plain format if it throws).

- [ ] **Step 3: Add the Sidebar link**

In `components/Sidebar.tsx`, add a "Salary Deduction" link to the admin-only section, pointing at `/admin/salary-deduction`.

- [ ] **Step 4: Manual verification — walks through the spec's own Testing item #6 live**

As admin: set a `monthly_salary` for a test employee (Task 7's UI), add one company holiday and confirm weekly off-days are `sat,sun` (Task 1), have that employee clock in on a few days this month (Task 2), submit and approve one paid-type leave request within their quota, one that exceeds it, and one Unpaid-type request (Tasks 3-5), then visit `/admin/salary-deduction?employeeId=<id>&year=<Y>&month=<M>`.

Pass criteria:
- Working days in month excludes the holiday and weekends.
- The within-quota paid leave contributes 0 to deductible days.
- The over-quota paid leave contributes only its excess days.
- The Unpaid leave contributes its full day count.
- Any working day with no attendance and no leave coverage shows up in unexplained absence.
- The deduction amount equals `total deductible days × (monthly salary / working days in month)`.
- Repeating for an employee with no `monthly_salary` set shows "Salary not set," no crash, no `NaN`.

- [ ] **Step 5: Commit**

```bash
cd portal
git add lib/salaryDeductionData.ts app/admin/salary-deduction/ components/Sidebar.tsx
git commit -m "Add admin salary deduction summary page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: RLS & cross-employee isolation e2e tests

**Files:**
- Create: `e2e/attendance-leave-isolation.spec.ts`

**Interfaces:**
- Consumes: whatever seeding helper the existing `e2e/onboarding-isolation.spec.ts`/`e2e/rls-isolation.spec.ts` use (`createEmployeeRecord()` via `createAdminClient()`, then `createClient(url, anonKey)` + `signInWithPassword` per-employee) — read one of those files in full before writing this one and match its exact setup/teardown structure (`beforeAll`/`afterAll`, env var loading via the existing `dotenv` config in `playwright.config.ts`).

- [ ] **Step 1: Write the isolation spec**

Structure (mirror `e2e/onboarding-isolation.spec.ts` exactly for the boilerplate — admin client creation, two employee accounts seeded via `createEmployeeRecord()`, signed-in clients for each):

```typescript
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees' // exact import path/name: verify against e2e/onboarding-isolation.spec.ts's own import before writing

// NOTE: fill in the exact seeding/sign-in boilerplate from e2e/onboarding-isolation.spec.ts here —
// two employees (employeeA, employeeB) each with a signed-in Supabase client, plus an admin client.

test('employee cannot read another employee\'s attendance_records', async () => {
  // employeeA clocks in via their own client (insert into attendance_records).
  // employeeB's client attempts to select attendance_records where employee_id = employeeA's id.
  // Assert: result is an empty array, not an error, and not employeeA's row.
})

test('employee cannot write another employee\'s attendance_records', async () => {
  // employeeB's client attempts to insert an attendance_records row with employee_id = employeeA's id.
  // Assert: insert either errors or the row RLS-filters back to []; admin client confirms no such row exists.
})

test('employee cannot approve their own or anyone else\'s leave request', async () => {
  // employeeA submits a leave request via their own client (should succeed — self-insert is allowed).
  // employeeA's client then attempts to update that same request's status to 'approved'.
  // Assert: the update is silently filtered (0 rows affected) — leave_requests_self_cancel_pending's
  // WITH CHECK only allows transitioning to 'cancelled', not 'approved', so this must fail even
  // though it's the employee's own row.
  // employeeB's client attempts the same against employeeA's request — same assertion.
  // Admin client confirms the request is still 'pending' after both attempts.
})

test('employee cannot set their own or another employee\'s leave_allocations', async () => {
  // employeeA's client attempts to insert/update a leave_allocations row for themselves.
  // Assert: 0 rows affected (no self-write policy exists on this table at all).
})

test('employee cannot set their own or another employee\'s monthly_salary', async () => {
  // employeeA's client attempts to update employees.monthly_salary on their own row.
  // Assert: either the update is rejected/filtered, or — if Task 3's migration step flagged that
  // the existing employees self-update policy DOES permit this — this test is the one that proves
  // it and should FAIL first, driving a fix-up migration (see Task 3 Step 1's note). Do not weaken
  // this test to make it pass; if it fails, that's a real gap to close with a migration, not a test problem.
})

test('manager role has no elevated access over attendance/leave data', async () => {
  // Seed a third employee with role: 'manager'. Repeat the "cannot read/write another employee's
  // attendance_records" and "cannot approve leave" assertions using the manager's signed-in client
  // against employeeA's data. Assert identical restriction to a plain employee — no manager-specific
  // carve-out exists anywhere in this phase's RLS policies.
})

test('approving two overlapping leave requests for the same employee is rejected at the database level', async () => {
  // Using the admin client: submit two leave_requests for employeeA with overlapping date ranges.
  // Approve the first (should succeed). Attempt to approve the second.
  // Assert: the second update throws/errors with the overlap trigger's message, and the row's
  // status is still 'pending' afterward (verify via a follow-up select).
})

test('clocking in twice in one day does not create a second row', async () => {
  // employeeA's client clocks in (insert). employeeA's client clocks in again for the same day.
  // Assert: the second insert fails on the (employee_id, date) primary key (error.code === '23505'),
  // and admin client confirms exactly one attendance_records row exists for employeeA today.
})
```

Fill in the actual Supabase calls following exactly the query shapes used in `lib/attendance.ts`/`lib/leaveRequests.ts`/`lib/leaveTypes.ts` (imported directly where convenient, or raw `.from(...)` calls matching those files' shapes) rather than re-deriving new ones — every assertion above corresponds to a specific RLS policy or trigger from Tasks 2-5, so trace back to that policy's `using`/`with check` clause when deciding exactly what to assert.

- [ ] **Step 2: Run the e2e suite**

Run: `cd portal && npm run test:e2e -- attendance-leave-isolation`
Expected: all tests in this file PASS. If `manager role has no elevated access` or `employee cannot set...monthly_salary` fails, that's a real RLS gap this task exists to catch — write the fix-up migration (`0019_fix_...sql`, next sequential number) rather than loosening the test.

- [ ] **Step 3: Commit**

```bash
cd portal
git add e2e/attendance-leave-isolation.spec.ts
# include any fix-up migration this step's failures produced
git commit -m "Add attendance/leave RLS and cross-employee isolation e2e tests

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Full-phase integration pass

**Files:** none expected (verification only — fix-up commits only if Steps 1-4 surface a real bug).

**Interfaces:** none.

- [ ] **Step 1: Full test suite**

Run: `cd portal && npm run test` (vitest — all of Tasks 1, 2, 4, 8's unit tests) and `cd portal && npm run test:e2e` (Playwright — Task 10's spec plus every pre-existing e2e spec, to confirm nothing in this phase regressed onboarding/projects/notifications isolation).

Pass criteria: 100% green, output pristine (no stray warnings).

- [ ] **Step 2: `npm run lint` and a production build**

Run: `cd portal && npm run lint && npm run build`

Pass criteria: lint clean, build succeeds with no type errors across all nine new/modified route files and seven new `lib/*.ts` files.

- [ ] **Step 3: End-to-end manual walkthrough as both roles**

Run `cd portal && npm run dev`. As an employee: clock in/out, request leave (full-day and half-day), view balance, view timesheet, cancel a pending request. As admin: set weekly off-days and a holiday, manage leave type quotas and one employee's allocation, review and approve/reject leave, set an employee's monthly salary, view their timesheet and salary deduction summary.

Pass criteria: every page loads without console errors; every Sidebar link added across Tasks 1, 4, 5, 9 navigates correctly; role-gating holds (employee cannot reach any `/admin/**` route added in this phase).

- [ ] **Step 4: Cross-check every spec requirement has a corresponding, working feature**

Re-read `docs/superpowers/specs/2026-08-05-attendance-leave-salary-deduction-design.md` section by section and confirm: Attendance (clock in/out, timesheets, unexplained absence) ✓, Leave (request/balance/approve/reject/cancel, notifications both directions) ✓, Salary Deduction Summary (all four numbered computation steps, "salary not set" case) ✓, Permissions table (every row) ✓ — cross-referenced against Task 10's e2e coverage.

- [ ] **Step 5: Commit (only if Steps 1-4 required fixes)**

```bash
cd portal
git add -A
git commit -m "Fix integration issues found in full-phase verification pass

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

If nothing needed fixing, skip this step.

---

## Self-Review

**Spec coverage:**
1. Data Model (`company_settings`, `company_holidays`, `attendance_records`, `leave_types`, `leave_allocations`, `leave_requests`, `employees.monthly_salary`) → Tasks 1, 2, 3, 4. ✅
2. Attendance (clock in/out, timesheets, unexplained absence) → Tasks 2, 6. ✅
3. Leave (request/balance/notify/approve/reject/cancel/overlap-rejection) → Tasks 4, 5. ✅
4. Salary Deduction Summary (all 4 computation steps, "salary not set") → Tasks 7, 8, 9. ✅
5. Permissions table → enforced via RLS in every migration (Tasks 1-4) + verified in Task 10's e2e suite. ✅
6. Testing section items 1-9 → item 1 (dedup clock-in) Task 10; item 2 (balance nets pending+approved) Task 4's unit tests; item 3 (over-balance submit/approve allowed, excess deductible) Task 8's unit tests + Task 9's manual pass; item 4 (overlap rejection) Task 10; item 5 (unexplained absence) Task 2 + Task 8 unit tests; item 6 (full mixed-month scenario) Task 8's unit test + Task 9's manual walkthrough; item 7 ("salary not set") Task 8's unit test; item 8 (RLS cross-employee isolation) Task 10; item 9 (manager has no elevation) Task 10. ✅
7. Non-goals — no task implements payroll/tax/payslips/lateness/multi-session/mobile-detection/carry-over; explicitly called out in Global Constraints. ✅

**Placeholder scan:** no "TBD"/"TODO"/"handle appropriately" language — every code step has literal SQL/TypeScript. The few places implementers are pointed at an existing file to mirror exact syntax (Next.js `useActionState` wiring, table styling classes, employee-picker UI) are deliberate — those are established, working, in-repo patterns whose exact current-version syntax I have not verified firsthand against `node_modules/next/dist/docs/`, per this codebase's own explicit warning in `AGENTS.md` that its Next.js version has breaking changes from typical training-data knowledge; pointing at proven working code in the same repo is safer than asserting exact API syntax I can't independently confirm — not a scope gap.

**Type/naming consistency:** `computeDayPeriodDays` (Task 4) is the exact name Task 9's `lib/salaryDeductionData.ts` imports. `computeUnexplainedAbsenceDates` (Task 2) is the exact name Task 8's `computeSalaryDeductionSummary` imports. `isWorkingDay`/`toDateKey`/`parseWeeklyOffDays` (Task 1) are the exact names reused in Tasks 2, 6, 8, 9. `ApprovedLeaveForDeduction`/`SalaryDeductionSummary` (Task 8) are the exact types Task 9 constructs/returns. `DayPeriod` (Task 4) is imported by name in Task 8 and Task 9. `getCompanySetting`/`listCompanyHolidays`/`getMonthlySalary`/`listAttendanceInRange` are each defined once (Tasks 1, 1, 7, 2 respectively) and only ever imported, never redefined, by later tasks.

**Task dependency order:** Tasks 1 → 2 → {3, 6 (needs 2)} → 4 (needs 3) → 5 (needs 4) → 7 (needs 3's migration) → 8 (needs 1, 2, 4's pure functions — no DB) → 9 (needs 1, 2, 4, 7, 8) → 10 (needs 2, 3, 4, 5) → 11. Task 6 only strictly needs Task 2 (and Task 1 for weekend/holiday labeling) so it could run in parallel with Task 3 if using subagent-driven-development's task ordering flexibility — noted here rather than renumbered, since the linear order above is still valid and simpler for sequential execution.
