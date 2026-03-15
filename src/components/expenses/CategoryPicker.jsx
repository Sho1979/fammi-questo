/**
 * STEP 7.2 — CategoryPicker: 4-column grid of expense categories.
 * Props: value (selected category id), onChange(categoryId)
 */
import { DEFAULT_CATEGORIES } from '../../lib/constants.js'

export default function CategoryPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {DEFAULT_CATEGORIES.map((cat) => {
        const isSelected = value === cat.id
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center transition-all
              ${isSelected
                ? 'ring-2 ring-violet-500 bg-violet-50 scale-105'
                : 'bg-gray-50 hover:bg-gray-100'}`}
          >
            <span className="text-xl">{cat.icon}</span>
            <span className="text-[10px] font-medium leading-tight text-gray-700">
              {cat.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
