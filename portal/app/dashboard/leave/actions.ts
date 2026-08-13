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
