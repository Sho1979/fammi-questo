/**
 * STEP 12.3 — TaskForm: add/edit task with priority, assignment, points, category.
 * Props: members[], currentMember, onSave(data), task? (edit), onClose(), isProposal? (child proposing)
 */
import { useState, useEffect } from 'react'
import { TASK_CATEGORIES } from '../../lib/constants.js'
import { DatePicker } from '../shared/index.js'

const PRIORITIES = [
  { id: 'low', label: 'Bassa', color: 'bg-gray-200 text-gray-700' },
  { id: 'medium', label: 'Media', color: 'bg-amber-200 text-amber-800' },
  { id: 'high', label: 'Alta', color: 'bg-red-200 text-red-800' },
]

export default function TaskForm({ members, currentMember, onSave, task, onClose, isProposal }) {
  const isEdit = Boolean(task)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('medium')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [points, setPoints] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setCategory(task.category || '')
      setPriority(task.priority || 'medium')
      setAssignedTo(task.assigned_to || '')
      setDueDate(task.due_date || '')
      setPoints(task.points ? String(task.points) : '')
    } else {
      setTitle('')
      setDescription('')
      setCategory('')
      setPriority('medium')
      setAssignedTo(isProposal ? currentMember?.id || '' : '')
      setDueDate(new Date().toISOString().slice(0, 10))
      setPoints('')
    }
  }, [task, currentMember, isProposal])

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) {
      setError('Inserisci un titolo')
      return
    }

    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        category: category || 'altro',
        priority,
        assigned_to: assignedTo || null,
        created_by: currentMember?.id || null,
        due_date: dueDate || null,
        points: parseInt(points) || 0,
      })
    } catch (err) {
      setError('Errore nel salvataggio')
      setSaving(false)
      return
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-h-[70vh] overflow-y-auto">
      {/* Title */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Titolo</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Es: Riordinare la camera"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base font-semibold
            focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Descrizione (opzionale)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dettagli aggiuntivi..."
          rows={2}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm resize-none
            focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
      </div>

      {/* Category */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Categoria</label>
        <div className="flex flex-wrap gap-2">
          {TASK_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all
                ${category === cat.id
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <span>{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Priorità</label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPriority(p.id)}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold text-center transition-all
                ${priority === p.id
                  ? `${p.color} shadow-md ring-2 ring-offset-1 ring-violet-300`
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assigned to (with "Tutti" option) */}
      {members && members.length > 1 && !isProposal && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Assegnato a</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAssignedTo('tutti')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all
                ${assignedTo === 'tutti'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {m.avatar || m.icon || '👤'} {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Due date */}
      <DatePicker label="Scadenza" value={dueDate} onChange={setDueDate} />

      {/* Points */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Punti premio</label>
        <input
          type="text"
          inputMode="numeric"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder="0"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm
            focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
      </div>

      {/* Proposal badge — child proposing something they ALREADY DID */}
      {isProposal && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          Stai proponendo un task che HAI GIÀ FATTO. Un genitore dovrà confermare.
        </div>
      )}

      {/* Error */}
      {error && <p role="alert" className="text-sm font-medium text-red-500">{error}</p>}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600
            hover:bg-gray-50 transition-colors"
        >
          Annulla
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white
            shadow-md hover:bg-violet-700 disabled:opacity-50 transition-all"
        >
          {saving ? 'Salvo...' : isProposal ? 'Proponi' : isEdit ? 'Aggiorna' : 'Salva'}
        </button>
      </div>
    </div>
  )
}
