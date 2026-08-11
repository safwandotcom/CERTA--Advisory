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
