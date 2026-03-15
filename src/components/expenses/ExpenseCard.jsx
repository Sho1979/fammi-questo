/**
 * STEP 7.4 — ExpenseCard: single expense row.
 * Props: expense, members[], onEdit(expense)?, onDelete(expenseId)?
 * If onEdit/onDelete are null, the card is read-only (children view).
 */
import { memo } from 'react'
import { Trash2 } from 'lucide-react'
import { DEFAULT_CATEGORIES } from '../../lib/constants.js'
import { formatCurrency } from '../../lib/format.js'
import { formatDateShort } from '../../lib/dates.js'

export default memo(function ExpenseCard({ expense, members, onEdit, onDelete }) {
  const cat = DEFAULT_CATEGORIES.find((c) => c.id === expense.category) || {
    icon: '📌',
    label: 'Altro',
    color: '#9E9E9E',
  }
  const person = members?.find((m) => m.id === expense.person_id)

  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 shadow-sm
        border border-gray-100 transition-all hover:shadow-md"
    >
      {/* Category icon */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
        style={{ backgroundColor: cat.color + '20' }}
        onClick={() => onEdit && onEdit(expense)}
        onKeyDown={onEdit ? (e) => { if (e.key === 'Enter' || e.key === ' ') onEdit(expense) } : undefined}
        role={onEdit ? 'button' : undefined}
        tabIndex={onEdit ? 0 : undefined}
        aria-label={onEdit ? `Modifica spesa ${cat.label}` : undefined}
      >
        {cat.icon}
      </div>

      {/* Center: note + person + date */}
      <div
        className="flex flex-1 flex-col items-start text-left min-w-0"
        onClick={() => onEdit && onEdit(expense)}
        onKeyDown={onEdit ? (e) => { if (e.key === 'Enter' || e.key === ' ') onEdit(expense) } : undefined}
        role={onEdit ? 'button' : undefined}
        tabIndex={onEdit ? 0 : undefined}
      >
        <span className="text-sm font-medium text-gray-900 truncate w-full">
          {expense.note || cat.label}
        </span>
        <span className="text-xs text-gray-400">
          {person ? person.name : ''}{person ? ' · ' : ''}{formatDateShort(expense.date)}
        </span>
      </div>

      {/* Right: amount + delete */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold text-gray-900">
          {formatCurrency(expense.amount)}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(expense.id)
            }}
            className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500
              transition-colors"
            aria-label="Elimina spesa"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  )
})
