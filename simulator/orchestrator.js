/**
 * orchestrator.js — End-to-end phrase trajectory tracer.
 *
 * Wraps the simulator execution and captures the full journey of every phrase:
 *   text → parser result → action shape → DB table → record quality → role visibility
 *
 * Unlike the basic simulator report (which only checks intent accuracy),
 * the orchestrator verifies that records actually land in the right tables
 * with correct field values, and shows what each family role sees.
 *
 * @module simulator/orchestrator
 */

import { createWorldState, advanceDay, updateAfterPhrase, refreshFromDB } from './engine/worldState.js'
import { runDay } from './engine/dayLoop.js'
import { executeBatch } from './engine/phraseExecutor.js'
import { simDate } from './utils.js'

// ─── RECORD QUALITY RULES ──────────────────────────────────────

/**
 * Per-table required and recommended fields.
 * required = record is BROKEN without it.
 * recommended = record works but is LOW QUALITY without it.
 */
const TABLE_QUALITY_RULES = {
  events: {
    required: ['id', 'family_id', 'type', 'date'],
    recommended: ['title', 'timeStart', 'category'],
    titleMinLength: 3,
  },
  tasks: {
    required: ['id', 'family_id', 'type'],
    recommended: ['title', 'assignedToId', 'dueDate'],
    titleMinLength: 3,
  },
  expenses: {
    required: ['id', 'family_id', 'type', 'amount'],
    recommended: ['category', 'date'],
    amountMustBePositive: true,
  },
  shoppingItems: {
    required: ['id', 'family_id', 'type'],
    recommended: ['title', 'quantity'],
    titleField: 'title',  // check title or name
  },
  mealPlans: {
    required: ['id', 'family_id', 'type'],
    recommended: ['title', 'slot', 'date'],
    titleMinLength: 3,
  },
}

// ─── ROLE VISIBILITY RULES ─────────────────────────────────────

/**
 * Which tables each role can see in the app.
 * parents see everything; children see limited; grandparents see shared.
 */
const ROLE_VISIBILITY = {
  genitore: {
    tables: ['events', 'tasks', 'expenses', 'shoppingItems', 'mealPlans'],
    label: 'Genitore (full access)',
  },
  figlio: {
    tables: ['events', 'tasks', 'mealPlans'],
    label: 'Figlio (no expenses, no shopping)',
  },
  nonno: {
    tables: ['events', 'tasks', 'mealPlans', 'shoppingItems'],
    label: 'Nonno (no expenses)',
  },
}

// ─── INTENT→TABLE (same as phraseExecutor) ─────────────────────

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
  return INTENT_TABLE_MAP[intent] ?? null
}

// ─── TRAJECTORY OBJECT ─────────────────────────────────────────

/**
 * @typedef {Object} PhraseTrajectory
 * @property {string} id                  - phrase ID
 * @property {string} text                - original text
 * @property {string} agent               - who said it
 * @property {string} agentRole           - genitore|figlio|nonno
 * @property {string} simulatedDate       - YYYY-MM-DD
 * @property {string} expectedIntent      - what we expected
 * @property {string} actualIntent        - what parser said
 * @property {boolean} intentCorrect      - match?
 * @property {string|null} targetTable    - which DB table
 * @property {boolean} recordWritten      - was a record actually written?
 * @property {Object|null} recordSnapshot - the actual DB record (if written)
 * @property {Object} recordQuality       - { valid: bool, missing: [], warnings: [] }
 * @property {Object} roleVisibility      - { genitore: bool, figlio: bool, nonno: bool }
 * @property {string|null} errorType      - from evaluateResult
 * @property {string|null} errorCause     - detail
 */

// ─── VALIDATE RECORD QUALITY ───────────────────────────────────

/**
 * Check a DB record against the quality rules for its table.
 *
 * @param {string} tableName - e.g. 'events', 'tasks'
 * @param {Object} record    - the actual record from Dexie
 * @returns {{ valid: boolean, missingRequired: string[], missingRecommended: string[], warnings: string[] }}
 */
function validateRecordQuality(tableName, record) {
  const rules = TABLE_QUALITY_RULES[tableName]
  if (!rules) return { valid: true, missingRequired: [], missingRecommended: [], warnings: [] }

  const missingRequired = []
  const missingRecommended = []
  const warnings = []

  // Check required fields
  for (const field of rules.required) {
    if (record[field] === undefined || record[field] === null || record[field] === '') {
      missingRequired.push(field)
    }
  }

  // Check recommended fields
  for (const field of rules.recommended) {
    if (record[field] === undefined || record[field] === null || record[field] === '') {
      missingRecommended.push(field)
    }
  }

  // Title length check
  if (rules.titleMinLength && record.title) {
    if (record.title.length < rules.titleMinLength) {
      warnings.push(`title too short: "${record.title}" (${record.title.length} chars)`)
    }
  }

  // Title looks like raw sentence (> 60 chars usually means unprocessed)
  if (record.title && record.title.length > 80) {
    warnings.push(`title looks like raw sentence (${record.title.length} chars): "${record.title.slice(0, 50)}..."`)
  }

  // Name length check (shopping, meals)
  if (rules.nameMinLength && record.name) {
    if (record.name.length < rules.nameMinLength) {
      warnings.push(`name too short: "${record.name}" (${record.name.length} chars)`)
    }
  }

  // Amount check (expenses)
  if (rules.amountMustBePositive) {
    if (typeof record.amount !== 'number' || record.amount <= 0) {
      warnings.push(`amount invalid: ${record.amount}`)
    }
  }

  // Date format check
  if (record.date && !/^\d{4}-\d{2}-\d{2}/.test(record.date)) {
    warnings.push(`date format invalid: "${record.date}"`)
  }

  // assignedToId/assignedToName should not be string "undefined"/"null"
  for (const field of ['assignedToId', 'assignedToName', 'personId', 'personName']) {
    if (record[field] === 'undefined' || record[field] === 'null') {
      warnings.push(`${field} is string "${record[field]}" instead of null`)
    }
  }

  // Expense title should reflect the actual expense, not a random word
  if (tableName === 'expenses' && record.title && record.textOriginal) {
    // Check if title is suspiciously unrelated to the expense
    const titleLower = record.title.toLowerCase()
    const textLower = record.textOriginal.toLowerCase()
    if (titleLower.length > 2 && !textLower.includes(titleLower.slice(0, 4))) {
      warnings.push(`expense title "${record.title}" may not match text "${record.textOriginal.slice(0, 40)}"`)
    }
  }

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    missingRecommended,
    warnings,
  }
}

// ─── DETERMINE ROLE VISIBILITY ─────────────────────────────────

/**
 * For a given table, determine which roles can see the record.
 * @param {string|null} tableName
 * @returns {{ genitore: boolean, figlio: boolean, nonno: boolean }}
 */
function getRoleVisibility(tableName) {
  if (!tableName) return { genitore: false, figlio: false, nonno: false }

  return {
    genitore: ROLE_VISIBILITY.genitore.tables.includes(tableName),
    figlio: ROLE_VISIBILITY.figlio.tables.includes(tableName),
    nonno: ROLE_VISIBILITY.nonno.tables.includes(tableName),
  }
}

// ─── DB SNAPSHOT AFTER WRITE ───────────────────────────────────

/**
 * After a phrase is executed, try to find the record that was just written.
 * We look for the most recent record in the target table with matching family_id.
 *
 * @param {Object} db - Dexie instance
 * @param {string} tableName - target table
 * @param {string} familyId
 * @param {number} countBefore - how many records were in the table before
 * @returns {Promise<Object|null>} the newly written record, or null
 */
async function findNewRecord(db, tableName, familyId, countBefore) {
  if (!tableName || !db[tableName]) return null

  try {
    const allRecords = await db[tableName]
      .where('family_id')
      .equals(familyId)
      .toArray()

    // If count increased, the last record is likely the new one
    if (allRecords.length > countBefore) {
      return allRecords[allRecords.length - 1]
    }
    return null
  } catch {
    return null
  }
}

// ─── MAIN ORCHESTRATOR ─────────────────────────────────────────

/**
 * Run the full simulation with trajectory tracing.
 *
 * This is a modified version of weekLoop.runSimulation that intercepts
 * every phrase execution and captures the full trajectory.
 *
 * @param {string}   familyId
 * @param {Object[]} members
 * @param {Object[]} agents
 * @param {Object}   db
 * @param {Object}   [config]
 * @returns {Promise<{ trajectories: PhraseTrajectory[], weeklyStats: Object[], worldState: Object }>}
 */
export async function runOrchestrated(familyId, members, agents, db, config = {}) {
  const cfg = {
    weeks: config.weeks || 8,
    startDate: config.startDate || '2025-09-01',
    randomEventChance: config.randomEventChance ?? 0.10,
    crossAgentChance: config.crossAgentChance ?? 0.15,
    editActionRate: config.editActionRate ?? 0.10,
  }

  // Build agent role lookup
  const agentRoleMap = {}
  for (const m of members) {
    agentRoleMap[m.id] = m.role
    agentRoleMap[m.name] = m.role
  }

  const worldState = createWorldState(familyId, members, cfg.startDate)

  /** @type {PhraseTrajectory[]} */
  const trajectories = []
  const weeklyStats = []

  // Build currentMemberMap once
  const currentMemberMap = {}
  for (const m of members) { currentMemberMap[m.id] = m }

  for (let week = 0; week < cfg.weeks; week++) {
    let weekCorrect = 0
    let weekTotal = 0

    for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
      const dayOffset = week * 7 + dayInWeek
      const simDateStr = simDate(cfg.startDate, dayOffset)

      advanceDay(worldState, simDateStr)

      // Generate phrases for this day
      let dayPhrases
      try {
        dayPhrases = await runDay(simDateStr, agents, worldState, {
          randomEventChance: cfg.randomEventChance,
          crossAgentChance: cfg.crossAgentChance,
          editActionRate: cfg.editActionRate,
          db,
          familyId,
        })
      } catch (err) {
        console.error(`[Orchestrator] Day ${simDateStr} generation failed: ${err.message}`)
        dayPhrases = []
      }

      if (dayPhrases.length === 0) continue

      // ── ORCHESTRATED EXECUTION: one phrase at a time ──
      for (const scenario of dayPhrases) {
        const expectedTable = intentToTable(scenario.expected?.intent)

        // Snapshot: count records in target table BEFORE execution
        let countBefore = 0
        if (expectedTable && db[expectedTable]) {
          try {
            countBefore = await db[expectedTable]
              .where('family_id')
              .equals(familyId)
              .count()
          } catch { /* ignore */ }
        }

        // Execute single phrase through real parser
        const currentMember = currentMemberMap[scenario.agentId]
          || members.find(m => m.name === scenario.agent)
          || members[0]

        const { results } = await executeBatch(
          [scenario], members, familyId, db,
          { currentMemberMap }
        )

        const result = results[0]
        result.executed = true
        result.correct = result.errorType === null

        // Find the actual table the record landed in
        const actualTable = intentToTable(result.actual?.intent)

        // Try to find the new record
        let recordSnapshot = null
        const writeTable = actualTable || expectedTable
        if (writeTable && result.actual?.dbEffect) {
          recordSnapshot = await findNewRecord(db, writeTable, familyId, countBefore)
        }

        // Validate record quality
        const recordQuality = recordSnapshot
          ? validateRecordQuality(writeTable, recordSnapshot)
          : { valid: false, missingRequired: [], missingRecommended: [], warnings: ['no record written'] }

        // Build trajectory
        const agentName = result.agent || result.agentName || 'unknown'
        const trajectory = {
          id: result.id || `traj-${dayOffset}-${weekTotal}`,
          text: result.text || result.rawText || '',
          agent: agentName,
          agentRole: agentRoleMap[result.agentId] || agentRoleMap[agentName] || 'unknown',
          simulatedDate: simDateStr,
          source: result.source || 'unknown',
          // Parser results
          expectedIntent: result.expected?.intent || 'unknown',
          actualIntent: result.actual?.intent || 'none',
          confidence: result.actual?.confidence ?? 0,
          intentCorrect: result.correct,
          // DB trajectory
          expectedTable: expectedTable,
          actualTable: actualTable,
          tableCorrect: expectedTable === actualTable,
          recordWritten: recordSnapshot !== null,
          recordSnapshot: recordSnapshot ? sanitizeRecord(recordSnapshot) : null,
          recordQuality,
          // Role visibility
          roleVisibility: getRoleVisibility(actualTable || expectedTable),
          // Error info
          errorType: result.errorType,
          errorCause: result.errorCause,
          // Resolver (edit_action only)
          resolverStatus: result.actual?.resolverStatus || null,
          // Commit evaluation
          commitLevel: result.actual?.actions?.[0]?.commit?.level || null,
          writePolicy: result.actual?.actions?.[0]?.commit?.writePolicy || null,
          commitReasonCodes: result.actual?.actions?.[0]?.commit?.reasonCodes || [],
          previewType: result.actual?.actions?.[0]?.commit?.previewType || null,
        }

        trajectories.push(trajectory)

        // Update world state
        if (result.correct) weekCorrect++
        weekTotal++

        try {
          updateAfterPhrase(worldState, result.agentId || agentName, {
            intent: result.actual?.intent ?? result.expected?.intent,
            rawText: result.text,
            confidence: result.actual?.confidence ?? 0,
          })
        } catch { /* non-critical */ }
      }
    }

    // Weekly DB refresh
    try { await refreshFromDB(worldState, db) } catch { /* ignore */ }

    const pct = weekTotal > 0 ? ((weekCorrect / weekTotal) * 100).toFixed(1) : 'N/A'
    console.log(`[Orchestrator] Week ${week + 1}/${cfg.weeks}: ${weekCorrect}/${weekTotal} correct (${pct}%)`)

    weeklyStats.push({
      week: week + 1,
      total: weekTotal,
      correct: weekCorrect,
    })

    // Reset weekly counters
    weekCorrect = 0
    weekTotal = 0
  }

  return { trajectories, weeklyStats, worldState }
}

/**
 * Sanitize a DB record for the trajectory report — remove huge/circular fields.
 */
function sanitizeRecord(record) {
  const safe = {}
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('_') && key !== '_version') continue
    if (typeof value === 'function') continue
    if (typeof value === 'string' && value.length > 200) {
      safe[key] = value.slice(0, 200) + '...'
    } else {
      safe[key] = value
    }
  }
  return safe
}
