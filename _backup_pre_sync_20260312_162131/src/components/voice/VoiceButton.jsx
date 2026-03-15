/**
 * VoiceButton — Floating mic button that triggers the Brain flow.
 *
 * Questo è solo il bottone floating. Tutto il flusso (parsing, preview,
 * esecuzione, apprendimento) è gestito da useBrain + BrainSheet.
 *
 * Il bottone cambia aspetto in base alla phase del Brain:
 *   idle → gradient viola (mic)
 *   listening → rosso pulsante
 *   parsing/executing → amber (loader)
 *   preview → nascosto (la sheet è aperta)
 *   done → verde
 *   error → rosso
 */
import { Mic, MicOff, Loader2, Brain } from 'lucide-react'

export default function VoiceButton({ phase, onPress, speechAvailable }) {
  if (!speechAvailable) return null

  // Nascondi quando la BrainSheet è aperta in preview
  if (phase === 'preview') return null

  const isActive = phase === 'listening' || phase === 'parsing' || phase === 'executing'

  const getStyle = () => {
    switch (phase) {
      case 'listening':
        return {
          background: 'linear-gradient(135deg, #EF4444, #DC2626)',
          boxShadow: '0 4px 24px rgba(239, 68, 68, 0.5)',
        }
      case 'parsing':
      case 'executing':
        return {
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          boxShadow: '0 4px 24px rgba(245, 158, 11, 0.4)',
        }
      case 'done':
        return {
          background: 'linear-gradient(135deg, #22C55E, #16A34A)',
          boxShadow: '0 4px 24px rgba(34, 197, 94, 0.4)',
        }
      case 'error':
        return {
          background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
          boxShadow: '0 4px 24px rgba(239, 68, 68, 0.3)',
        }
      default:
        return {
          background: 'var(--gradient-primary)',
          boxShadow: '0 4px 24px rgba(108, 92, 231, 0.4)',
        }
    }
  }

  const getIcon = () => {
    switch (phase) {
      case 'listening':
        return <Mic size={24} className="text-white animate-pulse" />
      case 'parsing':
      case 'executing':
        return <Loader2 size={24} className="text-white animate-spin" />
      case 'done':
        return <Brain size={24} className="text-white" />
      case 'error':
        return <MicOff size={24} className="text-white" />
      default:
        return <Mic size={24} className="text-white" />
    }
  }

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={isActive}
      className={`fixed bottom-20 right-4 z-50 flex items-center justify-center
        w-14 h-14 rounded-full transition-all duration-300
        ${phase === 'listening' ? 'scale-110' : 'hover:scale-105 active:scale-95'}
        disabled:cursor-not-allowed`}
      style={getStyle()}
      aria-label="Brain — input vocale"
    >
      {getIcon()}
    </button>
  )
}
