/**
 * STEP 3.3 — Confirm dialog (wraps Modal).
 * Props: isOpen, onConfirm, onCancel, title, message, confirmLabel?, danger? (boolean)
 * Includes double-tap guard: button disables after first click until dialog closes.
 */
import { useState, useEffect } from 'react'
import Modal from './Modal.jsx'
import { hapticMedium, hapticLight } from '../../lib/haptics.js'

export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Conferma',
  danger = false,
}) {
  const [processing, setProcessing] = useState(false)

  // Reset processing state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) setProcessing(false)
  }, [isOpen])

  const handleConfirm = async () => {
    if (processing) return
    setProcessing(true)
    hapticMedium()
    try {
      await onConfirm()
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <p className="mb-6 text-sm text-gray-600">{message}</p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { hapticLight(); onCancel() }}
          disabled={processing}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5
            text-sm font-medium text-gray-700 hover:bg-gray-50 touch-feedback
            disabled:opacity-50"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={processing}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white
            disabled:opacity-50 transition-opacity
            ${danger
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-violet-600 hover:bg-violet-700'
            }`}
        >
          {processing ? 'Attendi...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
