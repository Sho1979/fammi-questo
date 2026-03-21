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

const POLICY_MAP = { strong: 'commit_strong', light: 'commit_light', draft: 'draft_only', none: 'block' }

/**
 * Build a commit evaluation result object.
 * @param {'strong'|'light'|'draft'|'none'} level
 * @param {string} previewType
 * @param {Object} [opts]
 */
function buildCommit(level, previewType, opts = {}) {
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

// ─── LIGHTER PATH (Rules 13-15 + absence) ─────────────────────

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

// ─── CALENDAR RULES (1-4 + sub-rules 1a/3a/3b) ───────────────

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

    if (!fullLogistics) {
      reasonCodes.push(REASON_CODES.MINOR_LOGISTICS_UNRESOLVED)
      // Has some logistics but not complete (e.g. drop-off without pickup)
      if (hasAnyLogistics(action)) {
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
 * Detect personal need (buying/getting for self) vs. structured external task.
 * "devo comprare X", "devo prendere X", "mi serve X"
 */
function isPersonalNeed(text) {
  if (!text) return false
  return /\b(?:devo\s+comprare|devo\s+prendere|mi\s+serve|mi\s+servono|ho\s+bisogno)\b/i.test(text)
}

function evaluateTask(action, ctx) {
  const hasAssignee = !!(action.assignedToId)
  const text = action.textOriginal || ''
  const strongOwnership = hasStrongOwnership(text)

  // Rule 5: Explicit assignee + clear action → strong
  if (hasAssignee && !strongOwnership) {
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

  // Rule 8: No assignee, no ownership → block
  return buildCommit('none', 'unresolved', {
    reasonCodes: [REASON_CODES.AMBIGUOUS_SUBJECT, REASON_CODES.IMPERSONAL_NO_CONTEXT],
    uiBadges: ['Chi deve farlo?'],
  })
}

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
  // Meals are always strong if validator approved
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
  return buildCommit('strong', 'shopping')
}

// ─── FULL RULE ENGINE ─────────────────────────────────────────

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

// ─── PUBLIC API ────────────────────────────────────────────────

/**
 * Evaluate a single action's commit policy.
 * MUTATES the input action by attaching `action.commit`. Returns the same object.
 *
 * @param {Object} action - Canonical action from normalizer
 * @param {Object} ctx - Evaluation context { speakerRole, speakerId, speakerName, members }
 * @returns {Object} Same action with `.commit` attached
 */
export function evaluateSingleAction(action, ctx) {
  // Lighter path: reminder, note, edit_action, absence
  const lighter = evaluateLighterPath(action)
  if (lighter) {
    action.commit = lighter
    return action
  }

  // Full rule engine
  action.commit = evaluateFullRules(action, ctx)

  // ── Incomplete guard: never commit "strong" when action has missing fields ──
  if (action.incomplete && action.commit.level === 'strong') {
    action.commit.level = 'light'
    action.commit.writePolicy = POLICY_MAP.light
    action.commit.canWrite = true
    if (!action.commit.uiBadges.includes(action.incomplete)) {
      action.commit.uiBadges.push(action.incomplete)
    }
    if (!action.commit.reasonCodes.includes(REASON_CODES.PARTIAL_TEMPORAL_CONTEXT)) {
      action.commit.reasonCodes.push(REASON_CODES.PARTIAL_TEMPORAL_CONTEXT)
    }
  }

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

// ─── WRITE GUARD ───────────────────────────────────────────────

const POLICY_TARGET = {
  commit_strong: 'strong',
  commit_light: 'light',
  draft_only: 'draft',
  block: 'block',
}

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

    // Tasks can be written without assignee (light), so no hard check here
  }

  return reasons
}

/** Patterns that indicate critical integrity failure → must degrade to draft */
const CRITICAL_PATTERNS = ['date required', 'amount must be']

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

  let target = POLICY_TARGET[action.commit.writePolicy] || 'block'
  const reasons = []

  // For strong/light writes, run type-specific integrity checks
  if (target === 'strong' || target === 'light') {
    const integrityIssues = checkTypeIntegrity(action)

    if (integrityIssues.length > 0) {
      reasons.push(...integrityIssues)

      // Critical failures force degradation to draft
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
