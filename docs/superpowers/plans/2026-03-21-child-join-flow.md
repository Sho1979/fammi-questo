# Child Join Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a child to join an existing family from the setup wizard by entering an invite code and selecting their profile.

**Architecture:** Replace the placeholder child branch in WizardStep3 with a two-phase UI (code entry → member selection). Add a `handleChildJoinComplete` handler in SetupWizard that skips steps 4–7 and finalizes auth state directly. Reuse existing `joinFamilyByCode()` from sync.js.

**Tech Stack:** React, Vitest, @testing-library/react, Zustand (authStore), Dexie (localDb), Supabase (sync.js)

**Spec:** `docs/superpowers/specs/2026-03-21-child-join-flow-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/auth/WizardStep3.jsx` | Modify lines 1–37 (child branch) | Replace child placeholder with code entry + member selection UI |
| `src/components/auth/SetupWizard.jsx` | Modify line 42 (add `setMember` to destructure), insert after line 73, modify lines 201–203 | Add `handleChildJoinComplete`, pass it as `onNext` for child flow |
| `src/components/auth/wizard.test.jsx` | Modify (add mocks at top, replace child test, add new describe block) | Tests for child join flow |

---

## Chunk 1: WizardStep3 Child Join UI + SetupWizard Skip Logic

### Task 1: Write failing tests for WizardStep3 child join flow

**Files:**
- Modify: `src/components/auth/wizard.test.jsx`

- [ ] **Step 1: Add mocks and imports at the TOP of wizard.test.jsx**

Add these lines at the very top of the file, BEFORE all other imports (vi.mock must be at module scope for Vitest hoisting):

```jsx
// Add after line 4 (import { describe, it, expect, vi, afterEach } from 'vitest')
// but BEFORE the component imports:

vi.mock('../../lib/sync.js', () => ({
  joinFamilyByCode: vi.fn(),
}))

vi.mock('../../lib/localDb.js', () => ({
  db: {
    members: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([
            { id: 'c1', name: 'Luca', role: 'child', access_level: 'basic', icon: '👦', color: '#FF9800', family_id: 'f1', pin_hash: 'xxx', _deleted: false, _version: 1 },
            { id: 'c2', name: 'Sara', role: 'child', access_level: 'basic', icon: '👧', color: '#E91E63', family_id: 'f1', pin_hash: 'yyy', _deleted: false, _version: 1 },
            { id: 'p1', name: 'Papà', role: 'parent', access_level: 'full', icon: '👨', color: '#4A90D9', family_id: 'f1', pin_hash: 'zzz', _deleted: false, _version: 1 },
          ])),
        })),
      })),
    },
  },
}))

import { joinFamilyByCode } from '../../lib/sync.js'
import { db } from '../../lib/localDb.js'
```

Also add `waitFor` to the existing `@testing-library/react` import on line 6:

```jsx
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
```

- [ ] **Step 2: Replace old child test and add new child join describe block**

Remove the old test at lines 137–143 (`'shows child flow message for child role'`).

Add this new describe block after the WizardStep3 parent describe block:

```jsx
// ===== WizardStep3 — Child Join Flow =====

describe('WizardStep3 — child join flow', () => {
  const childData = {
    ownerRole: 'child',
    ownerName: 'Luca',
    parents: [],
    hasChildren: false,
    children: [],
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    // Re-set the default mock for db.members.where
    db.members.where.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([
          { id: 'c1', name: 'Luca', role: 'child', access_level: 'basic', icon: '👦', color: '#FF9800', family_id: 'f1', pin_hash: 'xxx', _deleted: false, _version: 1 },
          { id: 'c2', name: 'Sara', role: 'child', access_level: 'basic', icon: '👧', color: '#E91E63', family_id: 'f1', pin_hash: 'yyy', _deleted: false, _version: 1 },
          { id: 'p1', name: 'Papà', role: 'parent', access_level: 'full', icon: '👨', color: '#4A90D9', family_id: 'f1', pin_hash: 'zzz', _deleted: false, _version: 1 },
        ])),
      })),
    })
  })

  it('renders invite code input for child role', () => {
    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    expect(container.textContent).toContain('Codice invito')
    const input = container.querySelector('input[type="text"]')
    expect(input).not.toBeNull()
  })

  it('shows error for empty code submission', async () => {
    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)
    await waitFor(() => {
      expect(container.textContent).toContain('Inserisci il codice')
    })
  })

  it('shows error for code too short', async () => {
    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'AB' } })
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)
    await waitFor(() => {
      expect(container.textContent).toContain('Il codice deve essere di 6 caratteri')
    })
  })

  it('calls joinFamilyByCode and shows child members on success', async () => {
    joinFamilyByCode.mockResolvedValue({ id: 'f1', name: 'Famiglia Test' })

    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'A3B7K9' } })
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Luca')
      expect(container.textContent).toContain('Sara')
      // Should NOT show parent
      expect(container.textContent).not.toContain('Papà')
    })
  })

  it('shows error when joinFamilyByCode fails', async () => {
    joinFamilyByCode.mockRejectedValue(new Error('Codice non valido'))

    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'XXXXXX' } })
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Codice non valido')
    })
  })

  it('calls onNext with familyId and mapped member when child selected', async () => {
    joinFamilyByCode.mockResolvedValue({ id: 'f1', name: 'Famiglia Test' })
    const onNext = vi.fn()

    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={onNext} onBack={() => {}} />
    )
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'A3B7K9' } })
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Luca')
    })

    // Select Luca
    const lucaBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Luca'))
    fireEvent.click(lucaBtn)

    // Confirm
    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Conferma'))
    fireEvent.click(confirmBtn)

    expect(onNext).toHaveBeenCalledWith({
      familyId: 'f1',
      selectedMember: { id: 'c1', name: 'Luca', role: 'child', access_level: 'basic', icon: '👦', color: '#FF9800' },
    })
  })

  it('shows no-children message when family has no child members', async () => {
    joinFamilyByCode.mockResolvedValue({ id: 'f1', name: 'Famiglia Test' })
    // Override mock to return only adults
    db.members.where.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([
          { id: 'p1', name: 'Papà', role: 'parent', access_level: 'full', icon: '👨', color: '#4A90D9' },
        ])),
      })),
    })

    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'A3B7K9' } })
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Nessun figlio configurato')
    })
  })

  it('shows encrypted family error when member names look encrypted', async () => {
    joinFamilyByCode.mockResolvedValue({ id: 'f1', name: 'Famiglia Test' })
    // Encrypted names are base64 strings
    db.members.where.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([
          { id: 'c1', name: 'dGVzdCBlbmNyeXB0ZWQ=', role: 'child', access_level: 'basic', icon: '👦', color: '#FF9800' },
        ])),
      })),
    })

    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'A3B7K9' } })
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('sincronizzazione crittografata')
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/auth/wizard.test.jsx`
Expected: FAIL — new tests reference UI elements that don't exist yet in WizardStep3

---

### Task 2: Implement WizardStep3 child join UI

**Files:**
- Modify: `src/components/auth/WizardStep3.jsx` (lines 1–37: imports + child `if` block)

- [ ] **Step 4: Replace the child branch in WizardStep3**

Replace lines 1–37 (imports + child `if` block). The parent flow (line 39 onwards: `// -- Parent flow --`) stays unchanged.

```jsx
/**
 * STEP 4.3 — Family composition.
 * If parent: parents (up to 4), grandparents (up to 4), children (up to 8).
 * If child: invite code entry → member selection → join family.
 */
import { useState } from 'react'
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
    return name.length > 20 && /^[A-Za-z0-9+/=]+$/.test(name)
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

  // -- Parent flow -- (everything below this line stays unchanged)
```

- [ ] **Step 5: Run tests to check progress**

Run: `npx vitest run src/components/auth/wizard.test.jsx`
Expected: All child join tests pass; all parent tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/WizardStep3.jsx src/components/auth/wizard.test.jsx
git commit -m "feat(wizard): add child join flow with invite code entry and member selection"
```

---

### Task 3: Wire up SetupWizard to skip steps 4–7 for child flow

**Files:**
- Modify: `src/components/auth/SetupWizard.jsx` (line 42: add `setMember`, insert after line 73, modify lines 201–203)

- [ ] **Step 7: Add `setMember` to store destructure and add `handleChildJoinComplete`**

On line 42, add `setMember` to the existing destructure:

```jsx
// Change from:
const { setFamily, completeSetup, setOwnerName } = useAuthStore()
// To:
const { setFamily, setMember, completeSetup, setOwnerName } = useAuthStore()
```

After `goBack` (line 73), insert:

```jsx
  /**
   * Child join flow — skips steps 4–7.
   * Called by WizardStep3 when child selects their profile.
   */
  const handleChildJoinComplete = ({ familyId, selectedMember }) => {
    setFamily(familyId)
    setMember(selectedMember)
    completeSetup()
    navigate('/login', { replace: true })
  }
```

Then change the Step 3 rendering (lines 201–203) from:

```jsx
        {step === 3 && (
          <WizardStep3 data={data} onUpdate={updateData} onNext={goNext} onBack={goBack} />
        )}
```

to:

```jsx
        {step === 3 && (
          <WizardStep3
            data={data}
            onUpdate={updateData}
            onNext={data.ownerRole === 'child' ? handleChildJoinComplete : goNext}
            onBack={goBack}
          />
        )}
```

- [ ] **Step 8: Run all wizard tests**

Run: `npx vitest run src/components/auth/wizard.test.jsx`
Expected: All tests PASS

- [ ] **Step 9: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add src/components/auth/SetupWizard.jsx
git commit -m "feat(wizard): skip steps 4-7 for child join flow"
```

---

### Task 4: Verify E2E + push

**Files:** None (verification only)

- [ ] **Step 11: Run E2E tests**

Run: `npx playwright test`
Expected: All 10 E2E tests PASS (child join is not E2E-covered yet but existing flows must not regress)

- [ ] **Step 12: Push**

```bash
git push
```
