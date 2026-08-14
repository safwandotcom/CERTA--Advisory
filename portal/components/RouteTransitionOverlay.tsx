'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Don't show a spinner at all for a navigation that resolves quickly — most
// of them, once the app's server-side round trips are reasonably fast. This
// is the standard "delay before show" pattern: a full-screen loading state
// that appears for every click, even instant ones, reads as slow regardless
// of how fast the underlying fetch actually is. Only navigations that are
// still pending after this delay get a spinner at all.
const SHOW_DELAY_MS = 150
// Once the overlay is actually showing, hold it just long enough to avoid a
// single-frame flicker on a navigation that finishes right as the delay
// above elapses — not a deliberate "moment", just anti-flicker insurance.
const MIN_DISPLAY_MS = 150
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
  // Initial page load: nothing has painted yet (the browser's own blank/white
  // tab is already showing), so there's no flash to prevent — show the
  // overlay from first render rather than delaying it.
  const [visible, setVisible] = useState(true)
  // performance.now() is impure to call during render (React flags it); read
  // it inside effects instead, never as a useState/useRef initializer.
  const shownAtRef = useRef(0)
  const skipNextRouteChangeRef = useRef(true)
  const showTimerRef = useRef<number | undefined>(undefined)
  const forceHideTimerRef = useRef<number | undefined>(undefined)

  function clearShowTimer() {
    if (showTimerRef.current !== undefined) {
      window.clearTimeout(showTimerRef.current)
      showTimerRef.current = undefined
    }
  }

  function clearForceHideTimer() {
    if (forceHideTimerRef.current !== undefined) {
      window.clearTimeout(forceHideTimerRef.current)
      forceHideTimerRef.current = undefined
    }
  }

  // Initial page load: hide once the document has fully loaded, with a
  // small minimum-display floor so a same-frame show/hide never flickers.
  useEffect(() => {
    shownAtRef.current = performance.now()
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
      // Don't show anything yet — only arm a delayed reveal. If the route
      // change effect below fires before this timer does (the common case
      // once the backend is reasonably fast), the timer is cancelled and no
      // spinner ever appears for this navigation.
      clearShowTimer()
      showTimerRef.current = window.setTimeout(() => {
        shownAtRef.current = performance.now()
        setVisible(true)
        showTimerRef.current = undefined
      }, SHOW_DELAY_MS)

      // Safety net (see MAX_VISIBLE_MS above): a genuine new navigation
      // resets the ceiling rather than stacking a second pending force-hide
      // on top of an earlier one. Measured from navigation start, not from
      // whenever (or whether) the overlay actually becomes visible.
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
      clearShowTimer()
      clearForceHideTimer()
    }
  }, [])

  // Client-side navigation complete: the rendered route changed. Cancel any
  // still-pending delayed reveal (the fast-navigation case: nothing was ever
  // shown, so there's nothing to hide) and, if the overlay did make it on
  // screen, hide it — respecting the same small minimum-display floor.
  useEffect(() => {
    if (skipNextRouteChangeRef.current) {
      // The initial mount also fires this effect once; the window-load
      // effect above already owns hiding the overlay for the first paint.
      skipNextRouteChangeRef.current = false
      return
    }
    clearShowTimer()
    clearForceHideTimer()
    const elapsed = performance.now() - shownAtRef.current
    const timer = window.setTimeout(() => setVisible(false), Math.max(0, MIN_DISPLAY_MS - elapsed))
    return () => window.clearTimeout(timer)
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
