/**
 * R4.1 — useSync: React 19 hook for cloud sync with optimistic UI.
 *
 * Uses useOptimistic (React 19) to give immediate visual feedback
 * while fullSync/push/pull runs in the background.
 *
 * Sync states:
 *   idle → syncing (push ⬆️ / pull ⬇️) → success | error → idle
 *
 * Usage:
 *   const { syncState, startSync, lastSyncAt, progress } = useSync(familyId)
 */
import { useState, useOptimistic, useCallback, useTransition, useRef } from 'react'
import { fullSync, pushToCloud, pullFromCloud } from '../lib/sync.js'
import { isSyncEnabled } from '../lib/supabase.js'
import { getSyncKey } from '../lib/deviceSecret.js'
import useAuthStore from '../store/authStore.js'

// ─── Sync state machine ─────────────────────────────────────────
const SYNC_STATES = {
  IDLE: 'idle',
  PUSHING: 'pushing',
  PULLING: 'pulling',
  SUCCESS: 'success',
  ERROR: 'error',
}

/**
 * @param {string} familyId
 * @param {string} [pin] — needed for encrypted sync
 * @returns {{ syncState, startSync, progress, lastSyncAt, error }}
 */
export default function useSync(familyId, pin) {
  // Real state: last known sync result
  const [realState, setRealState] = useState({
    status: SYNC_STATES.IDLE,
    lastSyncAt: null,
    error: null,
  })

  // Optimistic state: immediately shows "syncing" to user
  const [optimisticState, setOptimisticState] = useOptimistic(
    realState,
    (current, optimisticUpdate) => ({
      ...current,
      ...optimisticUpdate,
    })
  )

  const [progress, setProgress] = useState(null)
  const [isPending, startTransition] = useTransition()
  const abortRef = useRef(false)
  // Cache the derived CryptoKey so we can clear the PIN from memory
  const cachedKeyRef = useRef(null)

  const startSync = useCallback(async (mode = 'full') => {
    if (!familyId || !isSyncEnabled()) return
    abortRef.current = false

    // Optimistic: immediately show syncing state
    startTransition(async () => {
      setOptimisticState({
        status: mode === 'push' ? SYNC_STATES.PUSHING : SYNC_STATES.PULLING,
        error: null,
      })

      try {
        // Derive sync key: use cached key, or derive from PIN then clear PIN
        let syncKey = cachedKeyRef.current
        if (!syncKey && pin) {
          try {
            syncKey = await getSyncKey(pin, familyId)
            // Cache the derived key (opaque CryptoKey, non-extractable)
            cachedKeyRef.current = syncKey
            // Clear the PIN from Zustand store — no longer needed in memory
            useAuthStore.getState().setSessionPin(null)
          } catch (e) {
            console.warn('[useSync] No sync key available, syncing unencrypted')
          }
        }

        const onProgress = (p) => {
          if (abortRef.current) return
          setProgress(p)
        }

        if (mode === 'push') {
          await pushToCloud(familyId, onProgress, syncKey)
        } else if (mode === 'pull') {
          await pullFromCloud(familyId, onProgress, syncKey)
        } else {
          await fullSync(familyId, onProgress, syncKey)
        }

        const now = new Date().toISOString()
        setRealState({
          status: SYNC_STATES.SUCCESS,
          lastSyncAt: now,
          error: null,
        })

        // Auto-reset to idle after 3s
        setTimeout(() => {
          setRealState((prev) => ({
            ...prev,
            status: SYNC_STATES.IDLE,
          }))
        }, 3000)
      } catch (err) {
        console.error('[useSync] Sync failed:', err)
        setRealState({
          status: SYNC_STATES.ERROR,
          lastSyncAt: realState.lastSyncAt,
          error: err.message || 'Errore di sincronizzazione',
        })

        // Auto-reset to idle after 5s
        setTimeout(() => {
          setRealState((prev) => ({
            ...prev,
            status: SYNC_STATES.IDLE,
          }))
        }, 5000)
      } finally {
        setProgress(null)
      }
    })
  }, [familyId, pin, realState.lastSyncAt])

  const cancel = useCallback(() => {
    abortRef.current = true
  }, [])

  return {
    syncState: optimisticState.status,
    lastSyncAt: optimisticState.lastSyncAt,
    error: optimisticState.error,
    progress,
    isPending,
    startSync,
    cancel,
    SYNC_STATES,
  }
}
