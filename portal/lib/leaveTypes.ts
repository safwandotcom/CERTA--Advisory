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
