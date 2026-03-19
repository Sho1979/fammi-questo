/**
 * worldState.js — Minimal world state for the Family Life Simulator.
 *
 * Tracks family-level data (tasks, events, expenses) and per-agent
 * state (memory, pending actions, objectives).
 *
 * All dates use ISO format strings internally (YYYY-MM-DD).
 * @module simulator/engine/worldState
 */

import { toISO, parseISO } from '../utils.js'

// ─── DEFAULTS ───────────────────────────────────────────────

/** Maximum memory entries kept per agent before oldest are pruned */
const MAX_MEMORY_PER_AGENT = 50

/** Days after which a memory entry is considered stale and prunable */
const MEMORY_STALE_DAYS = 7

// ─── TYPES (JSDoc) ──────────────────────────────────────────

/**
 * @typedef {Object} MemoryEntry
 * @property {string} date    - ISO date when this happened
 * @property {string} type    - category: 'phrase_sent' | 'phrase_received' | 'task_created' | 'event_added' | 'expense_logged' | 'objective_set'
 * @property {string} summary - short human-readable summary
 * @property {Record<string, any>} [data] - optional structured payload
 */

/**
 * @typedef {Object} AgentState
 * @property {MemoryEntry[]}  memory         - rolling window of recent memories
 * @property {string[]}       pendingActions - queued actions the agent wants to perform
 * @property {string[]}       objectives     - agent's current goals / intentions
 */

/**
 * @typedef {Object} FamilyState
 * @property {string}   id               - family ID
 * @property {Object[]} members          - member records (from setup.js)
 * @property {string}   currentDate      - ISO date of current sim day
 * @property {Object[]} openTasks        - active tasks from DB
 * @property {Object[]} upcomingEvents   - events in the next 14 days
 * @property {Object[]} recentExpenses   - expenses from the last 30 days
 */

/**
 * @typedef {Object} WorldState
 * @property {FamilyState} family
 * @property {Record<string, AgentState>} agents - keyed by lowercase first name
 */

// ─── FACTORY ────────────────────────────────────────────────

/**
 * Create the initial world state for a simulation run.
 *
 * @param {string}   familyId   - unique family identifier
 * @param {Object[]} members    - array of member objects (must have `.name`)
 * @param {string}   [startDate] - ISO start date; defaults to today
 * @returns {WorldState}
 */
export function createWorldState(familyId, members, startDate) {
  const currentDate = startDate || toISO(new Date())

  /** @type {Record<string, AgentState>} */
  const agents = {}
  for (const m of members) {
    const key = m.name.toLowerCase()
    agents[key] = {
      memory: [],
      pendingActions: [],
      objectives: [],
    }
  }

  return {
    family: {
      id: familyId,
      members: [...members],
      currentDate,
      openTasks: [],
      upcomingEvents: [],
      recentExpenses: [],
    },
    agents,
  }
}

// ─── STATE QUERIES ──────────────────────────────────────────

/**
 * Get a single agent's current state.
 * Returns `undefined` if the agent does not exist.
 *
 * @param {WorldState} state
 * @param {string}     agentId - lowercase first name
 * @returns {AgentState|undefined}
 */
export function getAgentState(state, agentId) {
  return state.agents[agentId.toLowerCase()]
}

/**
 * Get a shallow summary of world state for logging / debugging.
 *
 * @param {WorldState} state
 * @returns {{ date: string, agents: string[], openTasks: number, upcomingEvents: number, recentExpenses: number }}
 */
export function worldSummary(state) {
  return {
    date: state.family.currentDate,
    agents: Object.keys(state.agents),
    openTasks: state.family.openTasks.length,
    upcomingEvents: state.family.upcomingEvents.length,
    recentExpenses: state.family.recentExpenses.length,
  }
}

// ─── STATE MUTATIONS ────────────────────────────────────────

/**
 * Update world state after a phrase has been processed by the Brain.
 *
 * This pushes a memory entry to the speaking agent, and optionally
 * updates openTasks / upcomingEvents / recentExpenses if the phrase
 * result created any.
 *
 * @param {WorldState} state     - mutated in place
 * @param {string}     agentId   - who spoke (lowercase name)
 * @param {Object}     phraseResult - result from Brain.process()
 * @param {string}     phraseResult.intent     - detected intent
 * @param {string}     phraseResult.rawText    - original text
 * @param {Object}     [phraseResult.task]     - created/edited task, if any
 * @param {Object}     [phraseResult.event]    - created event, if any
 * @param {Object}     [phraseResult.expense]  - logged expense, if any
 * @param {string}     [phraseResult.response] - Brain response text
 * @returns {WorldState} the same state reference (for chaining)
 */
export function updateAfterPhrase(state, agentId, phraseResult) {
  const agent = state.agents[agentId.toLowerCase()]
  if (!agent) {
    console.warn(`[WorldState] updateAfterPhrase: unknown agent "${agentId}"`)
    return state
  }

  const date = state.family.currentDate

  // Record the phrase in agent memory
  agent.memory.push({
    date,
    type: 'phrase_sent',
    summary: `[${phraseResult.intent}] ${phraseResult.rawText}`,
    data: {
      intent: phraseResult.intent,
      rawText: phraseResult.rawText,
      response: phraseResult.response ?? null,
    },
  })

  // If a task was created or updated, track it
  if (phraseResult.task) {
    agent.memory.push({
      date,
      type: 'task_created',
      summary: `Task: ${phraseResult.task.title ?? phraseResult.task.id}`,
      data: phraseResult.task,
    })

    // Add to openTasks if not already present
    const existing = state.family.openTasks.findIndex(t => t.id === phraseResult.task.id)
    if (existing >= 0) {
      state.family.openTasks[existing] = phraseResult.task
    } else {
      state.family.openTasks.push(phraseResult.task)
    }
  }

  // If an event was created
  if (phraseResult.event) {
    agent.memory.push({
      date,
      type: 'event_added',
      summary: `Event: ${phraseResult.event.title ?? phraseResult.event.id}`,
      data: phraseResult.event,
    })
    state.family.upcomingEvents.push(phraseResult.event)
  }

  // If an expense was logged
  if (phraseResult.expense) {
    agent.memory.push({
      date,
      type: 'expense_logged',
      summary: `Expense: ${phraseResult.expense.amount ?? '?'}\u20AC`,
      data: phraseResult.expense,
    })
    state.family.recentExpenses.push(phraseResult.expense)
  }

  // Prune if memory is too large
  if (agent.memory.length > MAX_MEMORY_PER_AGENT) {
    agent.memory = agent.memory.slice(-MAX_MEMORY_PER_AGENT)
  }

  return state
}

/**
 * Advance the simulation to a new day.
 *
 * - Updates `family.currentDate`
 * - Prunes stale memory entries from all agents
 * - Removes past events from `upcomingEvents`
 * - Clears completed `pendingActions`
 *
 * @param {WorldState} state   - mutated in place
 * @param {string}     newDate - new ISO date (YYYY-MM-DD)
 * @returns {WorldState}
 */
export function advanceDay(state, newDate) {
  state.family.currentDate = newDate

  const newDateParsed = parseISO(newDate)

  // Prune stale memories for each agent
  for (const agentId of Object.keys(state.agents)) {
    const agent = state.agents[agentId]

    agent.memory = agent.memory.filter(entry => {
      const entryDate = parseISO(entry.date)
      const ageDays = Math.round((newDateParsed - entryDate) / (24 * 60 * 60 * 1000))
      return ageDays <= MEMORY_STALE_DAYS
    })

    // Reset pending actions at day boundary (they are day-scoped)
    agent.pendingActions = []
  }

  // Remove past events
  state.family.upcomingEvents = state.family.upcomingEvents.filter(ev => {
    const evDate = ev.date || ev.start_date
    return evDate >= newDate
  })

  // Keep only expenses from last 30 days
  const thirtyDaysAgo = new Date(newDateParsed)
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
  const cutoff = toISO(thirtyDaysAgo)

  state.family.recentExpenses = state.family.recentExpenses.filter(ex => {
    const exDate = ex.date || ex.created_at
    return exDate >= cutoff
  })

  return state
}

/**
 * Sync the world state with live data from the Dexie database.
 *
 * Refreshes `openTasks`, `upcomingEvents`, and `recentExpenses`
 * from the actual DB tables so the simulation stays in sync
 * with any side-effects from Brain processing.
 *
 * @param {WorldState} state - mutated in place
 * @param {Object}     db    - Dexie database instance (from localDb.js)
 * @returns {Promise<WorldState>}
 */
export async function refreshFromDB(state, db) {
  const familyId = state.family.id
  const currentDate = state.family.currentDate
  const currentDateParsed = parseISO(currentDate)

  // ── Open tasks: not completed, belonging to this family
  try {
    const allTasks = await db.tasks
      .where('family_id').equals(familyId)
      .toArray()

    state.family.openTasks = allTasks.filter(t =>
      t.status !== 'done' && t.status !== 'cancelled'
    )
  } catch {
    // Table might not exist yet in early sim stages
    state.family.openTasks = []
  }

  // ── Upcoming events: next 14 days
  try {
    const fourteenDaysLater = new Date(currentDateParsed)
    fourteenDaysLater.setUTCDate(fourteenDaysLater.getUTCDate() + 14)
    const cutoffDate = toISO(fourteenDaysLater)

    const allEvents = await db.events
      .where('family_id').equals(familyId)
      .toArray()

    state.family.upcomingEvents = allEvents.filter(ev => {
      const evDate = ev.date || ev.start_date
      return evDate >= currentDate && evDate <= cutoffDate
    })
  } catch {
    state.family.upcomingEvents = []
  }

  // ── Recent expenses: last 30 days
  try {
    const thirtyDaysAgo = new Date(currentDateParsed)
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
    const cutoff = toISO(thirtyDaysAgo)

    const allExpenses = await db.expenses
      .where('family_id').equals(familyId)
      .toArray()

    state.family.recentExpenses = allExpenses.filter(ex => {
      const exDate = ex.date || ex.created_at
      return exDate >= cutoff
    })
  } catch {
    state.family.recentExpenses = []
  }

  return state
}
