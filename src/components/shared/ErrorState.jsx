/**
 * ErrorState — Polished error state with subtle entrance animation.
 * Fratello di EmptyState, usato quando un fetch o operazione fallisce.
 * Props: title, description?, onRetry?, retryLabel?
 */
import { AlertTriangle } from 'lucide-react'

export default function ErrorState({ title, description, onRetry, retryLabel }) {
  return (
    <div
      className="flex flex-col items-center justify-center px-6 py-12 text-center animate-[fadeInUp_0.4s_ease-out]"
    >
      <div className="mb-4 rounded-2xl p-4 bg-red-50">
        <AlertTriangle size={32} className="text-red-400 opacity-80" />
      </div>
      <h3 className="text-base font-semibold text-gray-700">{title || 'Qualcosa è andato storto'}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-gray-400 max-w-[260px]">{description}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md
            hover:opacity-90 active:scale-[0.97] transition-all bg-red-500 hover:bg-red-600"
        >
          {retryLabel || 'Riprova'}
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
