/**
 * STEP 5.1 — MemberSelect: grid of family members to pick from.
 * Props: members[], onSelect(memberId)
 */
import { PersonBadge } from '../shared/index.js'

export default function MemberSelect({ members, onSelect }) {
  return (
    <div className="flex flex-col items-center px-6 py-10">
      <h2 className="mb-2 text-xl font-bold text-gray-900">Chi sei?</h2>
      <p className="mb-8 text-sm text-gray-500">Seleziona il tuo profilo</p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => onSelect(member.id)}
            className="flex flex-col items-center gap-2 rounded-2xl border-2 border-gray-200
              p-4 transition-all hover:border-violet-400 hover:bg-violet-50
              active:scale-[0.97]"
          >
            <PersonBadge member={member} size="lg" />
          </button>
        ))}
      </div>
    </div>
  )
}
