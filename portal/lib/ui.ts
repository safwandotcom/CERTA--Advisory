export const input =
  'w-full rounded-[10px] border border-border bg-white px-4 py-3 text-[0.9375rem] text-ink placeholder:text-ink-muted focus:border-certa-green-deep focus:outline-none focus:ring-4 focus:ring-certa-green-tint transition-colors'

export const label = 'block text-[0.8125rem] font-semibold text-ink mb-1.5'

export const card = 'rounded-[16px] bg-surface-tint p-6'

export const buttonPrimary =
  'inline-flex items-center justify-center gap-2 rounded-[10px] bg-certa-green-deep px-6 py-3 text-[0.8125rem] font-semibold tracking-[0.02em] text-white transition-all hover:bg-ink hover:shadow-[0_8px_20px_rgba(35,31,32,0.12)] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-certa-green disabled:opacity-60 disabled:pointer-events-none disabled:hover:translate-y-0 disabled:hover:shadow-none'

export const buttonCoral =
  'inline-flex items-center justify-center gap-2 rounded-[10px] bg-signal-coral px-6 py-3 text-[0.8125rem] font-semibold tracking-[0.02em] text-ink transition-all hover:bg-signal-coral-deep hover:text-white hover:shadow-[0_8px_20px_rgba(35,31,32,0.12)] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-certa-green disabled:opacity-60 disabled:pointer-events-none disabled:hover:translate-y-0 disabled:hover:shadow-none'

export const buttonGhost =
  'inline-flex items-center justify-center gap-2 rounded-[10px] border border-border bg-white px-6 py-3 text-[0.8125rem] font-semibold tracking-[0.02em] text-ink transition-all hover:bg-surface-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-certa-green disabled:opacity-60 disabled:pointer-events-none'

export function statusPillClass(status: 'active' | 'inactive'): string {
  return status === 'active'
    ? 'inline-flex items-center rounded-full bg-certa-green-tint px-2.5 py-1 text-xs font-semibold text-certa-green-deep'
    : 'inline-flex items-center rounded-full bg-surface-tint px-2.5 py-1 text-xs font-semibold text-ink-muted'
}

export function rolePillClass(role: 'admin' | 'employee'): string {
  return role === 'admin'
    ? 'inline-flex items-center rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-ink'
    : 'inline-flex items-center rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium text-ink-muted'
}

export const errorText = 'flex items-center gap-1.5 text-[0.8125rem] font-medium text-signal-coral-deep'

export const successText = 'flex items-center gap-1.5 text-[0.8125rem] font-medium text-certa-green-deep'
