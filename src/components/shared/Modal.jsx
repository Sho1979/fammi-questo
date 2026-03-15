/**
 * STEP 3.2 — Modal overlay.
 * Dark overlay + centered card. Click overlay or press Escape to close.
 * Focus trap: il tab rimane dentro il modale.
 * Props: isOpen, onClose, title, children
 */
import { useEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export default function Modal({ isOpen, onClose, title, children }) {
  const cardRef = useRef(null)

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose?.()
        return
      }
      // Focus trap: Tab / Shift+Tab restano dentro il modale
      if (e.key === 'Tab' && cardRef.current) {
        const focusable = cardRef.current.querySelectorAll(FOCUSABLE)
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll while modal is open
      document.body.style.overflow = 'hidden'
      // Auto-focus primo elemento focusable (o il card stesso)
      requestAnimationFrame(() => {
        if (cardRef.current) {
          const first = cardRef.current.querySelector(FOCUSABLE)
          if (first) first.focus()
        }
      })
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card — max-h per permettere scroll su schermi piccoli.
          Usa 100dvh per gestire correttamente la barra indirizzi mobile e safe areas */}
      <div
        ref={cardRef}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl flex flex-col"
        style={{
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
        }}
      >
        {/* Header — fisso in alto */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content — scrollabile con momentum iOS */}
        <div className="overflow-y-auto px-6 pb-6 flex-1 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
