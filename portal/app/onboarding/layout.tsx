import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { signOutAction } from '@/app/actions'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-white">
      <header className="flex h-16 items-center justify-between border-b border-border px-6">
        <Image
          src="/brand/certa-lockup.png"
          alt="CERTA& Advisory"
          width={140}
          height={44}
          priority
          className="h-7 w-auto"
        />
        <form action={signOutAction}>
          <button type="submit" className="text-[0.8125rem] font-semibold text-ink-muted hover:text-ink">
            Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-10">{children}</main>
    </div>
  )
}
