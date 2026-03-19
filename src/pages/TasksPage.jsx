/**
 * TasksPage — Redesigned: modern task manager with leaderboard,
 * member filter chips, proposals section, and animated interactions.
 */
import { useState, useCallback, useMemo } from 'react'
import confetti from 'canvas-confetti'
import { showSuccess, showUndo } from '../lib/toast.js'
import { notifyEvents } from '../hooks/useNotifications.js'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import useAuthStore from '../store/authStore.js'
import {
  useAllTasks,
  usePendingProposals,
  useWeeklyLeaderboard,
  addTask,
  updateTask,
  deleteTask,
  undoDeleteTask,
  completeTask,
  reopenTask,
  proposeTask,
  approveTask,
  rejectTask,
} from '../hooks/useTasks.js'
import TaskBoard from '../components/tasks/TaskBoard.jsx'
import TaskForm from '../components/tasks/TaskForm.jsx'
import ProposalList from '../components/tasks/ProposalList.jsx'
import TemplateManager from '../components/tasks/TemplateManager.jsx'
import { Modal, ConfirmDialog } from '../components/shared/index.js'
import { useNavigate } from 'react-router-dom'
import { Plus, Trophy, Crown, Star, Sparkles, RotateCw, Filter } from 'lucide-react'

export default function TasksPage() {
  const { familyId, currentMember } = useAuthStore()
  const navigate = useNavigate()
  const isParent = currentMember?.role === 'parent' || currentMember?.role === 'elder' ||
    currentMember?.role === 'genitore'

  const tasks = useAllTasks(familyId)
  const proposals = usePendingProposals(familyId)
  const leaderboard = useWeeklyLeaderboard(familyId)
  const members = useLiveQuery(
    () => familyId
      ? db.members.where('family_id').equals(familyId).and((m) => !m._deleted).toArray()
      : [],
    [familyId],
    []
  )

  const [filter, setFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all') // 'all' | 'high' | 'medium' | 'low'
  const [sortMode, setSortMode] = useState('default') // 'default' | 'deadline' | 'priority'
  const [showFilterBar, setShowFilterBar] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [isProposal, setIsProposal] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  // Apply member + priority filters, then sort
  const filteredTasks = useMemo(() => {
    let result = tasks

    // Member filter
    if (filter !== 'all') {
      result = result.filter((t) => t.assigned_to === filter || t.assigned_to === 'tutti')
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter((t) => (t.priority || 'medium') === priorityFilter)
    }

    // Sort
    if (sortMode === 'deadline') {
      result = [...result].sort((a, b) => {
        // Tasks without due_date go last
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
    } else if (sortMode === 'priority') {
      const PRIO_ORDER = { high: 0, medium: 1, low: 2 }
      result = [...result].sort((a, b) => {
        return (PRIO_ORDER[a.priority] ?? 1) - (PRIO_ORDER[b.priority] ?? 1)
      })
    }

    return result
  }, [tasks, filter, priorityFilter, sortMode])

  const hasActiveFilters = priorityFilter !== 'all' || sortMode !== 'default'

  const handleToggle = useCallback(async (id) => {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    if (task.status === 'done') {
      if (!isParent) return
      await reopenTask(id)
      showSuccess('Task riaperto')
    } else {
      await completeTask(id, currentMember?.id)
      showSuccess('Task completato!')
      // Confetti burst from center-bottom
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#8B5CF6', '#22C55E', '#F59E0B', '#3B82F6'],
        disableForReducedMotion: true,
      })
    }
  }, [tasks, currentMember, isParent])

  const handleAdd = () => { setEditingTask(null); setIsProposal(false); setShowForm(true) }
  const handlePropose = () => { setEditingTask(null); setIsProposal(true); setShowForm(true) }
  const handleEdit = (task) => { setEditingTask(task); setIsProposal(false); setShowForm(true) }

  const handleSave = useCallback(async (data) => {
    if (editingTask) {
      await updateTask(editingTask.id, data)
      showSuccess('Task aggiornato')
    } else if (isProposal) {
      await proposeTask(data)
      showSuccess('Proposta inviata! In attesa di approvazione.')
    } else {
      await addTask(data)
      showSuccess('Task aggiunto')
      // Notify assignee
      if (data.assigned_to && data.assigned_to !== currentMember?.id) {
        notifyEvents.taskAssigned(
          currentMember?.name, currentMember?.icon, '',
          data.assigned_to, data.title, data.due_date || ''
        ).catch(() => {})
      }
    }
    setShowForm(false)
    setEditingTask(null)
  }, [editingTask, isProposal, currentMember])

  const handleAccept = useCallback(async (taskId) => {
    const task = tasks.find(t => t.id === taskId)
    if (task?.needsConfirm) {
      // Promemoria: conferma lettura → segna come done
      await updateTask(taskId, {
        accepted: true,
        status: 'done',
        confirmedAt: new Date().toISOString(),
      })
      showSuccess('Promemoria confermato ✓')
    } else {
      await updateTask(taskId, { accepted: true, status: 'in_progress' })
      showSuccess('Task accettato! ✅')
    }
  }, [tasks])

  const handleReassign = useCallback(async (taskId, newMemberId) => {
    await updateTask(taskId, { assigned_to: newMemberId, accepted: false })
    const member = members.find((m) => m.id === newMemberId)
    showSuccess(`Task riassegnato a ${member?.name || 'membro'}`)
  }, [members])

  const handleDeleteRequest = (id) => setConfirmDelete(id)
  const handleDeleteConfirm = useCallback(async () => {
    const id = confirmDelete
    setConfirmDelete(null)
    await deleteTask(id)
    showUndo('Task eliminato', async () => {
      await undoDeleteTask(id)
    })
  }, [confirmDelete])

  // Task count per member for filter chips
  const memberTaskCount = (mId) =>
    tasks.filter((t) => t.assigned_to === mId || t.assigned_to === 'tutti').length

  // Loading state: show skeleton while members load
  if (familyId && members.length === 0) {
    return (
      <div className="flex flex-col gap-3.5 px-4 py-4 pb-24" style={{ background: 'var(--bg-main)' }}>
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-200 rounded-xl w-1/2" />
          <div className="h-24 bg-gray-200 rounded-2xl" />
          <div className="h-16 bg-gray-200 rounded-2xl" />
          <div className="h-16 bg-gray-200 rounded-2xl" />
          <div className="h-16 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5 px-4 py-4 pb-24 stagger-children" style={{ background: 'var(--bg-main)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Task</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {tasks.filter((t) => t.status !== 'done').length} da fare
          </p>
        </div>
        <div className="flex gap-2">
          {!isParent && (
            <button
              type="button"
              onClick={handlePropose}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #FDE68A, #FCD34D)', color: '#92400E', boxShadow: '0 2px 8px rgba(252,211,77,0.4)' }}
            >
              <Sparkles size={14} /> Proponi
            </button>
          )}
          {isParent && (
            <>
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-200 active:scale-95"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <RotateCw size={13} /> Template
              </button>
              <button
                type="button"
                onClick={handleAdd}
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white
                  transition-all duration-200 hover:opacity-90 active:scale-95"
                style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
              >
                <Plus size={14} /> Nuovo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Weekly Leaderboard Card — only for children (gamification) */}
      {leaderboard.leaderboard.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3" style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)' }}>
            <div className="flex items-center gap-2 mb-2.5">
              <Trophy size={16} className="text-amber-600" />
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                Classifica settimanale
              </span>
              <span className="ml-auto text-[10px] text-amber-600/70 font-medium">{leaderboard.weekLabel}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {leaderboard.leaderboard.map((entry, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                return (
                  <div key={entry.member_id}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all"
                    style={{ background: i < 3 ? `rgba(255,255,255,${0.7 - i * 0.15})` : 'rgba(255,255,255,0.25)' }}>
                    {medal ? (
                      <span className="text-base flex-shrink-0 w-6 text-center">{medal}</span>
                    ) : (
                      <span className="text-xs font-bold text-amber-600/60 w-6 text-center">{i + 1}°</span>
                    )}
                    <span className={`text-sm flex-1 truncate ${i < 3 ? 'font-semibold text-amber-900' : 'font-medium text-amber-700'}`}>
                      {entry.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <Star size={11} fill="#F59E0B" className="text-amber-500" />
                      <span className={`text-sm font-bold ${i < 3 ? 'text-amber-700' : 'text-amber-600/70'}`}>
                        {entry.completedWeek}
                      </span>
                    </div>
                    {i === 0 && <Crown size={14} className="text-amber-500" />}
                  </div>
                )
              })}
            </div>
            {leaderboard.weeklyPrize > 0 && (
              <p className="text-[10px] text-amber-600/80 mt-2 text-center font-medium">
                🏆 Premio settimanale: €{leaderboard.weeklyPrize}
                {leaderboard.isParimerito ? ' (parimerito)' : ''}
              </p>
            )}
            <button
              type="button"
              onClick={() => navigate('/rewards')}
              className="mt-2 w-full text-center text-xs font-semibold text-amber-700 py-1.5 rounded-lg
                hover:bg-amber-100/50 transition-colors active:scale-98"
            >
              Vedi classifica completa →
            </button>
          </div>
        </div>
      )}

      {/* Adult tracking — simple progress for parents/elders (no gamification) */}
      {(() => {
        const adultMembers = members.filter((m) =>
          m.role === 'parent' || m.role === 'elder' || m.role === 'genitore'
        )
        if (adultMembers.length === 0) return null
        const adultWithTasks = adultMembers
          .map((m) => {
            const assigned = tasks.filter((t) => t.assigned_to === m.id)
            const done = assigned.filter((t) => t.status === 'done').length
            return { ...m, assigned: assigned.length, done }
          })
          .filter((m) => m.assigned > 0)
        if (adultWithTasks.length === 0) return null
        return (
          <div className="card overflow-hidden">
            <div className="px-4 py-3" style={{ background: 'var(--bg-card)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  Tracking adulti
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {adultWithTasks.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                    style={{ background: 'var(--bg-main)' }}>
                    <span className="text-base flex-shrink-0">{m.icon || '👤'}</span>
                    <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                      {m.name}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                      {m.done}/{m.assigned} completati
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Member filter chips */}
      {members.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex-shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200
              ${filter === 'all' ? 'text-white shadow-md' : 'text-gray-500 shadow-sm'}`}
            style={filter === 'all'
              ? { background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }
              : { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            Tutti ({tasks.length})
          </button>
          {members.map((m) => {
            const count = memberTaskCount(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setFilter(m.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200
                  ${filter === m.id ? 'text-white shadow-md' : 'text-gray-500 shadow-sm'}`}
                style={filter === m.id
                  ? { background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }
                  : { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                {m.icon || '👤'} {m.name}
                <span className={`ml-0.5 text-[10px] ${filter === m.id ? 'text-white/70' : 'text-gray-300'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Priority filter + sort */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowFilterBar(!showFilterBar)}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200
            ${hasActiveFilters ? 'text-violet-700 bg-violet-50 ring-1 ring-violet-200' : ''}`}
          style={!hasActiveFilters ? { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' } : {}}
        >
          <Filter size={13} /> Filtri
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => { setPriorityFilter('all'); setSortMode('default'); setShowFilterBar(false) }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Reset
          </button>
        )}
      </div>
      {showFilterBar && (
        <div className="card p-3 flex flex-col gap-2.5 animate-fade-in">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider mb-1 block"
              style={{ color: 'var(--text-muted)' }}>Priorità</span>
            <div className="flex gap-1.5">
              {[
                { id: 'all', label: 'Tutte', color: 'var(--text-secondary)' },
                { id: 'high', label: '🔴 Alta', color: '#EF4444' },
                { id: 'medium', label: '🟡 Media', color: '#F59E0B' },
                { id: 'low', label: '⚪ Bassa', color: '#94A3B8' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriorityFilter(p.id)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all
                    ${priorityFilter === p.id ? 'text-white shadow-sm' : 'text-gray-500'}`}
                  style={priorityFilter === p.id
                    ? { background: p.id === 'all' ? 'var(--gradient-primary)' : p.color }
                    : { background: 'var(--border-subtle)' }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider mb-1 block"
              style={{ color: 'var(--text-muted)' }}>Ordina per</span>
            <div className="flex gap-1.5">
              {[
                { id: 'default', label: 'Predefinito' },
                { id: 'deadline', label: '📅 Scadenza' },
                { id: 'priority', label: '⚡ Priorità' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSortMode(s.id)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all
                    ${sortMode === s.id ? 'text-white shadow-sm' : 'text-gray-500'}`}
                  style={sortMode === s.id
                    ? { background: 'var(--gradient-primary)' }
                    : { background: 'var(--border-subtle)' }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Proposals (parent only) */}
      {isParent && proposals.length > 0 && (
        <ProposalList
          proposals={proposals}
          members={members}
          onApprove={async (id) => { await approveTask(id); showSuccess('Proposta approvata ✅') }}
          onReject={async (id) => { await rejectTask(id); showSuccess('Proposta rifiutata') }}
        />
      )}

      {/* Task Board */}
      <TaskBoard
        tasks={filteredTasks}
        members={members}
        onToggle={handleToggle}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
        onReassign={handleReassign}
        onAccept={handleAccept}
        isParent={isParent}
      />

      {/* Modals */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingTask(null) }}
        title={isProposal ? 'Proponi un task' : editingTask ? 'Modifica task' : 'Nuovo task'}
      >
        <TaskForm
          members={members}
          currentMember={currentMember}
          onSave={handleSave}
          task={editingTask}
          onClose={() => { setShowForm(false); setEditingTask(null) }}
          isProposal={isProposal}
        />
      </Modal>

      <Modal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        title="Template ricorrenti"
      >
        <TemplateManager
          members={members}
          familyId={familyId}
          onClose={() => setShowTemplates(false)}
        />
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
        title="Elimina task"
        message="Vuoi eliminare questo task?"
        confirmLabel="Elimina"
        danger
      />

    </div>
  )
}
