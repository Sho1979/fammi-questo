/**
 * STEP 3.1 — Toast notification.
 * Positioned above BottomNav, auto-dismiss, optional action button.
 * Props: message, action?, onAction?, duration? (default 4000ms)
 */
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { isIOS } from '../../lib/platform.js'

export default function Toast({ message, action, onAction, duration = 4000, onClose }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onClose?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!visible) return null

  return (
    <div
      role="alert"
      className="fixed left-4 right-4 z-50 flex items-center justify-between
        rounded-xl bg-gray-800 px-4 py-3 text-sm text-white shadow-lg
        animate-[slideUp_0.3s_ease-out]"
      style={{
        animation: 'slideUp 0.3s ease-out',
        // iOS: posiziona sopra la bottom nav + safe area
        bottom: isIOS ? 'calc(5rem + env(safe-area-inset-bottom, 0px))' : '5rem',
      }}
    >
      <span className="flex-1">{message}</span>

      {action && (
        <button
          type="button"
          onClick={() => {
            onAction?.()
            setVisible(false)
            onClose?.()
          }}
          className="ml-3 font-semibold text-violet-400 hover:text-violet-300"
        >
          {action}
        </button>
      )}

      <button
        type="button"
        aria-label="Chiudi"
        onClick={() => {
          setVisible(false)
          onClose?.()
        }}
        className="ml-2 p-1 text-gray-400 hover:text-white"
      >
        <X size={16} />
      </button>
    </div>
  )
}
