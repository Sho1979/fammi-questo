# Brain v3 — Resolver Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Resolver layer between parser and preview that queries the DB, finds existing records, and enables delete/move/edit operations on real data.

**Architecture:** Parser detects `edit_action` intent (delete/move/edit/correct) and builds a search spec. The new `dbResolver.js` queries Dexie tables to find matching records, scores candidates, and populates a `resolved` object. `useBrain.js` orchestrates the resolver step and executes confirmed edit actions. `BrainSheet.jsx` shows disambiguation UI for ambiguous/not_found states.

**Tech Stack:** Dexie (IndexedDB), React hooks, Vitest

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/brain/dbResolver.js` | Query layer + candidate ranking + resolveEditAction orchestrator |
| Create | `src/lib/brain/__tests__/dbResolver.test.js` | Unit tests for resolver |
| Modify | `src/lib/brain/intentClassifier.js:234-276` | L0-EDIT → `edit_action` with search/patch extraction |
| Modify | `src/lib/brain/actionNormalizer.js:90-107` | `edit_action` pass-through (skip normalization) |
| Modify | `src/hooks/useBrain.js:186-247,480-609` | Resolver step after parse + executeAction for edit_action |
| Modify | `src/lib/brain/entityExtractor.js` | Add `resolveImplicitPerson()` for nonna/mamma/papa |
| Modify | `src/components/brain/BrainSheet.jsx:170-457` | Disambiguation UI + not_found states |
| Modify | `src/lib/brain/actionContract.js:22-24` | Add `edit_action` to ACTION_TYPES |
| Modify | `src/lib/brain/actionValidator.js` | Accept `edit_action` type with verb+search validation |

**IMPORTANT NOTES:**
- Dexie queries use single-field indexes only (no compound indexes) — filter in-memory for date/person
- `deleteEvent`, `updateEvent`, `deleteTask`, `updateTask`, `deleteShoppingItem` are already exported from hook files (verified)
- `resolveImplicitPerson` lives in `entityExtractor.js` only — `dbResolver.js` imports from there (no duplication)
- When `targetType='unknown'`, ALL domains are searched unconditionally (not cascading)
- `expense` targetType detection is removed from parser (no findExpenses in MVP)

---

## Chunk 1: Foundation — dbResolver.js + Tests

### Task 1: Create dbResolver.js skeleton with findEvents

**Files:**
- Create: `src/lib/brain/dbResolver.js`
- Create: `src/lib/brain/__tests__/dbResolver.test.js`

- [ ] **Step 1: Write failing test for findEvents**

```javascript
// src/lib/brain/__tests__/dbResolver.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { findEvents, findTasks, findShoppingItems, scoreCandidate, resolveEditAction } from '../dbResolver.js'

// Mock Dexie — we test scoring logic, not actual DB
const mockEvents = [
  { id: 'ev1', title: 'Dentista Asia', date: '2026-03-26', person_id: 'mem_asia', category: 'medico', _deleted: false },
  { id: 'ev2', title: 'Danza Asia', date: '2026-03-26', person_id: 'mem_asia', category: 'sport', _deleted: false },
  { id: 'ev3', title: 'Dentista Viola', date: '2026-03-27', person_id: 'mem_viola', category: 'medico', _deleted: false },
]

const mockMembers = [
  { id: 'mem_asia', name: 'Asia', role: 'child', gender: 'F', aliases: [] },
  { id: 'mem_viola', name: 'Viola', role: 'child', gender: 'F', aliases: [] },
  { id: 'mem_chiara', name: 'Chiara', role: 'genitore', gender: 'F', aliases: ['mamma'] },
  { id: 'mem_cristian', name: 'Cristian', role: 'genitore', gender: 'M', aliases: ['papà', 'papa'] },
]

describe('scoreCandidate', () => {
  it('scores higher for exact date + title match', () => {
    const score1 = scoreCandidate(mockEvents[0], {
      titleHintNorm: 'dentista',
      dateNorm: '2026-03-26',
      personId: null,
      activityHint: null,
    })
    const score2 = scoreCandidate(mockEvents[1], {
      titleHintNorm: 'dentista',
      dateNorm: '2026-03-26',
      personId: null,
      activityHint: null,
    })
    expect(score1).toBeGreaterThan(score2) // dentista matches title
  })

  it('includes person match in score', () => {
    const score1 = scoreCandidate(mockEvents[0], {
      titleHintNorm: 'dentista',
      dateNorm: '2026-03-26',
      personId: 'mem_asia',
      activityHint: null,
    })
    const score2 = scoreCandidate(mockEvents[0], {
      titleHintNorm: 'dentista',
      dateNorm: '2026-03-26',
      personId: null,
      activityHint: null,
    })
    expect(score1).toBeGreaterThan(score2) // person match adds 30 pts
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/brain/__tests__/dbResolver.test.js`
Expected: FAIL — `dbResolver.js` does not exist

- [ ] **Step 3: Implement dbResolver.js with scoreCandidate + findEvents + findTasks + findShoppingItems**

```javascript
// src/lib/brain/dbResolver.js
/**
 * dbResolver.js — Query layer + resolver per edit_action.
 *
 * Responsabilita':
 *   - Query eventi/task/shopping per familyId + filtri
 *   - Score composito per ranking candidati
 *   - resolveEditAction: orchestratore che popola resolved{}
 *
 * NON è una funzione pura: accede a Dexie per query DB.
 */

import { db } from '../localDb.js'
import { resolveImplicitPerson as resolveImplicitPersonFromExtractor } from './entityExtractor.js'

// ═══════════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════════

/**
 * Score composito per ranking candidati.
 * dateMatch*40 + personMatch*30 + titleMatch*20 + activityMatch*10
 *
 * @param {Object} record - DB record (event/task/shoppingItem)
 * @param {Object} search - { titleHintNorm, dateNorm, personId, activityHint }
 * @returns {number} 0-100
 */
export function scoreCandidate(record, search) {
  let score = 0

  // Date match (40 pts)
  if (search.dateNorm && record.date === search.dateNorm) {
    score += 40
  } else if (search.dateNorm && record.due_date === search.dateNorm) {
    score += 40 // tasks use due_date
  }

  // Person match (30 pts)
  if (search.personId) {
    if (record.person_id === search.personId || record.assigned_to === search.personId) {
      score += 30
    }
  }

  // Title match (20 pts) — fuzzy substring
  if (search.titleHintNorm) {
    const titleLower = (record.title || record.name || '').toLowerCase()
    const hint = search.titleHintNorm.toLowerCase()
    if (titleLower.includes(hint) || hint.includes(titleLower)) {
      score += 20
    } else {
      // Partial word overlap
      const hintWords = hint.split(/\s+/)
      const titleWords = titleLower.split(/\s+/)
      const overlap = hintWords.filter(w => titleWords.some(tw => tw.includes(w) || w.includes(tw)))
      if (overlap.length > 0) {
        score += Math.round(20 * (overlap.length / hintWords.length))
      }
    }
  }

  // Activity match (10 pts)
  if (search.activityHint) {
    const category = (record.category || '').toLowerCase()
    const activity = search.activityHint.toLowerCase()
    if (category.includes(activity) || activity.includes(category)) {
      score += 10
    }
  }

  return score
}

// ═══════════════════════════════════════════════════════════════
// QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Find events matching search criteria.
 * @param {string} familyId
 * @param {Object} search - { personId, dateNorm, activityHint, titleHintNorm }
 * @returns {Promise<Array<{record: Object, score: number}>>}
 */
export async function findEvents(familyId, search) {
  // Use single-field index + in-memory filter (no compound index in schema)
  const records = await db.events
    .where('family_id').equals(familyId)
    .filter(r => !r._deleted && (!search.dateNorm || r.date === search.dateNorm))
    .toArray()

  // Score and rank
  return records
    .map(record => ({ record, score: scoreCandidate(record, search) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

/**
 * Find tasks matching search criteria.
 * @param {string} familyId
 * @param {Object} search - { assignedTo, dueDate, titleHintNorm }
 * @returns {Promise<Array<{record: Object, score: number}>>}
 */
export async function findTasks(familyId, search) {
  // Remap search fields for task schema
  const taskSearch = {
    ...search,
    personId: search.assignedTo || search.personId,
    dateNorm: search.dueDate || search.dateNorm,
  }

  // Use single-field index + in-memory filter (no compound index in schema)
  const records = await db.tasks
    .where('family_id').equals(familyId)
    .filter(r => !r._deleted && r.status !== 'done' && (!taskSearch.dateNorm || r.due_date === taskSearch.dateNorm))
    .toArray()

  return records
    .map(record => ({ record, score: scoreCandidate(record, taskSearch) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

/**
 * Find shopping items matching search criteria.
 * @param {string} familyId
 * @param {Object} search - { nameHint }
 * @returns {Promise<Array<{record: Object, score: number}>>}
 */
export async function findShoppingItems(familyId, search) {
  const records = await db.shoppingItems
    .where('family_id').equals(familyId)
    .filter(r => !r._deleted && !r.checked)
    .toArray()

  const titleSearch = { titleHintNorm: search.nameHint || search.titleHintNorm }

  return records
    .map(record => ({ record, score: scoreCandidate(record, titleSearch) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

// ═══════════════════════════════════════════════════════════════
// PERSON RESOLVER (implicit subjects)
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve a person name hint to a member.
 * Handles implicit references: "nonna" → elder F, "mamma" → parent F, "papa" → parent M
 *
 * @param {string} familyId - unused (members already passed)
 * @param {string} nameHint
 * @param {Array} members - family members with role, gender, aliases
 * @returns {{ candidates: Array, best: Object|null, confidence: number, ambiguous: boolean }}
 */
export function resolvePerson(familyId, nameHint, members) {
  if (!nameHint || !members?.length) {
    return { candidates: [], best: null, confidence: 0, ambiguous: false }
  }

  const lower = nameHint.toLowerCase().trim()

  // Exact name match
  const exact = members.find(m => m.name.toLowerCase() === lower)
  if (exact) return { candidates: [exact], best: exact, confidence: 1.0, ambiguous: false }

  // Alias match
  for (const m of members) {
    if (m.aliases?.some(a => a.toLowerCase() === lower)) {
      return { candidates: [m], best: m, confidence: 0.95, ambiguous: false }
    }
  }

  // Implicit role-based match (delegates to entityExtractor)
  const implicitResult = resolveImplicitPersonFromExtractor(lower, members)
  if (implicitResult.best) {
    return { candidates: [implicitResult.best], best: implicitResult.best, confidence: implicitResult.confidence, ambiguous: false }
  }

  // Partial match
  const partial = members.find(m =>
    m.name.toLowerCase().startsWith(lower) || lower.startsWith(m.name.toLowerCase())
  )
  if (partial) return { candidates: [partial], best: partial, confidence: 0.7, ambiguous: false }

  return { candidates: [], best: null, confidence: 0, ambiguous: false }
}

// ═══════════════════════════════════════════════════════════════
// MAIN RESOLVER ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve an edit_action by querying the DB for matching records.
 *
 * @param {string} familyId
 * @param {Object} editAction - action with type='edit_action', verb, targetType, search, patch
 * @param {Array} members - family members
 * @returns {Promise<Object>} - editAction with resolved{} populated
 */
export async function resolveEditAction(familyId, editAction, members) {
  const search = editAction.search || {}

  // Resolve person if nameHint present
  if (search.personNameRaw && !search.personId) {
    const personResult = resolvePerson(familyId, search.personNameRaw, members)
    if (personResult.best) {
      search.personId = personResult.best.id
    }
  }

  // Determine search domains
  const targetType = editAction.targetType || 'unknown'
  let candidates = []
  let searchDomains = []

  // When targetType='unknown', search ALL domains unconditionally (not cascading)
  // and let scoring pick the best match across all domains
  if (targetType === 'calendar' || targetType === 'unknown') {
    searchDomains.push('events')
    const eventResults = await findEvents(familyId, search)
    candidates.push(...eventResults.map(r => ({ ...r, domain: 'events' })))
  }

  if (targetType === 'task' || targetType === 'unknown') {
    searchDomains.push('tasks')
    const taskResults = await findTasks(familyId, search)
    candidates.push(...taskResults.map(r => ({ ...r, domain: 'tasks' })))
  }

  if (targetType === 'shopping' || targetType === 'unknown') {
    searchDomains.push('shopping')
    const shoppingResults = await findShoppingItems(familyId, search)
    candidates.push(...shoppingResults.map(r => ({ ...r, domain: 'shopping' })))
  }

  // Sort all candidates by score
  candidates.sort((a, b) => b.score - a.score)
  const topCandidates = candidates.slice(0, 5)

  // Determine resolution status
  let status, matchedRecord, resolutionSource

  if (topCandidates.length === 0) {
    status = 'not_found'
    matchedRecord = null
    resolutionSource = 'not_found'
  } else if (topCandidates.length === 1) {
    status = 'resolved'
    matchedRecord = topCandidates[0].record
    resolutionSource = 'single_match'
  } else {
    // Check if top candidate is clearly best (>20pt gap)
    const gap = topCandidates[0].score - topCandidates[1].score
    if (gap >= 20) {
      status = 'resolved'
      matchedRecord = topCandidates[0].record
      resolutionSource = 'single_match'
    } else {
      status = 'ambiguous'
      matchedRecord = null
      resolutionSource = 'ambiguous'
    }
  }

  const resolved = {
    status,
    candidates: topCandidates.map(c => c.record),
    matchedRecord,
    selectedRecord: null,
    requiresConfirmation: true, // always true for delete/move/edit
    resolutionConfidence: topCandidates.length > 0 ? topCandidates[0].score / 100 : 0,
    resolutionSource,
    resolverTrace: {
      searchDomains,
      query: search,
      candidatesFound: topCandidates.length,
      selectedId: matchedRecord?.id || null,
      reason: status === 'resolved' ? 'single_match' : status,
    },
  }

  return { ...editAction, resolved }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/brain/__tests__/dbResolver.test.js`
Expected: PASS — scoreCandidate tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/brain/dbResolver.js src/lib/brain/__tests__/dbResolver.test.js
git commit -m "feat(brain): add dbResolver with scoreCandidate + query functions"
```

---

### Task 2: Add resolveEditAction tests

**Files:**
- Modify: `src/lib/brain/__tests__/dbResolver.test.js`

- [ ] **Step 1: Write failing tests for resolveEditAction and resolvePerson**

Add to `dbResolver.test.js`:

```javascript
describe('resolvePerson', () => {
  it('resolves exact name', () => {
    const result = resolvePerson('fam1', 'Asia', mockMembers)
    expect(result.best.id).toBe('mem_asia')
    expect(result.confidence).toBe(1.0)
    expect(result.ambiguous).toBe(false)
  })

  it('resolves alias "mamma" to parent female', () => {
    const result = resolvePerson('fam1', 'mamma', mockMembers)
    expect(result.best.id).toBe('mem_chiara')
    expect(result.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('resolves alias "papà" to parent male', () => {
    const result = resolvePerson('fam1', 'papà', mockMembers)
    expect(result.best.id).toBe('mem_cristian')
  })

  it('returns not found for unknown name', () => {
    const result = resolvePerson('fam1', 'Sconosciuto', mockMembers)
    expect(result.best).toBeNull()
    expect(result.confidence).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lib/brain/__tests__/dbResolver.test.js`
Expected: PASS — resolvePerson uses members array directly, no DB needed

- [ ] **Step 3: Commit**

```bash
git add src/lib/brain/__tests__/dbResolver.test.js
git commit -m "test(brain): add resolvePerson tests for implicit subject resolution"
```

---

## Chunk 2: Parser — edit_action Intent

### Task 3: Update intentClassifier.js L0-EDIT to produce edit_action

**Files:**
- Modify: `src/lib/brain/intentClassifier.js:234-276`

- [ ] **Step 1: Write failing test for edit_action shape**

Add new test file:

```javascript
// src/lib/brain/__tests__/editAction.test.js
import { describe, it, expect } from 'vitest'

describe('edit_action shape from L0-EDIT', () => {
  it('has correct structure for "cancella il dentista di giovedì"', () => {
    // This test validates the edit_action shape after it flows through the pipeline
    const editAction = {
      type: 'edit_action',
      verb: 'delete',
      targetType: 'calendar',
      search: {
        titleHintRaw: 'dentista',
        titleHintNorm: 'dentista',
        dateHintRaw: 'giovedì',
        dateNorm: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        personNameRaw: null,
        personId: null,
        activityHint: 'Dentista',
      },
      patch: null,
      resolved: null,
    }
    expect(editAction.type).toBe('edit_action')
    expect(editAction.verb).toBe('delete')
    expect(editAction.search.titleHintNorm).toBe('dentista')
  })

  it('has patch for move verb', () => {
    const editAction = {
      type: 'edit_action',
      verb: 'move',
      targetType: 'calendar',
      search: {
        titleHintRaw: 'dentista',
        titleHintNorm: 'dentista',
        dateHintRaw: 'giovedì',
        dateNorm: '2026-03-26',
        personNameRaw: 'Viola',
        personId: null,
        activityHint: 'Dentista',
      },
      patch: {
        dateHintRaw: 'settimana prossima',
        dateNorm: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        timeHint: null,
      },
      resolved: null,
    }
    expect(editAction.patch).not.toBeNull()
    expect(editAction.patch.dateNorm).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to confirm it passes (shape validation only)**

Run: `npx vitest run src/lib/brain/__tests__/editAction.test.js`
Expected: PASS — these are pure shape assertions

- [ ] **Step 3: Modify intentClassifier.js L0-EDIT block**

Replace lines 234-276 in `src/lib/brain/intentClassifier.js`:

```javascript
    // ─── L0-EDIT: Frasi di modifica/cancellazione → edit_action ───
    // Produce un'azione strutturata con search{} e patch{} per il Resolver.
    const editPatterns = [
      { re: /^(?:cancella|elimina|rimuovi|togli)\s+/i, verb: 'delete' },
      { re: /^(?:sposta|cambia|modifica|aggiorna|correggi)\s+/i, verb: 'edit' },
      { re: /(?:sposta|cambia)\s+.*\s+(?:a|al?)\s+/i, verb: 'move' },
      { re: /^(?:annulla|no,?\s*(?:aspetta|scusa)|(?:no,?\s+)?(?:erano|era|non)\s+\d)/i, verb: 'correct' },
    ]
    // "move" overrides "edit" if both match (more specific)
    let editMatch = null
    for (const p of editPatterns) {
      if (p.re.test(lower.trim())) {
        if (!editMatch || p.verb === 'move') editMatch = p
      }
    }
    if (editMatch) {
      // Detect target type (no expense in MVP — no findExpenses yet)
      const targetType =
        /\b(?:task|compito|attività)\b/i.test(lower) ? 'task' :
        /\b(?:evento|appuntamento|dentista|danza|nuoto|scuola|calendario|visita|lezione)\b/i.test(lower) ? 'calendar' :
        /\b(?:lista|shopping|comprare)\b/i.test(lower) ? 'shopping' :
        'unknown'

      // Extract search hints from the sentence
      const activity = extractActivity(sentence)
      const titleHintRaw = activity
        ? activity.toLowerCase()
        : lower.replace(editMatch.re, '').replace(/\b(?:di|del|della|dello|il|la|lo|l'|un|una|dei|delle|degli)\b/gi, '').trim().split(/\s+/)[0] || null

      // Extract person from sentence
      const personMatch = persons.length > 0 ? persons[0] : null

      // Extract patch for move/edit verbs
      let patch = null
      if (editMatch.verb === 'move' || editMatch.verb === 'edit') {
        // "sposta X a venerdì" / "sposta X a settimana prossima"
        const moveToMatch = lower.match(/\b(?:a|al?|per)\s+(.+)$/i)
        if (moveToMatch) {
          const patchDateRaw = moveToMatch[1].trim()
          const patchDateNorm = parseLocalDate(patchDateRaw)
          const patchTime = parseLocalTime(patchDateRaw)
          patch = {
            dateHintRaw: patchDateRaw,
            dateNorm: patchDateNorm,
            timeHint: patchTime,
          }
        }
      }

      const editAction = {
        type: 'edit_action',
        verb: editMatch.verb,
        targetType,
        search: {
          titleHintRaw: titleHintRaw,
          titleHintNorm: titleHintRaw ? titleHintRaw.toLowerCase() : null,
          dateHintRaw: lower.match(/\b(?:oggi|domani|dopodomani|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica|settimana\s+prossima|[\d]+\s+\w+)\b/i)?.[0] || null,
          dateNorm: date,
          personNameRaw: personMatch?.name || null,
          personId: personMatch?.id || null,
          activityHint: activity || null,
        },
        patch,
        resolved: null,
        _confidence: 0.80,
        _pipelinePath: 'l0_edit',
        _textOriginal: sentence,
      }
      actions.push(editAction)
      totalConfidence += 0.80

      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'edit_action', confidence: 0.80, source: 'l0_edit',
          people: persons.map(p => p.name), date, time,
          actionsGenerated: [editAction], warnings: [],
        })
      }
      continue
    }
```

- [ ] **Step 4: Run existing tests to verify no regression**

Run: `npx vitest run`
Expected: All 29 existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/brain/intentClassifier.js src/lib/brain/__tests__/editAction.test.js
git commit -m "feat(brain): L0-EDIT produces edit_action with search/patch"
```

---

### Task 4: Update actionNormalizer.js to pass through edit_action

**Files:**
- Modify: `src/lib/brain/actionNormalizer.js:90-107`
- Modify: `src/lib/brain/actionContract.js:22-24`

- [ ] **Step 1: Add edit_action to ACTION_TYPES**

In `src/lib/brain/actionContract.js` line 22-24, change:

```javascript
export const ACTION_TYPES = Object.freeze([
  'calendar', 'task', 'expense', 'meal', 'shopping', 'reminder', 'note', 'edit_action',
])
```

- [ ] **Step 2: Add edit_action pass-through in normalizeAction**

In `src/lib/brain/actionNormalizer.js`, replace the `case 'edit_request'` at line 101:

```javascript
    case 'edit_action': return normalizeEditAction(raw, ctx, index)
    case 'edit_request': return normalizeEditAction(raw, ctx, index) // legacy fallback
```

Add the normalizeEditAction function after normalizeNote (after line 315):

```javascript
function normalizeEditAction(raw, ctx, index) {
  // edit_action is a special pass-through type.
  // It carries search{} and patch{} for the resolver, not DB fields.
  // We still fill base meta for tracking.
  const base = createActionBase('edit_action', ctx, index)

  // Fill base meta
  base.source = ctx.source || raw._source || 'L0'
  base.confidence = typeof raw._confidence === 'number' ? raw._confidence : 0.80
  base.textOriginal = raw._textOriginal || raw.textOriginal || ctx.textOriginal || ''
  base.familyId = ctx.familyId || ''
  base.createdBy = ctx.currentMemberId || null
  base.meta.utteranceRef = ctx.utteranceRef
  base.meta.actionRef = generateActionRef(index)
  base.meta.pipelinePath = raw._pipelinePath || 'l0_edit'

  // Carry edit-specific fields
  base.verb = raw.verb || 'edit'
  base.targetType = raw.targetType || 'unknown'
  base.search = raw.search || {}
  base.patch = raw.patch || null
  base.resolved = raw.resolved || null

  return base
}
```

NOTE: Also add `import { createActionBase, generateActionRef } from './actionContract.js'` — but these are already imported via the existing imports. Actually, `createActionBase` is NOT currently imported. We need to add it. Update the import at line 19-24:

```javascript
import {
  generateUtteranceRef, generateActionRef, createActionBase,
  createCalendarAction, createTaskAction, createExpenseAction,
  createMealAction, createShoppingAction, createReminderAction,
  createNoteAction, createLogisticsShape, createLinkedEntity,
} from './actionContract.js'
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/brain/actionNormalizer.js src/lib/brain/actionContract.js
git commit -m "feat(brain): edit_action pass-through in normalizer"
```

---

### Task 4b: Update actionValidator to accept edit_action

**Files:**
- Modify: `src/lib/brain/actionValidator.js`

- [ ] **Step 1: Add edit_action validation case**

In the validation switch for type-specific checks, add:

```javascript
case 'edit_action':
  if (!['delete', 'edit', 'move', 'correct'].includes(action.verb)) {
    errors.push(`edit_action: verb non valido "${action.verb}"`)
  }
  if (!action.search || typeof action.search !== 'object') {
    errors.push('edit_action: search mancante')
  }
  break
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/brain/actionValidator.js
git commit -m "feat(brain): actionValidator accepts edit_action type"
```

---

## Chunk 3: Orchestration — useBrain.js resolver + execute

### Task 5: Add resolver step to useBrain.js

**Files:**
- Modify: `src/hooks/useBrain.js`

- [ ] **Step 1: Add import for resolveEditAction**

At top of useBrain.js, add:

```javascript
import { resolveEditAction } from '../lib/brain/dbResolver.js'
```

- [ ] **Step 2: Add resolver step in doParse, after brainParse**

After line 227 (`const parsed = await brainParse(text, context)`), before the `if (parsed.ok && ...)` check at line 233, insert:

```javascript
      // ─── RESOLVER STEP: resolve edit_action against DB ───
      if (parsed.ok && parsed.actions?.length > 0) {
        for (let i = 0; i < parsed.actions.length; i++) {
          if (parsed.actions[i].type === 'edit_action') {
            try {
              parsed.actions[i] = await resolveEditAction(
                familyId,
                parsed.actions[i],
                context.members
              )
            } catch (err) {
              console.warn('[Brain] Resolver failed for edit_action:', err)
              // Keep the action as-is with resolved=null
            }
          }
        }
      }
```

- [ ] **Step 3: Add edit_action case to executeAction**

After the `case 'reminder':` block (around line 605), add:

```javascript
      case 'edit_action': {
        const target = action.resolved?.selectedRecord || action.resolved?.matchedRecord
        if (!target) {
          return { msg: `${action.verb}: nessun record selezionato`, record: null }
        }

        const verb = action.verb
        const domain = action.resolved?.resolverTrace?.searchDomains?.[0] || 'events'

        if (verb === 'delete') {
          if (domain === 'events' || target.time_start !== undefined) {
            await deleteEvent(target.id)
            return { msg: `Eliminato evento "${target.title}"`, record: target }
          } else if (domain === 'tasks' || target.status !== undefined) {
            await deleteTask(target.id)
            return { msg: `Eliminato task "${target.title}"`, record: target }
          } else if (domain === 'shopping' || target.checked !== undefined) {
            await deleteShoppingItem(target.id)
            return { msg: `Rimosso "${target.name || target.title}" dalla lista`, record: target }
          }
        }

        if (verb === 'move' || verb === 'edit') {
          const patch = action.patch || {}
          const changes = {}
          if (patch.dateNorm) changes.date = patch.dateNorm
          if (patch.timeHint) changes.time_start = patch.timeHint

          if (domain === 'events' || target.time_start !== undefined) {
            if (patch.dateNorm) changes.date = patch.dateNorm
            await updateEvent(target.id, changes)
            return { msg: `Spostato "${target.title}" a ${patch.dateNorm || '?'}`, record: target }
          } else if (domain === 'tasks' || target.status !== undefined) {
            if (patch.dateNorm) changes.due_date = patch.dateNorm
            await updateTask(target.id, changes)
            return { msg: `Spostato task "${target.title}" a ${patch.dateNorm || '?'}`, record: target }
          }
        }

        return { msg: `${verb}: operazione non supportata`, record: null }
      }
```

- [ ] **Step 4: Add delete/update imports**

At the top of useBrain.js, add imports:

```javascript
import { deleteEvent, updateEvent } from './useCalendar.js'
import { deleteTask, updateTask } from './useTasks.js'
import { deleteShoppingItem } from './useShopping.js'
```

NOTE: `addEvent` is already imported from `useCalendar.js`. We need to extend that import. Change line 29:

```javascript
import { addEvent, deleteEvent, updateEvent } from './useCalendar.js'
```

Similarly for tasks (line 30):
```javascript
import { addTask, deleteTask, updateTask } from './useTasks.js'
```

And shopping (line 31):
```javascript
import { addShoppingItem, deleteShoppingItem } from './useShopping.js'
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useBrain.js
git commit -m "feat(brain): resolver step + edit_action execute in useBrain"
```

---

## Chunk 4: UI — BrainSheet disambiguation

### Task 6: Add edit_action UI to BrainSheet.jsx

**Files:**
- Modify: `src/components/brain/BrainSheet.jsx`

- [ ] **Step 1: Add edit_action to ACTION_CONFIG**

After line 28, add:

```javascript
  edit_action: { icon: CalendarDays, label: 'Modifica', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
```

Also add import for `Search, ArrowRight, ExternalLink` from lucide-react (line 12-17).

- [ ] **Step 2: Add EditActionCard component**

Add before the `ActionCard` function:

```javascript
// ─── EditActionCard — shows resolved record or disambiguation ──
function EditActionCard({ action, index, onSelectCandidate, onRemove }) {
  const config = ACTION_CONFIG.edit_action
  const resolved = action.resolved
  const verb = action.verb
  const verbLabel = verb === 'delete' ? 'Elimina' : verb === 'move' ? 'Sposta' : 'Modifica'

  // Not found
  if (resolved?.status === 'not_found') {
    return (
      <div className="rounded-xl overflow-hidden" style={{ background: config.bg, border: `1px solid ${config.color}20` }}>
        <div className="px-3 py-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${config.color}20` }}>
            <Search size={16} style={{ color: config.color }} />
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: config.color }}>
              {verbLabel}
            </span>
            <p className="text-sm font-medium text-gray-600">Non trovato</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {action.search?.titleHintNorm
                ? `Nessun risultato da ${verbLabel.toLowerCase()} per "${action.search.titleHintNorm}"`
                : `Nessun record da ${verbLabel.toLowerCase()}`}
            </p>
          </div>
          <button type="button" onClick={() => onRemove(index)}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    )
  }

  // Ambiguous — show candidates for selection
  if (resolved?.status === 'ambiguous') {
    return (
      <div className="rounded-xl overflow-hidden" style={{ background: config.bg, border: `1px solid ${config.color}20` }}>
        <div className="px-3 py-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${config.color}20` }}>
            <AlertCircle size={16} style={{ color: '#F59E0B' }} />
          </div>
          <div className="flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: config.color }}>
              {verbLabel} — quale intendi?
            </span>
          </div>
          <button type="button" onClick={() => onRemove(index)}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
            <Trash2 size={13} />
          </button>
        </div>
        <div className="px-3 pb-2.5 flex flex-col gap-1.5">
          {resolved.candidates.map((candidate, ci) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onSelectCandidate(index, candidate)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-white/60 transition-all border border-transparent hover:border-gray-200"
            >
              <ArrowRight size={12} style={{ color: config.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{candidate.title || candidate.name}</p>
                <p className="text-[11px] text-gray-400">
                  {candidate.date || candidate.due_date || ''} {candidate.person_id ? '' : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Resolved — show matched record for confirmation
  const target = resolved?.selectedRecord || resolved?.matchedRecord
  if (resolved?.status === 'resolved' && target) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ background: config.bg, border: `1px solid ${config.color}20` }}>
        <div className="px-3 py-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: verb === 'delete' ? 'rgba(239,68,68,0.15)' : `${config.color}20` }}>
            {verb === 'delete'
              ? <Trash2 size={16} className="text-red-500" />
              : <ArrowRight size={16} style={{ color: config.color }} />}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: verb === 'delete' ? '#EF4444' : config.color }}>
              {verbLabel}
            </span>
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {target.title || target.name}
            </p>
            <p className="text-[11px] text-gray-400">
              {target.date || target.due_date || ''}
              {action.patch?.dateNorm ? ` → ${action.patch.dateNorm}` : ''}
            </p>
          </div>
          <button type="button" onClick={() => onRemove(index)}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    )
  }

  // Fallback: unresolved edit_action
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: config.bg, border: `1px solid ${config.color}20` }}>
      <div className="px-3 py-2.5">
        <span className="text-xs text-gray-400">{verbLabel}: in attesa del resolver...</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update action cards rendering in preview phase**

In the preview section (around line 305-313), replace the ActionCard map with:

```javascript
              {actions.map((action, i) => (
                action.type === 'edit_action' ? (
                  <EditActionCard
                    key={`edit-${i}`}
                    action={action}
                    index={i}
                    onSelectCandidate={handleSelectCandidate}
                    onRemove={handleRemove}
                  />
                ) : (
                  <ActionCard
                    key={`${action.type}-${i}`}
                    action={action}
                    index={i}
                    onRemove={handleRemove}
                  />
                )
              ))}
```

- [ ] **Step 4: Add handleSelectCandidate callback**

After `handleRemove` (line 190-192), add:

```javascript
  const handleSelectCandidate = useCallback((actionIndex, candidate) => {
    setActions(prev => prev.map((a, i) => {
      if (i !== actionIndex || a.type !== 'edit_action') return a
      return {
        ...a,
        resolved: {
          ...a.resolved,
          status: 'resolved',
          selectedRecord: candidate,
          resolutionSource: 'user_selected',
        },
      }
    }))
  }, [])
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/brain/BrainSheet.jsx
git commit -m "feat(brain): disambiguation UI for edit_action in BrainSheet"
```

---

## Chunk 5: Implicit Person + Integration Tests

### Task 7: Export resolveImplicitPerson from entityExtractor.js

**Files:**
- Modify: `src/lib/brain/entityExtractor.js`

- [ ] **Step 1: Add resolveImplicitPerson export**

At the end of `entityExtractor.js`, add:

```javascript
// ═══════════════════════════════════════════════════════════════
// IMPLICIT PERSON RESOLUTION (for resolver)
// ═══════════════════════════════════════════════════════════════
/**
 * Resolve implicit person references by role/relationship.
 * "nonna" → elder female member
 * "mamma" → parent female member
 * "papà"/"papa" → parent male member
 *
 * Uses members array directly — no DB query needed.
 *
 * @param {string} nameHint
 * @param {Array<{id, name, role, gender, aliases}>} members
 * @returns {{ best: Object|null, confidence: number }}
 */
export function resolveImplicitPerson(nameHint, members) {
  if (!nameHint || !members?.length) return { best: null, confidence: 0 }

  const lower = nameHint.toLowerCase().trim()
  const isFemale = (m) => m.gender === 'F' || /a$/i.test(m.name)
  const isMale = (m) => m.gender === 'M' || !isFemale(m)

  const IMPLICIT_MAP = [
    { terms: ['nonna', 'dalla nonna'], filter: m => (m.role === 'nonno' || m.role === 'nonna' || m.role === 'elder') && isFemale(m) },
    { terms: ['nonno', 'dal nonno'], filter: m => (m.role === 'nonno' || m.role === 'nonna' || m.role === 'elder') && isMale(m) },
    { terms: ['mamma', 'dalla mamma'], filter: m => (m.role === 'genitore' || m.role === 'parent') && isFemale(m) },
    { terms: ['papà', 'papa', 'dal papà', 'dal papa'], filter: m => (m.role === 'genitore' || m.role === 'parent') && isMale(m) },
  ]

  for (const { terms, filter } of IMPLICIT_MAP) {
    if (terms.includes(lower)) {
      const matches = members.filter(filter)
      if (matches.length === 1) return { best: matches[0], confidence: 0.85 }
      if (matches.length > 1) return { best: matches[0], confidence: 0.5 }
    }
  }

  return { best: null, confidence: 0 }
}
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/brain/entityExtractor.js
git commit -m "feat(brain): add resolveImplicitPerson export to entityExtractor"
```

---

### Task 8: Integration test — full pipeline edit_action

**Files:**
- Create: `src/lib/brain/__tests__/editActionIntegration.test.js`

- [ ] **Step 1: Write integration test**

```javascript
// src/lib/brain/__tests__/editActionIntegration.test.js
import { describe, it, expect } from 'vitest'
import { normalizeAndValidateActions } from '../actionNormalizer.js'

const CTX = {
  familyId: 'fam_test',
  currentMemberId: 'mem_cristian',
  members: [
    { id: 'mem_asia', name: 'Asia', role: 'child', aliases: [] },
    { id: 'mem_viola', name: 'Viola', role: 'child', aliases: [] },
    { id: 'mem_chiara', name: 'Chiara', role: 'genitore', gender: 'F', aliases: ['mamma'] },
    { id: 'mem_cristian', name: 'Cristian', role: 'genitore', gender: 'M', aliases: ['papà'] },
  ],
  source: 'L0',
}

describe('edit_action normalization', () => {
  it('passes through edit_action with search and patch', () => {
    const raw = [{
      type: 'edit_action',
      verb: 'delete',
      targetType: 'calendar',
      search: { titleHintNorm: 'dentista', dateNorm: '2026-03-26', personNameRaw: null, personId: null, activityHint: null },
      patch: null,
      resolved: null,
      _confidence: 0.80,
      _pipelinePath: 'l0_edit',
      _textOriginal: 'cancella il dentista di giovedì',
    }]

    const { actions, invalid } = normalizeAndValidateActions(raw, CTX)
    expect(invalid.length).toBe(0)
    expect(actions.length).toBe(1)
    expect(actions[0].type).toBe('edit_action')
    expect(actions[0].verb).toBe('delete')
    expect(actions[0].search.titleHintNorm).toBe('dentista')
    expect(actions[0].meta.utteranceRef).toBeTruthy()
  })

  it('passes through move with patch', () => {
    const raw = [{
      type: 'edit_action',
      verb: 'move',
      targetType: 'calendar',
      search: { titleHintNorm: 'dentista', dateNorm: '2026-03-26', personNameRaw: 'Viola', personId: null, activityHint: 'Dentista' },
      patch: { dateHintRaw: 'venerdì', dateNorm: '2026-03-27', timeHint: null },
      resolved: null,
      _confidence: 0.80,
      _pipelinePath: 'l0_edit',
      _textOriginal: 'sposta il dentista di Viola a venerdì',
    }]

    const { actions } = normalizeAndValidateActions(raw, CTX)
    expect(actions[0].verb).toBe('move')
    expect(actions[0].patch.dateNorm).toBe('2026-03-27')
  })
})
```

- [ ] **Step 2: Run test**

Run: `npx vitest run src/lib/brain/__tests__/editActionIntegration.test.js`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (29 existing + new tests)

- [ ] **Step 4: Commit**

```bash
git add src/lib/brain/__tests__/editActionIntegration.test.js
git commit -m "test(brain): add edit_action integration tests"
```

---

## Summary

**Total tasks:** 9 (Tasks 1-8 + 4b)
**Total files created:** 3 (dbResolver.js, dbResolver.test.js, editAction*.test.js)
**Total files modified:** 7 (intentClassifier.js, actionNormalizer.js, actionContract.js, actionValidator.js, useBrain.js, BrainSheet.jsx, entityExtractor.js)
**Estimated commits:** 9

**Execution order:** Task 1 → 2 → 3 → 4 → 4b → 5 → 6 → 7 → 8

**Key design decisions:**
- Dexie queries use single-field indexes only (no schema migration needed)
- `resolveImplicitPerson` lives in `entityExtractor.js`, imported by `dbResolver.js`
- `targetType='unknown'` searches ALL domains unconditionally
- No `expense` edit in MVP (expense targetType removed from parser detection)
- `requiresConfirmation: true` hardcoded — always confirm before execute

**Post-implementation checklist:**
- [ ] All existing 29 tests still pass
- [ ] New tests for scoreCandidate, resolvePerson, edit_action normalization pass
- [ ] Manual test: "cancella il dentista di giovedì" → resolver finds record → shows delete confirmation
- [ ] Manual test: "sposta il dentista a venerdì" → resolver finds record → shows move confirmation
- [ ] Manual test: ambiguous query → shows candidate selector
- [ ] Manual test: no match → shows "Non trovato" with CTA
