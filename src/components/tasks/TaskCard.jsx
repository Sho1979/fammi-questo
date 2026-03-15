/**
 * TaskCard — Modern card with accept/reject/reassign actions.
 * Features: colored border, animated check, assignee chip,
 * action buttons for task management.
 */
import { useState, memo } from 'react'
import { Check, Circle, Edit3, Trash2, Star, RotateCcw, Clock, UserRoundCheck, X, Users, Bell } from 'lucide-react'
import { TASK_CATEGORIES } from '../../lib/constants.js'

const PRIORITY_CONFIG = {
  high: { accent: '#EF4444', label: 'Alta', bg: 'rgba(239,68,68,0.08)' },
  medium: { accent: '#F59E0B', label: 'Media', bg: 'rgba(245,158,11,0.06)' },
  low: { accent: '#94A3B8', label: 'Bassa', bg: 'rgba(148,163,184,0.06)' },
}

export default memo(function TaskCard({ task, members, onToggle, onEdit, onDelete, onReassign, onAccept, isParent }) {
  const [showReassign, setShowReassign] = useState(false)
  const cat = TASK_CATEGORIES.find((c) => c.id === task.category)
  const assignee = task.assigned_to === 'tutti'
    ? { name: 'Tutti', icon: '👥' }
    : members.find((m) => m.id === task.assigned_to)
  const isDone = task.status === 'done'
  const prio = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium

  const completedBy = isDone && task.done_by
    ? members.find((m) => m.id === task.done_by)
    : null

  // Check if overdue
  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = !isDone && task.due_date && task.due_date < today

  // Check if task is new (not accepted yet) — a task created by Brain/another person
  // for this user. "New" means: not done, not rejected, and not yet "accepted" by assignee.
  const isNew = !isDone && !task.accepted && task.status === 'todo'
  const isReminder = !!task.needsConfirm

  const handleReassign = (memberId) => {
    setShowReassign(false)
    if (onReassign) {
      onReassign(task.id, memberId)
    }
  }

  return (
    <div
      className="card-interactive relative overflow-hidden transition-all duration-200"
      style={{
        borderLeft: `3px solid ${isDone ? '#22C55E' : isReminder ? '#8B5CF6' : prio.accent}`,
        opacity: isDone ? 0.65 : 1,
        background: isDone ? 'var(--bg-card)' : isReminder ? 'rgba(139,92,246,0.05)' : prio.bg,
      }}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Toggle */}
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          className="mt-0.5 flex-shrink-0 transition-all duration-300"
          style={{ color: isDone ? '#22C55E' : 'var(--text-muted)' }}
        >
          {isDone ? (
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}>
              <Check size={14} className="text-white" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-lg border-2 flex items-center justify-center
              hover:border-violet-400 transition-colors"
              style={{ borderColor: 'var(--border-subtle)' }}>
              <Circle size={10} className="opacity-0" />
            </div>
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base">{cat?.icon || '📌'}</span>
            <h4 className={`text-sm font-semibold truncate
              ${isDone ? 'line-through' : ''}`}
              style={{ color: isDone ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {task.title}
            </h4>
          </div>

          {task.description && !isDone && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {task.description}
            </p>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Assignee chip */}
            {assignee && (
              <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium"
                style={{ background: 'var(--primary-50)', color: 'var(--primary)' }}>
                {assignee.icon || '👤'} {assignee.name}
              </span>
            )}

            {/* Done by */}
            {completedBy && completedBy.id !== task.assigned_to && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-600">
                ✓ {completedBy.icon || '👤'} {completedBy.name}
              </span>
            )}

            {/* Due date */}
            {task.due_date && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium
                ${isOverdue ? 'text-red-500' : isDone ? 'text-gray-300' : 'text-gray-400'}`}>
                <Clock size={10} />
                {task.due_date === today ? 'Oggi'
                  : task.due_date.slice(5).replace('-', '/')}
                {isOverdue && ' ⚠️'}
              </span>
            )}

            {/* Points — only shown for children's tasks (gamification) */}
            {task.points > 0 && (() => {
              const taskMember = members.find((m) => m.id === task.assigned_to)
              const isChildTask = taskMember && (taskMember.role === 'child' || taskMember.role === 'figlio' || taskMember.role === 'ragazzo')
              return isChildTask || task.assigned_to === 'tutti'
            })() && (
              <span className="inline-flex items-center gap-0.5 rounded-lg bg-amber-50 px-2 py-0.5
                text-[11px] font-bold text-amber-600">
                <Star size={10} fill="currentColor" /> {task.points} pt
              </span>
            )}
          </div>

          {/* ═══ Reminder: "Letto ✓" confirm button ═══ */}
          {!isDone && isNew && isReminder && (
            <div className="mt-2.5 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              {task.fromPerson && (
                <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  🔔 Da: {task.fromPerson}
                </p>
              )}
              <button
                type="button"
                onClick={() => onAccept && onAccept(task.id)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all active:scale-95 w-full justify-center"
                style={{ background: 'rgba(139,92,246,0.12)', color: '#7C3AED' }}
              >
                <Bell size={13} /> Letto ✓
              </button>
            </div>
          )}

          {/* ═══ Accept / Reject / Reassign buttons (normal tasks) ═══ */}
          {!isDone && isNew && !isReminder && (
            <div className="flex items-center gap-2 mt-2.5 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              {/* Accept */}
              <button
                type="button"
                onClick={() => onAccept && onAccept(task.id)}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}
              >
                <UserRoundCheck size={12} /> Accetta
              </button>

              {/* Reassign */}
              <button
                type="button"
                onClick={() => setShowReassign(!showReassign)}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(9,132,227,0.1)', color: '#0984E3' }}
              >
                <Users size={12} /> Assegna
              </button>

              {/* Reject */}
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}
              >
                <X size={12} /> Rifiuta
              </button>
            </div>
          )}

          {/* Reassign member picker */}
          {showReassign && (
            <div className="flex flex-wrap gap-1.5 mt-2 p-2 rounded-xl animate-fade-in"
              style={{ background: 'rgba(9,132,227,0.05)', border: '1px solid rgba(9,132,227,0.15)' }}>
              <span className="text-[10px] font-semibold w-full mb-0.5" style={{ color: '#0984E3' }}>
                Assegna a:
              </span>
              {members
                .filter((m) => m.id !== task.assigned_to)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleReassign(m.id)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium
                      transition-all active:scale-95 hover:shadow-sm"
                    style={{ background: 'white', border: '1px solid rgba(9,132,227,0.2)', color: 'var(--text-primary)' }}
                  >
                    {m.icon || '👤'} {m.name}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setShowReassign(false)}
                className="text-[10px] text-gray-400 ml-auto"
              >
                Chiudi
              </button>
            </div>
          )}
        </div>

        {/* Actions (edit/delete for non-new tasks) */}
        <div className="flex gap-0.5 flex-shrink-0">
          {isDone && isParent && (
            <button
              type="button"
              onClick={() => onToggle(task.id)}
              className="rounded-xl p-2 text-gray-300 hover:bg-amber-50 hover:text-amber-500 transition-all"
              aria-label="Riapri"
            >
              <RotateCcw size={14} />
            </button>
          )}
          {!isDone && !isNew && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(task) }}
                className="rounded-xl p-2 text-gray-300 hover:text-violet-500 transition-all"
                aria-label="Modifica"
              >
                <Edit3 size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
                className="rounded-xl p-2 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all"
                aria-label="Elimina"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
})
