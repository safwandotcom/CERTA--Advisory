import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isApi = path.startsWith('/api/')

  // /manager was replaced by the project-scoped /projects section — redirect
  // rather than 404 so any bookmarked links still land somewhere useful.
  if (path === '/manager') {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  if (
    !user &&
    (path.startsWith('/dashboard') ||
      path.startsWith('/admin') ||
      path.startsWith('/projects') ||
      path.startsWith('/onboarding') ||
      isApi)
  ) {
    // API callers get a status code, not an HTML login page.
    return isApi
      ? NextResponse.json({ error: 'Not authorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (path.startsWith('/admin') || isApi)) {
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (employee?.role !== 'admin' && employee?.role !== 'superadmin') {
      return isApi
        ? NextResponse.json({ error: 'Not authorized' }, { status: 403 })
        : NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (user && path.startsWith('/projects')) {
    const isTaskDetail = /^\/projects\/[^/]+\/tasks\//.test(path)
    if (!isTaskDetail) {
      const { data: employee } = await supabase
        .from('employees')
        .select('role')
        .eq('auth_user_id', user.id)
        .single()

      if (!['superadmin', 'admin', 'manager'].includes(employee?.role ?? '')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  // Onboarding gate: an employee/manager whose onboarding isn't at least
  // submitted is redirected to /onboarding from every other protected route.
  // Admin/superadmin never onboard themselves (they're the ones creating
  // other accounts), so this block only runs for /dashboard and /projects,
  // never /admin. Conversely, once onboarding is submitted or complete,
  // visiting /onboarding itself redirects away — the form isn't editable in
  // either of those states (see employee_onboarding_update_self RLS).
  if (user && (path.startsWith('/dashboard') || path.startsWith('/projects') || path.startsWith('/onboarding'))) {
    const { data: employee } = await supabase
      .from('employees')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .single()

    if (employee && (employee.role === 'employee' || employee.role === 'manager')) {
      const { data: onboarding } = await supabase
        .from('employee_onboarding')
        .select('status')
        .eq('employee_id', employee.id)
        .single()

      const needsOnboarding = !onboarding || onboarding.status === 'not_started' || onboarding.status === 'needs_correction'

      if (needsOnboarding && !path.startsWith('/onboarding')) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
      if (!needsOnboarding && path.startsWith('/onboarding')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

// Defence in depth only — the real authorization boundary for admin Server
// Actions and route handlers is requireAdmin() in lib/auth.ts, since actions are
// reachable by direct POST and several use the RLS-bypassing service-role key.
// '/admin/:path*' already covers /admin/employees/** and the Server Actions
// POSTed to those page URLs.
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/manager/:path*',
    '/projects/:path*',
    '/onboarding/:path*',
    '/api/employees/:path*',
  ],
}
