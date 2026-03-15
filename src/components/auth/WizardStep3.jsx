/**
 * STEP 4.3 — Family composition.
 * If parent: parents (up to 4), grandparents (up to 4), children (up to 8).
 * If child: simplified "enter family code" (R1 placeholder).
 */
import { useState } from 'react'

const MAX_PARENTS = 4
const MAX_GRANDPARENTS = 4
const MAX_CHILDREN = 8

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

  // Parents (genitori) — pre-populate first with ownerName from Step 2
  const parents = data.parents?.length > 0
    ? data.parents
    : [{ name: data.ownerName || '', role: 'parent' }]

  // Grandparents (nonni)
  const grandparents = data.grandparents || []
  const hasGrandparents = data.hasGrandparents ?? false

  // Children (figli)
  const hasChildren = data.hasChildren ?? false
  const children = data.children || []

  // Build the combined adults array for SetupWizard compatibility
  const syncAdults = (newParents, newGrandparents) => {
    const combined = [
      ...newParents,
      ...newGrandparents,
    ]
    onUpdate({ adults: combined })
  }

  const setParents = (newParents) => {
    onUpdate({ parents: newParents })
    syncAdults(newParents, grandparents)
  }

  const setGrandparents = (newGrandparents) => {
    onUpdate({ grandparents: newGrandparents })
    syncAdults(parents, newGrandparents)
  }

  const setHasGrandparents = (val) => {
    onUpdate({ hasGrandparents: val })
    if (!val) {
      onUpdate({ grandparents: [] })
      syncAdults(parents, [])
    }
  }

  const setHasChildren = (val) => {
    onUpdate({ hasChildren: val })
    if (!val) onUpdate({ children: [] })
  }
  const setChildren = (newChildren) => onUpdate({ children: newChildren })

  // Parent count handlers
  const handleParentCount = (count) => {
    const current = [...parents]
    while (current.length < count) current.push({ name: '', role: 'parent' })
    setParents(current.slice(0, count))
  }

  const updateParent = (index, field, value) => {
    const updated = [...parents]
    updated[index] = { ...updated[index], [field]: value }
    setParents(updated)
  }

  // Grandparent count handlers
  const handleGrandparentCount = (count) => {
    const current = [...grandparents]
    while (current.length < count) current.push({ name: '', role: 'elder' })
    setGrandparents(current.slice(0, count))
  }

  const updateGrandparent = (index, field, value) => {
    const updated = [...grandparents]
    updated[index] = { ...updated[index], [field]: value }
    setGrandparents(updated)
  }

  // Children count handlers
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
    parents.forEach((a, i) => {
      if (!a.name?.trim()) errs[`parent_${i}`] = 'Nome obbligatorio'
    })
    if (hasGrandparents) {
      if (grandparents.length === 0) errs.grandparentCount = 'Aggiungi almeno un nonno/a'
      grandparents.forEach((g, i) => {
        if (!g.name?.trim()) errs[`grandparent_${i}`] = 'Nome obbligatorio'
      })
    }
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
    <div className="flex flex-col px-6 py-8 overflow-y-auto" style={{ maxHeight: '85vh' }}>
      <h2 className="mb-6 text-xl font-bold text-gray-900 text-center">
        La tua famiglia
      </h2>

      {/* ── GENITORI ── */}
      <div className="mb-6">
        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <span>👨‍👩</span> Genitori
        </label>
        <p className="mb-2 text-xs text-gray-500">Quanti genitori? (max {MAX_PARENTS})</p>
        <div className="mb-3 flex gap-2">
          {Array.from({ length: MAX_PARENTS }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleParentCount(n)}
              className={`h-10 w-10 rounded-xl text-sm font-semibold transition-all
                ${parents.length === n
                  ? 'bg-violet-600 text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
            >
              {n}
            </button>
          ))}
        </div>

        {parents.map((parent, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input
              type="text"
              placeholder={i === 0 ? data.ownerName || 'Nome genitore' : 'Nome genitore'}
              value={parent.name}
              onChange={(e) => updateParent(i, 'name', e.target.value)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm
                ${errors[`parent_${i}`] ? 'border-red-400' : 'border-gray-300'}
                focus:outline-none focus:ring-2 focus:ring-violet-500/20`}
            />
          </div>
        ))}
      </div>

      {/* ── NONNI ── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <span>👴👵</span> Nonni
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setHasGrandparents(true); if (grandparents.length === 0) handleGrandparentCount(1) }}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all
                ${hasGrandparents ? 'bg-violet-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Sì
            </button>
            <button
              type="button"
              onClick={() => setHasGrandparents(false)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all
                ${!hasGrandparents ? 'bg-violet-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              No
            </button>
          </div>
        </div>

        {hasGrandparents && (
          <>
            <p className="mb-2 text-xs text-gray-500">Quanti nonni? (max {MAX_GRANDPARENTS})</p>
            <div className="mb-3 flex gap-2">
              {Array.from({ length: MAX_GRANDPARENTS }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleGrandparentCount(n)}
                  className={`h-10 w-10 rounded-xl text-sm font-semibold transition-all
                    ${grandparents.length === n
                      ? 'bg-violet-600 text-white'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {grandparents.map((gp, i) => (
              <div key={i} className="mb-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Nome nonno/a"
                  value={gp.name}
                  onChange={(e) => updateGrandparent(i, 'name', e.target.value)}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm
                    ${errors[`grandparent_${i}`] ? 'border-red-400' : 'border-gray-300'}
                    focus:outline-none focus:ring-2 focus:ring-violet-500/20`}
                />
              </div>
            ))}
            {errors.grandparentCount && <p className="text-xs text-red-500">{errors.grandparentCount}</p>}
          </>
        )}
      </div>

      {/* ── FIGLI ── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <span>👧👦</span> Figli
          </label>
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

        {hasChildren && (
          <>
            <p className="mb-2 text-xs text-gray-500">Quanti figli? (max {MAX_CHILDREN})</p>
            <div className="mb-3 flex gap-2 flex-wrap">
              {Array.from({ length: MAX_CHILDREN }, (_, i) => i + 1).map((n) => (
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
              <div key={i} className="mb-2 flex gap-2">
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
      </div>

      {/* Navigation */}
      <div className="mt-4 flex gap-3">
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
