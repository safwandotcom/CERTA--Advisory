import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, NOT_AUTHORIZED } from '@/lib/auth'
import { listDepartments } from '@/lib/departments'
import { getOnboarding } from '@/lib/onboarding'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only the admin edit page consumes this route — the employee dashboard
  // queries Supabase directly — so admin-only is the correct scope here.
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: NOT_AUTHORIZED }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { data: employee } = await supabase.from('employees').select('*').eq('id', id).single()
  const { data: documents } = await supabase
    .from('employee_documents')
    .select('*')
    .eq('employee_id', id)

  const departments = await listDepartments(supabase)

  const onboarding = await getOnboarding(supabase, id)
  const onboardingPaths = [onboarding?.national_id_path, onboarding?.offer_letter_path, onboarding?.photo_path].filter(
    (p): p is string => Boolean(p)
  )
  // Signed URLs for onboarding documents are generated via the service-role
  // client, not the admin's own RLS-scoped `supabase` client. Migration 0012
  // re-keyed the onboarding-documents bucket's self-insert/self-update/select
  // policies to a bare auth.uid() check (no cross-table subquery) because
  // cross-table subqueries don't reliably evaluate during real Storage-API
  // calls in this project — the select policy's `or public.is_admin()`
  // branch (which an admin's own session would need) still has that same
  // subquery shape and was never proven to work, only left in place for
  // documentation. Using the service-role client here sidesteps that
  // untested path entirely, matching the established convention already
  // used for every other admin storage operation in this codebase (e.g.
  // uploadDocumentAction's use of createAdminClient() for employee-documents).
  const adminClient = createAdminClient()
  const { data: onboardingSignedUrls } = onboardingPaths.length
    ? await adminClient.storage.from('onboarding-documents').createSignedUrls(onboardingPaths, 60 * 10)
    : { data: [] as { path: string; signedUrl: string }[] }

  function onboardingUrlFor(path: string | null | undefined) {
    if (!path) return null
    return onboardingSignedUrls?.find((s) => s.path === path)?.signedUrl ?? null
  }

  return NextResponse.json({
    employee,
    documents: documents ?? [],
    departments,
    onboarding,
    onboardingDocumentUrls: {
      nationalId: onboardingUrlFor(onboarding?.national_id_path),
      offerLetter: onboardingUrlFor(onboarding?.offer_letter_path),
      photo: onboardingUrlFor(onboarding?.photo_path),
    },
  })
}
