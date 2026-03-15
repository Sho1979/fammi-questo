/**
 * TemplateManager — UI for managing recurring task templates.
 * CRUD logic already exists in useTasks.js (addTemplate, updateTemplate, deleteTemplate).
 * This component provides the visual interface: list, add form, edit inline, delete with confirm.
 *
 * Props: members[], familyId, onClose()
 */
import { useState, useCallback } from 'react'
import {
  useTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
} from '../../hooks/useTasks.js'
import { TASK_CATEGORIES } from '../../lib/constants.js'
import {
  Plus,
  Trash2,
  Edit3,
  RotateCw,
  ChevronDown,
  ChevronUp,
  X,
  Save,
} from 'lucide-react'

const PRIORITIES = [
  { id: 'low', label: 'Bassa', color: '#94A3B8' },
  { id: 'medium', label: 'Media', color: '#F59E0B' },
  { id: 'high', label: 'Alta', color: '#EF4444' },
]

const RECURRENCE_OPTIONS = [
  { id: 'daily', label: 'Ogni giorno', icon: '📅' },
  { id: 'weekdays', label: 'Lun-Ven', icon: '🏢' },
  { id: 'weekly', label: 'Settimanale', icon: '📆' },
  { id: 'monthly', label: 'Mensile', icon: '🗓️' },
]

export default function TemplateManager({ members, familyId, onClose }) {
  const templates = useTemplates(familyId)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('altro')
  const [priority, setPriority] = useState('medium')
  const [assignedTo, setAssignedTo] = useState('')
  const [points, setPoints] = useState('')
  const [recurrence, setRecurrence] = useState('daily')

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setCategory('altro')
    setPriority('medium')
    setAssignedTo('')
    setPoints('')
    setRecurrence('daily')
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (tmpl) => {
    setTitle(tmpl.title || '')
    setDescription(tmpl.description || '')
    setCategory(tmpl.category || 'altro')
    setPriority(tmpl.priority || 'medium')
    setAssignedTo(tmpl.assigned_to || '')
    setPoints(tmpl.points ? String(tmpl.points) : '')
    setRecurrence(tmpl.recurrence || 'daily')
    setEditingId(tmpl.id)
    setShowForm(true)
  }

  const handleSave = useCallback(async () => {
    if (!title.trim()) return

    const data = {
      title: title.trim(),
      description: description.trim(),
      category: category || 'altro',
      priority,
      assigned_to: assignedTo || null,
      points: parseInt(points) || 0,
      recurrence,
    }

    if (editingId) {
      await updateTemplate(editingId, data)
    } else {
      await addTemplate(data)
    }
    resetForm()
  }, [title, description, category, priority, assignedTo, points, recurrence, editingId])

  const handleDelete = useCallback(async (id) => {
    await deleteTemplate(id)
    setConfirmDeleteId(null)
  }, [])

  const getCat = (id) => TASK_CATEGORIES.find((c) => c.id === id)
  const getPrio = (id) => PRIORITIES.find((p) => p.id === id)
  const getRecLabel = (id) => RECURRENCE_OPTIONS.find((r) => r.id === id)
  const getAssignee = (id) => {
    if (!id) return null
    if (id === 'tutti') return { name: 'Tutti', icon: '👥' }
    return members.find((m) => m.id === id)
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCw size={18} style={{ color: 'var(--primary)' }} />
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            Template ricorrenti
          </h3>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ background: 'var(--primary-50)', color: 'var(--primary)' }}>
          {templates.length} template
        </span>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        I template generano automaticamente task ogni giorno. Configura qui le attività ricorrenti della famiglia.
      </p>

      {/* Template List */}
      {templates.length > 0 && (
        <div className="flex flex-col gap-2">
          {templates.map((tmpl) => {
            const cat = getCat(tmpl.category)
            const prio = getPrio(tmpl.priority)
            const rec = getRecLabel(tmpl.recurrence)
            const assignee = getAssignee(tmpl.assigned_to)
            const isDeleting = confirmDeleteId === tmpl.id

            return (
              <div
                key={tmpl.id}
                className="card-interactive relative overflow-hidden transition-all duration-200"
                style={{ borderLeft: `3px solid ${prio?.color || '#F59E0B'}` }}
              >
                <div className="flex items-start gap-3 p-3">
                  {/* Icon */}
                  <span className="text-lg mt-0.5 flex-shrink-0">{cat?.icon || '📌'}</span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {tmpl.title}
                    </h4>
                    {tmpl.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                        {tmpl.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {/* Recurrence badge */}
                      <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: 'var(--primary-50)', color: 'var(--primary)' }}>
                        {rec?.icon || '📅'} {rec?.label || 'Giornaliero'}
                      </span>
                      {/* Assignee */}
                      {assignee && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                          {assignee.icon || '👤'} {assignee.name}
                        </span>
                      )}
                      {/* Points */}
                      {tmpl.points > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-600">
                          ⭐ {tmpl.points} pt
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(tmpl)}
                      className="rounded-xl p-2 text-gray-300 hover:text-violet-500 transition-all"
                      aria-label="Modifica template"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(tmpl.id)}
                      className="rounded-xl p-2 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all"
                      aria-label="Elimina template"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Inline delete confirmation */}
                {isDeleting && (
                  <div className="flex items-center justify-between px-3 py-2.5"
                    style={{ background: 'rgba(239,68,68,0.06)', borderTop: '1px solid rgba(239,68,68,0.15)' }}>
                    <span className="text-xs font-medium text-red-600">Eliminare questo template?</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 transition-all"
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tmpl.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all"
                        style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {templates.length === 0 && !showForm && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: 'var(--primary-50)' }}>
            🔄
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Nessun template creato
          </p>
          <p className="text-xs max-w-[250px]" style={{ color: 'var(--text-muted)' }}>
            Crea template per generare automaticamente task ricorrenti ogni giorno
          </p>
        </div>
      )}

      {/* Add/Edit Form (expandable) */}
      {showForm && (
        <div className="card overflow-hidden" style={{ border: '1.5px solid var(--primary)', background: 'var(--bg-card)' }}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ background: 'var(--primary-50)' }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--primary)' }}>
              {editingId ? 'Modifica template' : 'Nuovo template'}
            </span>
            <button type="button" onClick={resetForm}
              className="rounded-lg p-1 transition-all hover:bg-white/50">
              <X size={14} style={{ color: 'var(--primary)' }} />
            </button>
          </div>

          <div className="flex flex-col gap-3.5 p-4">
            {/* Title */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Titolo *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Es: Riordinare la camera"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold
                  focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Descrizione</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Dettagli opzionali..."
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm
                  focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
            </div>

            {/* Recurrence */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600">Ricorrenza</label>
              <div className="flex flex-wrap gap-1.5">
                {RECURRENCE_OPTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRecurrence(r.id)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all
                      ${recurrence === r.id
                        ? 'text-white shadow-md'
                        : 'bg-gray-100 text-gray-600'
                      }`}
                    style={recurrence === r.id ? { background: 'var(--gradient-primary)' } : {}}
                  >
                    {r.icon} {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600">Categoria</label>
              <div className="flex flex-wrap gap-1.5">
                {TASK_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all
                      ${category === cat.id
                        ? 'bg-violet-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600'
                      }`}
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600">Priorità</label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id)}
                    className={`flex-1 rounded-xl py-2 text-xs font-semibold text-center transition-all
                      ${priority === p.id
                        ? 'text-white shadow-md'
                        : 'bg-gray-100 text-gray-500'
                      }`}
                    style={priority === p.id ? { background: p.color } : {}}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assigned to */}
            {members.length > 0 && (
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-600">Assegnato a</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAssignedTo('tutti')}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all
                      ${assignedTo === 'tutti'
                        ? 'bg-violet-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600'
                      }`}
                  >
                    👥 Tutti
                  </button>
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAssignedTo(m.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all
                        ${assignedTo === m.id
                          ? 'bg-violet-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600'
                        }`}
                    >
                      {m.avatar || m.icon || '👤'} {m.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Points */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Punti premio</label>
              <input
                type="text"
                inputMode="numeric"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm
                  focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
            </div>

            {/* Save button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white
                shadow-md disabled:opacity-40 transition-all active:scale-[0.98]"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
            >
              <Save size={15} />
              {editingId ? 'Aggiorna template' : 'Crea template'}
            </button>
          </div>
        </div>
      )}

      {/* Add button (when form is closed) */}
      {!showForm && (
        <button
          type="button"
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white
            shadow-md transition-all active:scale-[0.98]"
          style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}
        >
          <Plus size={16} /> Aggiungi template
        </button>
      )}
    </div>
  )
}
