/**
 * STEP 11.5 — EventForm: add/edit event with recurrence, logistics, category.
 * Props: members[], currentMember, onSave(data), event? (edit mode), onClose(), selectedDate?
 */
import { useState, useEffect } from 'react'
import { EVENT_CATEGORIES, RECURRENCE_TYPES, LOGISTICS_ROLES } from '../../lib/constants.js'
import { PersonPicker, DatePicker } from '../shared/index.js'
import { Plus, X } from 'lucide-react'

export default function EventForm({ members, currentMember, onSave, event, onClose, selectedDate }) {
  const isEdit = Boolean(event)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [personId, setPersonId] = useState('')
  const [recurrenceType, setRecurrenceType] = useState('none')
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
  const [logistics, setLogistics] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (event) {
      setTitle(event.title || '')
      setDate(event.date || '')
      setTimeStart(event.time_start || '')
      setTimeEnd(event.time_end || '')
      setCategory(event.category || '')
      setNote(event.note || '')
      setPersonId(event.person_id || '')
      setLogistics(event.logistics || [])
      setRecurrenceType('none') // Can't change recurrence in edit mode
    } else {
      setTitle('')
      setDate(selectedDate || new Date().toISOString().slice(0, 10))
      setTimeStart('')
      setTimeEnd('')
      setCategory('')
      setNote('')
      setPersonId(currentMember?.id || '')
      setLogistics([])
      setRecurrenceType('none')
      setRecurrenceEndDate('')
    }
  }, [event, currentMember, selectedDate])

  const handleAddLogistic = () => {
    setLogistics([...logistics, { role: 'porta', member_id: '' }])
  }

  const handleRemoveLogistic = (index) => {
    setLogistics(logistics.filter((_, i) => i !== index))
  }

  const handleLogisticChange = (index, field, value) => {
    const updated = [...logistics]
    updated[index] = { ...updated[index], [field]: value }
    setLogistics(updated)
  }

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) {
      setError('Inserisci un titolo')
      return
    }
    if (!date) {
      setError('Seleziona una data')
      return
    }

    // Filter out incomplete logistics
    const validLogistics = logistics.filter((l) => l.member_id && l.role)

    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        date,
        time_start: timeStart || null,
        time_end: timeEnd || null,
        person_id: personId,
        category: category || 'altro',
        note: note.trim(),
        logistics: validLogistics,
        // Recurrence data (only for new events)
        _recurrence: !isEdit && recurrenceType !== 'none'
          ? {
              type: recurrenceType,
              interval: 1,
              day_of_week: recurrenceType === 'weekly' ? new Date(date).getDay() : undefined,
              day_of_month: recurrenceType === 'monthly' ? new Date(date).getDate() : undefined,
              start_date: date,
              end_date: recurrenceEndDate || undefined,
            }
          : null,
      })
    } catch (err) {
      setError('Errore nel salvataggio')
      setSaving(false)
      return
    }
    setSaving(false)
  }

  // Members for logistics — all members can be assigned (not just parents)
  // Parents are shown first, then others
  const parentMembers = members.length > 0
    ? [...members].sort((a, b) => {
        const isParentA = ['parent', 'elder', 'genitore'].includes(a.role) ? 0 : 1
        const isParentB = ['parent', 'elder', 'genitore'].includes(b.role) ? 0 : 1
        return isParentA - isParentB
      })
    : []

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Titolo</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Es: Partita pallavolo"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base font-semibold
            focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
      </div>

      {/* Category picker */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Categoria</label>
        <div className="flex flex-wrap gap-2">
          {EVENT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all
                ${category === cat.id
                  ? 'text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              style={category === cat.id ? { backgroundColor: cat.color } : {}}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <DatePicker label="Data" value={date} onChange={setDate} />

      {/* Time range */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">Ora inizio</label>
          <input
            type="time"
            value={timeStart}
            onChange={(e) => setTimeStart(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
              focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">Ora fine</label>
          <input
            type="time"
            value={timeEnd}
            onChange={(e) => setTimeEnd(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
              focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
        </div>
      </div>

      {/* Person (who owns the event) */}
      {members && members.length > 1 && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Di chi è l'impegno?</label>
          <div className="flex flex-wrap gap-2 mb-1">
            <button
              type="button"
              onClick={() => setPersonId('tutti')}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all
                ${personId === 'tutti'
                  ? 'bg-violet-600 text-white shadow-md ring-2 ring-violet-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              👥 Tutti
            </button>
          </div>
          <PersonPicker members={members} value={personId === 'tutti' ? '' : personId} onChange={setPersonId} />
        </div>
      )}

      {/* Note */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Nota (opzionale)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Es: Palestra via Roma"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm
            focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
      </div>

      {/* Logistics (chi porta / chi riprende) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Logistica</label>
          <button
            type="button"
            onClick={handleAddLogistic}
            className="flex items-center gap-0.5 text-xs font-medium text-violet-600 hover:text-violet-700"
          >
            <Plus size={14} /> Aggiungi
          </button>
        </div>
        {logistics.length === 0 && (
          <p className="text-xs text-gray-400">Chi porta? Chi riprende? Aggiungi la logistica.</p>
        )}
        {logistics.map((log, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            {/* Role select */}
            <select
              value={log.role}
              onChange={(e) => handleLogisticChange(i, 'role', e.target.value)}
              className="rounded-xl border border-gray-200 px-2 py-2 text-sm flex-shrink-0
                focus:border-violet-400 focus:outline-none"
            >
              {LOGISTICS_ROLES.map((r) => (
                <option key={r.id} value={r.id}>{r.icon} {r.label}</option>
              ))}
            </select>

            {/* Member select */}
            <select
              value={log.member_id}
              onChange={(e) => handleLogisticChange(i, 'member_id', e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 px-2 py-2 text-sm
                focus:border-violet-400 focus:outline-none"
            >
              <option value="">Seleziona...</option>
              {parentMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.icon || '👤'} {m.name}</option>
              ))}
            </select>

            {/* Remove */}
            <button
              type="button"
              onClick={() => handleRemoveLogistic(i)}
              className="rounded-full p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Recurrence (only for new events) */}
      {!isEdit && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Ripeti</label>
          <div className="flex flex-wrap gap-2">
            {RECURRENCE_TYPES.map((rt) => (
              <button
                key={rt.id}
                type="button"
                onClick={() => setRecurrenceType(rt.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all
                  ${recurrenceType === rt.id
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {rt.label}
              </button>
            ))}
          </div>
          {recurrenceType !== 'none' && (
            <div className="mt-2">
              <DatePicker label="Fino a (opzionale)" value={recurrenceEndDate} onChange={setRecurrenceEndDate} />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm font-medium text-red-500">{error}</p>}

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
          {saving ? 'Salvo...' : isEdit ? 'Aggiorna' : 'Salva'}
        </button>
      </div>
    </div>
  )
}
