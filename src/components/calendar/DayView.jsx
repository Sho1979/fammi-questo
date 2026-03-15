/**
 * DayView — Full daily timeline with hour slots, detailed event cards, and task section.
 * Maximum detail level. Shows events positioned by time + all-day section + tasks.
 */
import { useMemo } from 'react'
import { Plus, Clock, CheckCircle2, CalendarDays, MapPin, AlertTriangle, Sun, Sunset } from 'lucide-react'
import { formatDate, formatWeekday, formatTime } from '../../lib/dates.js'
import { EVENT_CATEGORIES, LOGISTICS_ROLES, TASK_CATEGORIES } from '../../lib/constants.js'

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7) // 7:00 – 22:00
const HOUR_HEIGHT = 64 // px per hour slot
const CAL_COLOR = '#0984E3'

function timeToMinutes(time) {
  if (!time) return -1
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function EventBlock({ event, members, onEdit, onDelete }) {
  const cat = EVENT_CATEGORIES.find((c) => c.id === event.category)
  const owner = event.person_id === 'tutti'
    ? { name: 'Tutti', icon: '👥' }
    : members.find((m) => m.id === event.person_id)
  const color = event.color || cat?.color || '#9E9E9E'
  const isAbsence = event.isAbsence || event.category === 'assenza'
  const hasWarnings = !isAbsence && (event.incomplete || event.needsPickup || !event.time_start)

  const startMin = timeToMinutes(event.time_start)
  const endMin = timeToMinutes(event.time_end)
  const duration = endMin > startMin ? endMin - startMin : 60

  return (
    <div
      className="rounded-xl p-3 shadow-sm border cursor-pointer active:scale-[0.98] transition-all"
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: isAbsence ? '#EF4444' : hasWarnings ? '#EF4444' : color,
        background: isAbsence
          ? 'repeating-linear-gradient(135deg, rgba(239,68,68,0.04), rgba(239,68,68,0.04) 8px, rgba(255,255,255,0.9) 8px, rgba(255,255,255,0.9) 16px)'
          : 'white',
        borderColor: isAbsence ? 'rgba(239,68,68,0.2)' : 'rgb(243,244,246)',
      }}
      onClick={() => onEdit(event)}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-sm">{isAbsence ? '🚫' : (cat?.icon || '📌')}</span>
        <h4 className="text-sm font-semibold truncate" style={{ color: isAbsence ? '#EF4444' : '#2D3436' }}>
          {event.title}
        </h4>
        {hasWarnings && (
          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>

      {/* Time */}
      <div className="flex items-center gap-1.5 mt-1">
        <Clock size={12} className="text-gray-400" />
        <span className="text-xs text-gray-500">
          {event.time_start ? formatTime(event.time_start) : 'Tutto il giorno'}
          {event.time_end ? ` – ${formatTime(event.time_end)}` : ''}
        </span>
        {event.time_start && event.time_end && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
            {Math.round(duration / 60)}h{duration % 60 > 0 ? `${duration % 60}m` : ''}
          </span>
        )}
      </div>

      {/* Owner */}
      {owner && (
        <p className="text-xs mt-1 text-gray-500">
          {owner.icon || '👤'} {owner.name}
        </p>
      )}

      {/* Note */}
      {event.note && !event.note.startsWith('⚠️') && (
        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{event.note}</p>
      )}

      {/* Logistics */}
      {event.logistics && event.logistics.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {event.logistics.map((log, i) => {
            const member = members.find((m) => m.id === log.member_id)
            const role = LOGISTICS_ROLES.find((r) => r.id === log.role)
            return (
              <span key={i} className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                {role?.icon || '🚗'} {role?.label || log.role}: {member?.name || '?'}
              </span>
            )
          })}
        </div>
      )}

      {/* Warning badges */}
      {(event.incomplete || event.needsPickup) && (
        <div className="flex flex-col gap-1 mt-2">
          {event.incomplete && (
            <div className="inline-flex items-center gap-1 rounded-lg px-2 py-1" style={{ background: 'rgba(239,68,68,0.08)' }}>
              <AlertTriangle size={11} className="text-red-500" />
              <span className="text-[11px] font-semibold text-red-600">{event.incomplete}</span>
            </div>
          )}
          {event.needsPickup && (
            <div className="inline-flex items-center gap-1 rounded-lg px-2 py-1" style={{ background: 'rgba(245,158,11,0.08)' }}>
              <AlertTriangle size={11} className="text-amber-500" />
              <span className="text-[11px] font-semibold text-amber-600">Chi va a riprendere?</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TaskBlock({ task, members, onComplete }) {
  const cat = TASK_CATEGORIES.find((c) => c.id === task.category)
  const assigned = task.assigned_to ? members.find((m) => m.id === task.assigned_to) : null

  return (
    <div
      className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all active:scale-[0.98]"
      style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.12)' }}
    >
      <button
        type="button"
        onClick={() => onComplete && onComplete(task.id)}
        className="flex-shrink-0 transition-all active:scale-90"
        style={{ color: '#A855F7' }}
        title="Segna come fatto"
      >
        <CheckCircle2 size={22} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {cat && <span className="text-[10px] text-gray-400">{cat.icon} {cat.label}</span>}
          {task.priority && task.priority !== 'media' && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                background: task.priority === 'alta' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                color: task.priority === 'alta' ? '#EF4444' : '#3B82F6',
              }}>
              {task.priority === 'alta' ? '🔴 Alta' : '🔵 Bassa'}
            </span>
          )}
        </div>
      </div>
      {assigned && (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: 'rgba(168,85,247,0.08)', color: '#7C3AED' }}>
          {assigned.icon || '👤'} {assigned.name}
        </span>
      )}
    </div>
  )
}

export default function DayView({ date, events, tasks, members, onAdd, onEdit, onDelete, onCompleteTask }) {
  if (!date) return null

  const dayEvents = useMemo(() => events.filter((e) => e.date === date), [events, date])
  const dayTasks = useMemo(() => tasks.filter((t) => t.due_date === date && t.status !== 'done'), [tasks, date])

  // Separate timed vs all-day events
  const timedEvents = dayEvents.filter((e) => e.time_start)
  const allDayEvents = dayEvents.filter((e) => !e.time_start)

  // Group timed events by hour for timeline
  const eventsByHour = useMemo(() => {
    const map = {}
    for (const ev of timedEvents) {
      const hour = parseInt(ev.time_start.split(':')[0], 10)
      if (!map[hour]) map[hour] = []
      map[hour].push(ev)
    }
    return map
  }, [timedEvents])

  // Current hour indicator
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isCurrentDay = date === todayStr
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  return (
    <div className="flex flex-col gap-3">
      {/* Day header card */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {formatWeekday(date)}
            </h3>
            <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
              {formatDate(date)}
            </p>
            <div className="flex items-center gap-3 mt-1">
              {dayEvents.length > 0 && (
                <span className="text-[11px] font-medium" style={{ color: CAL_COLOR }}>
                  {dayEvents.length} event{dayEvents.length !== 1 ? 'i' : 'o'}
                </span>
              )}
              {dayTasks.length > 0 && (
                <span className="text-[11px] font-medium" style={{ color: '#A855F7' }}>
                  {dayTasks.length} scadenz{dayTasks.length !== 1 ? 'e' : 'a'}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white
              transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
          >
            <Plus size={14} />
            Evento
          </button>
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sun size={14} style={{ color: '#FF9800' }} />
            <span className="text-xs font-semibold" style={{ color: '#FF9800' }}>Tutto il giorno</span>
          </div>
          <div className="flex flex-col gap-2">
            {allDayEvents.map((ev) => (
              <EventBlock key={ev.id} event={ev} members={members} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card p-3 overflow-hidden">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} style={{ color: CAL_COLOR }} />
          <span className="text-xs font-semibold" style={{ color: CAL_COLOR }}>Timeline</span>
        </div>

        <div className="relative" style={{ minHeight: `${HOURS.length * HOUR_HEIGHT}px` }}>
          {HOURS.map((hour) => {
            const hourEvents = eventsByHour[hour] || []
            const isPast = isCurrentDay && hour < currentHour
            const isCurrent = isCurrentDay && hour === currentHour

            return (
              <div
                key={hour}
                className="flex border-t"
                style={{
                  height: `${HOUR_HEIGHT}px`,
                  borderColor: 'rgba(0,0,0,0.05)',
                  opacity: isPast ? 0.5 : 1,
                }}
              >
                {/* Hour label */}
                <div className="flex-shrink-0 w-12 pt-1 text-right pr-2">
                  <span className="text-[11px] font-medium" style={{ color: isCurrent ? CAL_COLOR : '#B2BEC3' }}>
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>

                {/* Events in this hour */}
                <div className="flex-1 pl-2 pt-1 flex flex-col gap-1">
                  {hourEvents.map((ev) => (
                    <EventBlock key={ev.id} event={ev} members={members} onEdit={onEdit} onDelete={onDelete} />
                  ))}
                </div>
              </div>
            )
          })}

          {/* Current time indicator */}
          {isCurrentDay && currentHour >= 7 && currentHour <= 22 && (
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: `${(currentHour - 7) * HOUR_HEIGHT + (currentMinute / 60) * HOUR_HEIGHT}px`,
                zIndex: 10,
              }}
            >
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#EF4444' }} />
                <div className="flex-1 h-0.5" style={{ background: '#EF4444', opacity: 0.6 }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tasks section */}
      {dayTasks.length > 0 && (
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} style={{ color: '#A855F7' }} />
            <span className="text-xs font-semibold" style={{ color: '#A855F7' }}>Scadenze</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(168,85,247,0.1)', color: '#A855F7' }}>
              {dayTasks.length}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {dayTasks.map((task) => (
              <TaskBlock key={task.id} task={task} members={members} onComplete={onCompleteTask} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {dayEvents.length === 0 && dayTasks.length === 0 && (
        <div className="card p-8 flex flex-col items-center gap-3">
          <div className="empty-state-icon">
            <CalendarDays size={28} className="text-violet-300" />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Nessun impegno per questo giorno
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white
              transition-all active:scale-[0.97]"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Plus size={14} />
            Aggiungi evento
          </button>
        </div>
      )}
    </div>
  )
}
