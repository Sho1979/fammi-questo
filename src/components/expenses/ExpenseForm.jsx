/**
 * STEP 7.3 — ExpenseForm: add or edit an expense.
 * Props: members[], currentMember, onSave(data), expense? (for edit mode), onClose()
 */
import { useState, useEffect } from 'react'
import { useValidatedFormAction } from '../../hooks/useFormAction.js'
import { validateExpense } from '../../lib/validate.js'
import CategoryPicker from './CategoryPicker.jsx'
import { PersonPicker, DatePicker } from '../shared/index.js'
import { RECURRENCE_TYPES } from '../../lib/constants.js'

export default function ExpenseForm({ members, currentMember, onSave, expense, onClose }) {
  const isEdit = Boolean(expense)

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [personId, setPersonId] = useState('')
  const [date, setDate] = useState('')
  const [recurrence, setRecurrence] = useState('none')

  useEffect(() => {
    if (expense) {
      setAmount(String(expense.amount))
      setCategory(expense.category || '')
      setNote(expense.note || '')
      setPersonId(expense.person_id || '')
      setDate(expense.date || '')
    } else {
      setAmount('')
      setCategory('')
      setNote('')
      setPersonId(currentMember?.id || '')
      setDate(new Date().toISOString().slice(0, 10))
    }
  }, [expense, currentMember])

  // React 19 useActionState — replaces manual saving/error state
  const { formState, submitForm, isPending } = useValidatedFormAction(
    async (data) => await onSave(data),
    validateExpense,
    onClose // close modal on success
  )

  const handleSubmit = () => {
    const numAmount = parseFloat(amount.replace(',', '.'))
    submitForm({
      amount: numAmount,
      category,
      note: note.trim(),
      person_id: personId,
      date,
      recurrence: recurrence !== 'none' ? recurrence : null,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Amount */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Importo (€)</label>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-lg font-semibold
            focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
      </div>

      {/* Category */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Categoria</label>
        <CategoryPicker value={category} onChange={setCategory} />
      </div>

      {/* Note */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Nota (opzionale)</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Es: Spesa settimanale"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm
            focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
      </div>

      {/* Person */}
      {members && members.length > 1 && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Chi ha speso?</label>
          <PersonPicker members={members} value={personId} onChange={setPersonId} />
        </div>
      )}

      {/* Date */}
      <DatePicker label="Data" value={date} onChange={setDate} />

      {/* Recurrence (only for new expenses) */}
      {!isEdit && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Ricorrenza</label>
          <div className="flex flex-wrap gap-2">
            {RECURRENCE_TYPES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRecurrence(r.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all
                  ${recurrence === r.id
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {recurrence !== 'none' && (
            <p className="text-xs text-violet-500 mt-1.5">
              Verranno create spese automatiche per i prossimi 3 mesi
            </p>
          )}
        </div>
      )}

      {/* Error — from useActionState */}
      {formState.error && <p role="alert" className="text-sm font-medium text-red-500">{formState.error}</p>}

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
          disabled={isPending}
          className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white
            shadow-md hover:bg-violet-700 disabled:opacity-50 transition-all"
        >
          {isPending ? 'Salvo...' : isEdit ? 'Aggiorna' : 'Salva'}
        </button>
      </div>
    </div>
  )
}
