/**
 * TaskBoard — Redesigned: checklist-style per-member sections,
 * progress rings, collapsible "done" section.
 */
import { useState, useMemo } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, ListChecks } from 'lucide-react'
import TaskCard from './TaskCard.jsx'

export default function TaskBoard({ tasks, members, onToggle, onEdit, onDelete, onReassign, onAccept, isParent }) {
  const [showDone, setShowDone] = useState(false)

  const todo = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks])
  const done = useMemo(() => tasks.filter((t) => t.status === 'done'), [tasks])

  // Progress
  const total = tasks.length
  const doneCount = done.length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Progress ring card */}
      {total > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-4">
            {/* Mini progress ring */}
            <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
              <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                <circle cx="28" cy="28" r="24" fill="none" strokeWidth="5"
                  stroke="var(--border-subtle)" />
                <circle cx="28" cy="28" r="24" fill="none" strokeWidth="5"
                  stroke="url(#progressGrad)"
                  strokeLinecap="round"
                  strokeDasharray={`${pct * 1.508} 150.8`}
                  className="transition-all duration-700" />
                <defs>
                  <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold"
                style={{ color: 'var(--primary)' }}>{pct}%</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {doneCount === total && total > 0
                  ? 'Tutto fatto! 🎉'
                  : `${doneCount} di ${total} completati`}
              </p>
              <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: 'var(--gradient-primary)' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active tasks (todo + in_progress) */}
      {todo.length > 0 ? (
        <div className="flex flex-col gap-2">
          {todo.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              members={members}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onReassign={onReassign}
              onAccept={onAccept}
              isParent={isParent}
            />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--primary-50)' }}>
            <ListChecks size={32} style={{ color: 'var(--primary)' }} className="opacity-60" />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nessun task assegnato</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {isParent ? 'Premi + per aggiungerne uno' : 'Proponi un task completato!'}
          </p>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
            Tutti i task sono completati! 🏆
          </p>
        </div>
      )}

      {/* Completed tasks (collapsible) */}
      {done.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            className="flex items-center gap-2 w-full px-1 py-2 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-green-500" />
              <span className="text-xs font-semibold text-green-600">
                Completati ({done.length})
              </span>
            </div>
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
            {showDone
              ? <ChevronUp size={14} className="text-gray-400" />
              : <ChevronDown size={14} className="text-gray-400" />}
          </button>

          {showDone && (
            <div className="flex flex-col gap-1.5 mt-1 animate-fade-in">
              {done.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  members={members}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isParent={isParent}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
