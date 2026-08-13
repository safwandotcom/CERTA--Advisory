'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { updateLeaveTypeQuota, setLeaveAllocation } from '@/lib/leaveTypes'

export type LeaveTypesActionState = { error?: string; success?: string }

export async function updateDefaultQuotaAction(
  _prevState: LeaveTypesActionState,
  formData: FormData
): Promise<LeaveTypesActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const id = String(formData.get('id') ?? '')
  const rawQuota = String(formData.get('defaultAnnualQuota') ?? '').trim()
  if (!id) return { error: 'Missing leave type' }

  const defaultAnnualQuota = rawQuota === '' ? null : Number(rawQuota)
  if (defaultAnnualQuota !== null && !Number.isFinite(defaultAnnualQuota)) {
    return { error: 'Default quota must be a number' }
  }

  const supabase = await createClient()
  const { error } = await updateLeaveTypeQuota(supabase, id, defaultAnnualQuota)
  if (error) return { error }
  revalidatePath('/admin/leave-types')
  return { success: 'Default quota updated' }
}

export async function setAllocationAction(
  _prevState: LeaveTypesActionState,
  formData: FormData
): Promise<LeaveTypesActionState> {
  try {
    await requireAdmin()
  } catch {
    return { error: NOT_AUTHORIZED }
  }

  const employeeId = String(formData.get('employeeId') ?? '')
  const leaveTypeId = String(formData.get('leaveTypeId') ?? '')
  const year = Number(formData.get('year') ?? '')
  const allocatedDays = Number(formData.get('allocatedDays') ?? '')

  if (!employeeId || !leaveTypeId || !Number.isFinite(year)) {
    return { error: 'Missing employee, leave type, or year' }
  }
  if (!Number.isFinite(allocatedDays) || allocatedDays < 0) {
    return { error: 'Allocated days must be a non-negative number' }
  }

  const supabase = await createClient()
  const { error } = await setLeaveAllocation(supabase, employeeId, leaveTypeId, year, allocatedDays)
  if (error) return { error }
  revalidatePath('/admin/leave-types')
  return { success: 'Allocation updated' }
}
