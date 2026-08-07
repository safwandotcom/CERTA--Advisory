'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const MIN_DISPLAY_MS = 450
// Safety-net ceiling: normal navigations always hide via the pathname/
// searchParams effect below, well under this. But a pushState/replaceState
// call that doesn't actually change pathname or searchParams (e.g. a
// same-route `router.push`, such as NotificationBell navigating to the
// page the user is already on) never fires that effect, so nothing would
// otherwise hide the overlay again. This ceiling guarantees it always comes
// back down, regardless of whether the route actually changed.
const MAX_VISIBLE_MS = 3000

function OverlayMarkup({ hidden }: { hidden: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={hidden}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-300 ${
        hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size decorative spinner, not worth next/image's layout machinery */}
      <img
        src="/brand/certa-mark.png"
        alt=""
        className="h-16 w-16 animate-spin motion-reduce:animate-none"
      />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

function RouteTransitionWatcher() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(true)
  const shownAtRef = useRef(performance.now())
  const skipNextRouteChangeRef = useRef(true)
  const forceHideTimerRef = useRef<number | undefined>(undefined)

  function clearForceHideTimer() {
    if (forceHideTimerRef.current !== undefined) {
      window.clearTimeout(forceHideTimerRef.current)
      forceHideTimerRef.current = undefined
    }
  }

  // Initial page load: hide once the document has fully loaded, with a
  // minimum display floor so the overlay registers as a moment, not a flash.
  useEffect(() => {
    let timer: number | undefined
    function armHide() {
      const elapsed = performance.now() - shownAtRef.current
      timer = window.setTimeout(() => setVisible(false), Math.max(0, MIN_DISPLAY_MS - elapsed))
    }
    if (document.readyState === 'complete') {
      armHide()
    } else {
      window.addEventListener('load', armHide, { once: true })
    }
    return () => {
      window.removeEventListener('load', armHide)
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  // Client-side navigation start: Next's router drives history.pushState /
  // replaceState under the hood for every client-side transition (<Link>,
  // router.push/replace, and server-action redirects alike), so patching
  // those two entry points — plus popstate for back/forward — catches every
  // navigation regardless of which component triggered it.
  useEffect(() => {
    function startNavigation() {
      shownAtRef.current = performance.now()
      // Next.js 16's router itself calls history.pushState/replaceState from
      // inside a useInsertionEffect-timed phase of its own client-side
      // transition machinery. React forbids scheduling updates synchronously
      // during that phase ("useInsertionEffect must not schedule updates") —
      // doing it anyway doesn't just warn, it corrupts the scheduler badly
      // enough to hang the tab. Deferring the state update to a microtask
      // moves it outside that call stack while still running before the
      // next paint.
      queueMicrotask(() => setVisible(true))

      // Safety net (see MAX_VISIBLE_MS above): a genuine new navigation
      // resets the ceiling rather than stacking a second pending force-hide
      // on top of an earlier one.
      clearForceHideTimer()
      forceHideTimerRef.current = window.setTimeout(() => {
        setVisible(false)
        forceHideTimerRef.current = undefined
      }, MAX_VISIBLE_MS)
    }
    const originalPush = window.history.pushState.bind(window.history)
    const originalReplace = window.history.replaceState.bind(window.history)
    window.history.pushState = ((...args: Parameters<History['pushState']>) => {
      startNavigation()
      return originalPush(...args)
    }) as History['pushState']
    window.history.replaceState = ((...args: Parameters<History['replaceState']>) => {
      startNavigation()
      return originalReplace(...args)
    }) as History['replaceState']
    window.addEventListener('popstate', startNavigation)
    return () => {
      window.history.pushState = originalPush
      window.history.replaceState = originalReplace
      window.removeEventListener('popstate', startNavigation)
      clearForceHideTimer()
    }
  }, [])

  // Client-side navigation complete: the rendered route changed, so hide the
  // overlay (same minimum-display floor as the initial load).
  useEffect(() => {
    if (skipNextRouteChangeRef.current) {
      // The initial mount also fires this effect once; the window-load
      // effect above already owns hiding the overlay for the first paint.
      skipNextRouteChangeRef.current = false
      return
    }
    const elapsed = performance.now() - shownAtRef.current
    const timer = window.setTimeout(() => {
      setVisible(false)
      // The route actually changed, so the safety-net ceiling for this
      // navigation is no longer needed — clear it rather than let it fire
      // a redundant force-hide later.
      clearForceHideTimer()
    }, Math.max(0, MIN_DISPLAY_MS - elapsed))
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname/searchParams are the navigation signal, not data this effect reads
  }, [pathname, searchParams])

  return <OverlayMarkup hidden={!visible} />
}

export function RouteTransitionOverlay() {
  return (
    <Suspense fallback={<OverlayMarkup hidden={false} />}>
      <RouteTransitionWatcher />
    </Suspense>
  )
}
