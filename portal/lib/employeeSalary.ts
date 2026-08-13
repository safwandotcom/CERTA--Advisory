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
