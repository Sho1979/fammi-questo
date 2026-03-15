/**
 * WizardStep1 — Welcome screen with Voice Ripple logo.
 * Logo, welcome text, privacy note, "Inizia" button.
 */

export default function WizardStep1({ onNext }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {/* Voice Ripple logo */}
      <div className="mb-6">
        <img
          src="/logo.svg"
          alt="Fammi Questo"
          className="h-24 w-24 drop-shadow-lg"
        />
      </div>

      <h1 className="mb-1 text-2xl font-bold text-gray-900">
        Fammi Questo
      </h1>
      <p className="mb-1 text-sm font-medium" style={{ color: 'var(--primary, #6C5CE7)' }}>
        Organizza la tua famiglia con una frase
      </p>

      <p className="mb-8 text-sm text-gray-400 mt-3">
        I tuoi dati restano sul tuo telefono.
        <br />
        Nessun account, nessun cloud obbligatorio.
      </p>

      <button
        type="button"
        onClick={onNext}
        className="w-full max-w-xs rounded-xl bg-violet-600 px-6 py-3.5
          text-base font-semibold text-white shadow-md
          hover:bg-violet-700 active:scale-[0.98] transition-all"
      >
        Inizia &rarr;
      </button>

      <p className="mt-6 text-[11px] text-gray-300">
        Privacy first &middot; Local-first &middot; Crittografia AES-256
      </p>
    </div>
  )
}
