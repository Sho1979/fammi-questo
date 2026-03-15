/**
 * STEP 3.4 — PersonBadge.
 * Colored circle with emoji icon + name below (if size > 'sm').
 * Props: member ({ name, icon, color }), size ('sm'|'md'|'lg')
 */

const SIZES = {
  sm: { circle: 'h-8 w-8 text-base', showName: false },
  md: { circle: 'h-12 w-12 text-2xl', showName: true },
  lg: { circle: 'h-16 w-16 text-3xl', showName: true },
}

export default function PersonBadge({ member, size = 'md' }) {
  const cfg = SIZES[size] || SIZES.md

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex items-center justify-center rounded-full ${cfg.circle}`}
        style={{ backgroundColor: member.color + '22', borderColor: member.color, borderWidth: 2 }}
        aria-label={member.name}
      >
        <span role="img" aria-hidden="true">{member.icon}</span>
      </div>
      {cfg.showName && (
        <span className="text-xs font-medium text-gray-700 truncate max-w-[72px] text-center">
          {member.name}
        </span>
      )}
    </div>
  )
}
