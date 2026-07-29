import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client. Bypasses Row-Level Security — only ever import this
// from server-only code (server actions, route handlers, scripts).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
