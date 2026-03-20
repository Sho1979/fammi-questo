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

// ─── FULL RULE ENGINE (placeholder — Chunks 3-4 fill this) ────

function evaluateFullRules(action, ctx) {
  // Will be implemented in Chunks 3-4
  // Default: commit_light with UNKNOWN_TYPE_DEFAULTED
  return buildCommit('light', action.type || 'unresolved', {
    reasonCodes: [REASON_CODES.UNKNOWN_TYPE_DEFAULTED],
  })
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
