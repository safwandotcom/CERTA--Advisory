'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Building2, FileBarChart, LogOut, Menu, X } from 'lucide-react'
import { signOutAction } from '@/app/actions'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  isActive: (pathname: string) => boolean
}

const EMPLOYEE_NAV: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    isActive: (pathname) => pathname === '/dashboard',
  },
]

const ADMIN_NAV: NavItem[] = [
  {
    href: '/admin',
    label: 'Employees',
    icon: Users,
    isActive: (pathname) => pathname === '/admin' || pathname.startsWith('/admin/employees'),
  },
  {
    href: '/admin/departments',
    label: 'Departments',
    icon: Building2,
    isActive: (pathname) => pathname.startsWith('/admin/departments'),
  },
  {
    href: '/admin/reports',
    label: 'Reports',
    icon: FileBarChart,
    isActive: (pathname) => pathname.startsWith('/admin/reports'),
  },
]

const MANAGER_NAV: NavItem[] = [
  {
    href: '/manager',
    label: 'My Team',
    icon: Users,
    isActive: (pathname) => pathname.startsWith('/manager'),
  },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}

function SidebarContent({
  variant,
  name,
  roleLabel,
  onNavigate,
}: {
  variant: 'employee' | 'admin' | 'manager'
  name: string
  roleLabel: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const nav = variant === 'admin' ? ADMIN_NAV : variant === 'manager' ? MANAGER_NAV : EMPLOYEE_NAV

  return (
    <>
      <div className="flex h-16 items-center px-6">
        <Image
          src="/brand/certa-lockup.png"
          alt="CERTA& Advisory"
          width={140}
          height={44}
          priority
          className="h-7 w-auto"
        />
      </div>

      <nav className="flex-1 space-y-1 px-3 pt-2">
        {nav.map((item) => {
          const active = item.isActive(pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-[0.9375rem] font-medium transition-colors ${
                active
                  ? 'bg-certa-green-tint text-certa-green-deep'
                  : 'text-ink-muted hover:bg-white hover:text-ink'
              }`}
            >
              <Icon size={18} strokeWidth={2} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-certa-green-tint text-sm font-semibold text-certa-green-deep">
            {initials(name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-ink-muted">{roleLabel}</p>
          </div>
        </div>
        <form action={signOutAction} className="mt-1">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-white hover:text-signal-coral-deep"
          >
            <LogOut size={17} strokeWidth={2} />
            Sign out
          </button>
        </form>
      </div>
    </>
  )
}

export function Sidebar({
  variant,
  name,
  roleLabel,
}: {
  variant: 'employee' | 'admin' | 'manager'
  name: string
  roleLabel: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-white px-4 md:hidden">
        <Image
          src="/brand/certa-lockup.png"
          alt="CERTA& Advisory"
          width={120}
          height={38}
          priority
          className="h-6 w-auto"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink hover:bg-surface-tint"
        >
          <Menu size={20} strokeWidth={2} />
        </button>
      </div>

      {/* Mobile backdrop + drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-ink/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface-tint shadow-xl">
            <div className="flex justify-end px-3 pt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-white hover:text-ink"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <SidebarContent
              variant={variant}
              name={name}
              roleLabel={roleLabel}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-border bg-surface-tint md:flex">
        <SidebarContent variant={variant} name={name} roleLabel={roleLabel} />
      </aside>
    </>
  )
}
