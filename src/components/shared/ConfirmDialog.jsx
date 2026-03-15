/**
 * STEP 3.3 — Confirm dialog (wraps Modal).
 * Props: isOpen, onConfirm, onCancel, title, message, confirmLabel?, danger? (boolean)
 */
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
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <p className="mb-6 text-sm text-gray-600">{message}</p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { hapticLight(); onCancel() }}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5
            text-sm font-medium text-gray-700 hover:bg-gray-50 touch-feedback"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={() => { hapticMedium(); onConfirm() }}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white
            ${danger
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-violet-600 hover:bg-violet-700'
            }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
