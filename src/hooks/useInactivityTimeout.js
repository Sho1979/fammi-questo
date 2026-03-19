/**
 * useInactivityTimeout — Auto-logout after a configurable period of inactivity.
 *
 * Tracks touch, mouse, keyboard, and scroll events.
 * After TIMEOUT_MS of no interaction, calls onTimeout (typically logout).
 *
 * On a shared family tablet, this prevents one member from staying
 * logged in indefinitely and accessing another member's data.
 */
import { useEffect, useRef, useCallback } from 'react'

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes

const ACTIVITY_EVENTS = ['mousedown', 'touchstart', 'keydown', 'scroll']

export default function useInactivityTimeout(onTimeout, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const timerRef = useRef(null)
  const activeRef = useRef(true)

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      activeRef.current = false
      onTimeout?.()
    }, timeoutMs)
  }, [onTimeout, timeoutMs])

  useEffect(() => {
    // Start the timer
    resetTimer()

    // Reset on any user activity
    const handleActivity = () => {
      if (!activeRef.current) return // already timed out
      resetTimer()
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true })
    }

    // Also reset when app comes back to foreground
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleActivity()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity)
      }
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [resetTimer])
}
