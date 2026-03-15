/**
 * ViewToggle — Segmented control for calendar view modes: Giorno / Settimana / Mese.
 */
import { memo } from 'react'
import { CalendarDays, Columns3, LayoutGrid } from 'lucide-react'

const CAL_COLOR = '#0984E3'

const VIEWS = [
  { id: 'day', label: 'Giorno', icon: CalendarDays },
  { id: 'week', label: 'Settimana', icon: Columns3 },
  { id: 'month', label: 'Mese', icon: LayoutGrid },
]

export default memo(function ViewToggle({ value, onChange }) {
  return (
    <div
      className="flex rounded-xl p-1 gap-1"
      style={{
        background: 'rgba(9,132,227,0.06)',
        border: '1px solid rgba(9,132,227,0.08)',
      }}
    >
      {VIEWS.map(({ id, label, icon: Icon }) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95"
            style={{
              background: active ? '#FFFFFF' : 'transparent',
              color: active ? CAL_COLOR : '#B2BEC3',
              boxShadow: active ? '0 2px 8px rgba(9,132,227,0.12)' : 'none',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        )
      })}
    </div>
  )
})
