/**
 * STEP 4.3 — Family composition.
 * If parent: how many adults, their names/roles, children count, names/ages.
 * If child: simplified "enter family code" (R1 placeholder).
 */
import { useState } from 'react'

const MAX_ADULTS = 4
const MAX_CHILDREN = 6

export default function WizardStep3({ data, onUpdate, onNext, onBack }) {
  const [errors, setErrors] = useState({})
  const isChild = data.ownerRole === 'child'

  // -- Child flow (simplified in R1) --
  if (isChild) {
    return (
      <div className="flex flex-col px-6 py-8">
        <h2 className="mb-4 text-xl font-bold text-gray-900 text-center">
          Accedi alla tua famiglia
        </h2>
        <p className="mb-6 text-center text-sm text-gray-500">
          Chiedi a un genitore di fare il setup prima su questo telefono.
          <br />
          In R1 il figlio accede solo dopo che il genitore ha completato il setup.
        </p>

        <div className="mt-8 flex gap-3">
          <button type="button" onClick={onBack}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            &larr; Indietro
          </button>
        </div>
      </div>
    )
  }

  // -- Parent flow --

  // Pre-populate first adult with ownerName from Step 2
  const adults = data.adults?.length > 0
    ? data.adults
    : [{ name: data.ownerName || '', role: 'parent' }]
  const hasChildren = data.hasChildren ?? false
  const children = data.children || []

  const setAdults = (newAdults) => onUpdate({ adults: newAdults })
  const setHasChildren = (val) => {
    onUpdate({ hasChildren: val })
    if (!val) onUpdate({ children: [] })
  }
  const setChildren = (newChildren) => onUpdate({ children: newChildren })

  const handleAdultCount = (count) => {
    const current = [...adults]
    while (current.length < count) current.push({ name: '', role: 'parent' })
    setAdults(current.slice(0, count))
  }

  const updateAdult = (index, field, value) => {
    const updated = [...adults]
    updated[index] = { ...updated[index], [field]: value }
    setAdults(updated)
  }

  const handleChildCount = (count) => {
    const current = [...children]
    while (current.length < count) current.push({ name: '', age: '' })
    setChildren(current.slice(0, count))
  }

  const updateChild = (index, field, value) => {
    const updated = [...children]
    updated[index] = { ...updated[index], [field]: value }
    setChildren(updated)
  }

  const validate = () => {
    const errs = {}
    adults.forEach((a, i) => {
      if (!a.name?.trim()) errs[`adult_${i}`] = 'Nome obbligatorio'
    })
    if (hasChildren) {
      if (children.length === 0) errs.childCount = 'Aggiungi almeno un figlio'
      children.forEach((c, i) => {
        if (!c.name?.trim()) errs[`child_name_${i}`] = 'Nome obbligatorio'
        const age = parseInt(c.age)
        if (isNaN(age) || age < 0 || age > 25) errs[`child_age_${i}`] = 'Età non valida'
      })
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    if (validate()) onNext()
  }

  return (
    <div className="flex flex-col px-6 py-8">
      <h2 className="mb-6 text-xl font-bold text-gray-900 text-center">
        La tua famiglia
      </h2>

      {/* Adult count */}
      <label className="mb-2 text-sm font-medium text-gray-700">Quanti adulti?</label>
      <div className="mb-4 flex gap-2">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => handleAdultCount(n)}
            className={`h-10 w-10 rounded-xl text-sm font-semibold transition-all
              ${adults.length === n
                ? 'bg-violet-600 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Adult details */}
      {adults.map((adult, i) => (
        <div key={i} className="mb-3 flex gap-2">
          <input
            type="text"
            placeholder={i === 0 ? data.ownerName || 'Nome' : 'Nome'}
            value={adult.name}
            onChange={(e) => updateAdult(i, 'name', e.target.value)}
            className={`flex-1 rounded-xl border px-3 py-2.5 text-sm
              ${errors[`adult_${i}`] ? 'border-red-400' : 'border-gray-300'}
              focus:outline-none focus:ring-2 focus:ring-violet-500/20`}
          />
          <select
            value={adult.role}
            onChange={(e) => updateAdult(i, 'role', e.target.value)}
            className="rounded-xl border border-gray-300 px-2 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          >
            <option value="parent">Genitore</option>
            <option value="elder">Nonno/a</option>
            <option value="other">Altro</option>
          </select>
        </div>
      ))}

      {/* Has children toggle */}
      <div className="mt-4 mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Ci sono figli?</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setHasChildren(true); if (children.length === 0) handleChildCount(1) }}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all
              ${hasChildren ? 'bg-violet-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            Sì
          </button>
          <button
            type="button"
            onClick={() => setHasChildren(false)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all
              ${!hasChildren ? 'bg-violet-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            No
          </button>
        </div>
      </div>

      {/* Children count + details */}
      {hasChildren && (
        <>
          <label className="mb-2 text-sm font-medium text-gray-700">Quanti figli?</label>
          <div className="mb-4 flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleChildCount(n)}
                className={`h-10 w-10 rounded-xl text-sm font-semibold transition-all
                  ${children.length === n
                    ? 'bg-violet-600 text-white'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {n}
              </button>
            ))}
          </div>

          {children.map((child, i) => (
            <div key={i} className="mb-3 flex gap-2">
              <input
                type="text"
                placeholder="Nome"
                value={child.name}
                onChange={(e) => updateChild(i, 'name', e.target.value)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm
                  ${errors[`child_name_${i}`] ? 'border-red-400' : 'border-gray-300'}
                  focus:outline-none focus:ring-2 focus:ring-violet-500/20`}
              />
              <input
                type="number"
                placeholder="Età"
                min="0"
                max="25"
                value={child.age}
                onChange={(e) => updateChild(i, 'age', e.target.value)}
                className={`w-20 rounded-xl border px-3 py-2.5 text-sm text-center
                  ${errors[`child_age_${i}`] ? 'border-red-400' : 'border-gray-300'}
                  focus:outline-none focus:ring-2 focus:ring-violet-500/20`}
              />
            </div>
          ))}
          {errors.childCount && <p className="text-xs text-red-500">{errors.childCount}</p>}
        </>
      )}

      {/* Navigation */}
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={onBack}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
          &larr; Indietro
        </button>
        <button type="button" onClick={handleNext}
          className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700">
          Avanti &rarr;
        </button>
      </div>
    </div>
  )
}
