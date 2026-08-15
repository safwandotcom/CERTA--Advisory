'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Every button classes in lib/ui.ts (buttonPrimary/buttonCoral/buttonGhost)
// already style `disabled:` for free -- this just needs to actually set
// `disabled` while its form is submitting, and swap in a spinner so a click
// reads as "working" immediately rather than sitting inert during the
// server round-trip. Must be a descendant of the <form> it reports on
// (useFormStatus's own requirement) -- which every call site already is.
export function SubmitButton({
  children,
  pendingText,
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; pendingText?: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={disabled || pending} className={className} {...props}>
      {pending ? (
        <>
          <Loader2 size={15} strokeWidth={2} className="animate-spin" />
          {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  )
}
