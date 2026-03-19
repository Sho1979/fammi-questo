/**
 * phraseExecutor.js — Executes a single phrase through the real parser
 * pipeline and evaluates the result against the ScenarioTruth.
 *
 * Imports the app's actual parseLocally, resolveEditAction, and
 * normalizeAndValidateActions so the simulator exercises the real
 * brain code, not a mock.
 *
 * @module simulator/engine/phraseExecutor
 */

import { parseLocally } from '../../src/lib/brain/intentClassifier.js'
import { resolveEditAction } from '../../src/lib/brain/dbResolver.js'
import { normalizeAndValidateActions } from '../../src/lib/brain/actionNormalizer.js'

// ─── INTENT-TO-TABLE MAP (mirrors phraseGenerator) ──────────

const INTENT_TABLE_MAP = {
  calendar: 'events',
  task: 'tasks',
  expense: 'expenses',
  shopping: 'shoppingItems',
  meal: 'mealPlans',
  reminder: 'tasks',
  edit_action: null,
  none: null,
  unknown: null,
  noise: null,
  absence: null,
}

function intentToTable(intent) {
  if (!intent) return null
  return INTENT_TABLE_MAP[intent] ?? null
}

// ─── DATE MOCK ──────────────────────────────────────────────

/**
 * Create a Date class that is pinned to a specific "now" timestamp
 * but otherwise delegates to the real Date for all other functionality.
 *
 * The mock class extends the real Date so instanceof checks pass and
 * all prototype methods (toISOString, getUTCFullYear, etc.) work.
 *
 * @param {typeof Date} RealDate - the original globalThis.Date
 * @param {number}      fakeNow  - timestamp to return from Date.now()
 * @returns {typeof Date}
 */
function createDateMock(RealDate, fakeNow) {
  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        // new Date() -> use fakeNow
        super(fakeNow)
      } else {
        super(...args)
      }
    }

    static now() {
      return fakeNow
    }
  }

  // Preserve static methods that callers may use
  MockDate.UTC = RealDate.UTC
  MockDate.parse = RealDate.parse

  return MockDate
}

// ─── RESULT EVALUATION ──────────────────────────────────────

/**
 * Determine whether two intents should be considered equivalent.
 *
 * Handles known aliases:
 *   - reminder <-> task (same DB table)
 *   - noise <-> none/unknown
 *   - absence is a sub-type of calendar
 *
 * @param {string} expected
 * @param {string} actual
 * @returns {boolean}
 */
function intentsMatch(expected, actual) {
  if (expected === actual) return true

  // reminder and task share the tasks table
  const taskGroup = new Set(['reminder', 'task'])
  if (taskGroup.has(expected) && taskGroup.has(actual)) return true

  // noise, none, unknown are all "no action"
  const noActionGroup = new Set(['noise', 'none', 'unknown'])
  if (noActionGroup.has(expected) && noActionGroup.has(actual)) return true

  return false
}

/**
 * Evaluate parser results against expected truth.
 * Mutates scenarioTruth.errorType and scenarioTruth.errorCause in place.
 *
 * @param {Object} scenarioTruth - the ScenarioTruth object
 * @returns {Object} same scenarioTruth reference
 */
function evaluateResult(scenarioTruth) {
  const { expected, actual } = scenarioTruth

  const parseCorrect = intentsMatch(expected.intent, actual.intent)
  const didWrite = actual.dbEffect !== null
  const shouldWrite = expected.shouldWrite
  const writeCorrect = (shouldWrite && didWrite) || (!shouldWrite && !didWrite)

  if (parseCorrect && writeCorrect) {
    scenarioTruth.errorType = null
    scenarioTruth.errorCause = null
    return scenarioTruth
  }

  // Classify the error
  if (!parseCorrect) {
    scenarioTruth.errorType = 'parse_error'
    scenarioTruth.errorCause = `expected "${expected.intent}", got "${actual.intent}"`
  } else if (!shouldWrite && didWrite) {
    scenarioTruth.errorType = 'false_positive'
    scenarioTruth.errorCause = `wrote to DB when shouldWrite=false (table: ${actual.dbEffect?.table})`
  } else if (shouldWrite && !didWrite) {
    scenarioTruth.errorType = 'false_negative'
    scenarioTruth.errorCause = `did not write to DB when shouldWrite=true`
  }

  // Check edit_action resolver failures
  if (actual.intent === 'edit_action' && actual.resolverStatus && actual.resolverStatus !== 'resolved') {
    scenarioTruth.errorType = 'resolve_error'
    scenarioTruth.errorCause = `edit_action resolver status: ${actual.resolverStatus}`
  }

  return scenarioTruth
}

// ─── SINGLE PHRASE EXECUTION ────────────────────────────────

/**
 * Execute a single phrase through the real parser pipeline.
 *
 * 1. Mocks Date to the simulated date
 * 2. Calls parseLocally with the phrase text
 * 3. Extracts actual intent, confidence, and action count
 * 4. Handles edit_action via resolveEditAction
 * 5. Writes to DB if parser produced valid writable actions
 * 6. Evaluates correctness and classifies errors
 * 7. Restores the original Date in a finally block
 *
 * @param {Object}   scenarioTruth       - ScenarioTruth from phraseGenerator
 * @param {Object[]} members             - family member records
 * @param {string}   familyId            - family identifier
 * @param {Object}   currentMemberRecord - the agent's member record
 * @param {Object}   db                  - Dexie database instance
 * @returns {Promise<Object>} updated ScenarioTruth with actual results
 */
export async function executePhrase(scenarioTruth, members, familyId, currentMemberRecord, db) {
  const OrigDate = globalThis.Date

  try {
    // 1. Mock Date for simulated date
    const fakeNow = new OrigDate(scenarioTruth.simulatedDate + 'T12:00:00').getTime()
    globalThis.Date = createDateMock(OrigDate, fakeNow)

    // 2. Parse through the real pipeline
    let result = null
    try {
      result = await parseLocally(
        scenarioTruth.text,
        members,
        familyId,
        currentMemberRecord,
      )
    } catch (parseErr) {
      scenarioTruth.actual.intent = 'error'
      scenarioTruth.actual.confidence = 0
      scenarioTruth.errorType = 'parse_error'
      scenarioTruth.errorCause = `parseLocally threw: ${parseErr.message}`
      return scenarioTruth
    }

    // 3. Extract actual results
    const actions = result?.actions || []
    const firstAction = actions[0] || null

    scenarioTruth.actual.intent = firstAction?.type || 'none'
    scenarioTruth.actual.confidence = result?.confidence ?? 0
    scenarioTruth.actual.actionCount = actions.length

    // Check for absence (special sub-type)
    const hasAbsence = actions.some(
      a => a.isAbsence || a.category === 'assenza'
    )
    if (hasAbsence) {
      scenarioTruth.actual.intent = 'absence'
    }

    // 4. Handle edit_action through resolver
    if (scenarioTruth.actual.intent === 'edit_action' && firstAction) {
      try {
        const resolved = await resolveEditAction(familyId, firstAction, members)
        scenarioTruth.actual.resolverStatus = resolved?.status || 'unknown'
      } catch (resolveErr) {
        scenarioTruth.actual.resolverStatus = 'error'
        scenarioTruth.errorType = 'resolve_error'
        scenarioTruth.errorCause = `resolveEditAction threw: ${resolveErr.message}`
        return evaluateResult(scenarioTruth)
      }
    }

    // 5. Write to DB if applicable
    if (actions.length > 0 && scenarioTruth.actual.intent !== 'edit_action') {
      const writable = actions.filter(a => {
        const table = intentToTable(a.type)
        return table !== null
      })

      if (writable.length > 0) {
        // Check false-positive guard
        if (scenarioTruth.expected.shouldWrite === false) {
          scenarioTruth.actual.dbEffect = {
            table: intentToTable(writable[0].type),
            operation: 'create',
            blocked: false, // We still record it but flag the FP
          }
        } else {
          // Write each action to the appropriate table
          for (const action of writable) {
            const table = intentToTable(action.type)
            if (table && db[table]) {
              try {
                const record = {
                  ...action,
                  family_id: familyId,
                  id: action.id || `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                }
                await db[table].add(record)
              } catch (dbErr) {
                // Log but don't crash — DB write failure is non-fatal
                console.warn(
                  `[phraseExecutor] DB write failed for ${table}:`,
                  dbErr.message,
                )
              }
            }
          }
          scenarioTruth.actual.dbEffect = {
            table: intentToTable(writable[0].type),
            operation: 'create',
            count: writable.length,
          }
        }
      }
    }

    // 6. Evaluate correctness
    evaluateResult(scenarioTruth)

    return scenarioTruth
  } finally {
    // 7. Always restore Date
    globalThis.Date = OrigDate
  }
}

// ─── BATCH EXECUTION ────────────────────────────────────────

/**
 * Process an array of ScenarioTruth phrases sequentially through
 * the real parser and collect statistics.
 *
 * @param {Object[]}  phrases   - array of ScenarioTruth objects
 * @param {Object[]}  members   - family member records
 * @param {string}    familyId  - family identifier
 * @param {Object}    db        - Dexie database instance
 * @param {Object}    [opts]
 * @param {Function}  [opts.onProgress] - callback(index, total, scenarioTruth)
 * @param {Object}    [opts.currentMemberMap] - { agentId: memberRecord } lookup
 * @returns {Promise<{ results: Object[], stats: Object }>}
 */
export async function executeBatch(phrases, members, familyId, db, opts = {}) {
  const { onProgress, currentMemberMap = {} } = opts

  const results = []
  const stats = {
    total: phrases.length,
    correct: 0,
    errors: 0,
    parseErrors: 0,
    falsePositives: 0,
    falseNegatives: 0,
    resolveErrors: 0,
  }

  for (let i = 0; i < phrases.length; i++) {
    const scenario = phrases[i]

    // Resolve the currentMember for this agent
    const currentMember = currentMemberMap[scenario.agentId]
      || members.find(m => m.name === scenario.agent)
      || members[0]
      || null

    let executed
    try {
      executed = await executePhrase(scenario, members, familyId, currentMember, db)
    } catch (err) {
      // Catastrophic failure — should not happen since executePhrase has its own try/catch
      scenario.errorType = 'parse_error'
      scenario.errorCause = `executeBatch caught unexpected error: ${err.message}`
      executed = scenario
    }

    results.push(executed)

    // Update stats
    if (executed.errorType === null) {
      stats.correct++
    } else {
      stats.errors++
      switch (executed.errorType) {
        case 'parse_error': stats.parseErrors++; break
        case 'false_positive': stats.falsePositives++; break
        case 'false_negative': stats.falseNegatives++; break
        case 'resolve_error': stats.resolveErrors++; break
      }
    }

    // Progress callback
    if (typeof onProgress === 'function') {
      try {
        onProgress(i, phrases.length, executed)
      } catch {
        // Never let a progress callback crash the batch
      }
    }
  }

  return { results, stats }
}
