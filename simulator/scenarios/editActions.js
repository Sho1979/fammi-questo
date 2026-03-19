/**
 * editActions.js — Generate edit/cancel/move phrases targeting real DB records.
 *
 * Produces natural Italian phrases that instruct the Brain to modify,
 * cancel, or reschedule existing events and tasks. Only parent agents
 * generate edit actions.
 *
 * Each phrase has:
 *   - expected.intent = 'edit_action'
 *   - shouldWrite = false (edits modify existing records, don't create new ones)
 *   - truthConfidence = 'high' for clear edits, 'medium' for ambiguous
 *
 * @module simulator/scenarios/editActions
 */

import { pickRandom, dateRef, dayOfWeekIT } from '../utils.js';
import { PARENT_AGENTS } from '../agents/index.js';

// ─── HELPERS ────────────────────────────────────────────────

let _counter = 0;

/**
 * Build a ScenarioTruth-shaped object for an edit action.
 * @param {Object}  agent
 * @param {string}  simDateStr
 * @param {string}  text
 * @param {Object}  expected
 * @param {string}  [confidence='high']
 * @param {string}  [difficulty='medium']
 * @returns {import('../engine/dayLoop.js').ScenarioTruth}
 */
function makeTruth(agent, simDateStr, text, expected, confidence = 'high', difficulty = 'medium') {
  _counter++;
  return {
    id: `edit-${simDateStr}-${agent.id}-${_counter}`,
    agentId: agent.id,
    agentName: agent.name,
    rawText: text,
    simDate: simDateStr,
    source: 'edit_action',
    expected: {
      intent: 'edit_action',
      category: expected.category ?? null,
      shouldWrite: false,
      editType: expected.editType ?? 'delete',
      targetId: expected.targetId ?? null,
    },
    truthConfidence: confidence,
    difficulty,
  };
}

// ─── DATE ARITHMETIC ────────────────────────────────────────

/**
 * Add days to an ISO date string.
 * @param {string} isoDate
 * @param {number} days
 * @returns {string} ISO date
 */
function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ─── DELETE PHRASE GENERATORS ───────────────────────────────

/**
 * Generate a "delete" phrase for an event.
 * @param {Object}  agent
 * @param {string}  simDateStr
 * @param {Object}  event - event record from worldState
 * @returns {import('../engine/dayLoop.js').ScenarioTruth}
 */
function deleteEventPhrase(agent, simDateStr, event) {
  const title = (event.title || event.description || 'l\'appuntamento').toLowerCase();
  const evDate = event.date || event.start_date || '';
  const ref = evDate ? dateRef(simDateStr, evDate) : '';

  const templates = [
    `Cancella ${title}${ref ? ' di ' + ref : ''}`,
    `Togli ${title} dal calendario`,
    `Non serve piu\' ${title}${ref ? ' ' + ref : ''}`,
    `Annulla ${title}`,
    `${title} e\' saltato, toglilo`,
  ];

  return makeTruth(agent, simDateStr, pickRandom(templates), {
    editType: 'delete',
    category: event.category || null,
    targetId: event.id,
  }, 'high', 'medium');
}

/**
 * Generate a "delete" phrase for a task.
 * @param {Object}  agent
 * @param {string}  simDateStr
 * @param {Object}  task - task record from worldState
 * @returns {import('../engine/dayLoop.js').ScenarioTruth}
 */
function deleteTaskPhrase(agent, simDateStr, task) {
  // Shorten title to first 3-4 words max, like a real user would say
  const fullTitle = (task.title || task.description || 'la cosa da fare').toLowerCase();
  const title = fullTitle.split(/\s+/).slice(0, 4).join(' ');

  const templates = [
    `Cancella ${title} dalla lista`,
    `Togli ${title}, non serve piu\'`,
    `Ho gia\' fatto ${title}`,
    `${title} e\' fatto, toglilo`,
    `Cancella ${title}`,
  ];

  return makeTruth(agent, simDateStr, pickRandom(templates), {
    editType: 'delete',
    category: task.category || null,
    targetId: task.id,
  }, 'high', 'easy');
}

// ─── MOVE PHRASE GENERATORS ─────────────────────────────────

/**
 * Generate a "move" phrase for an event.
 * @param {Object}  agent
 * @param {string}  simDateStr
 * @param {Object}  event - event record from worldState
 * @returns {import('../engine/dayLoop.js').ScenarioTruth}
 */
function moveEventPhrase(agent, simDateStr, event) {
  const title = (event.title || event.description || 'l\'appuntamento').toLowerCase();

  // Pick a new target: 2-5 days ahead
  const offsetDays = Math.floor(Math.random() * 4) + 2;
  const newDate = addDays(simDateStr, offsetDays);
  const newRef = dateRef(simDateStr, newDate);
  const newDayName = dayOfWeekIT(newDate);

  const templates = [
    `Sposta ${title} a ${newRef}`,
    `Cambia ${title} a ${newDayName}`,
    `${title} va spostato a ${newRef}`,
    `Sposta ${title} a settimana prossima`,
    `Possiamo spostare ${title} a ${newDayName}?`,
  ];

  // "settimana prossima" is ambiguous -> lower confidence
  const text = pickRandom(templates);
  const isAmbiguous = text.includes('settimana prossima') || text.includes('Possiamo');

  return makeTruth(agent, simDateStr, text, {
    editType: 'move',
    category: event.category || null,
    targetId: event.id,
  }, isAmbiguous ? 'medium' : 'high', isAmbiguous ? 'hard' : 'medium');
}

// ─── MAIN EXPORT ────────────────────────────────────────────

/**
 * Generate edit/cancel/move phrases targeting real records from worldState.
 *
 * Steps:
 *   1. Query upcoming events and open tasks from worldState
 *   2. If no records, return empty array
 *   3. Pick 1-2 records as targets
 *   4. Generate appropriate Italian edit phrases
 *   5. Only parent agents generate edit_action phrases
 *
 * @param {string}   simDateStr  - ISO date (YYYY-MM-DD)
 * @param {Object[]} agents      - agent profiles
 * @param {import('../engine/worldState.js').WorldState} worldState
 * @param {Object}   db          - Dexie database instance (reserved for future direct queries)
 * @param {string}   familyId    - family identifier
 * @returns {Promise<import('../engine/dayLoop.js').ScenarioTruth[]>}
 */
export async function generateEditActions(simDateStr, agents, worldState, db, familyId) {
  /** @type {import('../engine/dayLoop.js').ScenarioTruth[]} */
  const phrases = [];

  // ── 1. Collect available targets ───────────────────────────

  const events = worldState.family.upcomingEvents || [];
  const tasks = worldState.family.openTasks || [];

  const allTargets = [
    ...events.map(e => ({ type: 'event', record: e })),
    ...tasks.map(t => ({ type: 'task', record: t })),
  ];

  if (allTargets.length === 0) return phrases;

  // ── 2. Pick parent agents for edit actions ─────────────────

  const parentAgents = agents.filter(
    a => a.role === 'papa' || a.role === 'mamma' || a.role === 'genitore',
  );
  if (parentAgents.length === 0) return phrases;

  // ── 3. Pick 1-2 targets ────────────────────────────────────

  const targetCount = Math.min(
    allTargets.length,
    Math.random() < 0.5 ? 1 : 2,
  );

  // Shuffle targets to avoid always picking the same ones
  const shuffled = [...allTargets].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, targetCount);

  // ── 4. Generate phrases for each target ────────────────────

  for (const target of selected) {
    const agent = pickRandom(parentAgents);

    try {
      // 60% delete, 40% move (only events can be moved)
      const isMove = target.type === 'event' && Math.random() < 0.4;

      if (isMove) {
        phrases.push(moveEventPhrase(agent, simDateStr, target.record));
      } else if (target.type === 'event') {
        phrases.push(deleteEventPhrase(agent, simDateStr, target.record));
      } else {
        phrases.push(deleteTaskPhrase(agent, simDateStr, target.record));
      }
    } catch (err) {
      console.warn(
        `[EditActions] Failed to generate edit for ${target.type} "${target.record.id}": ${err.message}`,
      );
    }
  }

  return phrases;
}
