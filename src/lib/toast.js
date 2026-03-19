/**
 * toast.js — Global toast helpers powered by Sonner.
 *
 * Replaces the per-page useState + custom Toast pattern.
 * Usage: import { showSuccess, showError, showUndo } from '../lib/toast.js'
 */
import { toast } from 'sonner'

export function showSuccess(message) {
  toast.success(message, { duration: 3000 })
}

export function showError(message) {
  toast.error(message, { duration: 5000 })
}

export function showInfo(message) {
  toast(message, { duration: 3000 })
}

/**
 * Toast with undo action. Calls onUndo if user clicks "Annulla".
 */
export function showUndo(message, onUndo) {
  toast(message, {
    duration: 5000,
    action: {
      label: 'Annulla',
      onClick: () => onUndo?.(),
    },
  })
}

/**
 * Toast for Brain actions cluster.
 * Shows summary of actions created from a voice/text message.
 */
export function showBrainResult(summary, actionCount) {
  if (actionCount === 0) {
    toast.error('Nessuna azione riconosciuta')
    return
  }
  toast.success(summary || `${actionCount} azioni create`, {
    duration: 4000,
  })
}
