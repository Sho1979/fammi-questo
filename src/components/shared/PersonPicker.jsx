/**
 * STEP 3.5 — PersonPicker.
 * Grid of clickable PersonBadges. Selected one has highlighted border.
 * Props: members[], value (selected member id), onChange(memberId)
 */
import PersonBadge from './PersonBadge.jsx'

export default function PersonPicker({ members, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Seleziona persona">
      {members.map((member) => {
        const isSelected = member.id === value
        return (
          <button
            key={member.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={member.name}
            onClick={() => onChange(member.id)}
            className={`rounded-2xl p-2 transition-all
              ${isSelected
                ? 'bg-violet-50 ring-2 ring-violet-500'
                : 'hover:bg-gray-50'
              }`}
          >
            <PersonBadge member={member} size="md" />
          </button>
        )
      })}
    </div>
  )
}
