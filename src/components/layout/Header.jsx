/**
 * Header — Gradient background with decorative elements, refined typography.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Settings } from 'lucide-react'
import useAuthStore from '../../store/authStore.js'
import { PersonBadge, Modal } from '../shared/index.js'
import { useUnreadCount, useNotifications, markAsRead, markAllAsRead } from '../../hooks/useNotifications.js'
import useStatusBar from '../../hooks/useStatusBar.js'
import { hapticLight } from '../../lib/haptics.js'
import NotifList from '../notifications/NotifList.jsx'

export default function Header() {
  const navigate = useNavigate()
  const { currentMember, familyId } = useAuthStore()
  const [showNotifs, setShowNotifs] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Status bar: testo bianco su sfondo viola (entrambe le piattaforme)
  useStatusBar({ style: 'light', color: '#6C5CE7' })

  const unreadCount = useUnreadCount(familyId, currentMember?.id)
  const notifications = useNotifications(familyId, currentMember?.id)

  return (
    <>
      <header
        className="status-bar-padding relative overflow-hidden"
        style={{ background: 'var(--gradient-header)' }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/[0.04]" />
        <div className="absolute -bottom-4 -left-6 h-24 w-24 rounded-full bg-white/[0.04]" />

        <div className="relative flex items-center justify-between px-4 py-3.5">
          {/* Left: member badge + name */}
          <div className="flex items-center gap-2.5">
            {currentMember && (
              <div className="rounded-full ring-2 ring-white/20">
                <PersonBadge member={currentMember} size="sm" />
              </div>
            )}
            {currentMember && (
              <span className="text-sm font-semibold text-white tracking-wide">
                {currentMember.name}
              </span>
            )}
          </div>

          {/* Center: unified logo */}
          <img
            src="/logo-header.svg"
            alt="Fammi Questo"
            className="absolute left-1/2 -translate-x-1/2 h-9 drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
          />

          {/* Right: settings + notification bell */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => { hapticLight(); navigate('/settings') }}
              className="rounded-xl p-2 text-white/60 hover:text-white hover:bg-white/10
                transition-all duration-200 touch-feedback"
              aria-label="Impostazioni"
            >
              <Settings size={18} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => { hapticLight(); setShowNotifs(true) }}
              className="relative rounded-xl p-2 text-white/60 hover:text-white hover:bg-white/10
                transition-all duration-200 touch-feedback"
              aria-label="Notifiche"
            >
              <Bell size={19} strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center
                  rounded-full bg-red-500 px-1 text-[10px] font-bold text-white
                  shadow-lg shadow-red-500/30 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {isOffline && (
        <div className="bg-amber-500 text-white text-xs text-center py-1 px-2 font-medium">
          Offline — i dati sono salvati localmente
        </div>
      )}

      {/* Notification drawer */}
      <Modal
        isOpen={showNotifs}
        onClose={() => setShowNotifs(false)}
        title="Notifiche"
      >
        <NotifList
          notifications={notifications}
          onMarkRead={markAsRead}
          onMarkAllRead={async () => {
            await markAllAsRead()
          }}
        />
      </Modal>
    </>
  )
}
