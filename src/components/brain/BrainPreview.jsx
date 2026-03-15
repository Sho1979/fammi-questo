/**
 * BrainPreview — Shows parsed Brain AI actions for user confirmation.
 * CRITICAL: No action is executed until the user explicitly confirms.
 *
 * Props:
 *   result: { ok, actions[], summary }
 *   members: Member[]
 *   onConfirm(actions[]) — called with confirmed actions to execute
 *   onCancel() — dismiss without executing
 */
import { useState, useCallback } from 'react'
import {
  Check,
  X,
  Trash2,
  CalendarDays,
  ListChecks,
  Wallet,
  UtensilsCrossed,
  ShoppingCart,
  StickyNote,
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

const ACTION_CONFIG = {
  task: { icon: ListChecks, label: 'Task', color: '#6C5CE7', bg: 'rgba(108,92,231,0.08)' },
  calendar: { icon: CalendarDays, label: 'Evento', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)' },
  expense: { icon: Wallet, label: 'Spesa', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  meal: { icon: UtensilsCrossed, label: 'Pasto', color: '#22C55E', bg: 'rgba(34,197,94,0.08)' },
  shopping: { icon: ShoppingCart, label: 'Lista', color: '#EC4899', bg: 'rgba(236,72,153,0.08)' },
  note: { icon: StickyNote, label: 'Nota', color: '#94A3B8', bg: 'rgba(148,163,184,0.08)' },
  reminder: { icon: Bell, label: 'Promemoria', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
  absence: { icon: CalendarDays, label: '🚫 Assenza', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
}

function ActionCard({ action, members, index, onRemove }) {
  const [expanded, setExpanded] = useState(false)
  const config = action.type === 'reminder' ? ACTION_CONFIG.reminder
    : action.isReminder ? ACTION_CONFIG.reminder
    : action.isAbsence ? ACTION_CONFIG.absence
    : (ACTION_CONFIG[action.type] || ACTION_CONFIG.note)
  const Icon = config.icon

  // Resolve member name to check if valid
  const resolvedAssignee = action.assignedTo
    ? members.find((m) => m.name.toLowerCase() === action.assignedTo?.toLowerCase())
    : null
  const resolvedPerson = action.person
    ? members.find((m) => m.name.toLowerCase() === action.person?.toLowerCase())
    : null

  const hasWarning =
    (action.assignedTo && !resolvedAssignee && action.type !== 'reminder') ||
    (action.person && !resolvedPerson) ||
    action.incomplete ||
    action.needsPickup

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{ background: config.bg, border: `1px solid ${config.color}20` }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
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
            {hasWarning && (
              <AlertTriangle size={11} className="text-amber-500" />
            )}
          </div>
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {action.title || action.name || action.text || `€${action.amount}`}
          </p>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(index) }}
          className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <Trash2 size={13} />
        </button>

        {expanded ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-2.5 flex flex-col gap-1">
          {action.type === 'task' && (
            <>
              <Detail label="Titolo" value={action.title} />
              <Detail label="Assegnato a" value={action.assignedTo || '—'} warn={action.assignedTo && !resolvedAssignee} />
              <Detail label="Data" value={action.date} />
              {action.time && <Detail label="Ora" value={action.time} />}
            </>
          )}
          {action.type === 'calendar' && (
            <>
              <Detail label="Titolo" value={action.title} />
              <Detail label="Per" value={action.assignedTo || '—'} warn={action.assignedTo && !resolvedAssignee} />
              <Detail label="Data" value={action.date} />
              {action.time && action.timeEnd
                ? <Detail label="Orario" value={`${action.time} — ${action.timeEnd}`} />
                : action.time ? <Detail label="Ora" value={action.time} />
                : !action.isAbsence ? <Detail label="Ora" value="Da definire" warn /> : null}
              {action.accompaniedBy && <Detail label="Porta" value={action.accompaniedBy} />}
              {action.pickupBy && <Detail label="Riprende" value={action.pickupBy} />}
              {action.needsPickup && (
                <div className="flex items-center gap-1.5 px-1 py-0.5 rounded-md mt-0.5" style={{ background: 'rgba(245,158,11,0.1)' }}>
                  <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />
                  <span className="text-[11px] text-amber-600 font-medium">Chi va a riprendere? Da definire</span>
                </div>
              )}
              {action.incomplete && (
                <div className="flex items-center gap-1.5 px-1 py-0.5 rounded-md mt-0.5" style={{ background: 'rgba(245,158,11,0.1)' }}>
                  <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />
                  <span className="text-[11px] text-amber-600 font-medium">{action.incomplete}</span>
                </div>
              )}
            </>
          )}
          {action.type === 'expense' && (
            <>
              <Detail label="Importo" value={`€${Number(action.amount).toFixed(2)}`} />
              <Detail label="Categoria" value={action.category} />
              <Detail label="Nota" value={action.note || '—'} />
              <Detail label="Chi" value={action.person || '—'} warn={action.person && !resolvedPerson} />
              {action.date && <Detail label="Data" value={action.date} />}
            </>
          )}
          {action.type === 'meal' && (
            <>
              <Detail label="Piatto" value={action.name} />
              <Detail label="Data" value={action.date} />
            </>
          )}
          {action.type === 'shopping' && (
            <>
              <Detail label="Prodotto" value={action.name} />
              {action.quantity && <Detail label="Quantità" value={`${action.quantity} ${action.unit || ''}`} />}
            </>
          )}
          {action.type === 'note' && (
            <Detail label="Testo" value={action.text} />
          )}
          {action.type === 'reminder' && (
            <>
              <Detail label="Messaggio" value={action.text} />
              <Detail label="Destinatario" value={action.assignedTo || '—'} />
              <Detail label="Da" value={action.fromPerson || '—'} />
              {action.date && <Detail label="Data" value={action.date} />}
              {action.needsConfirm && (
                <div className="flex items-center gap-1.5 px-1 py-0.5 rounded-md mt-0.5" style={{ background: 'rgba(139,92,246,0.1)' }}>
                  <Bell size={11} className="text-violet-500 flex-shrink-0" />
                  <span className="text-[11px] text-violet-600 font-medium">Attende conferma di lettura</span>
                </div>
              )}
            </>
          )}
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

export default function BrainPreview({ result, members, onConfirm, onCancel }) {
  const [actions, setActions] = useState(result.actions || [])

  const handleRemove = useCallback((index) => {
    setActions((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleConfirmAll = () => {
    if (actions.length > 0) {
      onConfirm(actions)
    }
  }

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-sm text-gray-500">Nessuna azione da confermare</p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-4 py-2 text-xs font-medium text-gray-500 border border-gray-200"
        >
          Chiudi
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 max-h-[70vh] overflow-y-auto">
      {/* Summary */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Anteprima
        </span>
        <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: 'var(--primary-50)', color: 'var(--primary)' }}>
          {actions.length} {actions.length === 1 ? 'azione' : 'azioni'}
        </span>
      </div>

      <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
        {result.summary}
      </p>

      {/* Action cards */}
      <div className="flex flex-col gap-2">
        {actions.map((action, i) => (
          <ActionCard
            key={`${action.type}-${i}`}
            action={action}
            members={members}
            index={i}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Confirm / Cancel */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition-all"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
        >
          <X size={15} /> Annulla
        </button>
        <button
          type="button"
          onClick={handleConfirmAll}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white
            shadow-md transition-all active:scale-[0.98]"
          style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
        >
          <Check size={15} /> Conferma tutto
        </button>
      </div>

      <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
        Tocca un'azione per espandere i dettagli. Rimuovi quelle che non vuoi.
      </p>
    </div>
  )
}
