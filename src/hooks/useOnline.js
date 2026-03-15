/**
 * useOnline — Hook to detect online/offline status.
 * Uses navigator.onLine + event listeners for real-time updates.
 * Returns { isOnline: boolean }
 */
import { useState, useEffect } from 'react'

export default function useOnline() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return { isOnline }
}
