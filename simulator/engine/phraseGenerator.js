/**
 * phraseGenerator.js — Generates phrases from agent templates
 * based on the current simulated date and world state.
 *
 * Each generated phrase produces a ScenarioTruth object that carries
 * both the expected outcome (from the template) and a slot for the
 * actual outcome (filled later by phraseExecutor).
 *
 * @module simulator/engine/phraseGenerator
 */

import {
  interpolate, pickRandom, dateRef, timeSlot,
  applyTypos, addDialect, dayOfWeekIT, simDate, pickWeighted,
} from '../utils.js'

// ─── INTENT-TO-TABLE MAP ────────────────────────────────────

const INTENT_TABLE_MAP = {
  calendar: 'events',
  task: 'tasks',
  expense: 'expenses',
  shopping: 'shoppingItems',
  meal: 'mealPlans',
  reminder: 'tasks',
  edit_action: null,
  compound: null, // multi-action — tracked via expectedActions
  none: null,
  unknown: null,
  noise: null,
  absence: null,
}

/**
 * Map an intent string to the DB table it writes to.
 * Returns null for intents that do not produce a DB write.
 *
 * @param {string} intent
 * @returns {string|null}
 */
function intentToTable(intent) {
  if (!intent) return null
  return INTENT_TABLE_MAP[intent] ?? null
}

// ─── VARIABLE RESOLUTION ────────────────────────────────────

/**
 * Pick a random amount from the agent's weighted-range amount pool.
 *
 * @param {Object} amountPool - { type: 'weighted-range', buckets: [...] }
 * @returns {number}
 */
function pickAmount(amountPool) {
  if (!amountPool) return Math.floor(Math.random() * 80) + 10

  if (amountPool.type === 'weighted-range' && Array.isArray(amountPool.buckets)) {
    const buckets = amountPool.buckets
    const weights = buckets.map(b => b.weight)
    const bucket = pickWeighted(buckets, weights)
    return Math.floor(Math.random() * (bucket.max - bucket.min + 1)) + bucket.min
  }

  // Flat array fallback
  if (Array.isArray(amountPool)) {
    return pickRandom(amountPool)
  }

  return Math.floor(Math.random() * 80) + 10
}

/**
 * Resolve a single template variable to a concrete value.
 *
 * @param {string}   varName      - variable name from template (e.g. 'amount', 'who')
 * @param {Object}   pools        - agent.variablePools
 * @param {string}   simDateStr   - current simulated date (ISO)
 * @param {Object}   worldState   - full world state
 * @returns {{ value: string|number, isEntity: boolean, entityType?: string }}
 */
function resolveVar(varName, pools, simDateStr, worldState) {
  const key = varName.toLowerCase()

  // Date-related variables
  if (key === 'dateref' || key === 'date') {
    // Pick a target date 0-6 days from simDate
    const offset = Math.floor(Math.random() * 7)
    const targetDate = simDate(simDateStr, offset)
    return { value: dateRef(simDateStr, targetDate), isEntity: true, entityType: 'date' }
  }

  if (key === 'day') {
    // Use pool if available, otherwise compute from simDate
    if (pools.day && pools.day.length > 0) {
      return { value: pickRandom(pools.day), isEntity: true, entityType: 'date' }
    }
    return { value: dayOfWeekIT(simDateStr), isEntity: true, entityType: 'date' }
  }

  // Time variables
  if (key === 'time') {
    if (pools.time && pools.time.length > 0) {
      const raw = pickRandom(pools.time)
      const [h, m] = raw.split(':').map(Number)
      return { value: timeSlot(h, m), isEntity: true, entityType: 'time' }
    }
    // Default: random daytime hour
    const h = 7 + Math.floor(Math.random() * 13) // 7-19
    const m = pickRandom([0, 15, 30, 45])
    return { value: timeSlot(h, m), isEntity: true, entityType: 'time' }
  }

  // Amount variables
  if (key === 'amount') {
    const val = pickAmount(pools.amount)
    return { value: String(val), isEntity: true, entityType: 'amount' }
  }

  // Person variables — pick from worldState members
  if (key === 'who' || key === 'person' || key === 'child') {
    const members = worldState?.family?.members
    if (members && members.length > 0) {
      const member = pickRandom(members)
      return { value: member.name, isEntity: true, entityType: 'person' }
    }
    // Fallback to agent pool
    if (pools.person && pools.person.length > 0) {
      return { value: pickRandom(pools.person), isEntity: true, entityType: 'person' }
    }
    return { value: 'qualcuno', isEntity: false }
  }

  // Generic pool lookup (where, what, meal, etc.)
  if (pools[key] && Array.isArray(pools[key]) && pools[key].length > 0) {
    const val = pickRandom(pools[key])
    const isEntity = ['where', 'what', 'meal'].includes(key)
    return { value: val, isEntity, entityType: isEntity ? key : undefined }
  }

  // Unknown variable — leave placeholder
  return { value: `{{${varName}}}`, isEntity: false }
}

// ─── MAIN GENERATORS ────────────────────────────────────────

/**
 * Generate a single phrase from an agent template.
 *
 * Resolves template variables, applies speech mutations, and builds
 * a ScenarioTruth object with expected outcomes.
 *
 * @param {Object} agent       - agent profile
 * @param {Object} template    - phrase template from agent.phraseTemplates
 * @param {string} simDateStr  - simulated date (ISO YYYY-MM-DD)
 * @param {Object} worldState  - current world state
 * @returns {Object} ScenarioTruth
 */
export function generatePhrase(agent, template, simDateStr, worldState) {
  const pools = agent.variablePools || {}
  const vars = template.vars || []

  // 1. Resolve all template variables
  const resolvedVars = {}
  const entityVars = {}

  for (const varName of vars) {
    const resolved = resolveVar(varName, pools, simDateStr, worldState)
    resolvedVars[varName] = resolved.value
    if (resolved.isEntity) {
      entityVars[varName] = {
        value: resolved.value,
        type: resolved.entityType,
      }
    }
  }

  // 2. Interpolate template
  let text = interpolate(template.text, resolvedVars)

  // 3. Apply speech mutations
  const style = agent.speechStyle || {}

  if (style.typoRate > 0) {
    text = applyTypos(text, style.typoRate)
  }
  if (style.dialectRate > 0) {
    text = addDialect(text, style.dialectRate)
  }

  // 4. Determine DB effect
  const table = intentToTable(template.intent)
  const dbEffect = template.shouldWrite && table
    ? { table, operation: 'create' }
    : null

  // 5. Build ScenarioTruth
  return {
    text,
    agent: agent.name,
    agentId: agent.id,
    simulatedDate: simDateStr,
    truthConfidence: template.truthConfidence || 'medium',
    expected: {
      intent: template.intent,
      expectedActions: template.expectedActions || null,
      entities: entityVars,
      dbEffect,
      shouldWrite: template.shouldWrite ?? false,
    },
    actual: {
      intent: null,
      confidence: null,
      entities: {},
      dbEffect: null,
      resolverStatus: null,
    },
    errorType: null,
    errorCause: null,
  }
}

// ─── DAY-OF-WEEK MAPPING ────────────────────────────────────

/** Map English 3-letter day codes to JS getUTCDay values */
const DAY_CODE_TO_UTC = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

/**
 * Generate phrases from an agent's weekly routine for a given day.
 *
 * Looks at the agent's weeklyRoutine for slots matching the day of week,
 * finds templates with matching intent/category, and generates phrases
 * with a configurable chance (default 85%).
 *
 * @param {Object} agent       - agent profile
 * @param {string} simDateStr  - simulated date (ISO YYYY-MM-DD)
 * @param {Object} worldState  - current world state
 * @param {Object} [opts]
 * @param {number} [opts.phraseChance=0.85] - probability each routine slot generates a phrase
 * @returns {Object[]} array of ScenarioTruth objects
 */
export function generateRoutinePhrases(agent, simDateStr, worldState, opts = {}) {
  const phraseChance = opts.phraseChance ?? 0.85
  const routine = agent.weeklyRoutine
  if (!routine || routine.length === 0) return []

  const templates = agent.phraseTemplates
  if (!templates || templates.length === 0) return []

  // Determine the JS day-of-week for simDateStr
  // Parse manually to avoid timezone issues
  const [y, m, d] = simDateStr.split('-').map(Number)
  const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const jsDayOfWeek = dateObj.getUTCDay() // 0=Sun

  // Filter routine slots for today
  const todaySlots = routine.filter(slot => {
    const slotDayNum = DAY_CODE_TO_UTC[slot.day]
    return slotDayNum === jsDayOfWeek
  })

  if (todaySlots.length === 0) return []

  const results = []

  for (const slot of todaySlots) {
    // Skip this slot with (1 - phraseChance) probability
    if (Math.random() > phraseChance) continue

    // Try to find a template that matches intent/category for this activity
    const matchingTemplate = findTemplateForRoutine(slot, templates)
    if (!matchingTemplate) continue

    const scenario = generatePhrase(agent, matchingTemplate, simDateStr, worldState)
    results.push(scenario)
  }

  return results
}

/**
 * Find a template that best matches a routine slot.
 *
 * Tries to match on category first, then falls back to intent matching,
 * and finally picks a random actionable template.
 *
 * @param {Object}   slot      - { day, time, activity }
 * @param {Object[]} templates - agent.phraseTemplates
 * @returns {Object|null}
 */
function findTemplateForRoutine(slot, templates) {
  const activityLower = (slot.activity || '').toLowerCase()

  // Infer intent and category from activity description
  const activityHints = {
    spesa: { intent: 'calendar', category: 'shopping' },
    scuola: { intent: 'calendar', category: 'transport' },
    danza: { intent: 'calendar', category: 'transport' },
    ufficio: { intent: 'calendar', category: null },
    piscina: { intent: 'calendar', category: 'sport' },
    palestra: { intent: 'calendar', category: 'sport' },
    catechismo: { intent: 'calendar', category: null },
    cucina: { intent: 'meal', category: 'dinner' },
    cena: { intent: 'meal', category: 'dinner' },
    pranzo: { intent: 'meal', category: 'lunch' },
    porta: { intent: 'calendar', category: 'transport' },
  }

  let bestHint = null
  for (const [keyword, hint] of Object.entries(activityHints)) {
    if (activityLower.includes(keyword)) {
      bestHint = hint
      break
    }
  }

  if (bestHint) {
    // Try category + intent match
    if (bestHint.category) {
      const catMatches = templates.filter(
        t => t.category === bestHint.category && t.intent === bestHint.intent
      )
      if (catMatches.length > 0) return pickRandom(catMatches)
    }

    // Try intent match
    const intentMatches = templates.filter(t => t.intent === bestHint.intent)
    if (intentMatches.length > 0) return pickRandom(intentMatches)
  }

  // Fallback: pick any actionable template
  const actionable = templates.filter(t => t.shouldWrite === true)
  if (actionable.length > 0) return pickRandom(actionable)

  return null
}

// ─── RE-EXPORT HELPER ───────────────────────────────────────

export { intentToTable }
