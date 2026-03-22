/**
 * STEP 4.3 — Family composition.
 * If parent: parents (up to 4), grandparents (up to 4), children (up to 8).
 * If child: invite code entry → member selection → join family.
 */
import { useState, useEffect } from 'react'
import { joinFamilyByCode } from '../../lib/sync.js'
import { db } from '../../lib/localDb.js'

const MAX_PARENTS = 4
const MAX_GRANDPARENTS = 4
const MAX_CHILDREN = 8

function mapMember(m) {
  return { id: m.id, name: m.name, role: m.role, access_level: m.access_level, icon: m.icon, color: m.color }
}

/**
 * Heuristic: detect if member names look encrypted (base64 or hex strings).
 * Real names contain spaces, accents, etc. Encrypted values are long alphanumeric/base64.
 */
function looksEncrypted(members) {
  return members.some(m => {
    const name = m.name || ''
    // Base64 pattern: 20+ chars of [A-Za-z0-9+/=] with no spaces
    return name.length >= 16 && /^[A-Za-z0-9+/=]+$/.test(name)
  })
}

export default function WizardStep3({ data, onUpdate, onNext, onBack }) {
  const [errors, setErrors] = useState({})
  const isChild = data.ownerRole === 'child'

  // -- Child join flow state --
  const [inviteCode, setInviteCode] = useState('')
  const [joinPhase, setJoinPhase] = useState('code') // 'code' | 'select'
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [childMembers, setChildMembers] = useState([])
  const [familyData, setFamilyData] = useState(null)
  const [selectedMemberId, setSelectedMemberId] = useState(null)

  // -- Child flow --
  if (isChild) {
    const handleCodeChange = (e) => {
      const val = e.target.value.toUpperCase().replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '').slice(0, 6)
      setInviteCode(val)
      setJoinError('')
    }

    const handleJoin = async () => {
      if (!inviteCode) {
        setJoinError('Inserisci il codice invito')
        return
      }
      if (inviteCode.length !== 6) {
        setJoinError('Il codice deve essere di 6 caratteri')
        return
      }

      setJoining(true)
      setJoinError('')

      try {
        const family = await joinFamilyByCode(inviteCode)
        // Read members from local Dexie (joinFamilyByCode already saved them)
        const allMembers = await db.members.where('family_id').equals(family.id).toArray()
        const children = allMembers.filter(m => m.role === 'child' && !m._deleted)

        // Detect encrypted family
        if (children.length > 0 && looksEncrypted(children)) {
          setJoinError('Questa famiglia usa la sincronizzazione crittografata. Chiedi al genitore di aggiungerti dalle Impostazioni.')
          setJoining(false)
          return
        }

        if (children.length === 0) {
          setJoinError('Nessun figlio configurato nella famiglia. Chiedi al genitore di aggiungerti.')
          setJoining(false)
          return
        }

        setChildMembers(children)
        setFamilyData(family)
        setJoinPhase('select')
      } catch (err) {
        if (!navigator.onLine) {
          setJoinError('Serve una connessione internet per unirti alla famiglia.')
        } else {
          setJoinError(err.message || 'Codice non valido. Controlla e riprova.')
        }
      } finally {
        setJoining(false)
      }
    }

    const handleConfirmMember = () => {
      if (!selectedMemberId) return
      const member = childMembers.find(m => m.id === selectedMemberId)
      if (member) {
        onNext({ familyId: familyData.id, selectedMember: mapMember(member) })
      }
    }

    // Phase 2: Member selection
    if (joinPhase === 'select') {
      return (
        <div className="flex flex-col px-6 py-8">
          <h2 className="mb-2 text-xl font-bold text-gray-900 text-center">Chi sei?</h2>
          <p className="mb-6 text-center text-sm text-gray-500">Seleziona il tuo profilo</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {childMembers.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMemberId(m.id)}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all
                  ${selectedMemberId === m.id
                    ? 'border-violet-600 bg-violet-50'
                    : 'border-gray-200 hover:border-gray-300'}`}
              >
                <span className="text-3xl">{m.icon}</span>
                <span className="text-sm font-medium text-gray-800">{m.name}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => { setJoinPhase('code'); setSelectedMemberId(null) }}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
              &larr; Indietro
            </button>
            <button type="button" onClick={handleConfirmMember}
              disabled={!selectedMemberId}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white
                ${selectedMemberId ? 'bg-violet-600 hover:bg-violet-700' : 'bg-gray-300 cursor-not-allowed'}`}>
              Conferma
            </button>
          </div>
        </div>
      )
    }

    // Phase 1: Code entry
    return (
      <div className="flex flex-col px-6 py-8">
        <h2 className="mb-2 text-xl font-bold text-gray-900 text-center">
          Unisciti alla tua famiglia
        </h2>
        <p className="mb-6 text-center text-sm text-gray-500">
          Chiedi a un genitore il codice invito a 6 caratteri
        </p>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-gray-800">Codice invito</label>
          <input
            type="text"
            value={inviteCode}
            onChange={handleCodeChange}
            placeholder="Es. A3B7K9"
            maxLength={6}
            className={`w-full rounded-xl border px-4 py-3 text-center text-2xl font-mono tracking-[0.3em] uppercase
              ${joinError ? 'border-red-400' : 'border-gray-300'}
              focus:outline-none focus:ring-2 focus:ring-violet-500/20`}
          />
          {joinError && <p className="mt-2 text-sm text-red-500">{joinError}</p>}
        </div>

        <div className="mt-8 flex gap-3">
          <button type="button" onClick={onBack}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            &larr; Indietro
          </button>
          <button type="button" onClick={handleJoin} disabled={joining}
            className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:bg-gray-300">
            {joining ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Connessione...
              </span>
            ) : 'Unisciti'}
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

  // Sync adults on initial mount — ensures owner is always in data.adults
  // even if user doesn't modify the parents list
  useEffect(() => {
    if (!data.adults || data.adults.length === 0) {
      const combined = [...parents, ...grandparents]
      if (combined.length > 0 && combined[0].name) {
        onUpdate({ adults: combined })
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
