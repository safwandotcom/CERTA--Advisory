'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import {
  listNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/app/actions'
import type { Notification } from '@/lib/notifications'

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [notifications, setNotifications] = useState<Notification[] | null>(null)
  const [, startTransition] = useTransition()

  async function toggleOpen() {
    if (!open && notifications === null) {
      const list = await listNotificationsAction()
      setNotifications(list)
    }
    setOpen((o) => !o)
  }

  function handleSelect(notification: Notification) {
    startTransition(async () => {
      if (!notification.read_at) {
        await markNotificationReadAction(notification.id)
        setUnreadCount((c) => Math.max(0, c - 1))
        setNotifications(
          (list) =>
            list?.map((n) =>
              n.id === notification.id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n
            ) ?? null
        )
      }
      setOpen(false)
      if (notification.link) router.push(notification.link)
    })
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction()
      setUnreadCount(0)
      setNotifications(
        (list) => list?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null
      )
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-white hover:text-ink"
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-signal-coral text-[0.625rem] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-[10px] border border-border bg-white shadow-[0_8px_20px_rgba(35,31,32,0.12)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-[0.8125rem] font-semibold text-ink">Notifications</span>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[0.75rem] font-semibold text-certa-green-deep hover:underline"
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifications === null || notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-[0.8125rem] text-ink-muted">
                {notifications === null ? 'Loading…' : 'No notifications yet.'}
              </li>
            ) : (
              notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(n)}
                    className={`block w-full px-4 py-3 text-left text-[0.8125rem] transition-colors hover:bg-surface-tint ${
                      n.read_at ? 'text-ink-muted' : 'font-semibold text-ink'
                    }`}
                  >
                    {n.title}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
