/**
 * BrainInput — Text input bar for the Brain AI, embedded in Dashboard.
 *
 * Funziona come una search bar: l'utente scrive o detta, il testo va a useBrain.parseText().
 * Il mic button inline avvia recordSpeech direttamente (alternativa al VoiceButton floating).
 *
 * Props (da useBrain):
 *   phase, parseText, startVoice, aiCallsRemaining, speechAvailable
 */
import { useState, useRef } from 'react'
import { Send, Mic, MicOff, Loader2, Brain } from 'lucide-react'
import { getBrainStats } from '../../lib/brain/index.js'
import useAuthStore from '../../store/authStore.js'

export default function BrainInput({ phase, parseText, startVoice, aiCallsRemaining, speechAvailable, nlpReady }) {
  const { familyId } = useAuthStore()
  const [text, setText] = useState('')
  const [showStats, setShowStats] = useState(false)
  const [stats, setStats] = useState(null)
  const inputRef = useRef(null)

  const isActive = phase === 'listening' || phase === 'parsing' || phase === 'executing'

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || isActive) return
    parseText(trimmed)
    setText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleShowStats = async () => {
    if (showStats) {
      setShowStats(false)
      return
    }
    const s = await getBrainStats(familyId)
    setStats(s)
    setShowStats(true)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <button type="button" onClick={handleShowStats} className="flex items-center gap-1.5">
          <Brain size={16} style={{ color: 'var(--primary)' }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--primary)' }}>
            Cervellone
          </span>
        </button>
        <span className={`ml-auto text-[10px] font-medium ${nlpReady ? 'text-emerald-500' : 'text-amber-400'}`}>
          {nlpReady ? '🧠 NLP attivo' : '⏳ NLP loading...'} · {aiCallsRemaining} AI
        </span>
      </div>

      {/* Stats panel (toggle) */}
      {showStats && stats && (
        <div className="rounded-xl p-3 text-xs flex flex-col gap-1.5"
          style={{ background: 'rgba(108,92,231,0.05)', border: '1px solid rgba(108,92,231,0.12)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Sinapsi attive</span>
            <span className="font-bold" style={{ color: 'var(--primary)' }}>{stats.totalSynapses}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Sinapsi forti</span>
            <span className="font-bold" style={{ color: 'var(--primary)' }}>{stats.strongCount || 0}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Salute rete</span>
            <span className="font-bold" style={{ color: (stats.healthScore || 0) > 50 ? '#22C55E' : '#F59E0B' }}>
              {stats.healthScore || 0}%
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>NLP.js</span>
            <span className="font-bold" style={{ color: stats.nlpReady ? '#22C55E' : '#F59E0B' }}>
              {stats.nlpReady ? 'Attivo' : 'Off'} · {stats.nlpUserDocs || 0} doc utente
            </span>
          </div>
          {stats.topKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {stats.topKeywords.slice(0, 6).map((kw, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                  style={{
                    background: kw.type === 'calendar' ? 'rgba(14,165,233,0.1)'
                      : kw.type === 'task' ? 'rgba(108,92,231,0.1)'
                      : kw.type === 'expense' ? 'rgba(245,158,11,0.1)'
                      : 'rgba(148,163,184,0.1)',
                    color: 'var(--text-secondary)',
                  }}>
                  {kw.keyword} ({kw.score})
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Es: Asia dentista domani alle 16, ho speso 30€ al super"
            rows={2}
            maxLength={500}
            disabled={isActive}
            className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none
              focus:outline-none focus:ring-2 transition-all"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
            }}
          />
          <span className="absolute bottom-1.5 right-2.5 text-[10px] text-gray-300">
            {text.length}/500
          </span>
        </div>

        {/* Voice button (inline) */}
        {speechAvailable && (
          <button
            type="button"
            onClick={startVoice}
            disabled={isActive}
            aria-label={phase === 'listening' ? 'Ferma registrazione' : 'Input vocale'}
            className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95"
            style={{
              background: phase === 'listening'
                ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                : 'linear-gradient(135deg, #F59E0B, #D97706)',
              boxShadow: phase === 'listening'
                ? '0 2px 12px rgba(239,68,68,0.4)'
                : '0 2px 8px rgba(245,158,11,0.3)',
            }}
          >
            {phase === 'listening' ? (
              <MicOff size={18} className="text-white animate-pulse" />
            ) : (
              <Mic size={18} className="text-white" />
            )}
          </button>
        )}

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isActive || !text.trim()}
          aria-label={isActive ? 'Elaborazione in corso' : 'Invia comando'}
          className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white
            transition-all active:scale-95 disabled:opacity-40"
          style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
        >
          {isActive ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>

      {/* Status line */}
      {isActive && (
        <p className="text-xs text-center font-medium animate-pulse" style={{ color: 'var(--primary)' }}>
          {phase === 'listening' ? '🎙️ Sto ascoltando...'
            : phase === 'parsing' ? '🧠 Analizzo...'
            : '⚡ Eseguo...'}
        </p>
      )}
    </div>
  )
}
