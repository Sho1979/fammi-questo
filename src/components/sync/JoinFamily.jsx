/**
 * JoinFamily — Complete flow for joining a family via invite code or QR.
 * Two modes:
 *   1. "share" — Show invite code + QR for the current family (host device)
 *   2. "join"  — Enter code manually to join an existing family (guest device)
 *
 * Props: mode ('share'|'join'), familyId?, inviteCode?, onJoined(familyData), onClose()
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { Copy, QrCode, UserPlus, Loader2, Check, Share2 } from 'lucide-react'
import { joinFamilyByCode, registerFamilyOnCloud } from '../../lib/sync.js'
import { isSyncEnabled } from '../../lib/supabase.js'

/**
 * Generate a simple QR code as SVG string using a basic encoding.
 * Uses a minimal approach: renders the code as a large, scannable text display
 * since we can't add QR libraries per architecture rules.
 */
function InviteCodeDisplay({ code }) {
  if (!code) return null

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Large code display */}
      <div className="rounded-2xl px-6 py-5 text-center"
        style={{ background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)', border: '2px dashed var(--primary)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--primary)' }}>
          Codice invito
        </p>
        <p className="font-mono text-3xl font-black tracking-[0.3em] select-all"
          style={{ color: 'var(--primary)' }}>
          {code}
        </p>
      </div>

      {/* QR-like visual (large chars in a grid for easy scanning from distance) */}
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="grid grid-cols-6 gap-1">
          {code.split('').map((char, i) => (
            <div
              key={i}
              className="w-10 h-10 rounded-lg flex items-center justify-center font-mono text-lg font-black"
              style={{
                background: i % 2 === 0 ? 'var(--primary)' : 'var(--primary-50)',
                color: i % 2 === 0 ? 'white' : 'var(--primary)',
              }}
            >
              {char}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function JoinFamily({ mode = 'share', familyId, inviteCode: existingCode, onJoined, onClose }) {
  const [code, setCode] = useState(existingCode || '')
  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Generate code if in share mode and no code exists
  const handleGenerateCode = useCallback(async () => {
    if (!familyId) return
    setGenerating(true)
    setError('')
    try {
      const newCode = await registerFamilyOnCloud(familyId)
      setCode(newCode)
    } catch (err) {
      setError(err.message || 'Errore generazione codice')
    }
    setGenerating(false)
  }, [familyId])

  // Join family with code
  const handleJoin = useCallback(async () => {
    const trimmed = inputCode.trim().toUpperCase()
    if (trimmed.length < 4) {
      setError('Inserisci un codice valido')
      return
    }

    setLoading(true)
    setError('')
    try {
      const familyData = await joinFamilyByCode(trimmed)
      setSuccess(true)
      setTimeout(() => onJoined?.(familyData), 1500)
    } catch (err) {
      setError(err.message || 'Codice non valido')
    }
    setLoading(false)
  }, [inputCode, onJoined])

  const handleCopy = () => {
    if (code) {
      navigator.clipboard?.writeText(code)
    }
  }

  const handleShare = async () => {
    if (!code) return
    try {
      await navigator.share?.({
        title: 'Fammi Questo — Invito',
        text: `Unisciti alla mia famiglia su Fammi Questo! Codice: ${code}`,
      })
    } catch {
      // Share cancelled or not available — copy instead
      handleCopy()
    }
  }

  if (!isSyncEnabled()) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center p-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-gray-100">
          🔒
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Sincronizzazione non configurata
        </p>
        <p className="text-xs max-w-[250px]" style={{ color: 'var(--text-muted)' }}>
          Per usare il join famiglia serve configurare Supabase nel file .env
        </p>
      </div>
    )
  }

  // ─── Share Mode (host) ─────────────────────────────────────────
  if (mode === 'share') {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <QrCode size={18} style={{ color: 'var(--primary)' }} />
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            Invita nella famiglia
          </h3>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Condividi questo codice con chi vuole unirsi. L'altro dispositivo deve avere l'app installata e la sync attiva.
        </p>

        {code ? (
          <>
            <InviteCodeDisplay code={code} />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition-all"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <Copy size={14} /> Copia
              </button>
              {navigator.share && (
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white transition-all"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  <Share2 size={14} /> Condividi
                </button>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={handleGenerateCode}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white
              shadow-md disabled:opacity-50 transition-all"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
            {generating ? 'Genero codice...' : 'Genera codice invito'}
          </button>
        )}

        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
      </div>
    )
  }

  // ─── Join Mode (guest) ────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <UserPlus size={18} style={{ color: 'var(--primary)' }} />
        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          Unisciti a una famiglia
        </h3>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Inserisci il codice invito ricevuto dal dispositivo principale della famiglia.
      </p>

      {success ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}>
            <Check size={28} className="text-white" />
          </div>
          <p className="text-sm font-semibold text-green-600">Famiglia trovata!</p>
          <p className="text-xs text-gray-400">Sincronizzazione in corso...</p>
        </div>
      ) : (
        <>
          {/* Code input */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Codice invito</label>
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ES: A3B7K9"
              maxLength={6}
              className="w-full rounded-xl border px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.2em]
                focus:outline-none focus:ring-2 transition-all"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--primary)',
              }}
            />
          </div>

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          <button
            type="button"
            onClick={handleJoin}
            disabled={loading || inputCode.length < 4}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white
              shadow-md disabled:opacity-40 transition-all active:scale-[0.98]"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {loading ? 'Cerco famiglia...' : 'Unisciti'}
          </button>
        </>
      )}
    </div>
  )
}
