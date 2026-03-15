/**
 * NotifBanner — Compact notification banner shown below the Header.
 * Displays the latest unread notification with auto-dismiss and tap-to-read.
 * Auto-hides after 6 seconds or on tap.
 *
 * Usage: place inside AppShell, below <Header />.
 */
import { useState, useEffect, useCallback } from 'react'
import { X, Bell } from 'lucide-react'
import useAuthStore from '../../store/authStore.js'
import { useNotifications, markAsRead } from '../../hooks/useNotifications.js'

const TYPE_ICONS = {
  task_assigned: '📋',
  task_complete: '🏆',
  task_proposed: '📣',
  task_approved: '✅',
  task_rejected: '❌',
  expense: '💰',
  calendar: '📅',
  shopping: '🛒',
  meal: '👨‍🍳',
  reward_earned: '⭐',
  general: '🔔',
}

export default function NotifBanner() {
  const { familyId, currentMember } = useAuthStore()
  const notifications = useNotifications(familyId, currentMember?.id)

  const [dismissed, setDismissed] = useState(new Set())
  const [visible, setVisible] = useState(false)

  // Find the latest unread, not-yet-dismissed notification
  const latestUnread = notifications.find(
    (n) => !n.read && !dismissed.has(n.id)
  )

  // Show/hide animation
  useEffect(() => {
    if (latestUnread) {
      // Small delay for slide-in effect
      const showTimer = setTimeout(() => setVisible(true), 100)
      // Auto-dismiss after 6 seconds
      const hideTimer = setTimeout(() => {
        setVisible(false)
        setTimeout(() => {
          setDismissed((prev) => new Set([...prev, latestUnread.id]))
        }, 300)
      }, 6000)
      return () => {
        clearTimeout(showTimer)
        clearTimeout(hideTimer)
      }
    } else {
      setVisible(false)
    }
  }, [latestUnread?.id])

  const handleDismiss = useCallback(() => {
    if (!latestUnread) return
    setVisible(false)
    setTimeout(() => {
      setDismissed((prev) => new Set([...prev, latestUnread.id]))
    }, 300)
  }, [latestUnread])

  const handleTap = useCallback(async () => {
    if (!latestUnread) return
    await markAsRead(latestUnread.id)
    handleDismiss()
  }, [latestUnread, handleDismiss])

  if (!latestUnread) return null

  const icon = TYPE_ICONS[latestUnread.type] || '🔔'

  return (
    <div
      className="mx-3 mt-1 mb-0 transition-all duration-300 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        maxHeight: visible ? '80px' : '0px',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={handleTap}
        className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition-all active:scale-[0.98]"
        style={{
          background: 'linear-gradient(135deg, rgba(108,92,231,0.08), rgba(108,92,231,0.04))',
          border: '1px solid rgba(108,92,231,0.15)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Icon */}
        <span className="text-base flex-shrink-0">{icon}</span>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {latestUnread.title}
          </p>
          {latestUnread.message && (
            <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {latestUnread.message}
            </p>
          )}
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleDismiss()
          }}
          className="flex-shrink-0 rounded-lg p-1.5 transition-all hover:bg-white/50"
          aria-label="Chiudi notifica"
        >
          <X size={13} style={{ color: 'var(--text-muted)' }} />
        </button>
      </button>
    </div>
  )
}
