/**
 * BrainSheet — Bottom sheet modale per il flusso Brain.
 *
 * Mostra: stato registrazione → parsing → anteprima azioni → conferma → risultato.
 * Il componente riceve tutto lo stato da useBrain() e si renderizza di conseguenza.
 *
 * Props (da useBrain):
 *   phase, transcript, result, executionLog, error, members,
 *   confirmActions, cancel, aiCallsRemaining
 */
import { useState, useEffect, useCallback } from 'react'
import {
  X, Check, Trash2, ChevronDown, ChevronUp,
  CalendarDays, ListChecks, Wallet, UtensilsCrossed,
  ShoppingCart, StickyNote, AlertTriangle, Bell, Link2Off,
  Brain, Mic, Loader2, Sparkles, Wifi, WifiOff,
  CheckCircle2, XCircle, AlertCircle, Search, ArrowRight,
} from 'lucide-react'

// ─── Configurazione icone per tipo azione ─────────────────────
const ACTION_CONFIG = {
  task:     { icon: ListChecks,      label: 'Task',     color: '#6C5CE7', bg: 'rgba(108,92,231,0.08)' },
  calendar: { icon: CalendarDays,    label: 'Evento',   color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
  expense:  { icon: Wallet,          label: 'Spesa',    color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  meal:     { icon: UtensilsCrossed, label: 'Pasto',    color: '#22C55E', bg: 'rgba(34,197,94,0.08)' },
  shopping: { icon: ShoppingCart,    label: 'Lista',    color: '#EC4899', bg: 'rgba(236,72,153,0.08)' },
  reminder: { icon: Bell,            label: 'Promemoria', color: '#F97316', bg: 'rgba(249,115,22,0.08)' },
  note:        { icon: StickyNote,      label: 'Nota',     color: '#94A3B8', bg: 'rgba(148,163,184,0.08)' },
  edit_action: { icon: CalendarDays,    label: 'Modifica', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
}

// ─── EditActionCard — disambiguation UI per edit_action ──────
function EditActionCard({ action, index, onSelectCandidate, onRemove }) {
  const config = ACTION_CONFIG.edit_action
  const resolved = action.resolved || {}
  const status = resolved.status || 'not_found'
  const verb = action.verb || 'edit'

  const verbLabel = verb === 'delete' ? 'Elimina' : verb === 'move' ? 'Sposta' : 'Modifica'
  const notFoundSuffix = verb === 'delete' ? 'da eliminare' : verb === 'move' ? 'da spostare' : 'da modificare'

  // ── not_found ──
  if (status === 'not_found') {
    return (
      <div
        className="rounded-xl overflow-hidden transition-all duration-200"
        style={{ background: config.bg, border: `1px solid ${config.color}20` }}
      >
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100">
            <Search size={16} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Non trovato
            </span>
            <p className="text-sm font-medium text-gray-500 truncate">
              Nessun risultato {notFoundSuffix} per "{action.originalText || action.title || '?'}"
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    )
  }

  // ── ambiguous ──
  if (status === 'ambiguous') {
    const candidates = resolved.candidates || []
    return (
      <div
        className="rounded-xl overflow-hidden transition-all duration-200"
        style={{ background: config.bg, border: `1px solid #F59E0B30` }}
      >
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.15)' }}>
            <AlertCircle size={16} className="text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
              {verbLabel}
            </span>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {action.originalText || action.title || '?'} — quale intendi?
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
        <div className="px-3 pb-2.5 flex flex-col gap-1.5">
          {candidates.map((c, ci) => (
            <button
              key={ci}
              type="button"
              onClick={() => onSelectCandidate(index, c)}
              className="w-full text-left rounded-lg px-3 py-2 border transition-all
                hover:border-purple-300 hover:bg-purple-50 active:scale-[0.98]"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}
            >
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {c.title || c.text || '—'}
              </p>
              {c.date && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {c.date}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── resolved ──
  const record = resolved.selectedRecord || resolved.matchedRecord || {}
  const isDelete = verb === 'delete'
  const VerbIcon = isDelete ? Trash2 : ArrowRight
  const verbColor = isDelete ? '#EF4444' : '#8B5CF6'
  const verbBg = isDelete ? 'rgba(239,68,68,0.08)' : config.bg

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{ background: verbBg, border: `1px solid ${verbColor}20` }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${verbColor}20` }}
        >
          <VerbIcon size={16} style={{ color: verbColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: verbColor }}>
            {verbLabel}
          </span>
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {record.title || record.text || action.title || '—'}
          </p>
          {record.date && (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {record.date}
              {verb === 'move' && action.newDate && (
                <span> <ArrowRight size={10} className="inline" /> {action.newDate}</span>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── ActionCard — legge SOLO campi canonici (Sprint 2+) ──────
function ActionCard({ action, index, onRemove }) {
  const [expanded, setExpanded] = useState(false)
  const config = ACTION_CONFIG[action.type] || ACTION_CONFIG.note
  const Icon = config.icon

  // Warning: persona non risolta (il normalizer mette warning in action.warnings)
  const hasPersonWarning = action.warnings?.some(w => w.startsWith('person_not_resolved'))
  const hasIncomplete = !!action.incomplete
  const hasWarning = hasPersonWarning || hasIncomplete

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{ background: config.bg, border: `1px solid ${config.color}20` }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded) }}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${config.color}20` }}
        >
          <Icon size={16} style={{ color: config.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: config.color }}>
              {config.label}
            </span>
            {hasWarning && <AlertTriangle size={11} className="text-amber-500" />}
            {action.linkedEntity && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500 font-medium">linked</span>
            )}
          </div>
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {action.title || action.text || `€${action.amount}`}
          </p>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(index) }}
          className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <Trash2 size={13} />
        </button>

        {expanded
          ? <ChevronUp size={14} className="text-gray-300" />
          : <ChevronDown size={14} className="text-gray-300" />
        }
      </div>

      {expanded && (
        <div className="px-3 pb-2.5 flex flex-col gap-1">
          {action.type === 'calendar' && (
            <>
              <Detail label="Titolo" value={action.title} />
              <Detail label="Per" value={action.personNames?.join(', ') || '—'} warn={hasPersonWarning} />
              <Detail label="Data" value={action.date} />
              {action.timeStart && <Detail label="Ora" value={action.timeStart} />}
              {action.timeEnd && <Detail label="Fine" value={action.timeEnd} />}
              {action.location && <Detail label="Luogo" value={action.location} />}
              {action.logistics?.accompaniedByName && <Detail label="Porta" value={action.logistics.accompaniedByName} />}
              {action.logistics?.pickupByName && <Detail label="Riprende" value={action.logistics.pickupByName} />}
              {action.logistics?.needsDriver && !action.logistics?.accompaniedByName && !action.logistics?.pickupByName && (
                <Detail label="Avviso" value="Manca chi accompagna/riprende" warn />
              )}
              {action.incomplete && <Detail label="Incompleto" value={action.incomplete} warn />}
            </>
          )}
          {action.type === 'task' && (
            <>
              <Detail label="Titolo" value={action.title} />
              <Detail label="Assegnato" value={action.assignedToName || '—'} warn={hasPersonWarning} />
              <Detail label="Scadenza" value={action.dueDate || '—'} />
              {action.linkedEntity && (
                <Detail label="Collegato a" value={`${action.linkedEntity.entityType} (${action.linkedEntity.tempRef || 'pending'})`} />
              )}
            </>
          )}
          {action.type === 'expense' && (
            <>
              <Detail label="Importo" value={`€${Number(action.amount).toFixed(2)}`} />
              <Detail label="Categoria" value={action.category || '—'} />
              <Detail label="Descrizione" value={action.title || '—'} />
              <Detail label="Chi" value={action.personName || '—'} warn={hasPersonWarning} />
              <Detail label="Data" value={action.date} />
            </>
          )}
          {action.type === 'meal' && (
            <>
              <Detail label="Piatto" value={action.title} />
              <Detail label="Data" value={action.date} />
              {action.slot && <Detail label="Pasto" value={action.slot} />}
            </>
          )}
          {action.type === 'shopping' && (
            <>
              <Detail label="Prodotto" value={action.title} />
              {action.quantity && <Detail label="Quantità" value={`${action.quantity} ${action.unit || ''}`} />}
              {action.category && <Detail label="Categoria" value={action.category} />}
            </>
          )}
          {action.type === 'reminder' && (
            <>
              <Detail label="Titolo" value={action.title} />
              <Detail label="Per" value={action.assignedToName || '—'} warn={hasPersonWarning} />
              {action.date && <Detail label="Data" value={action.date} />}
              {action.timeStart && <Detail label="Ora" value={action.timeStart} />}
              {action.fromPersonName && <Detail label="Da" value={action.fromPersonName} />}
            </>
          )}
          {action.type === 'note' && <Detail label="Testo" value={action.text} />}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, warn }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-[11px] text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className={`text-xs font-medium ${warn ? 'text-amber-600' : 'text-gray-700'}`}>
        {value}
        {warn && ' ⚠️ non trovato'}
      </span>
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function BrainSheet({
  phase,
  transcript,
  result,
  executionLog,
  error,
  members,
  confirmActions,
  cancel,
  aiCallsRemaining,
}) {
  const [actions, setActions] = useState([])

  // Sync azioni dal result
  useEffect(() => {
    if (result?.actions) {
      setActions([...result.actions])
    }
  }, [result])

  const handleRemove = useCallback((index) => {
    setActions(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleSelectCandidate = useCallback((actionIndex, candidate) => {
    setActions(prev => prev.map((a, i) => {
      if (i !== actionIndex || a.type !== 'edit_action') return a
      return {
        ...a,
        resolved: {
          ...a.resolved,
          status: 'resolved',
          selectedRecord: candidate,
          resolutionSource: 'user_selected',
        },
      }
    }))
  }, [])

  const handleConfirm = () => {
    if (actions.length > 0) {
      confirmActions(actions)
    }
  }

  // Non mostrare niente se idle
  if (phase === 'idle') return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={phase === 'preview' ? cancel : undefined}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl animate-slide-up
          max-h-[85vh] flex flex-col"
        style={{
          background: 'var(--bg-card)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* ─── LISTENING ─────────────────────────────────── */}
        {phase === 'listening' && (
          <div className="flex flex-col items-center gap-4 py-8 px-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center animate-pulse"
              style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)', boxShadow: '0 4px 24px rgba(239,68,68,0.4)' }}>
              <Mic size={32} className="text-white" />
            </div>
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Sto ascoltando...
            </p>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Parla liberamente. Posso capire più cose in una frase sola.
            </p>
            <button type="button" onClick={cancel}
              className="text-xs font-medium text-gray-400 mt-2">
              Annulla
            </button>
          </div>
        )}

        {/* ─── PARSING ──────────────────────────────────── */}
        {phase === 'parsing' && (
          <div className="flex flex-col items-center gap-4 py-8 px-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}>
              <Brain size={32} className="text-white animate-pulse" />
            </div>
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Analizzo...
            </p>
            {transcript && (
              <p className="text-sm text-center px-4 py-2 rounded-xl bg-gray-50 max-w-full"
                style={{ color: 'var(--text-secondary)' }}>
                "{transcript}"
              </p>
            )}
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        )}

        {/* ─── PREVIEW ──────────────────────────────────── */}
        {phase === 'preview' && result && (
          <div className="flex flex-col gap-3 px-4 pt-2 pb-4 overflow-y-auto flex-1">
            {/* Header */}
            <div className="flex items-center gap-2 px-1">
              <Brain size={16} style={{ color: 'var(--primary)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Anteprima
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                {result.usedAI ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-1">
                    <Sparkles size={10} /> AI
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 flex items-center gap-1">
                    <WifiOff size={10} /> Locale
                  </span>
                )}
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--primary-50)', color: 'var(--primary)' }}>
                  {actions.length} {actions.length === 1 ? 'azione' : 'azioni'}
                </span>
              </span>
            </div>

            {/* Transcript */}
            {transcript && (
              <p className="text-xs px-2 py-1.5 rounded-lg bg-gray-50"
                style={{ color: 'var(--text-muted)' }}>
                "{transcript}"
              </p>
            )}

            {/* Summary */}
            <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
              {result.summary}
            </p>

            {/* Action cards */}
            <div className="flex flex-col gap-2">
              {actions.map((action, i) => (
                action.type === 'edit_action' ? (
                  <EditActionCard
                    key={`edit-${i}`}
                    action={action}
                    index={i}
                    onSelectCandidate={handleSelectCandidate}
                    onRemove={handleRemove}
                  />
                ) : (
                  <ActionCard
                    key={`${action.type}-${i}`}
                    action={action}
                    index={i}
                    onRemove={handleRemove}
                  />
                )
              ))}
            </div>

            {actions.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-sm text-gray-500">Tutte le azioni rimosse</p>
              </div>
            )}

            {/* Confirm / Cancel buttons */}
            <div className="flex gap-3 pt-2 pb-2">
              <button type="button" onClick={cancel}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-medium transition-all"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <X size={15} /> Annulla
              </button>
              <button type="button" onClick={handleConfirm}
                disabled={actions.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white
                  shadow-md transition-all active:scale-[0.98] disabled:opacity-40"
                style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}>
                <Check size={15} /> Conferma
              </button>
            </div>

            <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
              Tocca un'azione per i dettagli. Rimuovi quelle sbagliate.
            </p>
          </div>
        )}

        {/* ─── EXECUTING ────────────────────────────────── */}
        {phase === 'executing' && (
          <div className="flex flex-col items-center gap-4 py-8 px-6">
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
            <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Eseguo le azioni...
            </p>
          </div>
        )}

        {/* ─── DONE ─────────────────────────────────────── */}
        {phase === 'done' && (() => {
          const okCount = executionLog.filter(l => l.ok && !l.msg?.startsWith('⚠')).length
          const failCount = executionLog.filter(l => !l.ok).length
          const warnCount = executionLog.filter(l => l.ok && l.msg?.startsWith('⚠')).length
          const allOk = failCount === 0 && warnCount === 0
          const allFailed = okCount === 0 && failCount > 0
          const hasProblems = failCount > 0 || warnCount > 0

          return (
            <div className="flex flex-col items-center gap-3 py-6 px-6">
              {/* Icon — changes based on outcome */}
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                allFailed ? 'bg-red-50' : allOk ? 'bg-emerald-50' : 'bg-amber-50'
              }`}>
                {allFailed
                  ? <XCircle size={32} className="text-red-500" />
                  : allOk
                    ? <CheckCircle2 size={32} className="text-emerald-500" />
                    : <AlertCircle size={32} className="text-amber-500" />
                }
              </div>

              {/* Title */}
              <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {allFailed ? 'Errore nel salvataggio' : allOk ? 'Fatto!' : 'Completato con avvisi'}
              </p>

              {/* Summary banner */}
              {executionLog.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 text-xs font-medium">
                  {okCount > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      {okCount} {okCount === 1 ? 'salvata' : 'salvate'}
                    </span>
                  )}
                  {warnCount > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                      {warnCount} senza collegamento
                    </span>
                  )}
                  {failCount > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700">
                      {failCount} non {failCount === 1 ? 'salvata' : 'salvate'}
                    </span>
                  )}
                </div>
              )}

              {/* No actions saved at all */}
              {executionLog.length === 0 && (
                <p className="text-xs text-gray-400">Nessuna azione eseguita</p>
              )}

              {/* Detail log */}
              {executionLog.length > 0 && (
                <div className="flex flex-col gap-1.5 w-full max-w-sm mt-1">
                  {executionLog.map((log, i) => {
                    const isWarning = log.ok && log.msg?.startsWith('⚠')
                    return (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        {isWarning
                          ? <Link2Off size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          : log.ok
                            ? <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                            : <XCircle size={12} className="text-red-500 flex-shrink-0 mt-0.5" />
                        }
                        <span className={isWarning ? 'text-amber-600' : log.ok ? 'text-gray-600' : 'text-red-600'}>
                          {log.msg}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Pulsante chiudi manuale se ci sono problemi */}
              {hasProblems && (
                <button type="button" onClick={cancel}
                  className="mt-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors">
                  Chiudi
                </button>
              )}
            </div>
          )
        })()}

        {/* ─── ERROR ────────────────────────────────────── */}
        {phase === 'error' && (
          <div className="flex flex-col items-center gap-3 py-6 px-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-50">
              <XCircle size={32} className="text-red-500" />
            </div>
            <p className="text-sm font-medium text-red-600 text-center">{error}</p>
            <button type="button" onClick={cancel}
              className="text-xs font-medium text-gray-400 mt-1">
              Chiudi
            </button>
          </div>
        )}
      </div>
    </>
  )
}
