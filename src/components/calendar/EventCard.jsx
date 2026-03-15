/**
 * STEP 11.3 — EventCard: single event display with time, title, owner badge, logistics.
 * Props: event, members[], onEdit(event), onDelete(eventId)
 */
import { Clock, MapPin, Trash2, Edit3, AlertTriangle } from 'lucide-react'
import { EVENT_CATEGORIES, LOGISTICS_ROLES } from '../../lib/constants.js'
import { formatTime } from '../../lib/dates.js'

export default function EventCard({ event, members, onEdit, onDelete }) {
  const cat = EVENT_CATEGORIES.find((c) => c.id === event.category)
  const owner = event.person_id === 'tutti'
    ? { name: 'Tutti', icon: '👥' }
    : members.find((m) => m.id === event.person_id)
  const color = event.color || cat?.color || '#9E9E9E'
  const isAbsence = event.isAbsence || event.category === 'assenza'
  const hasWarnings = !isAbsence && (event.incomplete || event.needsPickup || (!event.time_start))

  return (
    <div
      className="flex gap-3 rounded-xl p-3 shadow-sm border active:bg-gray-50 transition-colors"
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: isAbsence ? '#EF4444' : hasWarnings ? '#EF4444' : color,
        background: isAbsence
          ? 'repeating-linear-gradient(135deg, rgba(239,68,68,0.04), rgba(239,68,68,0.04) 8px, rgba(255,255,255,0.9) 8px, rgba(255,255,255,0.9) 16px)'
          : 'white',
        borderColor: isAbsence ? 'rgba(239,68,68,0.2)' : 'rgb(243,244,246)',
      }}
    >
      {/* Left: time column */}
      <div className="flex flex-col items-center justify-center min-w-[48px]">
        {isAbsence ? (
          <div className="flex flex-col items-center gap-0.5">
            {event.time_start ? (
              <>
                <span className="text-xs font-bold text-red-500">{formatTime(event.time_start)}</span>
                {event.time_end && (
                  <span className="text-xs font-bold text-red-500">{formatTime(event.time_end)}</span>
                )}
              </>
            ) : (
              <span className="text-xs text-red-400">Tutto il giorno</span>
            )}
          </div>
        ) : event.time_start ? (
          <>
            <span className="text-sm font-semibold text-gray-900">{formatTime(event.time_start)}</span>
            {event.time_end && (
              <span className="text-xs text-gray-400">{formatTime(event.time_end)}</span>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-gray-400">Tutto il giorno</span>
            <div className="flex items-center gap-0.5">
              <AlertTriangle size={10} className="text-red-500" />
              <span className="text-[9px] font-bold text-red-500">No ora</span>
            </div>
          </div>
        )}
      </div>

      {/* Center: content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {isAbsence ? (
            /* Absence: show 🚫 with member icon */
            <>
              <span className="text-lg">🚫</span>
              <h4 className="text-sm font-bold text-red-600 truncate">{event.title}</h4>
            </>
          ) : (
            <>
              <span className="text-sm">{cat?.icon || '📌'}</span>
              <h4 className="text-sm font-semibold text-gray-900 truncate">{event.title}</h4>
              {/* Red warning dot for incomplete */}
              {hasWarnings && (
                <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" title="Evento incompleto" />
              )}
            </>
          )}
        </div>

        {/* Owner */}
        {owner && (
          <p className={`text-xs mt-0.5 ${isAbsence ? 'text-red-400 font-medium' : 'text-gray-500'}`}>
            {owner.icon || '👤'} {owner.name}
            {isAbsence && event.time_start && event.time_end
              ? ` — assente ${formatTime(event.time_start)}–${formatTime(event.time_end)}`
              : isAbsence ? ' — non disponibile' : ''}
          </p>
        )}

        {/* Note (regular note, not warnings) */}
        {event.note && !event.note.startsWith('⚠️') && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{event.note}</p>
        )}

        {/* Logistics */}
        {event.logistics && event.logistics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {event.logistics.map((log, i) => {
              const member = members.find((m) => m.id === log.member_id)
              const role = LOGISTICS_ROLES.find((r) => r.id === log.role)
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {role?.icon || '🚗'} {role?.label || log.role}: {member?.name || '?'}
                </span>
              )
            })}
          </div>
        )}

        {/* Warning badges */}
        {(event.incomplete || event.needsPickup) && (
          <div className="flex flex-col gap-1 mt-1.5">
            {event.incomplete && (
              <div className="inline-flex items-center gap-1 rounded-lg px-2 py-1"
                style={{ background: 'rgba(239,68,68,0.08)' }}>
                <AlertTriangle size={11} className="text-red-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-red-600">{event.incomplete}</span>
              </div>
            )}
            {event.needsPickup && (
              <div className="inline-flex items-center gap-1 rounded-lg px-2 py-1"
                style={{ background: 'rgba(245,158,11,0.08)' }}>
                <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-amber-600">Chi va a riprendere? Da definire</span>
              </div>
            )}
          </div>
        )}

        {/* Recurrence badge */}
        {event.recurrence_id && (
          <span className="inline-flex items-center gap-0.5 mt-1 text-xs text-violet-500">
            🔄 Ricorrente
          </span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(event) }}
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-violet-500 transition-colors"
          aria-label="Modifica evento"
        >
          <Edit3 size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(event.id) }}
          className="rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          aria-label="Elimina evento"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
