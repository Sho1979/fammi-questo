/**
 * STEP 4.2 — "Di chi è questo telefono?"
 * Role selection (parent/child) + name input.
 */
import { useState } from 'react'

export default function WizardStep2({ data, onUpdate, onNext, onBack }) {
  const [errors, setErrors] = useState({})

  const handleRoleSelect = (role) => {
    onUpdate({ ownerRole: role })
    setErrors((e) => ({ ...e, role: undefined }))
  }

  const handleNameChange = (e) => {
    onUpdate({ ownerName: e.target.value })
    setErrors((er) => ({ ...er, name: undefined }))
  }

  const validate = () => {
    const errs = {}
    if (!data.ownerRole) errs.role = 'Seleziona un ruolo'
    if (!data.ownerName?.trim()) errs.name = 'Inserisci il tuo nome'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    if (validate()) onNext()
  }

  return (
    <div className="flex flex-col px-6 py-8">
      <h2 className="mb-6 text-xl font-bold text-gray-900 text-center">
        Di chi è questo telefono?
      </h2>

      {/* Role cards */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleRoleSelect('parent')}
          className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition-all
            ${data.ownerRole === 'parent'
              ? 'border-violet-500 bg-violet-50'
              : 'border-gray-200 hover:border-gray-300'
            }`}
        >
          <span className="text-3xl" role="img" aria-label="Genitore">👨</span>
          <span className="text-sm font-semibold text-gray-800">Genitore / Adulto</span>
        </button>

        <button
          type="button"
          onClick={() => handleRoleSelect('child')}
          className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition-all
            ${data.ownerRole === 'child'
              ? 'border-violet-500 bg-violet-50'
              : 'border-gray-200 hover:border-gray-300'
            }`}
        >
          <span className="text-3xl" role="img" aria-label="Figlio">👧</span>
          <span className="text-sm font-semibold text-gray-800">Figlio/a</span>
        </button>
      </div>
      {errors.role && <p className="mb-4 -mt-4 text-xs text-red-500">{errors.role}</p>}

      {/* Name input */}
      <label className="mb-1 text-sm font-medium text-gray-700">Il tuo nome</label>
      <input
        type="text"
        value={data.ownerName || ''}
        onChange={handleNameChange}
        placeholder="es. Marco"
        className={`mb-1 rounded-xl border px-4 py-3 text-sm
          focus:outline-none focus:ring-2 focus:ring-violet-500/20
          ${errors.name ? 'border-red-400' : 'border-gray-300 focus:border-violet-500'}`}
      />
      {errors.name && <p className="mb-4 text-xs text-red-500">{errors.name}</p>}

      {/* Navigation */}
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3
            text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          &larr; Indietro
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="flex-1 rounded-xl bg-violet-600 px-4 py-3
            text-sm font-semibold text-white hover:bg-violet-700"
        >
          Avanti &rarr;
        </button>
      </div>
    </div>
  )
}
