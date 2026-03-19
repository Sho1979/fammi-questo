/**
 * weekLoop.js — Main multi-week simulation orchestrator.
 *
 * Runs N weeks of simulated family life:
 *   - Creates world state
 *   - Iterates day by day, generating and executing phrases
 *   - Refreshes world state from DB every 7 days
 *   - Logs weekly progress stats
 *
 * @module simulator/engine/weekLoop
 */

import { createWorldState, advanceDay, updateAfterPhrase, refreshFromDB } from './worldState.js';
import { runDay } from './dayLoop.js';
import { simDate } from '../utils.js';

// ─── TYPES ──────────────────────────────────────────────────

/**
 * @typedef {Object} SimConfig
 * @property {number}  [weeks=8]              - number of weeks to simulate
 * @property {string}  [startDate='2025-09-01'] - ISO start date
 * @property {number}  [randomEventChance=0.10] - daily probability of a random event
 * @property {number}  [crossAgentChance=0.15]  - daily probability of cross-agent interaction
 * @property {number}  [editActionRate=0.10]    - fraction of phrases that should be edit actions
 * @property {boolean} [dryRun=false]           - if true, generate phrases but skip execution
 */

/**
 * @typedef {Object} WeeklyStat
 * @property {number} week           - week number (1-based)
 * @property {number} phrasesGenerated
 * @property {number} phrasesExecuted
 * @property {number} correct        - phrases where Brain output matched expected truth
 * @property {number} total          - total executed (same as phrasesExecuted)
 */

/**
 * @typedef {Object} SimulationResult
 * @property {import('./dayLoop.js').ScenarioTruth[]} allResults  - every generated phrase with execution results
 * @property {WeeklyStat[]} weeklyStats
 * @property {import('./worldState.js').WorldState} worldState    - final world state
 */

// ─── DEFAULT CONFIG ─────────────────────────────────────────

/** @type {SimConfig} */
const DEFAULT_CONFIG = {
  weeks: 8,
  startDate: '2025-09-01',
  randomEventChance: 0.10,
  crossAgentChance: 0.15,
  editActionRate: 0.10,
  dryRun: false,
};

// ─── MAIN ───────────────────────────────────────────────────

/**
 * Run the full multi-week family life simulation.
 *
 * @param {string}   familyId  - family identifier (e.g. 'sim-family-001')
 * @param {Object[]} members   - member records from setup.js
 * @param {Object[]} agents    - agent profiles from agents/index.js
 * @param {Object}   db        - Dexie database instance
 * @param {SimConfig} [config] - simulation configuration
 * @returns {Promise<SimulationResult>}
 */
export async function runSimulation(familyId, members, agents, db, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // ── 1. Create initial world state ──────────────────────────

  const worldState = createWorldState(familyId, members, cfg.startDate);

  // ── 2. Lazy-import phraseExecutor to avoid circular deps ───

  let executeBatch = null;
  if (!cfg.dryRun) {
    try {
      const executor = await import('./phraseExecutor.js');
      executeBatch = executor.executeBatch;
    } catch (err) {
      console.warn(`[WeekLoop] phraseExecutor not available, switching to dryRun: ${err.message}`);
      cfg.dryRun = true;
    }
  }

  // ── 3. Accumulate results ──────────────────────────────────

  /** @type {import('./dayLoop.js').ScenarioTruth[]} */
  const allResults = [];

  /** @type {WeeklyStat[]} */
  const weeklyStats = [];

  const totalDays = cfg.weeks * 7;

  // ── 4. Main loop: week by week, day by day ─────────────────

  for (let week = 0; week < cfg.weeks; week++) {
    let weekPhrases = 0;
    let weekExecuted = 0;
    let weekCorrect = 0;

    for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
      const dayOffset = week * 7 + dayInWeek;
      const simDateStr = simDate(cfg.startDate, dayOffset);

      // Advance world state to new day
      advanceDay(worldState, simDateStr);

      // Generate all phrases for this day
      let dayPhrases;
      try {
        dayPhrases = await runDay(simDateStr, agents, worldState, {
          randomEventChance: cfg.randomEventChance,
          crossAgentChance: cfg.crossAgentChance,
          editActionRate: cfg.editActionRate,
          db,
          familyId,
        });
      } catch (err) {
        console.error(`[WeekLoop] Day ${simDateStr} generation failed: ${err.message}`);
        dayPhrases = [];
      }

      weekPhrases += dayPhrases.length;

      // Execute phrases (or skip in dryRun mode)
      if (!cfg.dryRun && executeBatch && dayPhrases.length > 0) {
        try {
          // Build currentMemberMap: agentId → member record
          const currentMemberMap = {}
          for (const m of members) { currentMemberMap[m.id] = m }
          const { results: batchResults } = await executeBatch(
            dayPhrases, members, familyId, db,
            { currentMemberMap }
          )
          const results = batchResults;

          // results ARE the scenarioTruth objects with .actual and .errorType filled in
          for (const result of results) {
            result.executed = true
            result.correct = result.errorType === null

            if (result.correct) weekCorrect++
            weekExecuted++

            // Update world state with the result
            try {
              updateAfterPhrase(
                worldState,
                result.agentId || result.agent,
                {
                  intent: result.actual?.intent ?? result.expected?.intent,
                  rawText: result.text,
                  confidence: result.actual?.confidence ?? 0,
                },
              );
            } catch (_) {
              // Non-critical — world state update is best-effort
            }
          }
        } catch (execErr) {
          console.error(`[WeekLoop] Batch execution failed on ${simDateStr}: ${execErr.message}`);
          // Mark all phrases as not executed
          for (const phrase of dayPhrases) {
            phrase.executed = false;
            phrase.correct = false;
          }
        }
      } else {
        // Dry run: mark all as not executed
        for (const phrase of dayPhrases) {
          phrase.executed = false;
          phrase.correct = null;
        }
      }

      allResults.push(...dayPhrases);
    }

    // ── Weekly DB refresh (every 7 days) ───────────────────

    try {
      await refreshFromDB(worldState, db);
    } catch (err) {
      console.warn(`[WeekLoop] DB refresh failed after week ${week + 1}: ${err.message}`);
    }

    // ── Weekly stats ───────────────────────────────────────

    const stat = {
      week: week + 1,
      phrasesGenerated: weekPhrases,
      phrasesExecuted: weekExecuted,
      correct: weekCorrect,
      total: weekExecuted,
    };
    weeklyStats.push(stat);

    const pct = weekExecuted > 0
      ? ((weekCorrect / weekExecuted) * 100).toFixed(1)
      : 'N/A';
    console.log(
      `Week ${week + 1}/${cfg.weeks}: ${weekPhrases} phrases, ${weekCorrect}/${weekExecuted} correct (${pct}%)`,
    );
  }

  // ── 5. Return final results ────────────────────────────────

  return {
    allResults,
    weeklyStats,
    worldState,
  };
}
