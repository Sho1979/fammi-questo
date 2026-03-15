/**
 * useStatusBar — Gestisce lo stile della status bar via meta tag.
 *
 * Aggiorna il meta tag theme-color per cambiare il colore della status bar.
 * Funziona su iOS (Safari) e Android (Chrome) senza plugin Capacitor.
 *
 * Nota: per un controllo più fine (overlay, show/hide), installare @capacitor/status-bar.
 */
import { useEffect } from 'react'

/**
 * @param {Object} options
 * @param {'light'|'dark'} options.style - 'light' = sfondo scuro, 'dark' = sfondo chiaro
 * @param {string} options.color - Colore di sfondo della status bar
 */
export default function useStatusBar({ style = 'light', color = '#6C5CE7' } = {}) {
  useEffect(() => {
    // Aggiorna il meta tag theme-color (supportato da Safari iOS 15+ e Chrome Android)
    let meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', color)
    }

    // iOS PWA: aggiorna apple-mobile-web-app-status-bar-style
    let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    if (appleMeta) {
      appleMeta.setAttribute('content', style === 'light' ? 'black-translucent' : 'default')
    }
  }, [style, color])
}
