/**
 * WeekView — Weekly calendar view with 7 day columns.
 * Medium detail: shows event blocks with time + title, task indicators.
 * Scrollable horizontally on mobile, responsive layout.
 */
import { useMemo, memo } from 'react'
import { Plus, Clock, CheckCircle2, CalendarDays, Trash2 } from 'lucide-react'
import { getWeekDays, formatDayShort, formatTime, isToday } from '../../lib/dates.js'
import { EVENT_CATEGORIES, TASK_CATEGORIES } from '../../lib/constants.js'

const CAL_COLOR = '#0984E3'
const TASK_COLOR = '#A855F7'

function MiniEventCard({ event, members, onDelete }) {
  const cat = EVENT_CATEGORIES.find((c) => c.id === event.category)
  const color = event.color || cat?.color || '#9E9E9E'
  const isAbsence = event.isAbsence || event.category === 'assenza'
  const hasWarnings = !isAbsence && (event.incomplete || event.needsPickup || !event.time_start)
  const owner = event.person_id === 'tutti'
    ? { name: 'Tutti', icon: '👥' }
    : members.find((m) => m.id === event.person_id)

  return (
    <div
      className="rounded-lg p-2 text-[11px] leading-tight transition-all active:scale-[0.97]"
      style={{
        background: isAbsence ? 'rgba(239,68,68,0.06)' : `${color}12`,
        borderLeft: `3px solid ${isAbsence ? '#EF4444' : hasWarnings ? '#FF9800' : color}`,
      }}
    >
      <div className="flex items-center gap-1">
        <span className="text-[10px]">{isAbsence ? '🚫' : (cat?.icon || '📌')}</span>
        <span className="font-semibold truncate flex-1" style={{ color: isAbsence ? '#EF4444' : '#2D3436' }}>
          {event.title}
        </span>
        {hasWarnings && (
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(event.id) }}
            className="flex-shrink-0 rounded-full p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
            aria-label="Elimina evento"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      {event.time_start && (
        <div className="flex items-center gap-1 mt-0.5 text-gray-400">
          <Clock size={9} />
          <span>{formatTime(event.time_start)}</span>
          {event.time_end && <span>– {formatTime(event.time_end)}</span>}
        </div>
      )}
      {owner && (
        <p className="text-[10px] mt-0.5 text-gray-400 truncate">
          {owner.icon || '👤'} {owner.name}
        </p>
      )}
      {/* Logistics summary */}
      {event.logistics && event.logistics.length > 0 && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {event.logistics.map((log, i) => {
            const member = members.find((m) => m.id === log.member_id)
            return (
              <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-600">
                {log.role === 'porta' ? '🚗' : '🔄'} {member?.name || '?'}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MiniTaskCard({ task, members, onComplete }) {
  const assigned = task.assigned_to ? members.find((m) => m.id === task.assigned_to) : null

  return (
    <div
      className="flex items-center gap-1.5 rounded-lg p-2 text-[11px] transition-all active:scale-[0.97]"
      style={{ background: 'rgba(168,85,247,0.05)', borderLeft: `3px solid ${TASK_COLOR}` }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onComplete && onComplete(task.id) }}
        className="flex-shrink-0 active:scale-90"
        style={{ color: TASK_COLOR }}
      >
        <CheckCircle2 size={16} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
        {assigned && (
          <p className="text-[9px] text-gray-400 truncate mt-0.5">{assigned.icon || '👤'} {assigned.name}</p>
        )}
      </div>
    </div>
  )
}

export default memo(function WeekView({
  selectedDate, events, tasks, members,
  onDayClick, onAdd, onEdit, onDelete, onCompleteTask
}) {
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate])

  // Events grouped by date
  const eventsByDate = useMemo(() => {
    const map = {}
    for (const d of weekDays) map[d] = []
    for (const ev of events) {
      if (map[ev.date]) map[ev.date].push(ev)
    }
    // Sort by time within each day
    for (const d of weekDays) {
      map[d].sort((a, b) => (a.time_start || '').localeCompare(b.time_start || ''))
    }
    return map
  }, [events, weekDays])

  // Tasks grouped by due_date
  const tasksByDate = useMemo(() => {
    const map = {}
    for (const d of weekDays) map[d] = []
    for (const t of tasks) {
      if (t.due_date && map[t.due_date] && t.status !== 'done') {
        map[t.due_date].push(t)
      }
    }
    return map
  }, [tasks, weekDays])

  return (
    <div className="card overflow-hidden">
      {/* Week header */}
      <div className="grid grid-cols-7 border-b" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
        {weekDays.map((day) => {
          const today = isToday(day)
          const selected = day === selectedDate
          return (
            <button
              key={day}
              type="button"
              onClick={() => onDayClick(day)}
              className="flex flex-col items-center py-2.5 transition-all active:scale-95"
              style={{
                background: selected
                  ? 'linear-gradient(135deg, #0984E3 0%, #74B9FF 100%)'
                  : today
                  ? 'rgba(9,132,227,0.06)'
                  : 'transparent',
              }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: selected ? 'rgba(255,255,255,0.8)' : '#B2BEC3' }}>
                {formatDayShort(day).split(' ')[0]}
              </span>
              <span className="text-lg font-bold mt-0.5"
                style={{
                  color: selected ? '#FFFFFF' : today ? CAL_COLOR : '#2D3436',
                }}>
                {formatDayShort(day).split(' ')[1]}
              </span>
              {/* Dot indicators */}
              <div className="flex gap-1 mt-1 h-2">
                {(eventsByDate[day] || []).length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: selected ? 'rgba(255,255,255,0.8)' : CAL_COLOR }} />
                )}
                {(tasksByDate[day] || []).length > 0 && (
                  <span className="w-1.5 h-1.5" style={{ borderRadius: '1px', background: selected ? 'rgba(255,255,255,0.8)' : TASK_COLOR }} />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Week body - scrollable columns */}
      <div className="grid grid-cols-7 min-h-[300px]">
        {weekDays.map((day) => {
          const dayEvts = eventsByDate[day] || []
          const dayTsks = tasksByDate[day] || []
          const today = isToday(day)
          const selected = day === selectedDate
          const isEmpty = dayEvts.length === 0 && dayTsks.length === 0

          return (
            <div
              key={day}
              className="flex flex-col gap-1 p-1 border-r last:border-r-0 cursor-pointer"
              style={{
                borderColor: 'rgba(0,0,0,0.04)',
                background: selected ? 'rgba(9,132,227,0.02)' : today ? 'rgba(9,132,227,0.01)' : 'transparent',
                minHeight: '200px',
              }}
              onClick={() => onDayClick(day)}
            >
              {/* Events */}
              {dayEvts.map((ev) => (
                <MiniEventCard key={ev.id} event={ev} members={members} onDelete={onDelete} />
              ))}

              {/* Tasks */}
              {dayTsks.map((t) => (
                <MiniTaskCard key={t.id} task={t} members={members} onComplete={onCompleteTask} />
              ))}

              {/* Empty indicator */}
              {isEmpty && (
                <div className="flex-1 flex items-center justify-center opacity-20">
                  <CalendarDays size={16} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})
