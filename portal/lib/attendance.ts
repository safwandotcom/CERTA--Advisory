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
