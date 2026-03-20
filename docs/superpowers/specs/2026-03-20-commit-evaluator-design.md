# Commit Evaluator — Design Spec

**Date:** 2026-03-20
**Status:** Approved (v3 — post spec review + 5 user refinements)
**Scope:** New policy layer between normalizer and preview that classifies commit safety

## Problem

The parser classifies intent correctly ~90% of the time, but intent classification alone is insufficient for responsible DB writes. The system currently writes records with missing fields, creates calendar events without time/logistics, assigns tasks without assignees, and forces every phrase into a strong category when many phrases only warrant a light reminder or a draft.

**Core principle:** The system must not ask "what intent is this?" alone. It must ask: **"What is the safest, most honest record I can create without inventing facts?"**

## Architecture

### Pipeline Position

```
text
  -> parser (intentClassifier.js)
  -> normalizer (actionNormalizer.js)
  -> validator (actionValidator.js)
  -> COMMIT EVALUATOR (NEW)          <-- position A: before preview
  -> preview (BrainSheet.jsx)
  -> user confirm
  -> WRITE GUARD (NEW)               <-- position C: safety net before DB
  -> executeAction (useBrain.js)
  -> DB write
```

**Why this position:**
- Parser has finished — semantic type is known
- Normalizer has canonicalized — fields are in standard shape
- Validator has approved — shape is structurally valid
- Preview has NOT been shown — user sees the honest classification from the start

### New File

`src/lib/brain/commitEvaluator.js` — standalone module.

### Required Changes to Existing Files

1. **`intentClassifier.js`** — after the `normalizeAndValidateActions()` call: invoke `evaluateCommitPolicy()`
2. **`useBrain.js`** — inside `confirmActions()` loop, before each `executeAction()`: invoke `canWrite()`
3. **`actionValidator.js`** — relax `date` requirement for `calendar` actions from hard error to warning (see C1 below)
4. **`conversationMemory.js`** — expand `MEMORY_INTENTS` to include all action types (see C2 below)

### Prerequisite Changes (Critical)

**C1 — Validator must allow date-less calendar actions to reach the evaluator.**

Today, `actionValidator.js` hard-rejects calendar actions without a `date` field (line 159). But Rule 4 needs date-less event-like phrases ("ho catechismo") to survive validation so the evaluator can route them to `draft_only`.

The fix must be **selective, not a general loosening:**
- Change `date` from hard error to warning **only for `calendar` type actions**
- `expense` and `meal` date requirements stay as hard errors (they have no draft path today)
- The evaluator handles disposition (draft_only for date-less events)
- The write guard provides the final safety net — no date-less record ever reaches the events table

The principle: **"valid as minimum shape, not yet valid as strong commit."** The validator ensures structural minimum; the evaluator decides commit worthiness.

**C2 — Draft system must support all action types.**

Today, `conversationMemory.js` line 30 has `MEMORY_INTENTS = ['calendar', 'absence', 'expense']`. The evaluator may route any type to `draft_only` (tasks, shopping, etc.). The fix: expand `MEMORY_INTENTS` to `['calendar', 'absence', 'expense', 'task', 'reminder', 'shopping', 'meal', 'note']`.

### Exports

```javascript
// Batch evaluation — enriches canonical actions with commit policy
export function evaluateCommitPolicy(actions, ctx) → actions[]

// Single action evaluation — usable standalone
export function evaluateSingleAction(action, ctx) → action

// Write guard — final safety check (does NOT trust action.commit.canWrite)
export function canWrite(action) → { ok, target, reasons }
```

## Commit Levels

Four levels, clearly defined:

| Level | Meaning | Where it writes |
|-------|---------|-----------------|
| `strong` | Fully committable, all required info present | Target table (events, tasks, etc.) |
| `light` | Writable but explicitly incomplete, enrichable later | Target table, with `incomplete` field set |
| `draft` | Useful information but insufficient for any strong table | `conversationDrafts` table only |
| `none` | Too ambiguous, no honest record possible | Nowhere |

### commit_light Definition (explicit)

`commit_light` means: **write to the real target table, but with declared incompleteness and enrichable state.** It does NOT mean "almost draft" — it means the record exists and is useful, but has known gaps.

Examples:
- Calendar event with date but no time → written to `events` with `incomplete: "Manca l'orario"`
- Calendar event for a minor without logistics → written to `events` with `incomplete: "Chi porta/riprende?"`
- Task auto-assigned to speaker → written to `tasks` with reasonCode SPEAKER_AUTO_ASSIGNED

## Write Policies

| Policy | Behavior |
|--------|----------|
| `commit_strong` | Write to target table, no warnings |
| `commit_light` | Write to target table with incomplete flag |
| `draft_only` | Write to `conversationDrafts` via `createDraft()` |
| `block` | Do not persist anywhere |

### draft_only is a real write path

`draft_only` is NOT "do not write." It uses the existing `conversationDrafts` table which has:
- `status: 'draft'`
- `missing_fields[]`
- TTL (auto-expires)
- `updateDraft()` for enrichment
- Promotion path to strong record when completed

### canWrite() — Write Guard Behavior

The write guard resolves write disposition. It returns a **target** that tells the caller exactly where to route:

```javascript
canWrite(action) → {
  target: 'strong' | 'light' | 'draft' | 'block',
  reasons: string[]   // why degraded or blocked (empty if strong)
}
```

The caller uses `target` to decide routing — no boolean ambiguity:
- `target === 'strong'` or `'light'` → call `executeAction()` (writes to target table)
- `target === 'draft'` → call `createDraft()` (writes to conversationDrafts)
- `target === 'block'` → log and skip

Key rules:
- Does NOT trust `action.commit.canWrite` — recalculates from `writePolicy` + real field state
- Type-specific integrity checks run as safety net (expense needs amount > 0, event needs date for strong/light, etc.). These overlap with the validator intentionally — the write guard is a defense-in-depth layer, not the source of truth for structural validity
- If the evaluator said `commit_strong` but the write guard detects a missing required field, it degrades to `light` or `draft` (never silently writes a broken record)

## Evaluation Context

```javascript
ctx = {
  speakerRole: 'genitore' | 'figlio' | 'nonno',
  speakerId: string,
  speakerName: string,
  members: [{ id, name, role, gender }],
}
```

All data already available in `intentClassifier.js` normContext.

## Output Shape

Attached to each action as `action.commit`:

```javascript
/**
 * @typedef {Object} CommitEvaluation
 * @property {'strong'|'light'|'draft'|'none'} level
 * @property {string} previewType
 * @property {'commit_strong'|'commit_light'|'draft_only'|'block'} writePolicy
 * @property {string[]} missingFields
 * @property {string[]} reasonCodes
 * @property {string[]} uiBadges
 * @property {boolean} canConfirm
 * @property {boolean} canWrite     — UI indication only; write guard recalculates
 */
```

### previewType Rules

`previewType` is a presentation/commit view, NOT a replacement for `action.type`. It may diverge from `action.type` only in two documented cases:

1. **Honest degradation:** `calendar` type → `draft_event` previewType (event-like but not calendar-ready)
2. **Personal softening:** `task` type → `self_reminder` previewType (task-like but actually a personal need)

Valid previewType values: `event`, `task`, `self_reminder`, `draft_event`, `expense`, `meal`, `shopping`, `unresolved`

### canConfirm Rules

- `commit_strong` / `commit_light` / `draft_only` → `canConfirm: true`
- `block` → `canConfirm: false`

Rationale: if the system cannot write anywhere (not even draft), confirmation has no meaning. Show error badge + motivation + invite to rephrase.

## Definitions

### Minor vs. Autonomous Adult

For logistics purposes:
- `role === 'figlio'` → **minor** (not autonomous, needs escort for sport/school/medical events)
- `role === 'genitore'` or `role === 'nonno'` → **autonomous adult**

This is a **policy v1 decision**, not an ontological truth or age calculation. In the current family structure, all `figlio` members are minors. Future versions may introduce age-based or per-member autonomy flags, but v1 uses role as the sole discriminant. The evaluator reads `role` from context — changing the policy later means changing one check, not restructuring the rules.

### Multi-Action Utterances

When a single phrase produces multiple actions (e.g., "Domani Asia ha danza alle 17 e devo comprare i libri"), each action is evaluated independently. One action's commit level does not influence another's.

**Partial failure logging:** When a multi-action phrase produces mixed results (some actions succeed, some degrade or block), the confirmation log must reflect each action's outcome individually. Log entries use explicit categories:

```javascript
// Each action in a multi-action phrase gets its own log entry:
{ ok: true,  target: 'strong', msg: 'Evento creato: Danza Asia', type: 'calendar' }
{ ok: true,  target: 'draft',  msg: 'Salvato come bozza: Comprare libri', type: 'task' }
{ ok: false, target: 'block',  msg: 'Bloccato: AMBIGUOUS_SUBJECT', type: 'task' }
```

The user sees a per-action summary, not a single pass/fail for the whole phrase. This is critical for transparency: "your event was created, but the task was saved as a draft because..."

## The Rules

### Events

| # | Condition | level | previewType | writePolicy | reasonCodes |
|---|-----------|-------|-------------|-------------|-------------|
| 1 | Event, autonomous adult subject, date + time | strong | event | commit_strong | — |
| 2 | Event, minor subject, date + time + full logistics (drop-off AND pickup) | strong | event | commit_strong | — |
| 3 | Event, minor subject, date + time, but logistics incomplete | light | event | commit_light | MINOR_LOGISTICS_UNRESOLVED, MISSING_PICKUP_PLAN |
| 4 | Event-like but no sufficient temporal anchor | draft | draft_event | draft_only | NO_TEMPORAL_CONTEXT |

**Rule 4 — temporal anchor definition:**
"Sufficient temporal anchor" does NOT mean "date + time." It means a minimum useful temporal reference:
- "ho catechismo" → NO anchor → `draft_only` + NO_TEMPORAL_CONTEXT
- "domani catechismo" → partial anchor (date, no time) → `commit_light` + PARTIAL_TEMPORAL_CONTEXT
- "domani catechismo alle 15" → full anchor → `commit_strong`

So rule 4 applies only when there is NO temporal reference at all. Partial temporal context triggers sub-rules:

**Sub-rule 1a/3a — Event with date but no time (PARTIAL_TEMPORAL_CONTEXT):**

These sub-rules are the **direct consequence** of the temporal anchor definition above. When the evaluator detects a date but no time, it applies PARTIAL_TEMPORAL_CONTEXT and degrades the commit level to `light`:

- **1a:** Autonomous adult + date, no time → `commit_light` + PARTIAL_TEMPORAL_CONTEXT + `incomplete: "Manca l'orario"`
- **3a:** Minor + date, no time, no logistics → `commit_light` + PARTIAL_TEMPORAL_CONTEXT + MINOR_LOGISTICS_UNRESOLVED + `incomplete: "Manca l'orario"`
- **3b:** Minor + date, no time, WITH logistics → `commit_light` + PARTIAL_TEMPORAL_CONTEXT + `incomplete: "Manca l'orario"`

These are not new rules — they are the light-commit variant of rules 1 and 3 when time is absent but date is present. The reason code PARTIAL_TEMPORAL_CONTEXT is the link: it tells both the preview and the write guard exactly why the level was degraded.

### Tasks

| # | Condition | level | previewType | writePolicy | reasonCodes |
|---|-----------|-------|-------------|-------------|-------------|
| 5 | Task with explicit assignee + clear action | strong | task | commit_strong | — |
| 6 | Task in 1st person ("devo fare X") without explicit assignee, speaker is adult with strong ownership signal | light | task | commit_light | SPEAKER_AUTO_ASSIGNED |
| 7 | Personal need in 1st person, no external target ("devo comprare libri") | light | self_reminder | commit_light | SELF_INTENT_NO_EXTERNAL |
| 8 | Impersonal action without context ("prenota dentista", "comprare libri") | none | unresolved | block | AMBIGUOUS_SUBJECT, IMPERSONAL_NO_CONTEXT |

**Rule 6 — strong ownership signals:**
Auto-assign to speaker ONLY when:
- 1st person verb: "devo", "ho da", "mi tocca", "voglio"
- Explicit self-reference: "ricordami", "devo io"

Do NOT auto-assign on:
- Bare imperative: "prenota dentista"
- Bare infinitive: "comprare libri per Viola"
- 3rd person: "chiamare pediatra"

### Other Types

| # | Condition | level | previewType | writePolicy | reasonCodes |
|---|-----------|-------|-------------|-------------|-------------|
| 9 | Expense with amount > 0 | strong | expense | commit_strong | — |
| 10 | Meal with identifiable dish | strong | meal | commit_strong | — |
| 11 | Shopping with explicit grocery context (store/list/consumables, NOT personal needs) | strong | shopping | commit_strong | — |
| 12 | Child expressing material need ("mi servono le scarpe da danza") | light | self_reminder | commit_light | SELF_INTENT_NO_EXTERNAL |

**Rule 11 — shopping strictness:**
Classify as shopping ONLY when:
- Lista/spesa vocabulary present
- Supermarket/store context
- Consumable items (food, household supplies)
- Absence of personal task structure

"Devo comprare i libri" → rule 7 (self_reminder), NOT rule 11 (shopping)
"Servono pannolini e latte" → rule 11 (shopping)

### Default Rules for Other Types (Lighter Path)

These types follow a **simplified evaluation path** — they don't need the full rule engine because their commit disposition is predictable from type alone. The evaluator still attaches `action.commit` for pipeline consistency, but the logic is a direct mapping, not a multi-condition evaluation:

| # | Type | Default level | previewType | writePolicy | Notes |
|---|------|---------------|-------------|-------------|-------|
| 13 | `reminder` | light | task | commit_light | Reminders are treated as light tasks. `needsConfirm` flag already exists and is preserved. No rule engine needed — type alone determines disposition. |
| 14 | `note` | strong | task | commit_strong | Notes are informational, always committable if validator approved. Passthrough — evaluator stamps commit but applies no conditions. |
| 15 | `edit_action` | strong | (pass-through) | commit_strong | Edit actions go through the Resolver, not the evaluator's rules. The evaluator adds `action.commit` with `level: 'strong'` and lets the Resolver handle disposition. Evaluator is a passthrough here. |

**Implementation note:** In code, rules 13-15 should be a simple `switch` at the top of `evaluateSingleAction()`, returning early before the full rule engine runs. This keeps the hot path fast and makes it obvious these types don't participate in the complex evaluation.

**Default for any unknown type:** If the validator approved the shape and no rule matches, default to `commit_light` with reasonCode `UNKNOWN_TYPE_DEFAULTED`. This prevents silent blocking of future action types.

## Reason Codes

```javascript
// Logistics (minors)
MINOR_LOGISTICS_UNRESOLVED     // minor without escort plan
MISSING_PICKUP_PLAN            // drop-off exists but no pickup

// Temporal
NO_TEMPORAL_CONTEXT            // zero temporal reference ("ho catechismo")
PARTIAL_TEMPORAL_CONTEXT       // date but no time, or relative day only ("domani catechismo")

// Assignment
MISSING_ASSIGNEE               // task without assignee
SPEAKER_AUTO_ASSIGNED          // assigned to speaker by inference (not explicit)
AMBIGUOUS_SUBJECT              // unclear who should act
IMPERSONAL_NO_CONTEXT          // impersonal phrase without context

// Type
SELF_INTENT_NO_EXTERNAL        // personal need, not structured task
EXPENSE_MISSING_AMOUNT         // expense without amount
UNKNOWN_TYPE_DEFAULTED         // type not covered by rules, defaulted to commit_light

// Metadata (always appended)
EVALUATED_POST_NORMALIZE       // sentinel: appended to every action's reasonCodes to confirm evaluator ran
```

`EVALUATED_POST_NORMALIZE` is always added as a metadata marker. It allows downstream consumers (orchestrator, debug tools) to detect whether an action has been through the evaluator.

## What the Module Does NOT Do

1. **Does not change action.type** — semantic type stays as parser decided
2. **Does not do entity extraction** — uses only data already in the canonical record
3. **Does not duplicate the validator** — if validator approved the shape, evaluator decides commit level
4. **Does not modify `incomplete` or `needsPickup`** — reads them as input signals
5. **Does not infer missing facts aggressively** — only classifies the safest writable form

## Integration Points

### intentClassifier.js — after normalizeAndValidateActions() call

```javascript
// After normalize (currently near end of parseLocally function)
const { actions: canonical, invalid, warnings } = normalizeAndValidateActions(actions, normContext)

// NEW: evaluate commit policy
const evalCtx = {
  speakerRole: currentMember?.role || 'genitore',
  speakerId: currentMember?.id || null,
  speakerName: currentMember?.name || null,
  members: normContext.members,
}
const enriched = evaluateCommitPolicy(canonical, evalCtx)

// Return enriched instead of canonical
return { actions: enriched, ... }
```

### useBrain.js confirmActions()

Inside the `confirmActions` callback (currently at the `for (const action of independent)` loop):

```javascript
for (const action of independent) {
  const writeCheck = canWrite(action)

  if (writeCheck.target === 'block') {
    log.push({ ok: false, msg: `Bloccato: ${writeCheck.reasons.join(', ')}`, type: action.type })
    continue
  }

  if (writeCheck.target === 'draft') {
    // Route to conversationDrafts instead of strong table.
    // Note: action.textOriginal is always available on canonical actions.
    // action itself contains all entities needed by createDraft.
    await createDraft({
      familyId,
      createdBy: currentMember?.id,
      intent: action.type,
      entities: action,
      parseResult: { actions: [action], confidence: action.confidence },
      inputText: action.textOriginal,
    })
    log.push({ ok: true, msg: `Salvato come bozza: ${action.title}`, type: action.type })
    continue
  }

  // target === 'strong' or 'light' — proceed with normal DB write
  const execResult = await executeAction(action)
  // ... existing logic
}
```

**Note on `parseResult`:** The `createDraft()` function expects a `parseResult` object. Since we are inside `confirmActions()` where only the individual action is available (not the original parse result), we construct a minimal parseResult from the action itself. This is sufficient because `createDraft` uses it primarily for `actions_preview` and `confidence`.

## Simulator & Orchestrator Updates

After implementing the evaluator:

1. **Update phraseGenerator** agent templates — add `expected.commitLevel` and `expected.writePolicy` to ScenarioTruth
2. **Update orchestrator** — trace `action.commit` in trajectory, validate commitLevel matches expected
3. **Update agents** — add phrases that test boundary cases (temporal edge, logistics edge, speaker ambiguity)
4. **New stress test** — run 688 phrases through evaluator, measure how many change disposition vs. today

## Success Criteria

- Zero records in `events` table without at least a date
- Zero tasks with `assignedToId: null` that were written as commit_strong
- "Ho catechismo" (no time/date) → goes to conversationDrafts, not events
- "Devo comprare i libri" → self_reminder in tasks, not shopping
- "Domani ho danza alle 17:30" (minor) → event with MINOR_LOGISTICS_UNRESOLVED warning
- All 12 rules covered by unit tests with Italian phrase examples
- Orchestrator record quality rate goes from current levels to 95%+
