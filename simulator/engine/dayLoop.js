/**
 * dayLoop.js — Single-day simulation loop.
 *
 * Generates all ScenarioTruth phrases for one simulated day by combining:
 *   1. Agent routine phrases (from phraseGenerator)
 *   2. Seasonal scenario phrases (from scenarios/seasons)
 *   3. Random events (~10 % chance)
 *   4. Cross-agent interactions (~15 % chance)
 *   5. Edit actions (~10 % of total phrases)
 *
 * Phrases are returned but NOT executed — the caller (weekLoop) handles execution.
 *
 * @module simulator/engine/dayLoop
 */

import { generateRoutinePhrases } from './phraseGenerator.js';
import { getSeasonalPhrases } from '../scenarios/seasons.js';
import { rollRandomEvent } from '../scenarios/randomEvents.js';
import { generateCrossAgentInteraction } from '../scenarios/crossAgent.js';
import { generateEditActions } from '../scenarios/editActions.js';
import { pickRandom } from '../utils.js';

// ─── DEFAULTS ───────────────────────────────────────────────

/** @type {import('./weekLoop.js').SimConfig} */
const DEFAULT_CONFIG = {
  randomEventChance: 0.10,
  crossAgentChance: 0.15,
  editActionRate: 0.10,
};

// ─── HELPERS ────────────────────────────────────────────────

/**
 * Fisher-Yates shuffle (in-place, returns same array).
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
/**
 * Normalize a scenario phrase from any source (seasonal, random, cross-agent)
 * to the standard ScenarioTruth shape used by phraseExecutor.
 * Maps: rawText→text, agentName→agent, simDate→simulatedDate
 */
function normalizeScenario(phrase, simDateStr) {
  return {
    text: phrase.text || phrase.rawText || '',
    agent: phrase.agent || phrase.agentName || 'Unknown',
    agentId: phrase.agentId || null,
    simulatedDate: phrase.simulatedDate || phrase.simDate || simDateStr,
    truthConfidence: phrase.truthConfidence || 'medium',
    expected: {
      intent: phrase.expected?.intent || 'unknown',
      entities: phrase.expected?.entities || {},
      dbEffect: phrase.expected?.dbEffect || null,
      shouldWrite: phrase.expected?.shouldWrite ?? false,
    },
    actual: { intent: null, confidence: null, entities: {}, dbEffect: null, resolverStatus: null },
    errorType: null,
    errorCause: null,
    source: phrase.source || 'unknown',
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── MAIN ───────────────────────────────────────────────────

/**
 * @typedef {Object} ScenarioTruth
 * @property {string}  id              - unique phrase ID (e.g. "day-2025-09-03-cristian-0")
 * @property {string}  agentId         - agent id (e.g. "sim-cristian")
 * @property {string}  agentName       - display name (e.g. "Cristian")
 * @property {string}  rawText         - the Italian phrase to send to the Brain
 * @property {string}  simDate         - ISO date (YYYY-MM-DD)
 * @property {string}  source          - origin: 'routine' | 'seasonal' | 'random_event' | 'cross_agent' | 'edit_action'
 * @property {Object}  expected        - ground-truth expectations
 * @property {string}  expected.intent - expected intent (e.g. 'expense', 'calendar', 'task', 'noise', 'edit_action')
 * @property {string|null} expected.category - expected category or null
 * @property {boolean} expected.shouldWrite  - whether the Brain should persist a record
 * @property {string}  truthConfidence - 'high' | 'medium' | 'low'
 * @property {string}  difficulty      - 'easy' | 'medium' | 'hard'
 */

/**
 * Generate all phrases for a single simulated day.
 *
 * @param {string}   simDateStr  - ISO date (YYYY-MM-DD) for this day
 * @param {Object[]} agents      - array of agent profiles (from agents/index.js)
 * @param {import('./worldState.js').WorldState} worldState - current world state
 * @param {Object}   [config]    - tuning knobs
 * @param {number}   [config.randomEventChance=0.10]  - probability of a random event
 * @param {number}   [config.crossAgentChance=0.15]   - probability of cross-agent interaction
 * @param {number}   [config.editActionRate=0.10]      - fraction of total phrases to be edit actions
 * @param {Object}   [config.db]       - Dexie db instance (needed for edit actions)
 * @param {string}   [config.familyId] - family ID (needed for edit actions)
 * @returns {Promise<ScenarioTruth[]>} shuffled array of phrases (not yet executed)
 */
export async function runDay(simDateStr, agents, worldState, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  /** @type {ScenarioTruth[]} */
  const allPhrases = [];

  // ── 1. Routine phrases for each agent ──────────────────────

  for (const agent of agents) {
    try {
      const routinePhrases = generateRoutinePhrases(agent, simDateStr, worldState);
      for (let i = 0; i < routinePhrases.length; i++) {
        // phraseGenerator returns ScenarioTruth with .text, .expected, etc.
        // Just add source tag and push directly.
        const scenario = routinePhrases[i]
        scenario.source = 'routine'
        scenario.simulatedDate = scenario.simulatedDate || simDateStr
        allPhrases.push(scenario)
      }
    } catch (err) {
      console.warn(`[DayLoop] Routine phrases failed for ${agent.name}: ${err.message}`);
    }
  }

  // ── 2. Seasonal scenario phrases ───────────────────────────

  try {
    const seasonal = getSeasonalPhrases(simDateStr, agents);
    for (const phrase of seasonal) {
      allPhrases.push(normalizeScenario(phrase, simDateStr))
    }
  } catch (err) {
    console.warn(`[DayLoop] Seasonal phrases failed: ${err.message}`);
  }

  // ── 3. Random event roll ───────────────────────────────────

  if (Math.random() < cfg.randomEventChance) {
    try {
      const eventPhrases = rollRandomEvent(simDateStr, agents, worldState);
      for (const phrase of eventPhrases) {
        allPhrases.push(normalizeScenario(phrase, simDateStr))
      }
    } catch (err) {
      console.warn(`[DayLoop] Random event failed: ${err.message}`);
    }
  }

  // ── 4. Cross-agent interaction roll ────────────────────────

  const activeAgents = agents.filter(a => a.weeklyRoutine && a.weeklyRoutine.length > 0);
  if (activeAgents.length >= 2 && Math.random() < cfg.crossAgentChance) {
    try {
      const crossPhrases = generateCrossAgentInteraction(simDateStr, agents, worldState);
      for (const phrase of crossPhrases) {
        allPhrases.push(normalizeScenario(phrase, simDateStr))
      }
    } catch (err) {
      console.warn(`[DayLoop] Cross-agent interaction failed: ${err.message}`);
    }
  }

  // ── 5. Edit actions (only if worldState has records) ───────

  const hasRecords =
    (worldState.family.openTasks.length > 0) ||
    (worldState.family.upcomingEvents.length > 0);

  if (hasRecords && cfg.db && cfg.familyId) {
    const targetCount = Math.max(1, Math.round(allPhrases.length * cfg.editActionRate));
    try {
      const editPhrases = await generateEditActions(
        simDateStr,
        agents,
        worldState,
        cfg.db,
        cfg.familyId,
      );
      // Take at most targetCount edit phrases
      const limited = editPhrases.slice(0, targetCount);
      for (const phrase of limited) {
        allPhrases.push(normalizeScenario(phrase, simDateStr))
      }
    } catch (err) {
      console.warn(`[DayLoop] Edit actions failed: ${err.message}`);
    }
  }

  // ── 6. Shuffle all phrases ─────────────────────────────────

  shuffle(allPhrases);

  return allPhrases;
}
