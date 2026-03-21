/**
 * useAppLifecycle — clears session PIN when app goes to background.
 * Uses visibilitychange (works on both web and Capacitor WebView).
 */
import { useEffect } from 'react'
import useAuthStore from '../store/authStore.js'

export default function useAppLifecycle() {
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        useAuthStore.getState().setSessionPin(null)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])
}
