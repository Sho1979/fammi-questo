/**
 * VoiceButton — Floating draggable mic button that triggers the Brain flow.
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
 *
 * DRAGGABLE: l'utente può trascinare il bottone in qualsiasi posizione
 * per evitare che copra contenuti importanti.
 */
import { memo, useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Loader2, Brain } from 'lucide-react'
import { hapticMedium } from '../../lib/haptics.js'
import { isIOS } from '../../lib/platform.js'

export default memo(function VoiceButton({ phase, onPress, speechAvailable }) {
  if (!speechAvailable) return null

  // Nascondi quando la BrainSheet è aperta in preview
  if (phase === 'preview') return null

  const isActive = phase === 'listening' || phase === 'parsing' || phase === 'executing'

  // --- Draggable state ---
  const [position, setPosition] = useState({
    right: 16,
    bottom: isIOS ? 128 : 112,  // ~7rem
  })
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startRight: 0,
    startBottom: 0,
    moved: false,
  })

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    dragRef.current = {
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      startRight: position.right,
      startBottom: position.bottom,
      moved: false,
    }
  }, [position])

  const handleTouchMove = useCallback((e) => {
    if (!dragRef.current.isDragging) return
    const touch = e.touches[0]
    const deltaX = dragRef.current.startX - touch.clientX
    const deltaY = dragRef.current.startY - touch.clientY

    // Solo se si è mosso abbastanza consideriamo drag
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      dragRef.current.moved = true
      e.preventDefault() // Evita scroll durante il drag

      const newRight = Math.max(8, Math.min(window.innerWidth - 64, dragRef.current.startRight + deltaX))
      const newBottom = Math.max(80, Math.min(window.innerHeight - 80, dragRef.current.startBottom + deltaY))

      setPosition({ right: newRight, bottom: newBottom })
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    const wasDragging = dragRef.current.moved
    dragRef.current.isDragging = false
    dragRef.current.moved = false

    // Se NON si è mosso, è un tap → attiva il voice
    if (!wasDragging) {
      hapticMedium()
      onPress()
    }
  }, [onPress])

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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        // Desktop click fallback (touch non disponibile)
        if (!('ontouchstart' in window)) {
          hapticMedium()
          onPress()
        }
      }}
      disabled={isActive}
      className={`fixed z-50 flex items-center justify-center
        w-14 h-14 rounded-full transition-colors duration-300
        ${phase === 'listening' ? 'scale-110' : ''}
        disabled:cursor-not-allowed touch-none`}
      style={{
        ...getStyle(),
        right: `${position.right}px`,
        bottom: `${position.bottom}px`,
      }}
      aria-label="Brain — input vocale"
    >
      {getIcon()}
    </button>
  )
})
