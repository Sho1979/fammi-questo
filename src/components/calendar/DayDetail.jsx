/**
 * DayDetail — Shows all events for a selected day with refined styling.
 */
import { Plus, CalendarDays, Clock, CheckCircle2 } from 'lucide-react'
import { formatDate, formatWeekday } from '../../lib/dates.js'
import EventCard from './EventCard.jsx'

export default function DayDetail({ date, events, tasks = [], members, onAdd, onEdit, onDelete, onCompleteTask }) {
  if (!date) return null

  const dayEvents = events.filter((e) => e.date === date)
  const dayTasks = tasks.filter((t) => t.due_date === date && t.status !== 'done')

  return (
    <div className="card p-4">
      {/* Day header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {formatWeekday(date)}
          </h3>
          <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{formatDate(date)}</p>
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

      {/* Events list */}
      {dayEvents.length > 0 ? (
        <div className="flex flex-col gap-2">
          {dayEvents.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              members={members}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-8 gap-2">
          <div className="empty-state-icon">
            <CalendarDays size={28} className="text-violet-300" />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Nessun evento per questo giorno
          </p>
        </div>
      )}

      {/* Task deadlines for this day */}
      {dayTasks.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(168,85,247,0.12)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} style={{ color: '#A855F7' }} />
            <span className="text-xs font-semibold" style={{ color: '#A855F7' }}>
              Scadenze
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(168,85,247,0.1)', color: '#A855F7' }}>
              {dayTasks.length}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {dayTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98]"
                style={{
                  background: 'rgba(168,85,247,0.04)',
                  border: '1px solid rgba(168,85,247,0.1)',
                }}
              >
                <button
                  type="button"
                  onClick={() => onCompleteTask && onCompleteTask(task.id)}
                  className="flex-shrink-0 transition-all active:scale-90"
                  style={{ color: '#A855F7' }}
                  title="Segna come fatto"
                >
                  <CheckCircle2 size={20} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {task.title}
                  </p>
                  {task.category && task.category !== 'altro' && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {task.category}
                    </p>
                  )}
                </div>
                {task.assigned_to && members && (() => {
                  const m = members.find(mb => mb.id === task.assigned_to);
                  return m ? (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(168,85,247,0.08)', color: '#7C3AED' }}>
                      {m.icon || ''} {m.name}
                    </span>
                  ) : null;
                })()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
