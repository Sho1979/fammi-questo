/**
 * R3.2 — MealsPage: weekly meal planner with drag-like slot assignment.
 */
import { useState, useCallback } from 'react'
import useAuthStore from '../store/authStore.js'
import {
  useWeekMealPlans,
  addMealPlan,
  deleteMealPlan,
  getMonday,
  MEAL_SLOTS,
} from '../hooks/useMeals.js'
import { Modal, Toast } from '../components/shared/index.js'
import { ChevronLeft, ChevronRight, Plus, X, Utensils } from 'lucide-react'
import { WEEKDAYS_SHORT } from '../lib/constants.js'

const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

export default function MealsPage() {
  const { familyId } = useAuthStore()

  // Week navigation
  const [weekStart, setWeekStart] = useState(getMonday())
  const plans = useWeekMealPlans(familyId, weekStart)

  // Add form
  const [showAdd, setShowAdd] = useState(false)
  const [addDate, setAddDate] = useState('')
  const [addSlot, setAddSlot] = useState('pranzo')
  const [addName, setAddName] = useState('')
  const [addNote, setAddNote] = useState('')
  const [toast, setToast] = useState(null)

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const handlePrevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d.toISOString().slice(0, 10))
  }

  const handleNextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d.toISOString().slice(0, 10))
  }

  const openAdd = (date, slot) => {
    setAddDate(date)
    setAddSlot(slot)
    setAddName('')
    setAddNote('')
    setShowAdd(true)
  }

  const handleAdd = useCallback(async () => {
    if (!addName.trim()) return
    await addMealPlan({
      date: addDate,
      slot: addSlot,
      name: addName.trim(),
      note: addNote.trim(),
    })
    setShowAdd(false)
    setToast({ message: 'Pasto aggiunto' })
  }, [addDate, addSlot, addName, addNote])

  const handleDelete = async (id) => {
    await deleteMealPlan(id)
    setToast({ message: 'Pasto rimosso' })
  }

  // Get today for highlighting
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-24">
      {/* Header + week nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Utensils size={22} className="text-violet-500" />
          <h2 className="text-lg font-bold text-gray-900">Pasti</h2>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={handlePrevWeek}
          className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {new Date(weekStart).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
          {' — '}
          {new Date(weekDates[6]).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
        </span>
        <button type="button" onClick={handleNextWeek}
          className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Week grid */}
      {weekDates.map((date, dayIdx) => {
        const dayPlans = plans.filter((p) => p.date === date)
        const isToday = date === today

        return (
          <div key={date}
            className={`rounded-2xl p-3 border transition-all
              ${isToday ? 'bg-violet-50 border-violet-200' : 'bg-white border-gray-100'}`}>
            <h4 className={`text-sm font-semibold mb-2 ${isToday ? 'text-violet-700' : 'text-gray-800'}`}>
              {DAY_NAMES[dayIdx]} {date.slice(8)}
            </h4>

            <div className="flex flex-col gap-1.5">
              {MEAL_SLOTS.map((slot) => {
                const meal = dayPlans.find((p) => p.slot === slot.id)
                return (
                  <div key={slot.id} className="flex items-center gap-2 min-h-[32px]">
                    <span className="text-sm w-5 text-center">{slot.icon}</span>
                    {meal ? (
                      <div className="flex-1 flex items-center justify-between bg-white rounded-lg px-2 py-1 border border-gray-100">
                        <span className="text-xs text-gray-700">{meal.name}</span>
                        <button type="button" onClick={() => handleDelete(meal.id)}
                          className="p-0.5 text-gray-300 hover:text-red-500">
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAdd(date, slot.id)}
                        className="flex-1 text-left text-xs text-gray-300 hover:text-violet-500
                          border border-dashed border-gray-200 rounded-lg px-2 py-1 hover:border-violet-300 transition-colors"
                      >
                        + {slot.label}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Add meal modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Aggiungi pasto">
        <div className="flex flex-col gap-4 p-4">
          <input
            type="text"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Es: Pasta al pomodoro"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold
              focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            autoFocus
          />
          <input
            type="text"
            value={addNote}
            onChange={(e) => setAddNote(e.target.value)}
            placeholder="Nota (opzionale)"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm
              focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <div className="flex gap-2">
            {MEAL_SLOTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setAddSlot(s.id)}
                className={`flex-1 rounded-xl py-2 text-xs font-medium text-center transition-all
                  ${addSlot === s.id ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!addName.trim()}
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white
              shadow-md hover:bg-violet-700 disabled:opacity-50 transition-all"
          >
            Salva
          </button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}
    </div>
  )
}
