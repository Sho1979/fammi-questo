# Commit Evaluator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a policy layer (commitEvaluator.js) between normalizer and preview that classifies commit safety into 4 levels (strong/light/draft/none), plus a write guard in useBrain.js that routes actions to target table, conversationDrafts, or blocks them.

**Architecture:** New standalone module `commitEvaluator.js` evaluates canonical actions post-normalization, attaching `action.commit` with level/writePolicy/reasonCodes. The write guard `canWrite()` recalculates disposition at write time as defense-in-depth. Two prerequisite changes unlock the full pipeline: validator relaxation for date-less calendar, and expanded draft support for all action types.

**Tech Stack:** Vitest for tests, pure JS module (no React), Dexie for draft writes.

**Spec:** `docs/superpowers/specs/2026-03-20-commit-evaluator-design.md` (v3)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/brain/commitEvaluator.js` | **Create** | Core module: `evaluateCommitPolicy()`, `evaluateSingleAction()`, `canWrite()`. 15 rules, reason codes, commit levels. |
| `src/lib/brain/__tests__/commitEvaluator.test.js` | **Create** | Unit tests for all 15 rules + sub-rules, write guard, edge cases. |
| `src/lib/brain/actionValidator.js` | **Modify** | C1: Relax `date` from hard error to warning for `calendar` type only. |
| `src/lib/brain/conversationMemory.js` | **Modify** | C2: Expand and export `MEMORY_INTENTS` to include all action types. |
| `src/lib/brain/index.js` | **Modify** | C2b: Remove duplicate `MEMORY_INTENTS` and import from `conversationMemory.js`. |
| `src/lib/brain/intentClassifier.js` | **Modify** | Insert `evaluateCommitPolicy()` call after `normalizeAndValidateActions()`. |
| `src/hooks/useBrain.js` | **Modify** | Insert `canWrite()` guard + draft routing in `confirmActions()` loop. |
| `simulator/orchestrator.js` | **Modify** | Trace `action.commit` in trajectory objects. |

---

## Chunk 1: Prerequisites (C1 + C2)

### Task 1: Relax validator date requirement for calendar actions (C1)

**Files:**
- Modify: `src/lib/brain/actionValidator.js:158-160`
- Test: `src/lib/brain/__tests__/commitEvaluator.test.js` (new file, prerequisite tests only)

**Context:** Line 158-160 of `actionValidator.js` contains:
```javascript
if (!a.date || typeof a.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) {
  errors.push('calendar: date is required (YYYY-MM-DD)')
}
```
This hard-rejects calendar actions without a date. We need date-less calendar actions (like "ho catechismo") to survive validation so the evaluator can route them to `draft_only`. The fix is **selective**: only calendar gets the relaxation; expense and meal keep their hard date requirements.

- [ ] **Step 1: Write the failing test for date-less calendar passing validation**

Create `src/lib/brain/__tests__/commitEvaluator.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { validateAction } from '../actionValidator.js'

// ── Prerequisites: Validator relaxation (C1) ──────────────────

describe('C1: Validator date relaxation for calendar', () => {
  const baseMeta = {
    utteranceRef: 'u_test_001',
    actionRef: 'a_0',
    pipelinePath: 'l0_calendar',
    usedAI: false,
  }

  it('should allow calendar action WITHOUT date (warning, not error)', () => {
    const action = {
      type: 'calendar',
      title: 'Catechismo',
      date: null,
      timeStart: null,
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      location: null,
      activity: 'catechismo',
      category: 'altro',
      isAbsence: false,
      logistics: null,
      textOriginal: 'ho catechismo',
      confidence: 0.85,
      meta: baseMeta,
    }
    const result = validateAction(action)
    expect(result.ok).toBe(true)
    expect(result.warnings).toContain('calendar: date missing (will be evaluated by commit policy)')
  })

  it('should still REQUIRE date for expense actions', () => {
    const action = {
      type: 'expense',
      title: 'Spesa',
      amount: 45.50,
      date: null,
      category: 'spesa',
      personIds: [],
      personNames: [],
      textOriginal: 'spesa 45 euro',
      confidence: 0.90,
      meta: { ...baseMeta, pipelinePath: 'l0_expense' },
    }
    const result = validateAction(action)
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('date'))).toBe(true)
  })

  it('should still accept calendar WITH valid date (no warning)', () => {
    const action = {
      type: 'calendar',
      title: 'Danza Viola',
      date: '2026-03-21',
      timeStart: '16:00',
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      location: null,
      activity: 'danza',
      category: 'sport',
      isAbsence: false,
      logistics: null,
      textOriginal: 'domani viola ha danza alle 16',
      confidence: 0.90,
      meta: baseMeta,
    }
    const result = validateAction(action)
    expect(result.ok).toBe(true)
    expect(result.warnings).not.toContain('calendar: date missing (will be evaluated by commit policy)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: FAIL — date-less calendar action currently gets `ok: false`

- [ ] **Step 3: Modify actionValidator.js to relax date for calendar only**

In `src/lib/brain/actionValidator.js`, find the `validateCalendar()` function (around line 158-160). Replace the hard error with a conditional:

```javascript
// BEFORE (line 158-160):
if (!a.date || typeof a.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) {
  errors.push('calendar: date is required (YYYY-MM-DD)')
}

// AFTER:
if (!a.date || typeof a.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) {
  // C1: date-less calendar actions are allowed through to the commit evaluator.
  // They get a warning (not error) so the evaluator can route them to draft_only.
  // Expense and meal date requirements remain hard errors in their own validators.
  warnings.push('calendar: date missing (will be evaluated by commit policy)')
}
```

**Important:** Only this one block changes. Do NOT touch date validation in `validateExpense()` or `validateMeal()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: All 3 tests PASS

- [ ] **Step 5: Run full test suite to check no regressions**

Run: `npx vitest run`
Expected: All existing tests pass. Some calendar tests may need review if they expect `ok: false` for date-less calendars.

- [ ] **Step 6: Commit**

```bash
git add src/lib/brain/actionValidator.js src/lib/brain/__tests__/commitEvaluator.test.js
git commit -m "feat(brain): C1 — relax date requirement for calendar actions (warning, not error)"
```

---

### Task 2: Expand MEMORY_INTENTS for all action types (C2)

**Files:**
- Modify: `src/lib/brain/conversationMemory.js:30`

- [ ] **Step 1: Write the test for expanded MEMORY_INTENTS**

Append to `src/lib/brain/__tests__/commitEvaluator.test.js`:

```javascript
import { MEMORY_INTENTS } from '../conversationMemory.js'

describe('C2: MEMORY_INTENTS expanded for all types', () => {
  it('should include all action types that can be drafted', () => {
    const requiredIntents = ['calendar', 'absence', 'expense', 'task', 'reminder', 'shopping', 'meal', 'note']
    for (const intent of requiredIntents) {
      expect(MEMORY_INTENTS).toContain(intent)
    }
  })
})
```

**Note:** `MEMORY_INTENTS` must be exported from `conversationMemory.js`. If it's currently a private `const`, add an export.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: FAIL — MEMORY_INTENTS only has 3 entries, or is not exported

- [ ] **Step 3: Modify conversationMemory.js**

In `src/lib/brain/conversationMemory.js`, line 30:

```javascript
// BEFORE:
const MEMORY_INTENTS = ['calendar', 'absence', 'expense']

// AFTER:
export const MEMORY_INTENTS = ['calendar', 'absence', 'expense', 'task', 'reminder', 'shopping', 'meal', 'note']
```

If `MEMORY_INTENTS` was already used elsewhere with a non-exported `const`, ensure all internal references still work after adding `export`.

- [ ] **Step 4: Fix duplicate MEMORY_INTENTS in index.js (C2b)**

`src/lib/brain/index.js` has its own copy at line 48: `const MEMORY_INTENTS = ['calendar', 'absence', 'expense']` used at line 309. Replace with an import:

```javascript
// BEFORE (line 48):
const MEMORY_INTENTS = ['calendar', 'absence', 'expense']

// AFTER (line 48):
import { MEMORY_INTENTS } from './conversationMemory.js'
// Delete the local const — use the single source of truth
```

If `index.js` already has imports from `conversationMemory.js`, add `MEMORY_INTENTS` to the existing import destructure.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: All tests PASS

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/brain/conversationMemory.js src/lib/brain/index.js src/lib/brain/__tests__/commitEvaluator.test.js
git commit -m "feat(brain): C2 — expand MEMORY_INTENTS, export it, remove duplicate in index.js"
```

---

## Chunk 2: Core Evaluator Module — Reason Codes, Helpers, Lighter Path (Rules 13-15)

### Task 3: Create commitEvaluator.js with constants, helpers, and lighter-path rules

**Files:**
- Create: `src/lib/brain/commitEvaluator.js`

This task creates the module skeleton with: reason codes, commit level constants, the `evaluateCommitPolicy()` and `evaluateSingleAction()` entry points, and the lighter-path rules (13-15: reminder, note, edit_action) that return early before the full rule engine.

- [ ] **Step 1: Write tests for reason codes, lighter-path rules (13-15), and sentinel**

Append to `src/lib/brain/__tests__/commitEvaluator.test.js`:

```javascript
import { evaluateCommitPolicy, evaluateSingleAction, REASON_CODES } from '../commitEvaluator.js'

const MEMBERS = [
  { id: 'mem_cristian', name: 'Cristian', role: 'genitore', gender: 'M' },
  { id: 'mem_chiara', name: 'Chiara', role: 'genitore', gender: 'F' },
  { id: 'mem_viola', name: 'Viola', role: 'figlio', gender: 'F' },
  { id: 'mem_asia', name: 'Asia', role: 'figlio', gender: 'F' },
]

const BASE_CTX = {
  speakerRole: 'genitore',
  speakerId: 'mem_cristian',
  speakerName: 'Cristian',
  members: MEMBERS,
}

const baseMeta = {
  utteranceRef: 'u_test_001',
  actionRef: 'a_0',
  pipelinePath: 'l0_calendar',
  usedAI: false,
}

describe('Commit Evaluator — Constants', () => {
  it('should export all documented reason codes', () => {
    expect(REASON_CODES.MINOR_LOGISTICS_UNRESOLVED).toBe('MINOR_LOGISTICS_UNRESOLVED')
    expect(REASON_CODES.NO_TEMPORAL_CONTEXT).toBe('NO_TEMPORAL_CONTEXT')
    expect(REASON_CODES.PARTIAL_TEMPORAL_CONTEXT).toBe('PARTIAL_TEMPORAL_CONTEXT')
    expect(REASON_CODES.SPEAKER_AUTO_ASSIGNED).toBe('SPEAKER_AUTO_ASSIGNED')
    expect(REASON_CODES.AMBIGUOUS_SUBJECT).toBe('AMBIGUOUS_SUBJECT')
    expect(REASON_CODES.EVALUATED_POST_NORMALIZE).toBe('EVALUATED_POST_NORMALIZE')
  })
})

describe('Commit Evaluator — Sentinel marker', () => {
  it('should append EVALUATED_POST_NORMALIZE to every action', () => {
    const action = {
      type: 'task',
      title: 'Comprare latte',
      assignedToId: 'mem_cristian',
      assignedToName: 'Cristian',
      dueDate: null,
      category: null,
      textOriginal: 'devo comprare latte',
      confidence: 0.88,
      meta: baseMeta,
    }
    const result = evaluateSingleAction(action, BASE_CTX)
    expect(result.commit).toBeDefined()
    expect(result.commit.reasonCodes).toContain('EVALUATED_POST_NORMALIZE')
  })
})

describe('Commit Evaluator — Rule 13: Reminder (lighter path)', () => {
  it('should evaluate reminder as commit_light with no rule engine', () => {
    const action = {
      type: 'reminder',
      title: 'Ricordami di chiamare il pediatra',
      assignedToId: 'mem_cristian',
      assignedToName: 'Cristian',
      dueDate: null,
      category: 'promemoria',
      textOriginal: 'ricordami di chiamare il pediatra',
      confidence: 0.85,
      meta: baseMeta,
    }
    const result = evaluateSingleAction(action, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.writePolicy).toBe('commit_light')
    expect(result.commit.previewType).toBe('task')
    expect(result.commit.canConfirm).toBe(true)
    expect(result.commit.canWrite).toBe(true)
  })
})

describe('Commit Evaluator — Rule 14: Note (lighter path)', () => {
  it('should evaluate note as commit_strong', () => {
    const action = {
      type: 'note',
      title: 'Asia ha avuto febbre ieri',
      text: 'Asia ha avuto febbre ieri',
      textOriginal: 'Asia ha avuto febbre ieri',
      confidence: 0.80,
      meta: baseMeta,
    }
    const result = evaluateSingleAction(action, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.writePolicy).toBe('commit_strong')
    expect(result.commit.canConfirm).toBe(true)
  })
})

describe('Commit Evaluator — Rule 15: Edit action (lighter path)', () => {
  it('should evaluate edit_action as commit_strong passthrough', () => {
    const action = {
      type: 'edit_action',
      editType: 'cancel',
      targetType: 'calendar',
      targetRef: 'a_0',
      textOriginal: 'cancella danza domani',
      confidence: 0.90,
      meta: baseMeta,
    }
    const result = evaluateSingleAction(action, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.writePolicy).toBe('commit_strong')
  })
})

describe('Commit Evaluator — Batch evaluation', () => {
  it('should evaluate multiple actions independently', () => {
    const actions = [
      {
        type: 'reminder',
        title: 'Reminder 1',
        textOriginal: 'ricordami cosa',
        confidence: 0.85,
        meta: { ...baseMeta, actionRef: 'a_0' },
      },
      {
        type: 'note',
        title: 'Note 1',
        text: 'nota',
        textOriginal: 'nota importante',
        confidence: 0.80,
        meta: { ...baseMeta, actionRef: 'a_1' },
      },
    ]
    const results = evaluateCommitPolicy(actions, BASE_CTX)
    expect(results).toHaveLength(2)
    expect(results[0].commit.level).toBe('light')  // reminder
    expect(results[1].commit.level).toBe('strong')  // note
    // Both should have sentinel
    expect(results[0].commit.reasonCodes).toContain('EVALUATED_POST_NORMALIZE')
    expect(results[1].commit.reasonCodes).toContain('EVALUATED_POST_NORMALIZE')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: FAIL — module does not exist yet

- [ ] **Step 3: Create commitEvaluator.js with skeleton + lighter path**

Create `src/lib/brain/commitEvaluator.js`:

```javascript
/**
 * commitEvaluator.js — Commit safety classification layer.
 *
 * Position: after normalizer/validator, before preview.
 * Attaches `action.commit` with level, writePolicy, reasonCodes, previewType.
 *
 * @module brain/commitEvaluator
 * @see docs/superpowers/specs/2026-03-20-commit-evaluator-design.md
 */

// ─── REASON CODES ──────────────────────────────────────────────

export const REASON_CODES = Object.freeze({
  // Logistics (minors)
  MINOR_LOGISTICS_UNRESOLVED: 'MINOR_LOGISTICS_UNRESOLVED',
  MISSING_PICKUP_PLAN: 'MISSING_PICKUP_PLAN',
  // Temporal
  NO_TEMPORAL_CONTEXT: 'NO_TEMPORAL_CONTEXT',
  PARTIAL_TEMPORAL_CONTEXT: 'PARTIAL_TEMPORAL_CONTEXT',
  // Assignment
  MISSING_ASSIGNEE: 'MISSING_ASSIGNEE',
  SPEAKER_AUTO_ASSIGNED: 'SPEAKER_AUTO_ASSIGNED',
  AMBIGUOUS_SUBJECT: 'AMBIGUOUS_SUBJECT',
  IMPERSONAL_NO_CONTEXT: 'IMPERSONAL_NO_CONTEXT',
  // Type
  SELF_INTENT_NO_EXTERNAL: 'SELF_INTENT_NO_EXTERNAL',
  EXPENSE_MISSING_AMOUNT: 'EXPENSE_MISSING_AMOUNT',
  UNKNOWN_TYPE_DEFAULTED: 'UNKNOWN_TYPE_DEFAULTED',
  // Metadata
  EVALUATED_POST_NORMALIZE: 'EVALUATED_POST_NORMALIZE',
})

// ─── COMMIT RESULT BUILDER ─────────────────────────────────────

/**
 * Build a commit evaluation result object.
 * @param {'strong'|'light'|'draft'|'none'} level
 * @param {string} previewType
 * @param {Object} [opts]
 * @returns {import('../../docs/superpowers/specs/2026-03-20-commit-evaluator-design.md').CommitEvaluation}
 */
function buildCommit(level, previewType, opts = {}) {
  const POLICY_MAP = { strong: 'commit_strong', light: 'commit_light', draft: 'draft_only', none: 'block' }
  const writePolicy = POLICY_MAP[level]
  const canConfirm = writePolicy !== 'block'
  const canWrite = writePolicy === 'commit_strong' || writePolicy === 'commit_light'

  return {
    level,
    previewType,
    writePolicy,
    missingFields: opts.missingFields || [],
    reasonCodes: [...(opts.reasonCodes || []), REASON_CODES.EVALUATED_POST_NORMALIZE],
    uiBadges: opts.uiBadges || [],
    canConfirm,
    canWrite,
  }
}

// ─── HELPERS ───────────────────────────────────────────────────

/** Check if a member role is a minor (policy v1: figlio = minor). */
function isMinor(role) {
  return role === 'figlio'
}

/** Find a member by ID in the context members list. */
function findMember(memberId, members) {
  if (!memberId || !members) return null
  return members.find(m => m.id === memberId) || null
}

/** Check if action has a valid date string. */
function hasDate(action) {
  return action.date && typeof action.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(action.date)
}

/** Check if action has a valid time. */
function hasTime(action) {
  return !!(action.timeStart && action.timeStart !== '')
}

/** Check if calendar action has full logistics (both drop-off AND pickup). */
function hasFullLogistics(action) {
  const l = action.logistics
  if (!l) return false
  const hasAccompanied = !!(l.accompaniedById || l.accompaniedByName)
  const hasPickup = !!(l.pickupById || l.pickupByName)
  return hasAccompanied && hasPickup
}

/** Check if calendar action has any logistics at all. */
function hasAnyLogistics(action) {
  const l = action.logistics
  if (!l) return false
  return !!(l.accompaniedById || l.accompaniedByName || l.pickupById || l.pickupByName)
}

// ─── LIGHTER PATH (Rules 13-15) ───────────────────────────────

/**
 * Types that bypass the full rule engine.
 * Returns commit evaluation or null if type needs full evaluation.
 */
function evaluateLighterPath(action) {
  switch (action.type) {
    case 'reminder':
      // Rule 13: reminders are light tasks
      return buildCommit('light', 'task')

    case 'note':
      // Rule 14: notes are always committable if validator approved
      return buildCommit('strong', 'task')

    case 'edit_action':
      // Rule 15: edit actions go through the Resolver, evaluator is passthrough
      return buildCommit('strong', action.previewType || action.type)

    case 'absence':
      // Absences are calendar-like, always committable if validator approved
      return buildCommit('strong', 'event')

    default:
      return null  // needs full evaluation
  }
}

// ─── FULL RULE ENGINE (placeholder — Tasks 4-6 will fill this) ─

function evaluateFullRules(action, ctx) {
  // Will be implemented in Tasks 4-6
  // Default: commit_light with UNKNOWN_TYPE_DEFAULTED
  return buildCommit('light', action.type, {
    reasonCodes: [REASON_CODES.UNKNOWN_TYPE_DEFAULTED],
  })
}

// ─── PUBLIC API ────────────────────────────────────────────────

/**
 * Evaluate a single action's commit policy.
 * MUTATES the input action by attaching `action.commit`. Returns the same object.
 * Tests use spread ({ ...action }) to avoid cross-test mutation; production relies on mutation.
 *
 * @param {Object} action - Canonical action from normalizer
 * @param {Object} ctx - Evaluation context { speakerRole, speakerId, speakerName, members }
 * @returns {Object} Same action with `.commit` attached
 */
export function evaluateSingleAction(action, ctx) {
  // Lighter path: reminder, note, edit_action
  const lighter = evaluateLighterPath(action)
  if (lighter) {
    action.commit = lighter
    return action
  }

  // Full rule engine
  action.commit = evaluateFullRules(action, ctx)
  return action
}

/**
 * Batch evaluation — enriches all canonical actions with commit policy.
 * Each action is evaluated independently (multi-action independence).
 *
 * @param {Object[]} actions - Array of canonical actions
 * @param {Object} ctx - Evaluation context
 * @returns {Object[]} Same actions array, each with `.commit` attached
 */
export function evaluateCommitPolicy(actions, ctx) {
  return actions.map(action => evaluateSingleAction(action, ctx))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: All tests PASS (constants, sentinel, rules 13-15, batch)

- [ ] **Step 5: Commit**

```bash
git add src/lib/brain/commitEvaluator.js src/lib/brain/__tests__/commitEvaluator.test.js
git commit -m "feat(brain): add commitEvaluator skeleton with reason codes, lighter path (rules 13-15)"
```

---

## Chunk 3: Event Rules (1-4 + sub-rules 1a/3a/3b)

### Task 4: Implement event evaluation rules

**Files:**
- Modify: `src/lib/brain/commitEvaluator.js` — replace `evaluateFullRules` placeholder for calendar type
- Test: `src/lib/brain/__tests__/commitEvaluator.test.js`

**Rules to implement:**
- Rule 1: Event, autonomous adult, date + time → strong
- Rule 1a: Autonomous adult, date but no time → light + PARTIAL_TEMPORAL_CONTEXT
- Rule 2: Event, minor, date + time + full logistics → strong
- Rule 3: Event, minor, date + time, incomplete logistics → light + MINOR_LOGISTICS_UNRESOLVED
- Rule 3a: Minor, date but no time, no logistics → light + PARTIAL_TEMPORAL_CONTEXT + MINOR_LOGISTICS_UNRESOLVED
- Rule 3b: Minor, date but no time, WITH logistics → light + PARTIAL_TEMPORAL_CONTEXT
- Rule 4: No temporal anchor at all → draft + NO_TEMPORAL_CONTEXT

- [ ] **Step 1: Write failing tests for all event rules**

Append to `src/lib/brain/__tests__/commitEvaluator.test.js`:

```javascript
describe('Commit Evaluator — Event Rules', () => {
  const calendarBase = {
    type: 'calendar',
    personIds: [],
    personNames: [],
    location: null,
    activity: null,
    category: 'altro',
    isAbsence: false,
    logistics: null,
    confidence: 0.88,
    meta: baseMeta,
  }

  // ── Rule 1: Autonomous adult + date + time → strong ──
  it('Rule 1: adult + date + time → commit_strong', () => {
    const action = {
      ...calendarBase,
      title: 'Riunione ufficio',
      date: '2026-03-21',
      timeStart: '09:00',
      timeEnd: null,
      personIds: ['mem_cristian'],
      personNames: ['Cristian'],
      textOriginal: 'domani riunione alle 9',
    }
    // Speaker is genitore (adult) — subject is themselves
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.writePolicy).toBe('commit_strong')
    expect(result.commit.previewType).toBe('event')
  })

  // ── Rule 1a: Adult + date, no time → light + PARTIAL_TEMPORAL ──
  it('Rule 1a: adult + date, no time → commit_light + PARTIAL_TEMPORAL_CONTEXT', () => {
    const action = {
      ...calendarBase,
      title: 'Riunione ufficio',
      date: '2026-03-21',
      timeStart: null,
      timeEnd: null,
      personIds: ['mem_cristian'],
      personNames: ['Cristian'],
      textOriginal: 'domani riunione',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.writePolicy).toBe('commit_light')
    expect(result.commit.previewType).toBe('event')
    expect(result.commit.reasonCodes).toContain('PARTIAL_TEMPORAL_CONTEXT')
    expect(result.commit.missingFields).toContain('timeStart')
  })

  // ── Rule 2: Minor + date + time + full logistics → strong ──
  it('Rule 2: minor + date + time + full logistics → commit_strong', () => {
    const action = {
      ...calendarBase,
      title: 'Danza Viola',
      date: '2026-03-21',
      timeStart: '17:00',
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      activity: 'danza',
      category: 'sport',
      textOriginal: 'domani viola ha danza alle 17 la porto io e la riprende chiara',
      logistics: {
        subjectId: 'mem_viola',
        subjectName: 'Viola',
        accompaniedById: 'mem_cristian',
        accompaniedByName: 'Cristian',
        pickupById: 'mem_chiara',
        pickupByName: 'Chiara',
        actionVerb: 'portare',
        needsDriver: true,
      },
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.writePolicy).toBe('commit_strong')
    expect(result.commit.previewType).toBe('event')
  })

  // ── Rule 3: Minor + date + time, incomplete logistics → light ──
  it('Rule 3: minor + date + time, no logistics → commit_light + MINOR_LOGISTICS_UNRESOLVED', () => {
    const action = {
      ...calendarBase,
      title: 'Danza Viola',
      date: '2026-03-21',
      timeStart: '17:30',
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      activity: 'danza',
      category: 'sport',
      textOriginal: 'domani viola ha danza alle 17:30',
      logistics: null,
    }
    // Viola is figlio → minor
    const ctxAsViola = { ...BASE_CTX }
    const result = evaluateSingleAction({ ...action }, ctxAsViola)
    expect(result.commit.level).toBe('light')
    expect(result.commit.writePolicy).toBe('commit_light')
    expect(result.commit.reasonCodes).toContain('MINOR_LOGISTICS_UNRESOLVED')
  })

  // ── Rule 3 variant: drop-off but no pickup → light + MISSING_PICKUP ──
  it('Rule 3 variant: minor + logistics with drop-off but no pickup → MISSING_PICKUP_PLAN', () => {
    const action = {
      ...calendarBase,
      title: 'Danza Viola',
      date: '2026-03-21',
      timeStart: '17:30',
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      activity: 'danza',
      category: 'sport',
      textOriginal: 'porto viola a danza domani alle 17:30',
      logistics: {
        subjectId: 'mem_viola',
        subjectName: 'Viola',
        accompaniedById: 'mem_cristian',
        accompaniedByName: 'Cristian',
        pickupById: null,
        pickupByName: null,
        actionVerb: 'portare',
        needsDriver: true,
      },
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.reasonCodes).toContain('MINOR_LOGISTICS_UNRESOLVED')
    expect(result.commit.reasonCodes).toContain('MISSING_PICKUP_PLAN')
  })

  // ── Rule 3a: Minor + date, no time, no logistics → light + PARTIAL + MINOR ──
  it('Rule 3a: minor + date, no time, no logistics → PARTIAL_TEMPORAL + MINOR_LOGISTICS', () => {
    const action = {
      ...calendarBase,
      title: 'Catechismo Viola',
      date: '2026-03-21',
      timeStart: null,
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      activity: 'catechismo',
      textOriginal: 'domani viola ha catechismo',
      logistics: null,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.reasonCodes).toContain('PARTIAL_TEMPORAL_CONTEXT')
    expect(result.commit.reasonCodes).toContain('MINOR_LOGISTICS_UNRESOLVED')
    expect(result.commit.missingFields).toContain('timeStart')
  })

  // ── Rule 3b: Minor + date, no time, WITH logistics → light + PARTIAL only ──
  it('Rule 3b: minor + date, no time, WITH full logistics → PARTIAL_TEMPORAL only', () => {
    const action = {
      ...calendarBase,
      title: 'Catechismo Viola',
      date: '2026-03-21',
      timeStart: null,
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      activity: 'catechismo',
      textOriginal: 'domani viola ha catechismo la porto e la riprendo',
      logistics: {
        subjectId: 'mem_viola',
        subjectName: 'Viola',
        accompaniedById: 'mem_cristian',
        accompaniedByName: 'Cristian',
        pickupById: 'mem_cristian',
        pickupByName: 'Cristian',
        actionVerb: 'portare',
        needsDriver: true,
      },
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.reasonCodes).toContain('PARTIAL_TEMPORAL_CONTEXT')
    expect(result.commit.reasonCodes).not.toContain('MINOR_LOGISTICS_UNRESOLVED')
    expect(result.commit.missingFields).toContain('timeStart')
  })

  // ── Rule 4: No temporal anchor → draft ──
  it('Rule 4: no date, no time → draft_only + NO_TEMPORAL_CONTEXT', () => {
    const action = {
      ...calendarBase,
      title: 'Catechismo',
      date: null,
      timeStart: null,
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      activity: 'catechismo',
      textOriginal: 'ho catechismo',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('draft')
    expect(result.commit.writePolicy).toBe('draft_only')
    expect(result.commit.previewType).toBe('draft_event')
    expect(result.commit.reasonCodes).toContain('NO_TEMPORAL_CONTEXT')
    expect(result.commit.canConfirm).toBe(true) // draft is still confirmable
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: FAIL — evaluateFullRules returns UNKNOWN_TYPE_DEFAULTED for all calendar actions

- [ ] **Step 3: Implement evaluateCalendar() in commitEvaluator.js**

Add to `src/lib/brain/commitEvaluator.js`, replacing the calendar path in `evaluateFullRules`:

```javascript
// ─── CALENDAR RULES (1-4 + sub-rules) ─────────────────────────

function evaluateCalendar(action, ctx) {
  const datePresent = hasDate(action)
  const timePresent = hasTime(action)

  // Rule 4: No temporal anchor at all → draft
  if (!datePresent) {
    return buildCommit('draft', 'draft_event', {
      reasonCodes: [REASON_CODES.NO_TEMPORAL_CONTEXT],
      missingFields: ['date', 'timeStart'],
      uiBadges: ['Bozza — manca quando'],
    })
  }

  // Date is present. Determine if subject is a minor.
  const subjectId = action.logistics?.subjectId || action.personIds?.[0] || ctx.speakerId
  const subjectMember = findMember(subjectId, ctx.members)
  const subjectIsMinor = subjectMember ? isMinor(subjectMember.role) : false

  const missingFields = []
  const reasonCodes = []
  const uiBadges = []

  // Time check
  if (!timePresent) {
    missingFields.push('timeStart')
    reasonCodes.push(REASON_CODES.PARTIAL_TEMPORAL_CONTEXT)
  }

  // Minor logistics check
  if (subjectIsMinor) {
    const fullLogistics = hasFullLogistics(action)
    const anyLogistics = hasAnyLogistics(action)

    if (!fullLogistics) {
      reasonCodes.push(REASON_CODES.MINOR_LOGISTICS_UNRESOLVED)
      if (anyLogistics && !hasFullLogistics(action)) {
        // Has drop-off but not pickup (or vice versa)
        reasonCodes.push(REASON_CODES.MISSING_PICKUP_PLAN)
      }
      uiBadges.push('Chi porta/riprende?')
    }

    // Rule 2: Minor + date + time + full logistics → strong
    if (timePresent && fullLogistics) {
      return buildCommit('strong', 'event', { reasonCodes, missingFields, uiBadges })
    }

    // Rule 3/3a/3b: Minor with incomplete info → light
    return buildCommit('light', 'event', { reasonCodes, missingFields, uiBadges })
  }

  // Adult path
  // Rule 1: Adult + date + time → strong
  if (timePresent) {
    return buildCommit('strong', 'event', { reasonCodes, missingFields, uiBadges })
  }

  // Rule 1a: Adult + date, no time → light
  return buildCommit('light', 'event', { reasonCodes, missingFields, uiBadges })
}
```

Update `evaluateFullRules` to dispatch to `evaluateCalendar`:

```javascript
function evaluateFullRules(action, ctx) {
  switch (action.type) {
    case 'calendar':
      return evaluateCalendar(action, ctx)
    // Tasks 5-6 will add more cases here
    default:
      return buildCommit('light', action.type || 'unresolved', {
        reasonCodes: [REASON_CODES.UNKNOWN_TYPE_DEFAULTED],
      })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: All event rule tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/brain/commitEvaluator.js src/lib/brain/__tests__/commitEvaluator.test.js
git commit -m "feat(brain): add event rules (1-4 + sub-rules) to commit evaluator"
```

---

## Chunk 4: Task Rules (5-8) + Other Types (9-12)

### Task 5: Implement task evaluation rules (5-8)

**Files:**
- Modify: `src/lib/brain/commitEvaluator.js`
- Test: `src/lib/brain/__tests__/commitEvaluator.test.js`

- [ ] **Step 1: Write failing tests for task rules**

Append to test file:

```javascript
describe('Commit Evaluator — Task Rules', () => {
  const taskBase = {
    type: 'task',
    dueDate: null,
    category: null,
    linkedEntity: null,
    confidence: 0.88,
    meta: baseMeta,
  }

  // ── Rule 5: Explicit assignee + clear action → strong ──
  it('Rule 5: task with explicit assignee → commit_strong', () => {
    const action = {
      ...taskBase,
      title: 'Portare Viola a danza',
      assignedToId: 'mem_chiara',
      assignedToName: 'Chiara',
      textOriginal: 'Chiara porta Viola a danza',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.writePolicy).toBe('commit_strong')
    expect(result.commit.previewType).toBe('task')
  })

  // ── Rule 6: 1st person + strong ownership → light + SPEAKER_AUTO_ASSIGNED ──
  it('Rule 6: "devo fare X" → commit_light + SPEAKER_AUTO_ASSIGNED', () => {
    const action = {
      ...taskBase,
      title: 'Fare la lavatrice',
      assignedToId: 'mem_cristian',
      assignedToName: 'Cristian',
      textOriginal: 'devo fare la lavatrice',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.writePolicy).toBe('commit_light')
    expect(result.commit.previewType).toBe('task')
    expect(result.commit.reasonCodes).toContain('SPEAKER_AUTO_ASSIGNED')
  })

  // ── Rule 7: Personal need, 1st person, no external target → self_reminder ──
  it('Rule 7: "devo comprare libri" → commit_light + self_reminder', () => {
    const action = {
      ...taskBase,
      title: 'Comprare libri',
      assignedToId: 'mem_cristian',
      assignedToName: 'Cristian',
      textOriginal: 'devo comprare i libri',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.previewType).toBe('self_reminder')
    expect(result.commit.reasonCodes).toContain('SELF_INTENT_NO_EXTERNAL')
  })

  // ── Rule 8: Impersonal, no context → block ──
  it('Rule 8: "prenota dentista" (bare imperative) → block', () => {
    const action = {
      ...taskBase,
      title: 'Prenota dentista',
      assignedToId: null,
      assignedToName: null,
      textOriginal: 'prenota dentista',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('none')
    expect(result.commit.writePolicy).toBe('block')
    expect(result.commit.previewType).toBe('unresolved')
    expect(result.commit.reasonCodes).toContain('AMBIGUOUS_SUBJECT')
    expect(result.commit.canConfirm).toBe(false)
  })

  // ── Rule 6 negative: bare infinitive should NOT auto-assign ──
  it('Rule 6 negative: "comprare libri per Viola" (bare infinitive) → block', () => {
    const action = {
      ...taskBase,
      title: 'Comprare libri per Viola',
      assignedToId: null,
      assignedToName: null,
      textOriginal: 'comprare libri per Viola',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('none')
    expect(result.commit.writePolicy).toBe('block')
  })

  // ── Rule 6/7 edge cases: ownership heuristic boundaries ──
  it('Rule 6 edge: "mi tocca pagare la bolletta" → commit_light + SPEAKER_AUTO_ASSIGNED', () => {
    const action = {
      ...taskBase,
      title: 'Pagare la bolletta',
      assignedToId: 'mem_cristian',
      assignedToName: 'Cristian',
      textOriginal: 'mi tocca pagare la bolletta',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    // "mi tocca" is ownership signal but "pagare bolletta" is not isPersonalNeed → Rule 6
    expect(result.commit.reasonCodes).toContain('SPEAKER_AUTO_ASSIGNED')
  })

  it('Rule 7 edge: "devo prendere le medicine" → self_reminder', () => {
    const action = {
      ...taskBase,
      title: 'Prendere le medicine',
      assignedToId: 'mem_cristian',
      assignedToName: 'Cristian',
      textOriginal: 'devo prendere le medicine',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.previewType).toBe('self_reminder')
  })

  it('Rule 8 edge: "chiamare pediatra" (3rd person, no assignee) → block', () => {
    const action = {
      ...taskBase,
      title: 'Chiamare pediatra',
      assignedToId: null,
      assignedToName: null,
      textOriginal: 'chiamare pediatra',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('none')
    expect(result.commit.writePolicy).toBe('block')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: FAIL — task returns UNKNOWN_TYPE_DEFAULTED

- [ ] **Step 3: Implement evaluateTask() in commitEvaluator.js**

Add to `src/lib/brain/commitEvaluator.js`:

```javascript
// ─── TASK RULES (5-8) ─────────────────────────────────────────

/** Strong ownership signals in Italian — 1st person verbs and self-references. */
const OWNERSHIP_PATTERNS = [
  /\b(?:devo|ho\s+da|mi\s+tocca|voglio|devo\s+io)\b/i,
  /\bricordami\b/i,
]

/** Check if the text has a strong first-person ownership signal. */
function hasStrongOwnership(text) {
  if (!text) return false
  return OWNERSHIP_PATTERNS.some(re => re.test(text))
}

/**
 * Detect if a task is a personal need (buying things for self, personal errands)
 * vs. a structured task with external target.
 * Personal needs: "devo comprare X", "devo prendere X", "mi serve X"
 */
function isPersonalNeed(text) {
  if (!text) return false
  const lower = text.toLowerCase()
  return /\b(?:devo\s+comprare|devo\s+prendere|mi\s+serve|mi\s+servono|ho\s+bisogno)\b/i.test(lower)
}

function evaluateTask(action, ctx) {
  const hasAssignee = !!(action.assignedToId)
  const text = action.textOriginal || ''
  const strongOwnership = hasStrongOwnership(text)

  // Rule 5: Explicit assignee + clear action → strong
  // "Explicit" means assignee was set by the parser/normalizer from the phrase,
  // AND the assignee is different from speaker OR was explicitly named.
  if (hasAssignee && !strongOwnership) {
    // Assignee was explicitly mentioned in phrase
    return buildCommit('strong', 'task')
  }

  // Rule 6/7: Speaker with ownership signal
  if (hasAssignee && strongOwnership) {
    // Rule 7: Personal need → self_reminder
    if (isPersonalNeed(text)) {
      return buildCommit('light', 'self_reminder', {
        reasonCodes: [REASON_CODES.SELF_INTENT_NO_EXTERNAL],
      })
    }

    // Rule 6: Strong ownership, auto-assigned to speaker → light task
    if (action.assignedToId === ctx.speakerId) {
      return buildCommit('light', 'task', {
        reasonCodes: [REASON_CODES.SPEAKER_AUTO_ASSIGNED],
      })
    }

    // Ownership signal + explicit other assignee → strong
    return buildCommit('strong', 'task')
  }

  // Rule 8: No assignee, no ownership → block (impersonal/ambiguous)
  return buildCommit('none', 'unresolved', {
    reasonCodes: [REASON_CODES.AMBIGUOUS_SUBJECT, REASON_CODES.IMPERSONAL_NO_CONTEXT],
    uiBadges: ['Chi deve farlo?'],
  })
}
```

Update `evaluateFullRules`:

```javascript
function evaluateFullRules(action, ctx) {
  switch (action.type) {
    case 'calendar':
      return evaluateCalendar(action, ctx)
    case 'task':
      return evaluateTask(action, ctx)
    default:
      return buildCommit('light', action.type || 'unresolved', {
        reasonCodes: [REASON_CODES.UNKNOWN_TYPE_DEFAULTED],
      })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: All task rule tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/brain/commitEvaluator.js src/lib/brain/__tests__/commitEvaluator.test.js
git commit -m "feat(brain): add task rules (5-8) to commit evaluator"
```

---

### Task 6: Implement other-type rules (9-12) + unknown default

**Files:**
- Modify: `src/lib/brain/commitEvaluator.js`
- Test: `src/lib/brain/__tests__/commitEvaluator.test.js`

- [ ] **Step 1: Write failing tests for rules 9-12**

Append to test file:

```javascript
describe('Commit Evaluator — Other Types (Rules 9-12)', () => {
  // ── Rule 9: Expense with amount > 0 → strong ──
  it('Rule 9: expense with amount → commit_strong', () => {
    const action = {
      type: 'expense',
      title: 'Spesa Conad',
      amount: 45.50,
      date: '2026-03-20',
      category: 'spesa',
      personIds: [],
      personNames: [],
      textOriginal: 'spesa conad 45 euro',
      confidence: 0.90,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.previewType).toBe('expense')
  })

  it('Rule 9 edge: expense with amount 0 → light + EXPENSE_MISSING_AMOUNT', () => {
    const action = {
      type: 'expense',
      title: 'Spesa',
      amount: 0,
      date: '2026-03-20',
      category: 'spesa',
      personIds: [],
      personNames: [],
      textOriginal: 'spesa conad',
      confidence: 0.85,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.reasonCodes).toContain('EXPENSE_MISSING_AMOUNT')
  })

  // ── Rule 10: Meal with dish → strong ──
  it('Rule 10: meal with dish → commit_strong', () => {
    const action = {
      type: 'meal',
      title: 'Pasta al pomodoro',
      date: '2026-03-20',
      slot: 'cena',
      personIds: [],
      personNames: [],
      textOriginal: 'stasera pasta al pomodoro',
      confidence: 0.88,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.previewType).toBe('meal')
  })

  // ── Rule 11: Shopping with grocery context → strong ──
  it('Rule 11: shopping with grocery items → commit_strong', () => {
    const action = {
      type: 'shopping',
      title: 'Pannolini e latte',
      personIds: [],
      personNames: [],
      textOriginal: 'servono pannolini e latte',
      confidence: 0.88,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.previewType).toBe('shopping')
  })

  // ── Rule 12: Child expressing material need → self_reminder ──
  it('Rule 12: child "mi servono le scarpe da danza" → commit_light + self_reminder', () => {
    const action = {
      type: 'shopping',
      title: 'Scarpe da danza',
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      textOriginal: 'mi servono le scarpe da danza',
      confidence: 0.85,
      meta: baseMeta,
    }
    const childCtx = {
      ...BASE_CTX,
      speakerRole: 'figlio',
      speakerId: 'mem_viola',
      speakerName: 'Viola',
    }
    const result = evaluateSingleAction({ ...action }, childCtx)
    expect(result.commit.level).toBe('light')
    expect(result.commit.previewType).toBe('self_reminder')
    expect(result.commit.reasonCodes).toContain('SELF_INTENT_NO_EXTERNAL')
  })

  // ── Unknown type → commit_light + UNKNOWN_TYPE_DEFAULTED ──
  it('Unknown type → commit_light + UNKNOWN_TYPE_DEFAULTED', () => {
    const action = {
      type: 'future_type',
      title: 'Something',
      textOriginal: 'qualcosa di nuovo',
      confidence: 0.80,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.reasonCodes).toContain('UNKNOWN_TYPE_DEFAULTED')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: FAIL — expense/meal/shopping all hit UNKNOWN_TYPE_DEFAULTED

- [ ] **Step 3: Implement evaluateExpense, evaluateMeal, evaluateShopping**

Add to `src/lib/brain/commitEvaluator.js`:

```javascript
// ─── EXPENSE RULES (9) ────────────────────────────────────────

function evaluateExpense(action, _ctx) {
  if (typeof action.amount === 'number' && action.amount > 0) {
    return buildCommit('strong', 'expense')
  }
  return buildCommit('light', 'expense', {
    reasonCodes: [REASON_CODES.EXPENSE_MISSING_AMOUNT],
    missingFields: ['amount'],
    uiBadges: ['Manca importo'],
  })
}

// ─── MEAL RULES (10) ──────────────────────────────────────────

function evaluateMeal(action, _ctx) {
  // Meals are always strong if validator approved (they have a dish name)
  return buildCommit('strong', 'meal')
}

// ─── SHOPPING RULES (11-12) ───────────────────────────────────

function evaluateShopping(action, ctx) {
  // Rule 12: Child expressing material need → self_reminder
  if (isMinor(ctx.speakerRole)) {
    return buildCommit('light', 'self_reminder', {
      reasonCodes: [REASON_CODES.SELF_INTENT_NO_EXTERNAL],
    })
  }

  // Rule 11: Shopping with grocery context → strong
  // If the parser already classified this as shopping and speaker is adult,
  // it should have grocery context. Trust the parser's classification.
  return buildCommit('strong', 'shopping')
}
```

Update `evaluateFullRules`:

```javascript
function evaluateFullRules(action, ctx) {
  switch (action.type) {
    case 'calendar':
      return evaluateCalendar(action, ctx)
    case 'task':
      return evaluateTask(action, ctx)
    case 'expense':
      return evaluateExpense(action, ctx)
    case 'meal':
      return evaluateMeal(action, ctx)
    case 'shopping':
      return evaluateShopping(action, ctx)
    default:
      return buildCommit('light', action.type || 'unresolved', {
        reasonCodes: [REASON_CODES.UNKNOWN_TYPE_DEFAULTED],
      })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/brain/commitEvaluator.js src/lib/brain/__tests__/commitEvaluator.test.js
git commit -m "feat(brain): add expense, meal, shopping rules (9-12) to commit evaluator"
```

---

## Chunk 5: Write Guard (canWrite)

### Task 7: Implement canWrite() write guard

**Files:**
- Modify: `src/lib/brain/commitEvaluator.js`
- Test: `src/lib/brain/__tests__/commitEvaluator.test.js`

The write guard does NOT trust `action.commit.canWrite`. It recalculates from `writePolicy` + real field state. It's a defense-in-depth layer.

- [ ] **Step 1: Write failing tests for canWrite()**

Append to test file:

```javascript
import { canWrite } from '../commitEvaluator.js'

describe('Commit Evaluator — Write Guard (canWrite)', () => {
  it('should route commit_strong → target: strong', () => {
    const action = {
      type: 'calendar',
      date: '2026-03-21',
      timeStart: '09:00',
      commit: { level: 'strong', writePolicy: 'commit_strong', canWrite: true },
    }
    const result = canWrite(action)
    expect(result.target).toBe('strong')
    expect(result.reasons).toEqual([])
  })

  it('should route commit_light → target: light', () => {
    const action = {
      type: 'calendar',
      date: '2026-03-21',
      timeStart: null,
      commit: { level: 'light', writePolicy: 'commit_light', canWrite: true },
    }
    const result = canWrite(action)
    expect(result.target).toBe('light')
    expect(result.reasons).toEqual([])
  })

  it('should route draft_only → target: draft', () => {
    const action = {
      type: 'calendar',
      date: null,
      commit: { level: 'draft', writePolicy: 'draft_only', canWrite: false },
    }
    const result = canWrite(action)
    expect(result.target).toBe('draft')
    expect(result.reasons).toEqual([])
  })

  it('should route block → target: block', () => {
    const action = {
      type: 'task',
      commit: { level: 'none', writePolicy: 'block', canWrite: false },
    }
    const result = canWrite(action)
    expect(result.target).toBe('block')
  })

  it('should degrade commit_strong to draft if calendar has no date', () => {
    const action = {
      type: 'calendar',
      date: null,
      timeStart: '09:00',
      commit: { level: 'strong', writePolicy: 'commit_strong', canWrite: true },
    }
    const result = canWrite(action)
    expect(result.target).toBe('draft')
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('should degrade commit_strong to draft if expense has amount 0', () => {
    const action = {
      type: 'expense',
      amount: 0,
      commit: { level: 'strong', writePolicy: 'commit_strong', canWrite: true },
    }
    const result = canWrite(action)
    expect(result.target).toBe('draft')
    expect(result.reasons).toContain('expense: amount must be > 0')
  })

  it('should handle action without commit (no evaluator ran) → block', () => {
    const action = { type: 'task', title: 'Something' }
    const result = canWrite(action)
    expect(result.target).toBe('block')
    expect(result.reasons).toContain('no commit evaluation found')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: FAIL — canWrite not exported yet

- [ ] **Step 3: Implement canWrite() in commitEvaluator.js**

Add to `src/lib/brain/commitEvaluator.js`:

```javascript
// ─── WRITE GUARD ───────────────────────────────────────────────

/**
 * Type-specific integrity checks for the write guard.
 * Returns array of failure reasons (empty = OK).
 */
function checkTypeIntegrity(action) {
  const reasons = []

  switch (action.type) {
    case 'calendar':
      if (!hasDate(action)) {
        reasons.push('calendar: date required for target table write')
      }
      break

    case 'expense':
      if (typeof action.amount !== 'number' || action.amount <= 0) {
        reasons.push('expense: amount must be > 0')
      }
      break

    case 'task':
      // Tasks can be written without assignee (light), so no hard check here
      break
  }

  return reasons
}

/**
 * Write guard — final safety check before DB write.
 * Does NOT trust action.commit.canWrite. Recalculates from writePolicy + real field state.
 *
 * @param {Object} action - Canonical action with .commit attached
 * @returns {{ target: 'strong'|'light'|'draft'|'block', reasons: string[] }}
 */
export function canWrite(action) {
  // No commit evaluation → block (safety)
  if (!action.commit) {
    return { target: 'block', reasons: ['no commit evaluation found'] }
  }

  const POLICY_TARGET = {
    commit_strong: 'strong',
    commit_light: 'light',
    draft_only: 'draft',
    block: 'block',
  }

  let target = POLICY_TARGET[action.commit.writePolicy] || 'block'
  const reasons = []

  // For strong/light writes, run type-specific integrity checks
  if (target === 'strong' || target === 'light') {
    const integrityIssues = checkTypeIntegrity(action)

    if (integrityIssues.length > 0) {
      reasons.push(...integrityIssues)

      // Degrade: strong → light → draft (never silently write broken record)
      // Critical failures force degradation to draft (can't survive as light either)
      const CRITICAL_PATTERNS = ['date required', 'amount must be']
      const criticalFailures = integrityIssues.filter(r =>
        CRITICAL_PATTERNS.some(p => r.includes(p))
      )

      if (criticalFailures.length > 0) {
        target = 'draft'  // critical integrity failure → can't write to target table
      } else if (target === 'strong') {
        target = 'light'  // non-critical → degrade to light
      }
    }
  }

  return { target, reasons }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/brain/commitEvaluator.js src/lib/brain/__tests__/commitEvaluator.test.js
git commit -m "feat(brain): add canWrite() write guard with defense-in-depth integrity checks"
```

---

## Chunk 6: Integration — intentClassifier.js + useBrain.js

### Task 8: Integrate evaluator into intentClassifier.js

**Files:**
- Modify: `src/lib/brain/intentClassifier.js:1361` (after `normalizeAndValidateActions()`)

- [ ] **Step 1: Write integration test**

Append to `src/lib/brain/__tests__/commitEvaluator.test.js`:

```javascript
describe('Commit Evaluator — Integration (parseLocally)', () => {
  // This test verifies that actions coming out of parseLocally have .commit attached.
  // It requires the real parser, so it's an integration test.
  it('should attach .commit to calendar action from parseLocally', async () => {
    // Dynamically import to avoid circular dependency issues in unit test context
    const { parseLocally } = await import('../intentClassifier.js')

    const MEMBERS_FULL = [
      { id: 'mem_cristian', name: 'Cristian', role: 'genitore', aliases: ['cri'] },
      { id: 'mem_viola', name: 'Viola', role: 'figlio', aliases: [] },
    ]

    const result = parseLocally(
      'domani Viola ha danza alle 17',
      MEMBERS_FULL,
      'fam_test',
      { id: 'mem_cristian', name: 'Cristian', role: 'genitore' }
    )

    expect(result.actions.length).toBeGreaterThanOrEqual(1)
    const calAction = result.actions.find(a => a.type === 'calendar')
    if (calAction) {
      expect(calAction.commit).toBeDefined()
      expect(calAction.commit.reasonCodes).toContain('EVALUATED_POST_NORMALIZE')
      expect(calAction.commit.level).toBeDefined()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: FAIL — `calAction.commit` is undefined (evaluator not wired yet)

- [ ] **Step 3: Modify intentClassifier.js**

In `src/lib/brain/intentClassifier.js`, add import at top:

```javascript
import { evaluateCommitPolicy } from './commitEvaluator.js'
```

After line 1361 (after `normalizeAndValidateActions`), insert:

```javascript
// ── Commit Evaluator: classify commit safety ──
const evalCtx = {
  speakerRole: currentMember?.role || 'genitore',
  speakerId: currentMember?.id || null,
  speakerName: currentMember?.name || null,
  members: normContext.members,
}
const enriched = evaluateCommitPolicy(canonical, evalCtx)
```

Then in the return statement near the end of `parseLocally`, replace the reference to `canonical` with `enriched`. Find where `canonical` is used in the return (look for `actions: canonical` or similar) and change to `actions: enriched`.

**Be careful:** The variable `canonical` may be referenced between line 1361 and the return. Only replace in the return statement — the intermediate logic should still work on the same array (since `evaluateCommitPolicy` mutates the actions by adding `.commit` and returns the same array references).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/brain/__tests__/commitEvaluator.test.js`
Expected: Integration test PASSES — `.commit` is now attached

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass. Existing tests should not break since `.commit` is additive.

- [ ] **Step 6: Commit**

```bash
git add src/lib/brain/intentClassifier.js src/lib/brain/__tests__/commitEvaluator.test.js
git commit -m "feat(brain): integrate evaluateCommitPolicy into intentClassifier parseLocally"
```

---

### Task 9: Integrate write guard into useBrain.js confirmActions()

**Files:**
- Modify: `src/hooks/useBrain.js:300-319` (inside confirmActions loop)

- [ ] **Step 1: Add imports to useBrain.js**

Add new import for the evaluator:

```javascript
import { canWrite } from '../lib/brain/commitEvaluator.js'
```

Modify the existing import at line 28 to add `createDraft`:

```javascript
// BEFORE (line 28):
import { expireOldDrafts } from '../lib/brain/conversationMemory.js'

// AFTER:
import { expireOldDrafts, createDraft } from '../lib/brain/conversationMemory.js'
```

- [ ] **Step 2: Modify the independent actions loop**

In `src/hooks/useBrain.js`, find the loop at lines ~300-319:

```javascript
// BEFORE (lines 300-319):
for (const action of independent) {
  try {
    const result = await executeAction(action)
    if (result) {
      log.push({ ok: true, msg: result.msg, type: action.type })
      if (result.record?.id && action.meta?.actionRef) {
        refToIdMap.set(action.meta.actionRef, result.record.id)
      }
    } else {
      log.push({ ok: false, msg: `${action.type}: tipo non riconosciuto`, type: action.type })
    }
  } catch (err) {
    console.error('[Brain] Action failed:', action.type, action.title, err)
    log.push({ ok: false, msg: `${action.type} fallito: ${err.message}`, type: action.type })
  }
}
```

Replace with:

```javascript
// AFTER — with write guard routing:
for (const action of independent) {
  try {
    const writeCheck = canWrite(action)

    // Block: do not persist anywhere
    if (writeCheck.target === 'block') {
      console.warn('[Brain] Action blocked:', action.type, writeCheck.reasons)
      log.push({ ok: false, target: 'block', msg: `Bloccato: ${writeCheck.reasons.join(', ')}`, type: action.type })
      continue
    }

    // Draft: route to conversationDrafts
    if (writeCheck.target === 'draft') {
      await createDraft({
        familyId,
        createdBy: currentMember?.id,
        intent: action.type,
        entities: action,
        parseResult: { actions: [action], confidence: action.confidence },
        inputText: action.textOriginal,
      })
      log.push({ ok: true, target: 'draft', msg: `Salvato come bozza: ${action.title || action.type}`, type: action.type })
      continue
    }

    // Strong or Light: proceed with normal DB write
    const result = await executeAction(action)
    if (result) {
      log.push({ ok: true, target: writeCheck.target, msg: result.msg, type: action.type })
      if (result.record?.id && action.meta?.actionRef) {
        refToIdMap.set(action.meta.actionRef, result.record.id)
      }
    } else {
      log.push({ ok: false, msg: `${action.type}: tipo non riconosciuto`, type: action.type })
    }
  } catch (err) {
    console.error('[Brain] Action failed:', action.type, action.title, err)
    log.push({ ok: false, msg: `${action.type} fallito: ${err.message}`, type: action.type })
  }
}
```

- [ ] **Step 3: Modify the dependent actions loop (lines ~322-353)**

In `src/hooks/useBrain.js`, find the `for (const action of dependent)` loop (lines 322-353) and replace with:

```javascript
for (const action of dependent) {
  // Resolve linked entity reference first (regardless of write check)
  if (action.linkedEntity?.tempRef) {
    const realId = refToIdMap.get(action.linkedEntity.tempRef)
    if (realId) {
      action.linkedEntity.realId = realId
    } else {
      console.warn(`[Brain] tempRef "${action.linkedEntity.tempRef}" non risolto — padre non persistito o non trovato`)
    }
  }

  try {
    const writeCheck = canWrite(action)

    if (writeCheck.target === 'block') {
      console.warn('[Brain] Dependent action blocked:', action.type, writeCheck.reasons)
      log.push({ ok: false, target: 'block', msg: `Bloccato: ${writeCheck.reasons.join(', ')}`, type: action.type, linked: false })
      continue
    }

    if (writeCheck.target === 'draft') {
      await createDraft({
        familyId,
        createdBy: currentMember?.id,
        intent: action.type,
        entities: action,
        parseResult: { actions: [action], confidence: action.confidence },
        inputText: action.textOriginal,
      })
      log.push({ ok: true, target: 'draft', msg: `Salvato come bozza: ${action.title || action.type}`, type: action.type, linked: false })
      continue
    }

    // Strong or Light: proceed with normal DB write
    console.log('[Brain] Executing dependent action:', action.type, action.title || action.text || '')
    const result = await executeAction(action)
    if (result) {
      if (result.record?.id && action.meta?.actionRef) {
        refToIdMap.set(action.meta.actionRef, result.record.id)
      }
      const linked = !!action.linkedEntity?.realId
      log.push({ ok: true, target: writeCheck.target, msg: result.msg, type: action.type, linked })
      if (!linked && action.linkedEntity) {
        log.push({ ok: true, msg: `⚠ ${action.type}: collegamento non risolto`, type: action.type, linked: false })
      }
    } else {
      console.warn('[Brain] executeAction (linked) returned null for:', action.type, action)
      log.push({ ok: false, msg: `${action.type}: tipo non riconosciuto`, type: action.type, linked: false })
    }
  } catch (err) {
    console.error('[Brain] Action (linked) failed:', action.type, action.title, err)
    log.push({ ok: false, msg: `${action.type} fallito: ${err.message}`, type: action.type, linked: false })
  }
}
```

**Key detail:** `linkedEntity` resolution happens BEFORE `canWrite()` because the linked reference should be resolved even if this action ends up being drafted or blocked (a future draft-promotion might need it). Blocked/drafted dependent actions do NOT break the chain — other dependents still run.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass. The write guard is additive — actions without `.commit` get blocked safely.

- [ ] **Step 5: Manual verification of write routing**

`useBrain.js` is a React hook with heavy dependencies (Dexie, auth store, React state). Full unit testing requires mocking the entire React + Dexie environment, which is out of scope for this task. Instead, verify the routing logic works through the existing integration tests:

1. Run the simulator: `cd simulator && node runner.js --weeks=1 --orchestrate`
2. Check `trajectories.json` for phrases that should now be drafted or blocked
3. Verify the write guard catches any date-less calendar actions that slipped through

The `canWrite()` function itself IS fully unit-tested (Task 7). The useBrain integration trusts that the unit-tested `canWrite()` returns correct targets.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useBrain.js
git commit -m "feat(brain): integrate canWrite() write guard + draft routing in confirmActions"
```

---

## Chunk 7: Orchestrator Update

### Task 10: Update orchestrator to trace commit evaluation

**Files:**
- Modify: `simulator/orchestrator.js`

- [ ] **Step 1: Add commit tracing to trajectory object**

In `simulator/orchestrator.js`, find the trajectory object construction (around line 365-391). Add commit-related fields:

```javascript
const trajectory = {
  // ... existing fields ...

  // Commit evaluation (NEW)
  commitLevel: result.actual?.actions?.[0]?.commit?.level || null,
  writePolicy: result.actual?.actions?.[0]?.commit?.writePolicy || null,
  commitReasonCodes: result.actual?.actions?.[0]?.commit?.reasonCodes || [],
  previewType: result.actual?.actions?.[0]?.commit?.previewType || null,

  // ... existing fields continue ...
}
```

**Note:** The actual commit data depends on how `executeBatch` returns action results. The commit evaluation is attached to each action as `action.commit`. Check how `phraseExecutor.js` exposes the parsed actions in `result.actual` — the commit info should flow through since it's on the action objects.

**v1 simplification:** For multi-action utterances, the trajectory captures only the first action's commit data. This is sufficient for the current report structure where each phrase maps to one trajectory row. A future version can expand this to an array of commit evaluations per trajectory.

- [ ] **Step 2: Update orchestrator-report.js to include commit stats**

In `simulator/orchestrator-report.js`, in `buildPipelineAccuracy()`, add commit level distribution:

```javascript
// After existing per-table breakdown, add commit level distribution:
const commitLevels = { strong: 0, light: 0, draft: 0, none: 0, missing: 0 }
for (const t of trajectories) {
  if (t.commitLevel) {
    commitLevels[t.commitLevel] = (commitLevels[t.commitLevel] || 0) + 1
  } else {
    commitLevels.missing++
  }
}
```

Add `commitLevelDistribution: commitLevels` to the return object.

In `printOrchestratorReport()`, add a line showing commit level distribution after the pipeline accuracy section.

- [ ] **Step 3: Run the simulator to verify no crash**

Run: `cd simulator && node runner.js --weeks=1 --orchestrate`
Expected: Completes without errors. Trajectories now include commitLevel fields (may be null until integration test runs through full pipeline).

- [ ] **Step 4: Commit**

```bash
git add simulator/orchestrator.js simulator/orchestrator-report.js
git commit -m "feat(simulator): trace commit evaluation in orchestrator trajectories"
```

---

## Chunk 8: Final Validation

### Task 11: Run full validation

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run simulator in standard mode**

Run: `cd simulator && node runner.js --weeks=1`
Expected: Completes without errors.

- [ ] **Step 3: Run simulator in orchestrate mode**

Run: `cd simulator && node runner.js --weeks=1 --orchestrate`
Expected: Completes, trajectories include commit data.

- [ ] **Step 4: Run 8-week orchestrate for full validation**

Run: `cd simulator && node runner.js --weeks=8 --orchestrate`
Expected: Completes. Check orchestrator-output.json for commit level distribution. Verify success criteria:
- Zero records in events without date
- "Ho catechismo" type phrases → draft level
- Minor events → MINOR_LOGISTICS_UNRESOLVED present

- [ ] **Step 5: Verify no uncommitted changes remain**

Run `git status` and commit any remaining changes from earlier tasks that were missed. Use specific file paths (not `git add -A`) to avoid staging unrelated files.
