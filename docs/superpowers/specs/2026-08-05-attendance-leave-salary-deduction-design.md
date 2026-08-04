# Employee Portal — Attendance, Leave & Salary Deduction Design

## Context

Second of three new subsystems requested together (see `REMAINING_TASKS.md` and the Onboarding spec, `2026-08-05-employee-onboarding-design.md`). This one covers daily clock in/out, leave requests with per-employee quotas, and a salary-deduction estimate that connects the two — requested together because the deduction figure depends on both attendance and leave data.

Departments are informational-only as of Phase 3; `department_managers` was dropped entirely, so there is no "employee's manager" concept in the system today. This spec deliberately does not reintroduce one — see Permissions.

## Scope

- Daily clock in / clock out, one session per day, no lateness judgment — raw timestamps only.
- Timesheets are a computed view over clock records, not separately entered.
- Leave: four types (Casual, Sick, Earned/Annual — paid, quota-based; Unpaid — no quota), full-day or half-day (first/last day of a range only) requests, admin approve/reject, per-employee-per-year quota allocation that admin can override.
- A read-only, live-computed monthly salary-deduction estimate per employee, based on unpaid leave, over-quota leave, and unexplained absences. This is an HR reference figure, not a payroll run.
- Admin-managed company holiday calendar and weekly off-days setting, used to compute "working days in a month" for both the deduction formula and (implicitly) attendance context.

Out of scope for this phase (deliberately deferred):
- Full payroll processing: tax withholding, payslip generation, disbursement — remains phase P5, which still has its own open scope question and is not started.
- A "reports to" / direct-manager relationship — leave approval and timesheet review stay admin/superadmin-only, matching the pattern already used for onboarding review. Reintroducing a manager concept was explicitly rejected for this phase.
- Lateness/on-time tracking — no fixed work-schedule start time is enforced or recorded.
- Break/multiple clock sessions per day.
- Mobile-specific restrictions on clock in/out — there's no mobile app and none is planned; the web page works the same on any device, no detection/blocking added.
- Automatic quota top-ups or carry-over rules across years (each year's `leave_allocations` row is independent; whether unused days carry over is an admin-manual decision for now, not automated).

## Data Model

**`company_settings`** (new) — generic key/value, admin-managed
- `key` (text, PK), `value` (text)
- Seeded: `weekly_off_days = 'sat,sun'`

**`company_holidays`** (new) — admin-managed
- `id`, `date` (unique), `name`

**`attendance_records`** (new) — one row per employee per calendar day
- `employee_id` (FK → employees), `date` (date) — PK together
- `clock_in_at` (timestamptz), `clock_out_at` (timestamptz, nullable until clock-out)

**`leave_types`** (new) — admin-managed
- `id`, `name` (text), `is_paid` (boolean), `default_annual_quota` (int, days; null = unlimited)
- Seeded at migration time: Casual (paid, `default_annual_quota = null`), Sick (paid, `null`), Earned/Annual (paid, `null`), Unpaid (not paid, `null` = unlimited). No real-world quota numbers (e.g. "10 Casual days/year") were specified for this spec, so the migration ships with the four types defined but no default day-counts — admin sets the actual numbers for Casual/Sick/Earned via the admin UI before allocations are meaningful. Until an employee has an explicit `leave_allocations` row (or the type's default is set), their balance for that type reads as 0, not unlimited — a missing quota should never silently mean "no limit" for a paid type.

**`leave_allocations`** (new) — per employee, per leave type, per calendar year
- `employee_id` (FK), `leave_type_id` (FK), `year` (int), `allocated_days` (numeric, supports halves) — PK (employee_id, leave_type_id, year)
- Defaults copied from `leave_types.default_annual_quota` when a new year/employee combination is first needed; admin can override any individual row.

**`leave_requests`** (new)
- `id`, `employee_id` (FK), `leave_type_id` (FK)
- `start_date`, `end_date` (date)
- `start_day_period`, `end_day_period` (`full` | `half_am` | `half_pm`, default `full`) — only the first and last day of a range can be half; any days in between are always full. When `start_date = end_date` (a single-day request), only `start_day_period` is read (0.5 or 1 day); `end_day_period` is ignored/kept equal to `start_day_period` for that row rather than allowed to disagree.
- `reason` (text)
- `status` (`pending` | `approved` | `rejected` | `cancelled`)
- `reviewed_by` (FK → employees, nullable), `reviewed_at` (nullable), `review_note` (text, nullable)
- `created_at`
- `total_days` computed (from date range and day-period modifiers) at read time, not stored — avoids it drifting out of sync if a request is edited pre-approval.

**`employees`** (existing table, extended)
- \+ `monthly_salary` (numeric, nullable until admin sets it) — BDT, admin/superadmin write-only.

## Attendance

Employee dashboard shows a Clock In / Clock Out control reflecting today's state (not clocked in → "Clock In"; clocked in, no clock-out yet → "Clock Out"; already completed → shows today's times, read-only). Clock In creates the day's `attendance_records` row (rejected if one already exists for today — no duplicate sessions); Clock Out fills `clock_out_at` on that row.

Timesheet views (daily / weekly / monthly, mirroring the Board/List/Calendar pattern already used for tasks where it makes sense) are read-only computations over `attendance_records` — no separate manual entry.

A calendar day counts as an **unexplained absence** for an employee if: it's a working day (not a weekly off-day per `company_settings`, not a `company_holidays` entry), there's no `attendance_records` row for that employee on that date, and no `approved` leave request covers that date.

## Leave

1. Employee opens "Request Leave," picks a leave type, start/end date, and optionally marks the first/last day as half. The form shows their current balance for that type: `allocated_days (this year) − (approved + pending) days already counted against it`. They can still submit even if the request would exceed the remaining balance — the UI warns, but doesn't block (admin makes the call).
2. Submitting creates a `pending` `leave_requests` row. A notification is emitted to every active admin/superadmin via the shared notification center (`2026-08-05-notification-center-design.md`).
3. Admin approves or rejects, with an optional note. Approving an already-overlapping-with-another-approved-request date range is rejected at the database level (no double-booking the same employee). A notification is emitted to the requesting employee either way.
4. Cancelling: employee can cancel their own `pending` request freely. Cancelling an `approved` request requires admin action (keeps balance/deduction math trustworthy — an employee can't silently un-take approved leave that already fed into a deduction estimate).

## Salary Deduction Summary

Admin-only view: pick an employee and a month, get a computed (not stored) breakdown:

1. **Working days in month** = calendar days in the month, minus days falling on a `company_settings.weekly_off_days` weekday, minus days in `company_holidays`.
2. **Deductible days**, summed from:
   - Approved leave requests of an `is_paid = false` type (Unpaid) overlapping the month.
   - The portion of approved leave for a paid type that exceeds that type's remaining `leave_allocations` balance for the year (over-quota days), overlapping the month.
   - Unexplained-absence days as defined above, within the month.
   - All day-counts respect half-day modifiers.
3. **Per-day rate** = `employees.monthly_salary ÷ working days in month` (if `monthly_salary` is unset, the summary shows "salary not set" instead of a figure).
4. **Deduction amount** = `deductible days × per-day rate`.

This is a reference figure for HR, recomputed fresh on every view — no snapshot is persisted, so it always reflects the current state of leave requests and attendance records. It does not generate a payslip, withhold tax, or trigger any payment action.

## Permissions

| Action | Superadmin | Admin | Manager | Employee |
|---|---|---|---|---|
| Clock in/out for self | — | — | ✅ | ✅ |
| View own attendance/timesheet/leave history/balance | — | — | ✅ | ✅ |
| Request/cancel-while-pending own leave | — | — | ✅ | ✅ |
| View/edit anyone's attendance or leave requests | ✅ | ✅ | ❌ | ❌ |
| Approve/reject/cancel-after-approval any leave request | ✅ | ✅ | ❌ | ❌ |
| Manage leave types, default quotas, holidays, weekly off-days | ✅ | ✅ | ❌ | ❌ |
| Set/override an employee's leave allocation | ✅ | ✅ | ❌ | ❌ |
| Set an employee's `monthly_salary` | ✅ | ✅ | ❌ | ❌ |
| View salary deduction summary (any employee) | ✅ | ✅ | ❌ | ❌ |

A `manager`-role account has identical rights to `employee` for their own attendance/leave — no manager-specific authority exists in this phase, matching the decision to keep approvals admin-only rather than reintroducing a manager mapping.

## Testing

1. Clocking in twice in one day doesn't create a second row for that date; clock-out before clock-in is rejected.
2. Leave balance calculation correctly nets out `pending` and `approved` requests, including half-day fractions, against the year's allocation.
3. Submitting a leave request that exceeds remaining balance is allowed; approving it is allowed; the excess days are correctly identified as deductible in the summary.
4. Approving two leave requests with overlapping dates for the same employee is rejected.
5. An unexplained-absence day (no clock-in, no approved leave, not a weekend/holiday) is correctly counted as deductible.
6. Salary deduction summary is correct for a month containing: a company holiday, a weekend, one approved paid-type leave within quota (not deductible), one approved paid-type leave that pushes past quota (partially deductible), one approved Unpaid-type leave (fully deductible), and one unexplained absence — verifies working-days math, per-day rate, and total.
7. Deduction summary shows "salary not set" rather than a number/error when `monthly_salary` is null.
8. RLS: employee cannot read or write another employee's `attendance_records`, `leave_requests`, `leave_allocations`, or `monthly_salary`; cannot approve/reject any leave request, including their own; cannot set their own salary or allocation.
9. RLS: manager has no elevated access over their own records — identical restrictions to an employee role on everyone else's data.

## Non-goals for this phase

- No tax withholding, payslip generation, or payment disbursement (stays in P5, still unscoped).
- No "reports to" manager relationship or manager-level leave approval.
- No lateness/on-time attendance status.
- No break/multiple clock-in sessions per day.
- No mobile-specific detection or restriction on clock in/out.
- No automated year-over-year leave carry-over — each year's allocation is a fresh, independently admin-set row.
