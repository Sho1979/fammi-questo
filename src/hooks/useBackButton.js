/**
 * useBackButton — Gestisce il pulsante "indietro" cross-platform.
 *
 * Android: intercetta popstate per gestire il back button hardware
 * iOS: swipe-back gestito nativamente da WebKit
 * Non richiede plugin Capacitor aggiuntivi.
 *
 * @param {Function} [customHandler] - Se ritorna true, il default viene skippato
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isNative, isAndroid } from '../lib/platform.js'

export default function useBackButton(customHandler) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNative || !isAndroid) return

    const handlePopState = () => {
      if (customHandler && customHandler() === true) {
        // Il custom handler ha gestito l'evento (es. chiuso un modale)
        history.pushState(null, '', location.href)
        return
      }
      // Default: React Router gestisce la navigazione normalmente
    }

    // Entry aggiuntiva nello history per poterla intercettare
    history.pushState(null, '', location.href)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [navigate, customHandler])
}
