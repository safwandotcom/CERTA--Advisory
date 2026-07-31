'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { LayoutGrid, List as ListIcon, Calendar as CalendarIcon } from 'lucide-react'

export type ViewMode = 'board' | 'list' | 'calendar'

const OPTIONS: { mode: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { mode: 'board', label: 'Board', icon: LayoutGrid },
  { mode: 'list', label: 'List', icon: ListIcon },
  { mode: 'calendar', label: 'Calendar', icon: CalendarIcon },
]

function isViewMode(value: string | null): value is ViewMode {
  return value === 'board' || value === 'list' || value === 'calendar'
}

// Reading localStorage on mount and syncing it into React state is the
// textbook "external system" case the project's react-hooks/set-state-in-effect
// rule flags a plain `useEffect(() => setMode(...))` for (it already fired on
// this exact pattern) — React's own recommendation for syncing with a mutable
// external source like localStorage is `useSyncExternalStore`, which also
// sidesteps the SSR/hydration mismatch a `useState(() => localStorage...)`
// lazy initializer would otherwise cause (server has no `window`).
//
// The native `storage` event only fires in *other* tabs, never the one that
// wrote the value, so `update()` below dispatches one manually to keep this
// tab's snapshot in sync too.
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getServerSnapshot(): ViewMode {
  return 'board'
}

export function useViewMode(storageKey: string): [ViewMode, (mode: ViewMode) => void] {
  const getSnapshot = useCallback((): ViewMode => {
    const stored = window.localStorage.getItem(storageKey)
    return isViewMode(stored) ? stored : 'board'
  }, [storageKey])

  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const update = useCallback(
    (next: ViewMode) => {
      window.localStorage.setItem(storageKey, next)
      window.dispatchEvent(new StorageEvent('storage', { key: storageKey }))
    },
    [storageKey]
  )

  return [mode, update]
}

export function ViewSwitcher({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-[10px] border border-border bg-white p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.mode}
          type="button"
          onClick={() => onChange(opt.mode)}
          className={`flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[0.8125rem] font-semibold transition-colors ${
            mode === opt.mode ? 'bg-certa-green-tint text-certa-green-deep' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <opt.icon size={15} strokeWidth={2} />
          {opt.label}
        </button>
      ))}
    </div>
  )
}
