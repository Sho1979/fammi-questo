/**
 * STEP 5.2 — PinLogin: avatar + name + PIN input + numeric pad.
 * Props: member, onLogin(pin), onBack()
 *
 * Brute-force protection:
 *   - After 5 failed attempts: 30 second lockout
 *   - After 10 failed attempts: 5 minute lockout
 *   - After 15 failed attempts: 15 minute lockout
 *   - Counter resets on successful login
 */
import { useState, useEffect, useRef } from 'react'
import { Delete, Lock } from 'lucide-react'
import { PersonBadge } from '../shared/index.js'

const LOCKOUT_THRESHOLDS = [
  { attempts: 5, seconds: 30 },
  { attempts: 10, seconds: 300 },
  { attempts: 15, seconds: 900 },
]

function getLockoutSeconds(attempts) {
  for (let i = LOCKOUT_THRESHOLDS.length - 1; i >= 0; i--) {
    if (attempts >= LOCKOUT_THRESHOLDS[i].attempts) return LOCKOUT_THRESHOLDS[i].seconds
  }
  return 0
}

export default function PinLogin({ member, onLogin, onBack }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  // Persist lockout state in localStorage (keyed by member ID)
  const lockKey = `pin_lock_${member?.id}`
  const stored = JSON.parse(localStorage.getItem(lockKey) || '{}')
  const [failedAttempts, setFailedAttempts] = useState(stored.attempts || 0)
  const [lockedUntil, setLockedUntil] = useState(
    stored.until && stored.until > Date.now() ? stored.until : null
  )
  const [lockCountdown, setLockCountdown] = useState(0)
  const timerRef = useRef(null)

  // Persist lockout changes to localStorage
  useEffect(() => {
    if (member?.id) {
      localStorage.setItem(lockKey, JSON.stringify({
        attempts: failedAttempts,
        until: lockedUntil,
      }))
    }
  }, [failedAttempts, lockedUntil, lockKey, member?.id])

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedUntil) { setLockCountdown(0); return }
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000)
      if (remaining <= 0) {
        setLockedUntil(null)
        setLockCountdown(0)
        setError('')
      } else {
        setLockCountdown(remaining)
      }
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => clearInterval(timerRef.current)
  }, [lockedUntil])

  const isLocked = lockCountdown > 0

  const handleDigit = (digit) => {
    if (isLocked || pin.length >= 6) return
    const newPin = pin + digit
    setPin(newPin)
    setError('')
  }

  const handleDelete = () => {
    if (isLocked) return
    setPin((p) => p.slice(0, -1))
    setError('')
  }

  const handleSubmit = async () => {
    if (isLocked) return
    if (pin.length < 4) {
      setError('Inserisci almeno 4 cifre')
      return
    }
    setLoading(true)
    const success = await onLogin(pin)
    setLoading(false)

    if (success) {
      setFailedAttempts(0)
      setLockedUntil(null)
      localStorage.removeItem(lockKey)
    } else {
      const newAttempts = failedAttempts + 1
      setFailedAttempts(newAttempts)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setPin('')

      const lockSeconds = getLockoutSeconds(newAttempts)
      if (lockSeconds > 0) {
        const until = Date.now() + lockSeconds * 1000
        setLockedUntil(until)
        const mins = Math.floor(lockSeconds / 60)
        const secs = lockSeconds % 60
        setError(mins > 0
          ? `Troppi tentativi. Riprova tra ${mins} min${secs > 0 ? ` ${secs}s` : ''}`
          : `Troppi tentativi. Riprova tra ${lockSeconds} secondi`
        )
      } else {
        const remaining = LOCKOUT_THRESHOLDS[0].attempts - newAttempts
        setError(`PIN errato (${remaining} tentativi rimasti)`)
      }
    }
  }

  return (
    <div className="flex flex-col items-center px-6 py-8">
      {/* Member avatar + name */}
      <div className={`mb-6 transition-transform ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
        <PersonBadge member={member} size="lg" />
      </div>

      {/* PIN dots */}
      <div className="mb-2 flex gap-3" data-testid="pin-dots">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            data-filled={i < pin.length}
            className={`h-3.5 w-3.5 rounded-full transition-all
              ${i < pin.length ? 'bg-violet-600 scale-110' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {isLocked && (
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-amber-600">
          <Lock size={14} />
          <span>Bloccato — {lockCountdown}s</span>
        </div>
      )}
      {error && !isLocked && (
        <p className="mb-4 text-sm font-medium text-red-500">{error}</p>
      )}
      {!error && !isLocked && <div className="mb-4 h-5" />}

      {/* Numeric keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleDigit(String(n))}
            disabled={loading || isLocked}
            className="flex h-14 w-full items-center justify-center rounded-xl
              bg-gray-100 text-xl font-semibold text-gray-800
              hover:bg-gray-200 active:bg-gray-300 transition-colors
              disabled:opacity-50"
          >
            {n}
          </button>
        ))}

        {/* Bottom row: back, 0, delete */}
        <div /> {/* empty cell */}
        <button
          type="button"
          onClick={() => handleDigit('0')}
          disabled={loading}
          className="flex h-14 w-full items-center justify-center rounded-xl
            bg-gray-100 text-xl font-semibold text-gray-800
            hover:bg-gray-200 active:bg-gray-300 transition-colors
            disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="flex h-14 w-full items-center justify-center rounded-xl
            text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors
            disabled:opacity-50"
          aria-label="Cancella cifra"
        >
          <Delete size={22} />
        </button>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="mt-6 w-full max-w-[240px] rounded-xl bg-violet-600 py-3
          text-base font-semibold text-white shadow-md
          hover:bg-violet-700 disabled:opacity-50 transition-all"
      >
        {loading ? 'Verifica...' : 'Entra'}
      </button>

      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="mt-4 text-sm text-gray-500 hover:text-violet-600"
      >
        Torna alla selezione
      </button>
    </div>
  )
}
