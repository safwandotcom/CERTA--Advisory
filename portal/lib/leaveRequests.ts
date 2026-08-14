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

export async function listPendingLeaveRequests(supabase: SupabaseClient): Promise<
  (LeaveRequest & { employee_name: string; leave_type_name: string })[]
> {
  // leave_requests has TWO foreign keys to employees (employee_id and
  // reviewed_by), so a bare `employees(name)` embed is ambiguous to
  // PostgREST (error PGRST201) -- it must be qualified with the specific
  // FK. This was silently broken (swallowed to []) from Task 5's original
  // ship until caught by live testing in Task 11's final-review pass: the
  // admin "Review Leave" page always showed "No pending leave requests"
  // regardless of actual data.
  const { data, error } = await supabase
    .from('leave_requests')
    .select(
      'id, employee_id, leave_type_id, start_date, end_date, start_day_period, end_day_period, reason, status, reviewed_by, reviewed_at, review_note, created_at, employees!leave_requests_employee_id_fkey(name), leave_types(name)'
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) console.error('listPendingLeaveRequests query failed:', error.message)
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    employee_name: (row.employees as { name: string })?.name ?? '',
    leave_type_name: (row.leave_types as { name: string })?.name ?? '',
  })) as (LeaveRequest & { employee_name: string; leave_type_name: string })[]
}

export async function listApprovedLeaveRequests(supabase: SupabaseClient): Promise<
  (LeaveRequest & { employee_name: string; leave_type_name: string })[]
> {
  // See listPendingLeaveRequests' comment above: employees(name) is
  // ambiguous (leave_requests has two FKs to employees) and must be
  // qualified.
  const { data, error } = await supabase
    .from('leave_requests')
    .select(
      'id, employee_id, leave_type_id, start_date, end_date, start_day_period, end_day_period, reason, status, reviewed_by, reviewed_at, review_note, created_at, employees!leave_requests_employee_id_fkey(name), leave_types(name)'
    )
    .eq('status', 'approved')
    .order('start_date', { ascending: true })
  if (error) console.error('listApprovedLeaveRequests query failed:', error.message)
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    employee_name: (row.employees as { name: string })?.name ?? '',
    leave_type_name: (row.leave_types as { name: string })?.name ?? '',
  })) as (LeaveRequest & { employee_name: string; leave_type_name: string })[]
}

// Admin-only: cancel an already-approved leave request (spec §Leave item 4).
// Unlike reviewLeaveRequest (pending -> approved/rejected), this transitions
// approved -> cancelled; the `.eq('status', 'approved')` guard mirrors
// reviewLeaveRequest's not-found handling so a request that's already been
// changed out from under the admin (e.g. concurrently cancelled) reports a
// clear error instead of silently no-op'ing.
export async function adminCancelApprovedLeaveRequest(
  adminClient: SupabaseClient,
  requestId: string
): Promise<{ error?: string; employeeId?: string }> {
  const { data, error } = await adminClient
    .from('leave_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('status', 'approved')
    .select('id, employee_id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Request is no longer approved' }
  return { employeeId: data[0].employee_id }
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
