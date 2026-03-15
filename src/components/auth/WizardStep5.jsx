/**
 * WizardStep5 — Permessi personalizzati per ogni membro.
 * Mostra ogni membro (adulti + figli) con il suo livello di accesso,
 * permettendo ai genitori di personalizzarlo.
 *
 * Access levels:
 *   full           — Tutto (default genitori/nonni)
 *   calendar_tasks — Calendario + Task + Spese
 *   basic          — Home + Task + Dispensa
 *   view_only      — Solo consultazione
 */
import { Shield, ChevronDown } from 'lucide-react'
import { ACCESS_BY_AGE } from '../../lib/constants.js'

const ACCESS_LEVELS = [
  { value: 'full', label: 'Completo', desc: 'Tutte le funzionalità', color: '#6C5CE7' },
  { value: 'calendar_tasks', label: 'Intermedio', desc: 'Calendario, Task, Spese', color: '#00B894' },
  { value: 'basic', label: 'Base', desc: 'Home, Task, Dispensa', color: '#F9CA24' },
  { value: 'view_only', label: 'Solo lettura', desc: 'Solo consultazione', color: '#FF6B6B' },
]

export default function WizardStep5({ data, onUpdate, onNext, onBack }) {
  // Build full member list with current access levels
  const allMembers = [
    ...data.adults.map((a) => ({
      name: a.name,
      role: a.role,
      isChild: false,
      age: null,
    })),
    ...(data.hasChildren
      ? data.children.map((c) => ({
          name: c.name,
          role: 'child',
          isChild: true,
          age: parseInt(c.age) || 0,
        }))
      : []),
  ]

  // Initialize permissions if not set yet
  const permissions = data.permissions || allMembers.map((m) => ({
    name: m.name,
    role: m.role,
    accessLevel: m.isChild ? ACCESS_BY_AGE(m.age) : 'full',
  }))

  // Sync permissions with parent state on first render
  if (!data.permissions) {
    onUpdate({ permissions })
  }

  const handleChange = (index, newLevel) => {
    const updated = [...permissions]
    updated[index] = { ...updated[index], accessLevel: newLevel }
    onUpdate({ permissions: updated })
  }

  const roleLabel = (role) => {
    if (role === 'parent') return 'Genitore'
    if (role === 'elder') return 'Nonno/a'
    return 'Figlio/a'
  }

  const roleEmoji = (role) => {
    if (role === 'parent') return '👨'
    if (role === 'elder') return '👴'
    return '👧'
  }

  return (
    <div className="flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 mb-3">
          <Shield size={24} className="text-violet-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 text-center">Permessi personalizzati</h2>
        <p className="text-sm text-gray-500 text-center mt-1">
          Ogni membro può avere un livello di accesso diverso.
          Potrai modificarli in qualsiasi momento.
        </p>
      </div>

      {/* Member list */}
      <div className="flex flex-col gap-3 max-h-[55vh] overflow-y-auto">
        {permissions.map((member, i) => {
          const currentLevel = ACCESS_LEVELS.find((l) => l.value === member.accessLevel) || ACCESS_LEVELS[0]
          return (
            <div
              key={i}
              className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{roleEmoji(member.role)}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{member.name}</p>
                  <p className="text-xs text-gray-400">{roleLabel(member.role)}</p>
                </div>
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: currentLevel.color }}
                />
              </div>

              {/* Access level selector */}
              <div className="relative">
                <select
                  value={member.accessLevel}
                  onChange={(e) => handleChange(i, e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2
                    text-sm text-gray-700 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100
                    pr-8"
                >
                  {ACCESS_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label} — {level.desc}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 rounded-xl bg-violet-50 p-3">
        <p className="text-xs font-semibold text-violet-700 mb-2">Livelli di accesso</p>
        <div className="grid grid-cols-2 gap-1.5">
          {ACCESS_LEVELS.map((level) => (
            <div key={level.value} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: level.color }} />
              <span className="text-[11px] text-gray-600">{level.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600
            hover:bg-gray-50 transition-colors"
        >
          ← Indietro
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white
            hover:bg-violet-700 active:scale-[0.98] transition-all"
        >
          Avanti →
        </button>
      </div>
    </div>
  )
}
