import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/PageHeader'
import { getOnboarding } from '@/lib/onboarding'
import OnboardingForm from './OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: employee } = await supabase
    .from('employees')
    .select('id, name')
    .eq('auth_user_id', user.id)
    .single()

  if (!employee) redirect('/login')

  const onboarding = await getOnboarding(supabase, employee.id)

  const paths = [onboarding?.national_id_path, onboarding?.offer_letter_path, onboarding?.photo_path].filter(
    (p): p is string => Boolean(p)
  )

  const { data: signedUrls } = paths.length
    ? await supabase.storage.from('onboarding-documents').createSignedUrls(paths, 60 * 10)
    : { data: [] as { path: string; signedUrl: string }[] }

  function urlFor(path: string | null | undefined) {
    if (!path) return null
    return signedUrls?.find((s) => s.path === path)?.signedUrl ?? null
  }

  return (
    <>
      <PageHeader
        title={`Welcome, ${employee.name.split(' ')[0]}`}
        subtitle="Complete your onboarding details before continuing to the rest of the portal"
      />
      <OnboardingForm
        onboarding={onboarding}
        documentUrls={{
          nationalId: urlFor(onboarding?.national_id_path),
          offerLetter: urlFor(onboarding?.offer_letter_path),
          photo: urlFor(onboarding?.photo_path),
        }}
        correctionNote={onboarding?.correction_notes ?? null}
      />
    </>
  )
}
