/**
 * EmptyState — Polished empty state with subtle entrance animation.
 * Props: icon (Lucide component), title, description?, action?, actionLabel?
 */

export default function EmptyState({ icon: Icon, title, description, action, actionLabel }) {
  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-12 text-center animate-[fadeInUp_0.4s_ease-out]"
      style={{
        '--fadeInUp': 'fadeInUp',
      }}
    >
      {Icon && (
        <div className="mb-4 rounded-2xl p-4 animate-[pulse_3s_ease-in-out_infinite]"
          style={{ background: 'var(--primary-50, #f3f0ff)' }}
        >
          <Icon size={32} style={{ color: 'var(--primary, #6C5CE7)' }} className="opacity-60" />
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-700">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-gray-400 max-w-[260px]">{description}</p>
      )}
      {action && actionLabel && (
        <button
          type="button"
          onClick={action}
          className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md
            hover:opacity-90 active:scale-[0.97] transition-all"
          style={{ background: 'var(--primary, #6C5CE7)' }}
        >
          {actionLabel}
        </button>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
