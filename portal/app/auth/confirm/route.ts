import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Only ever redirect to a same-origin relative path here -- `next` comes
// from the query string of a link we email out, but nothing stops someone
// crafting their own /auth/confirm?...&next=https://evil.example link, so
// an absolute/protocol-relative value must never be honored (open redirect).
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return '/reset-password'
  }
  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = safeNextPath(searchParams.get('next'))

  // This route only ever handles password-recovery links -- reject any
  // other otp type rather than accepting whatever the query string claims.
  if (tokenHash && type === 'recovery') {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  return NextResponse.redirect(new URL('/forgot-password?error=expired', origin))
}
