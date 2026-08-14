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

// Formats a Date as a YYYY-MM-DD string in Asia/Dhaka, independent of the
// host process's timezone — Postgres `date` columns and this app's
// date-range math are both calendar-day-oriented, so using toISOString()
// (UTC) here would shift dates near midnight. Using the host's local
// timezone (via getFullYear()/getMonth()/getDate()) would agree with this
// only on a host whose TZ happens to already be Asia/Dhaka; on a UTC host
// (Vercel, most containers/CI) that would disagree with migration 0019's
// `(now() at time zone 'Asia/Dhaka')::date` RLS comparison for roughly six
// hours every day. The `en-CA` locale formats as YYYY-MM-DD directly
// (verified experimentally against this project's Node/ICU version).
const DHAKA_DATE_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function toDateKey(date: Date): string {
  return DHAKA_DATE_KEY_FORMATTER.format(date)
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
