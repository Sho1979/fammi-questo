/**
 * STEP 8.3 — BudgetSetup: input to set/update monthly budget.
 * Props: currentBudget, onSave(amount)
 */
import { useState, useEffect } from 'react'

export default function BudgetSetup({ currentBudget, onSave }) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (currentBudget > 0) {
      setAmount(String(currentBudget))
    }
  }, [currentBudget])

  const handleSave = async () => {
    const num = parseFloat(amount.replace(',', '.'))
    if (!num || num <= 0) return

    setSaving(true)
    try {
      await onSave(num)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      console.error('Budget save error:', err)
    }
    setSaving(false)
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">Budget mensile</h3>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setSuccess(false) }}
            placeholder="3.000"
            className="w-full rounded-xl border border-gray-200 py-2.5 pl-8 pr-3 text-sm font-medium
              focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm
            transition-all disabled:opacity-50
            ${success ? 'bg-green-500' : 'bg-violet-600 hover:bg-violet-700'}`}
        >
          {saving ? '...' : success ? '✓' : 'Salva'}
        </button>
      </div>
    </div>
  )
}
