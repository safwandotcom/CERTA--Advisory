import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '../lib/supabase/admin'
import { createEmployeeRecord } from '../lib/employees'
import { employeeIdToEmail } from '../lib/employeeAuth'
import { clockIn } from '../lib/attendance'
import { toDateKey } from '../lib/companySettings'
import { submitLeaveRequest } from '../lib/leaveRequests'
import { listLeaveTypes } from '../lib/leaveTypes'

async function signInAsEmployee(employeeId: string, password: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await client.auth.signInWithPassword({ email: employeeIdToEmail(employeeId), password })
  return client
}

test("employee cannot read another employee's attendance_records", async () => {
  const adminClient = createAdminClient()

  const aId = `att-a-${Date.now()}`
  const { employeeRowId: aRowId } = await createEmployeeRecord(adminClient, {
    employeeId: aId,
    password: 'password-att-a-123',
    name: 'Attendance Employee A',
    role: 'employee',
  })

  const bId = `att-b-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId: bId,
    password: 'password-att-b-123',
    name: 'Attendance Employee B',
    role: 'employee',
  })

  const aClient = await signInAsEmployee(aId, 'password-att-a-123')
  const { error: clockInError } = await clockIn(aClient, aRowId)
  expect(clockInError).toBeUndefined()

  const bClient = await signInAsEmployee(bId, 'password-att-b-123')

  // attendance_select_self_or_admin (0016_attendance.sql:13-17) only lets a
  // row through when the caller's own employee row matches employee_id, or
  // the caller is_admin(). Employee B is neither, so RLS filters A's row
  // out entirely: empty result, not an error.
  const { data: visibleToB, error: selectError } = await bClient
    .from('attendance_records')
    .select('employee_id, date, clock_in_at')
    .eq('employee_id', aRowId)
  expect(selectError).toBeNull()
  expect(visibleToB).toHaveLength(0)
})

test("employee cannot write another employee's attendance_records", async () => {
  const adminClient = createAdminClient()
  const today = toDateKey(new Date())

  const aId = `att-w-a-${Date.now()}`
  const { employeeRowId: aRowId } = await createEmployeeRecord(adminClient, {
    employeeId: aId,
    password: 'password-att-w-a-123',
    name: 'Attendance Write A',
    role: 'employee',
  })

  const bId = `att-w-b-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId: bId,
    password: 'password-att-w-b-123',
    name: 'Attendance Write B',
    role: 'employee',
  })

  const bClient = await signInAsEmployee(bId, 'password-att-w-b-123')

  // attendance_insert_self's WITH CHECK (0016_attendance.sql:26-30) requires
  // the inserted row's employee_id to match an employees row whose
  // auth_user_id is the caller. B's session can never satisfy that for A's
  // employee_id, so this INSERT violates RLS outright -- a real Postgres
  // error, not a silent filter (INSERT has no pre-filter step the way
  // UPDATE's USING clause does).
  const { error: insertError } = await bClient
    .from('attendance_records')
    .insert({ employee_id: aRowId, date: today, clock_in_at: new Date().toISOString() })
  expect(insertError).not.toBeNull()

  const { data: rows } = await adminClient
    .from('attendance_records')
    .select('employee_id')
    .eq('employee_id', aRowId)
    .eq('date', today)
  expect(rows).toHaveLength(0)
})

test("employee cannot approve their own or anyone else's leave request", async () => {
  const adminClient = createAdminClient()
  const leaveTypes = await listLeaveTypes(adminClient)
  const leaveTypeId = leaveTypes[0].id

  const aId = `leave-appr-a-${Date.now()}`
  const { employeeRowId: aRowId } = await createEmployeeRecord(adminClient, {
    employeeId: aId,
    password: 'password-leave-a-123',
    name: 'Leave Approve A',
    role: 'employee',
  })

  const bId = `leave-appr-b-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId: bId,
    password: 'password-leave-b-123',
    name: 'Leave Approve B',
    role: 'employee',
  })

  const aClient = await signInAsEmployee(aId, 'password-leave-a-123')
  const bClient = await signInAsEmployee(bId, 'password-leave-b-123')

  // leave_requests_insert_self (0018_leave_requests.sql:32-36) allows a
  // self-insert while status stays 'pending' -- the default the column
  // takes when submitLeaveRequest() doesn't set it explicitly.
  const { error: submitError } = await submitLeaveRequest(aClient, aRowId, {
    leaveTypeId,
    startDate: '2026-09-01',
    endDate: '2026-09-02',
    startDayPeriod: 'full',
    endDayPeriod: 'full',
    reason: 'Approval isolation test',
  })
  expect(submitError).toBeUndefined()

  const { data: request } = await adminClient
    .from('leave_requests')
    .select('id')
    .eq('employee_id', aRowId)
    .eq('status', 'pending')
    .single()
  const requestId = request!.id as string

  // leave_requests_self_cancel_pending (0018_leave_requests.sql:43-50): its
  // USING clause passes for A on their own pending row, but the WITH CHECK
  // clause only permits the new status to be 'cancelled'. Setting 'approved'
  // fails WITH CHECK on a row that DID pass USING -- Postgres reports that
  // as a genuine RLS-violation error, distinct from the silent 0-row filter
  // you get below when USING itself excludes the row.
  const { error: selfApproveError } = await aClient
    .from('leave_requests')
    .update({ status: 'approved' })
    .eq('id', requestId)
  expect(selfApproveError).not.toBeNull()

  // For B, the same policy's USING `exists` check fails outright (B is not
  // this request's employee), so the row never enters the update's
  // candidate set at all: no error, just 0 rows affected.
  const { data: outsiderApproveResult, error: outsiderApproveError } = await bClient
    .from('leave_requests')
    .update({ status: 'approved' })
    .eq('id', requestId)
    .select('id')
  expect(outsiderApproveError).toBeNull()
  expect(outsiderApproveResult).toHaveLength(0)

  const { data: stillPending } = await adminClient
    .from('leave_requests')
    .select('status')
    .eq('id', requestId)
    .single()
  expect(stillPending?.status).toBe('pending')
})

test("employee cannot set their own or another employee's leave_allocations", async () => {
  const adminClient = createAdminClient()
  const leaveTypes = await listLeaveTypes(adminClient)
  const leaveTypeId = leaveTypes[0].id
  const year = new Date().getFullYear()

  const aId = `alloc-a-${Date.now()}`
  const { employeeRowId: aRowId } = await createEmployeeRecord(adminClient, {
    employeeId: aId,
    password: 'password-alloc-a-123',
    name: 'Allocation A',
    role: 'employee',
  })

  const aClient = await signInAsEmployee(aId, 'password-alloc-a-123')

  // leave_allocations has exactly one write policy,
  // leave_allocations_admin_write (0017_leave_types_and_allocations.sql:41-42,
  // "for all using (public.is_admin()) with check (public.is_admin())") -- no self-write
  // policy exists on this table at all, per that migration's own comment
  // (0017_leave_types_and_allocations.sql:38-40). For a plain employee,
  // is_admin() is false, so the WITH CHECK on this INSERT fails outright: a
  // real RLS error, not a silent filter (INSERT has nothing to silently
  // filter).
  const { error: insertError } = await aClient
    .from('leave_allocations')
    .insert({ employee_id: aRowId, leave_type_id: leaveTypeId, year, allocated_days: 20 })
  expect(insertError).not.toBeNull()

  const { data: rows } = await adminClient
    .from('leave_allocations')
    .select('allocated_days')
    .eq('employee_id', aRowId)
    .eq('leave_type_id', leaveTypeId)
    .eq('year', year)
  expect(rows).toHaveLength(0)
})

test("employee cannot set their own or another employee's monthly_salary", async () => {
  const adminClient = createAdminClient()

  const aId = `salary-a-${Date.now()}`
  const { employeeRowId: aRowId } = await createEmployeeRecord(adminClient, {
    employeeId: aId,
    password: 'password-salary-a-123',
    name: 'Salary A',
    role: 'employee',
  })

  const aClient = await signInAsEmployee(aId, 'password-salary-a-123')

  // `employees` carries no self-update policy at all (verified by reading
  // every migration from 0001_init.sql through 0018_leave_requests.sql --
  // see 0017_leave_types_and_allocations.sql:44-60's own audit comment). The
  // only UPDATE-applicable policy is employees_admin_write
  // (0001_init.sql:47-52, "for all using (public.is_admin()) with check
  // (public.is_admin())"). For a non-admin caller the USING clause itself fails, so
  // their own row is excluded from the update's candidate set before WITH
  // CHECK is ever considered: a silent 0-row no-op, not an error.
  const { data: updateResult, error: updateError } = await aClient
    .from('employees')
    .update({ monthly_salary: 999999 })
    .eq('id', aRowId)
    .select('id')
  expect(updateError).toBeNull()
  expect(updateResult).toHaveLength(0)

  const { data: unchanged } = await adminClient
    .from('employees')
    .select('monthly_salary')
    .eq('id', aRowId)
    .single()
  expect(unchanged?.monthly_salary).toBeNull()
})

test('manager role has no elevated access over attendance/leave data', async () => {
  const adminClient = createAdminClient()
  const today = toDateKey(new Date())
  const leaveTypes = await listLeaveTypes(adminClient)
  const leaveTypeId = leaveTypes[0].id

  const aId = `mgr-target-${Date.now()}`
  const { employeeRowId: aRowId } = await createEmployeeRecord(adminClient, {
    employeeId: aId,
    password: 'password-mgr-target-123',
    name: 'Manager Target',
    role: 'employee',
  })

  const mgrId = `mgr-role-${Date.now()}`
  await createEmployeeRecord(adminClient, {
    employeeId: mgrId,
    password: 'password-mgr-role-123',
    name: 'Manager Role',
    role: 'manager',
  })

  const aClient = await signInAsEmployee(aId, 'password-mgr-target-123')
  const mgrClient = await signInAsEmployee(mgrId, 'password-mgr-role-123')

  const { error: clockInError } = await clockIn(aClient, aRowId)
  expect(clockInError).toBeUndefined()

  // is_admin() was originally defined in 0001_init.sql:23-34 (role = 'admin'
  // only) but is redefined via `create or replace function` in
  // 0002_phase2_roles_departments_tasks.sql:36-47 to check
  // role in ('admin', 'superadmin') -- that later definition is the one
  // actually in effect. Either way 'manager' is excluded: it's a distinct
  // role with no carve-out anywhere in the attendance/leave policies
  // (0016-0018_*.sql), so a manager is treated exactly like a plain
  // employee for cross-employee access to this data.
  const { data: visibleAttendance, error: attendanceSelectError } = await mgrClient
    .from('attendance_records')
    .select('employee_id')
    .eq('employee_id', aRowId)
  expect(attendanceSelectError).toBeNull()
  expect(visibleAttendance).toHaveLength(0)

  const { error: attendanceInsertError } = await mgrClient
    .from('attendance_records')
    .insert({ employee_id: aRowId, date: today, clock_in_at: new Date().toISOString() })
  expect(attendanceInsertError).not.toBeNull()

  const { error: submitError } = await submitLeaveRequest(aClient, aRowId, {
    leaveTypeId,
    startDate: '2026-09-05',
    endDate: '2026-09-06',
    startDayPeriod: 'full',
    endDayPeriod: 'full',
    reason: 'Manager isolation test',
  })
  expect(submitError).toBeUndefined()

  const { data: request } = await adminClient
    .from('leave_requests')
    .select('id')
    .eq('employee_id', aRowId)
    .eq('status', 'pending')
    .single()
  const requestId = request!.id as string

  // Same leave_requests_self_cancel_pending USING clause as the dedicated
  // approval test above: the manager is not this request's employee, so the
  // `exists` check fails and the row is excluded from the update entirely.
  const { data: mgrApproveResult, error: mgrApproveError } = await mgrClient
    .from('leave_requests')
    .update({ status: 'approved' })
    .eq('id', requestId)
    .select('id')
  expect(mgrApproveError).toBeNull()
  expect(mgrApproveResult).toHaveLength(0)

  const { data: stillPending } = await adminClient
    .from('leave_requests')
    .select('status')
    .eq('id', requestId)
    .single()
  expect(stillPending?.status).toBe('pending')
})

test('approving two overlapping leave requests for the same employee is rejected at the database level', async () => {
  const adminClient = createAdminClient()
  const leaveTypes = await listLeaveTypes(adminClient)
  const leaveTypeId = leaveTypes[0].id

  const aId = `overlap-a-${Date.now()}`
  const { employeeRowId: aRowId } = await createEmployeeRecord(adminClient, {
    employeeId: aId,
    password: 'password-overlap-a-123',
    name: 'Overlap A',
    role: 'employee',
  })

  const { data: firstRequest } = await adminClient
    .from('leave_requests')
    .insert({ employee_id: aRowId, leave_type_id: leaveTypeId, start_date: '2026-10-01', end_date: '2026-10-05' })
    .select('id')
    .single()

  const { data: secondRequest } = await adminClient
    .from('leave_requests')
    .insert({ employee_id: aRowId, leave_type_id: leaveTypeId, start_date: '2026-10-03', end_date: '2026-10-10' })
    .select('id')
    .single()

  const { error: firstApproveError } = await adminClient
    .from('leave_requests')
    .update({ status: 'approved' })
    .eq('id', firstRequest!.id)
  expect(firstApproveError).toBeNull()

  // enforce_no_overlapping_approved_leave() / leave_requests_enforce_no_overlap
  // (0018_leave_requests.sql:58-83) fires before this UPDATE and raises a
  // plain exception when the row being approved overlaps another
  // already-approved request for the same employee. Using the admin client
  // here isolates the trigger's behavior from the RLS policies exercised by
  // the tests above (admin bypasses those entirely via is_admin()).
  const { error: secondApproveError } = await adminClient
    .from('leave_requests')
    .update({ status: 'approved' })
    .eq('id', secondRequest!.id)
  expect(secondApproveError).not.toBeNull()
  expect(secondApproveError?.message).toContain('already has an approved leave request overlapping')

  const { data: secondAfter } = await adminClient
    .from('leave_requests')
    .select('status')
    .eq('id', secondRequest!.id)
    .single()
  expect(secondAfter?.status).toBe('pending')
})

test('clocking in twice in one day does not create a second row', async () => {
  const adminClient = createAdminClient()
  const today = toDateKey(new Date())

  const aId = `dbl-clockin-${Date.now()}`
  const { employeeRowId: aRowId } = await createEmployeeRecord(adminClient, {
    employeeId: aId,
    password: 'password-dbl-clockin-123',
    name: 'Double Clock-in',
    role: 'employee',
  })

  const aClient = await signInAsEmployee(aId, 'password-dbl-clockin-123')

  const { error: firstClockInError } = await clockIn(aClient, aRowId)
  expect(firstClockInError).toBeUndefined()

  // attendance_records' primary key is (employee_id, date)
  // (0016_attendance.sql:1-7). A second clock-in for the same employee/day
  // hits that primary key's unique_violation. Inserting directly here
  // (rather than via clockIn()) so the raw Postgres error code survives --
  // clockIn() itself maps 23505 to a friendly message string for the app
  // layer.
  const { error: secondClockInError } = await aClient
    .from('attendance_records')
    .insert({ employee_id: aRowId, date: today, clock_in_at: new Date().toISOString() })
  expect(secondClockInError?.code).toBe('23505')

  const { data: rows } = await adminClient
    .from('attendance_records')
    .select('employee_id')
    .eq('employee_id', aRowId)
    .eq('date', today)
  expect(rows).toHaveLength(1)
})
