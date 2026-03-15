/**
 * STEP 3.8 — LoadingSpinner.
 * Tailwind animate-spin spinner.
 */

export default function LoadingSpinner({ size = 24, className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`} role="status" aria-label="Caricamento">
      <svg
        className="animate-spin text-violet-600"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="sr-only">Caricamento...</span>
    </div>
  )
}
