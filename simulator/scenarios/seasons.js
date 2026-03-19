/**
 * seasons.js — Seasonal scenario phrases for September-October (v1 scope).
 *
 * Generates contextually appropriate phrases for the 8-week simulation
 * starting September 1st:
 *   - Week 1 (Sept 1-7):  Back to school
 *   - Week 3-4:           Sports seasons start
 *   - Week 5-6 (October): Settled routines, homework heavy, school meetings
 *   - Week 7-8 (late Oct): Halloween prep, autumn weather
 *
 * @module simulator/scenarios/seasons
 */

import { pickRandom } from '../utils.js';

// ─── HELPERS ────────────────────────────────────────────────

/**
 * Parse ISO date string and return week number relative to Sept 1.
 * @param {string} simDateStr - ISO date (YYYY-MM-DD)
 * @param {string} [epochStr] - reference start date (defaults to same year Sept 1)
 * @returns {number} week number (1-based), or -1 if before epoch
 */
function weekOfSim(simDateStr, epochStr) {
  const sim = new Date(simDateStr + 'T12:00:00Z');
  const year = sim.getUTCFullYear();
  const epoch = epochStr
    ? new Date(epochStr + 'T12:00:00Z')
    : new Date(Date.UTC(year, 8, 1, 12, 0, 0)); // Sept 1 of same year

  const diffMs = sim - epoch;
  if (diffMs < 0) return -1;

  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Build a ScenarioTruth-shaped object.
 * @param {Object} agent
 * @param {string} text
 * @param {Object} expected
 * @param {string} [confidence='high']
 * @param {string} [difficulty='easy']
 * @returns {import('../engine/dayLoop.js').ScenarioTruth}
 */
function makeTruth(agent, text, expected, confidence = 'high', difficulty = 'easy') {
  return {
    id: `seasonal-${agent.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agentId: agent.id,
    agentName: agent.name,
    rawText: text,
    simDate: '', // filled by dayLoop
    source: 'seasonal',
    expected: {
      intent: expected.intent,
      category: expected.category ?? null,
      shouldWrite: expected.shouldWrite ?? true,
    },
    truthConfidence: confidence,
    difficulty,
  };
}

// ─── AGENT FINDERS ──────────────────────────────────────────

/** @param {Object[]} agents */
const findByRole = (agents, role) => agents.find(a => a.role === role);
const findById = (agents, id) => agents.find(a => a.id === id);

// ─── WEEK PHRASE GENERATORS ─────────────────────────────────

/**
 * Week 1: Back-to-school phrases.
 * @param {Object[]} agents
 * @returns {import('../engine/dayLoop.js').ScenarioTruth[]}
 */
function week1_backToSchool(agents) {
  const phrases = [];

  const mamma = findById(agents, 'sim-chiara');
  const papa = findById(agents, 'sim-cristian');
  const nonna = findById(agents, 'sim-mariangela');

  if (mamma) {
    phrases.push(makeTruth(
      mamma,
      'Devo comprare i libri di scuola per Viola e Asia',
      { intent: 'task', category: 'shopping', shouldWrite: true },
    ));
    phrases.push(makeTruth(
      mamma,
      pickRandom([
        'Ho speso 180 euro di materiale scolastico',
        'Ho preso zaini e quaderni, 95 euro',
        'Comprati i libri: 210 euro in tutto',
      ]),
      { intent: 'expense', category: 'shopping', shouldWrite: true },
    ));
  }

  if (papa) {
    phrases.push(makeTruth(
      papa,
      pickRandom([
        'Lunedi primo giorno di scuola, devo organizzare gli orari',
        'Dobbiamo decidere chi porta le bambine lunedi',
      ]),
      { intent: 'task', category: 'transport', shouldWrite: true },
      'medium',
      'medium',
    ));
  }

  if (nonna) {
    phrases.push(makeTruth(
      nonna,
      pickRandom([
        'Vi preparo la merenda per il primo giorno di scuola',
        'Porto io le bambine se avete bisogno lunedi',
      ]),
      { intent: 'calendar', category: 'transport', shouldWrite: true },
      'medium',
      'medium',
    ));
  }

  return phrases;
}

/**
 * Weeks 3-4: Sports season starts.
 * @param {Object[]} agents
 * @returns {import('../engine/dayLoop.js').ScenarioTruth[]}
 */
function week3_sportsStart(agents) {
  const phrases = [];

  const mamma = findById(agents, 'sim-chiara');
  const papa = findById(agents, 'sim-cristian');

  if (mamma) {
    phrases.push(makeTruth(
      mamma,
      pickRandom([
        'Ho iscritto Viola a danza, si ricomincia martedi',
        'Viola ricomincia danza questa settimana',
      ]),
      { intent: 'calendar', category: 'activity', shouldWrite: true },
    ));
    phrases.push(makeTruth(
      mamma,
      pickRandom([
        'Asia vuole fare nuoto, l\'iscrizione costa 350 euro',
        'Ho pagato il corso di nuoto di Asia, 280 euro',
      ]),
      { intent: 'expense', category: 'activity', shouldWrite: true },
    ));
  }

  if (papa) {
    phrases.push(makeTruth(
      papa,
      pickRandom([
        'Devo comprare le scarpette da danza nuove per Viola',
        'Servono le ciabatte per la piscina di Asia',
      ]),
      { intent: 'task', category: 'shopping', shouldWrite: true },
    ));
  }

  return phrases;
}

/**
 * Weeks 5-6: Settled routines, homework-heavy, school meetings.
 * @param {Object[]} agents
 * @returns {import('../engine/dayLoop.js').ScenarioTruth[]}
 */
function week5_settledRoutine(agents) {
  const phrases = [];

  const mamma = findById(agents, 'sim-chiara');
  const papa = findById(agents, 'sim-cristian');
  const viola = findById(agents, 'sim-viola');

  if (mamma) {
    phrases.push(makeTruth(
      mamma,
      pickRandom([
        'Giovedi c\'e\' il colloquio con le maestre di Asia',
        'Ricordami la riunione a scuola mercoledi alle 17',
        'C\'e\' l\'assemblea dei genitori venerdi pomeriggio',
      ]),
      { intent: 'calendar', category: 'school', shouldWrite: true },
    ));
  }

  if (papa) {
    phrases.push(makeTruth(
      papa,
      pickRandom([
        'Devo aiutare Viola con la ricerca di scienze',
        'Stasera compiti con le bambine',
      ]),
      { intent: 'task', category: 'homework', shouldWrite: true },
      'medium',
      'medium',
    ));
  }

  if (viola) {
    phrases.push(makeTruth(
      viola,
      pickRandom([
        'Papa mi aiuti con i compiti di matematica?',
        'Ho la verifica di italiano giovedi',
      ]),
      { intent: 'task', category: 'homework', shouldWrite: true },
      'medium',
      'medium',
    ));
  }

  return phrases;
}

/**
 * Weeks 7-8: Halloween prep, autumn weather changes.
 * @param {Object[]} agents
 * @returns {import('../engine/dayLoop.js').ScenarioTruth[]}
 */
function week7_halloween(agents) {
  const phrases = [];

  const mamma = findById(agents, 'sim-chiara');
  const papa = findById(agents, 'sim-cristian');
  const viola = findById(agents, 'sim-viola');
  const nonna = findById(agents, 'sim-mariangela');

  if (mamma) {
    phrases.push(makeTruth(
      mamma,
      pickRandom([
        'Devo comprare i costumi di Halloween per le bambine',
        'Viola vuole il costume da strega, Asia da principessa',
      ]),
      { intent: 'task', category: 'shopping', shouldWrite: true },
    ));
    phrases.push(makeTruth(
      mamma,
      pickRandom([
        'Speso 45 euro per i costumi di Halloween',
        'Comprati dolcetti e decorazioni, 30 euro',
      ]),
      { intent: 'expense', category: 'shopping', shouldWrite: true },
    ));
  }

  if (papa) {
    phrases.push(makeTruth(
      papa,
      pickRandom([
        'Fa freddo, devo tirare fuori i giubbotti invernali',
        'Servono le gomme invernali, prenoto dal gommista',
      ]),
      { intent: 'task', category: 'car', shouldWrite: true },
    ));
  }

  if (viola) {
    phrases.push(makeTruth(
      viola,
      pickRandom([
        'Posso andare alla festa di Halloween da Giulia?',
        'Sabato c\'e\' la festa di Halloween a scuola!',
      ]),
      { intent: 'calendar', category: 'activity', shouldWrite: true },
      'medium',
      'medium',
    ));
  }

  if (nonna) {
    phrases.push(makeTruth(
      nonna,
      pickRandom([
        'Vi faccio la torta di zucca per Halloween',
        'Porto le castagne per le bambine',
      ]),
      { intent: 'meal', category: 'dinner', shouldWrite: true },
      'medium',
      'medium',
    ));
  }

  return phrases;
}

// ─── MAIN EXPORT ────────────────────────────────────────────

/**
 * Get seasonal phrases for the current simulation date.
 *
 * Returns 3-5 ScenarioTruth-shaped objects for weeks that have
 * seasonal triggers, or an empty array otherwise. Phrases are only
 * generated once per trigger period (first day of the trigger week).
 *
 * @param {string}   simDateStr - ISO date (YYYY-MM-DD)
 * @param {Object[]} agents     - array of agent profiles
 * @returns {import('../engine/dayLoop.js').ScenarioTruth[]}
 */
export function getSeasonalPhrases(simDateStr, agents) {
  if (!agents || agents.length === 0) return [];

  const week = weekOfSim(simDateStr);
  if (week < 1) return [];

  // Parse day-of-week (0=Sun, 6=Sat) — only trigger on Mon or Tue
  // of the relevant week to avoid spamming every day
  const d = new Date(simDateStr + 'T12:00:00Z');
  const dow = d.getUTCDay();
  if (dow !== 1 && dow !== 2) return []; // Mon=1, Tue=2

  switch (week) {
    case 1:
      return week1_backToSchool(agents);

    case 3:
    case 4:
      // Only trigger once (week 3 Monday or week 4 if week 3 was missed)
      if (week === 3 || dow === 1) return week3_sportsStart(agents);
      return [];

    case 5:
    case 6:
      if (week === 5 || dow === 1) return week5_settledRoutine(agents);
      return [];

    case 7:
    case 8:
      if (week === 7 || dow === 1) return week7_halloween(agents);
      return [];

    default:
      return [];
  }
}
