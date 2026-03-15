/**
 * useKeyboard — Rileva apertura/chiusura della tastiera virtuale.
 *
 * Funziona cross-platform usando window.visualViewport (supportato da
 * tutti i browser moderni, Safari iOS 13+, Chrome Android).
 * Non richiede plugin Capacitor aggiuntivi.
 *
 * Uso:
 *   const { isOpen, keyboardHeight } = useKeyboard()
 */
import { useState, useEffect } from 'react'
import { isAndroid } from '../lib/platform.js'

/** Soglia in px: se il viewport si riduce di più, la tastiera è aperta */
const KEYBOARD_THRESHOLD = 100

export default function useKeyboard() {
  const [isOpen, setIsOpen] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const handleResize = () => {
      const heightDiff = window.innerHeight - vv.height
      const open = heightDiff > KEYBOARD_THRESHOLD
      setIsOpen(open)
      setKeyboardHeight(open ? heightDiff : 0)

      // Su Android, scrolla l'elemento attivo in vista
      if (open && isAndroid && document.activeElement) {
        setTimeout(() => {
          document.activeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
        }, 100)
      }
    }

    vv.addEventListener('resize', handleResize)
    return () => vv.removeEventListener('resize', handleResize)
  }, [])

  return { isOpen, keyboardHeight }
}
