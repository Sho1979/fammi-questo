/**
 * STEP 5.2 — PinLogin: avatar + name + PIN input + numeric pad.
 * Props: member, onLogin(pin), onBack()
 */
import { useState } from 'react'
import { Delete } from 'lucide-react'
import { PersonBadge } from '../shared/index.js'

export default function PinLogin({ member, onLogin, onBack }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  const handleDigit = (digit) => {
    if (pin.length >= 6) return
    const newPin = pin + digit
    setPin(newPin)
    setError('')
  }

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1))
    setError('')
  }

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError('Inserisci almeno 4 cifre')
      return
    }
    setLoading(true)
    const success = await onLogin(pin)
    setLoading(false)

    if (!success) {
      setError('PIN errato')
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setPin('')
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

      {error && (
        <p className="mb-4 text-sm font-medium text-red-500">{error}</p>
      )}
      {!error && <div className="mb-4 h-5" />}

      {/* Numeric keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleDigit(String(n))}
            disabled={loading}
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
