/**
 * Haptic feedback cross-platform via navigator.vibrate().
 *
 * Android: vibrazione nativa tramite Vibration API
 * iOS: vibrazione base (per Taptic Engine avanzato, installare @capacitor/haptics)
 * Web: noop silenzioso
 *
 * Uso:
 *   import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../lib/haptics.js'
 */
import { isNative } from './platform.js'

/** Vibra brevemente via navigator.vibrate */
function vibrate(pattern) {
  try {
    if (isNative && navigator.vibrate) navigator.vibrate(pattern)
  } catch {
    // Silently ignore — non tutti i dispositivi supportano vibrate
  }
}

/** Feedback leggero — per tap, toggle, selezione */
export function hapticLight() { vibrate(10) }

/** Feedback medio — per azioni importanti, conferma */
export function hapticMedium() { vibrate(20) }

/** Feedback successo — per completamento azione */
export function hapticSuccess() { vibrate([10, 50, 10]) }

/** Feedback errore — per errori, azione non permessa */
export function hapticError() { vibrate([20, 40, 20, 40, 20]) }
