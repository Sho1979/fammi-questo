/**
 * STEP 4.4 — PIN setup.
 * Parent PIN + Children PIN (if applicable). Min 4 digits, must differ.
 */
import { useState } from 'react'
import { Lock } from 'lucide-react'

export default function WizardStep4({ data, onUpdate, onNext, onBack }) {
  const [errors, setErrors] = useState({})
  const hasChildren = data.hasChildren && data.children?.length > 0

  const handleChange = (field, value) => {
    // Allow only digits
    const digits = value.replace(/\D/g, '').slice(0, 6)
    onUpdate({ [field]: digits })
    setErrors((e) => ({ ...e, [field]: undefined, pinMatch: undefined }))
  }

  const validate = () => {
    const errs = {}
    if (!data.parentPin || data.parentPin.length < 4) {
      errs.parentPin = 'Minimo 4 cifre'
    }
    if (data.parentPin !== data.parentPinConfirm) {
      errs.parentPinConfirm = 'I PIN non coincidono'
    }
    if (hasChildren) {
      if (!data.childPin || data.childPin.length < 4) {
        errs.childPin = 'Minimo 4 cifre'
      }
      if (data.childPin !== data.childPinConfirm) {
        errs.childPinConfirm = 'I PIN non coincidono'
      }
      if (data.parentPin && data.childPin && data.parentPin === data.childPin) {
        errs.pinMatch = 'I PIN genitori e figli devono essere diversi'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleComplete = () => {
    if (validate()) onNext()
  }

  return (
    <div className="flex flex-col px-6 py-8">
      <div className="mb-6 flex flex-col items-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100">
          <Lock size={28} className="text-violet-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Crea i PIN</h2>
        <p className="mt-1 text-sm text-gray-500 text-center">
          I PIN proteggono l'accesso all'app
        </p>
        <p className="mt-2 text-xs text-gray-400 text-center">
          Questi PIN verranno impostati al primo avvio e saranno richiesti ad ogni accesso
        </p>
      </div>

      {/* Parent PIN */}
      <label className="mb-1 text-sm font-medium text-gray-700">
        PIN genitori (4-6 cifre)
      </label>
      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        value={data.parentPin || ''}
        onChange={(e) => handleChange('parentPin', e.target.value)}
        placeholder="••••"
        className={`mb-1 rounded-xl border px-4 py-3 text-center text-lg tracking-[0.3em]
          focus:outline-none focus:ring-2 focus:ring-violet-500/20
          ${errors.parentPin ? 'border-red-400' : 'border-gray-300 focus:border-violet-500'}`}
      />
      {errors.parentPin && <p className="mb-2 text-xs text-red-500">{errors.parentPin}</p>}

      <label className="mb-1 mt-2 text-sm font-medium text-gray-700">Conferma PIN genitori</label>
      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        value={data.parentPinConfirm || ''}
        onChange={(e) => handleChange('parentPinConfirm', e.target.value)}
        placeholder="••••"
        className={`mb-1 rounded-xl border px-4 py-3 text-center text-lg tracking-[0.3em]
          focus:outline-none focus:ring-2 focus:ring-violet-500/20
          ${errors.parentPinConfirm ? 'border-red-400' : 'border-gray-300 focus:border-violet-500'}`}
      />
      {errors.parentPinConfirm && <p className="mb-2 text-xs text-red-500">{errors.parentPinConfirm}</p>}

      {/* Children PIN (if applicable) */}
      {hasChildren && (
        <>
          <hr className="my-4 border-gray-200" />
          <label className="mb-1 text-sm font-medium text-gray-700">
            PIN figli (4-6 cifre)
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={data.childPin || ''}
            onChange={(e) => handleChange('childPin', e.target.value)}
            placeholder="••••"
            className={`mb-1 rounded-xl border px-4 py-3 text-center text-lg tracking-[0.3em]
              focus:outline-none focus:ring-2 focus:ring-violet-500/20
              ${errors.childPin ? 'border-red-400' : 'border-gray-300 focus:border-violet-500'}`}
          />
          {errors.childPin && <p className="mb-2 text-xs text-red-500">{errors.childPin}</p>}

          <label className="mb-1 mt-2 text-sm font-medium text-gray-700">Conferma PIN figli</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={data.childPinConfirm || ''}
            onChange={(e) => handleChange('childPinConfirm', e.target.value)}
            placeholder="••••"
            className={`mb-1 rounded-xl border px-4 py-3 text-center text-lg tracking-[0.3em]
              focus:outline-none focus:ring-2 focus:ring-violet-500/20
              ${errors.childPinConfirm ? 'border-red-400' : 'border-gray-300 focus:border-violet-500'}`}
          />
          {errors.childPinConfirm && <p className="mb-2 text-xs text-red-500">{errors.childPinConfirm}</p>}
        </>
      )}

      {errors.pinMatch && (
        <p className="mt-2 text-center text-xs text-red-500">{errors.pinMatch}</p>
      )}

      {/* Navigation */}
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={onBack}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
          &larr; Indietro
        </button>
        <button type="button" onClick={handleComplete}
          className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700">
          Completa Setup ✓
        </button>
      </div>
    </div>
  )
}
