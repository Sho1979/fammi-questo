/**
 * Platform detection utility — iOS / Android / Web.
 *
 * Rileva la piattaforma corrente per adattare UI, feedback tattile,
 * scroll behavior, navigazione e status bar.
 *
 * Uso:
 *   import { isIOS, isAndroid, isNative, platform } from '../lib/platform.js'
 */
import { Capacitor } from '@capacitor/core'

/** True se l'app gira dentro Capacitor (non nel browser) */
export const isNative = Capacitor.isNativePlatform()

/** Piattaforma corrente: 'ios' | 'android' | 'web' */
export const platform = Capacitor.getPlatform()

/** Shorthand per check piattaforma */
export const isIOS = platform === 'ios'
export const isAndroid = platform === 'android'
export const isWeb = platform === 'web'

/**
 * Rileva se il dispositivo ha un notch / Dynamic Island.
 * Usa env(safe-area-inset-top) > 20px come euristica.
 */
export function hasNotch() {
  if (!isIOS) return false
  const root = document.documentElement
  const safeTop = getComputedStyle(root).getPropertyValue('env(safe-area-inset-top)')
  // Se non riesce a leggere, assume true per iPhone moderni
  return safeTop ? parseInt(safeTop, 10) > 20 : true
}

/**
 * Applica classi CSS condizionali alla piattaforma.
 * Es: platformClass('rounded-xl', { ios: 'rounded-2xl', android: 'rounded-lg' })
 */
export function platformClass(base, overrides = {}) {
  const platformOverride = overrides[platform]
  return platformOverride ? `${base} ${platformOverride}` : base
}

/**
 * Restituisce valore diverso in base alla piattaforma.
 * Es: platformValue({ ios: '20px', android: '0px', web: '0px' })
 */
export function platformValue(values) {
  return values[platform] ?? values.web ?? values.android
}
