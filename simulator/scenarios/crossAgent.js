/**
 * crossAgent.js — Cross-agent interaction templates.
 *
 * Generates coordinated phrase sequences between 2-3 family members
 * to simulate real-life family coordination (logistics, expenses,
 * meal planning, task delegation).
 *
 * All cross-agent phrases are marked with truthConfidence: 'medium'
 * since they are inherently harder for the parser to handle
 * (context depends on the paired phrase).
 *
 * @module simulator/scenarios/crossAgent
 */

import { pickRandom } from '../utils.js';

// ─── HELPERS ────────────────────────────────────────────────

let _counter = 0;

/**
 * Build a ScenarioTruth-shaped object for a cross-agent phrase.
 * @param {Object}  agent
 * @param {string}  simDateStr
 * @param {string}  text
 * @param {Object}  expected
 * @param {string}  [confidence='medium']
 * @param {string}  [difficulty='medium']
 * @returns {import('../engine/dayLoop.js').ScenarioTruth}
 */
function makeTruth(agent, simDateStr, text, expected, confidence = 'medium', difficulty = 'medium') {
  _counter++;
  return {
    id: `cross-${simDateStr}-${agent.id}-${_counter}`,
    agentId: agent.id,
    agentName: agent.name,
    rawText: text,
    simDate: simDateStr,
    source: 'cross_agent',
    expected: {
      intent: expected.intent,
      category: expected.category ?? null,
      shouldWrite: expected.shouldWrite ?? true,
    },
    truthConfidence: confidence,
    difficulty,
  };
}

/** @param {Object[]} agents @param {string} id */
const byId = (agents, id) => agents.find(a => a.id === id);

// ─── INTERACTION SCENARIOS ──────────────────────────────────

/**
 * @typedef {Object} InteractionDef
 * @property {string}   name     - internal scenario name
 * @property {function} generate - (simDateStr, agents, worldState) => ScenarioTruth[]
 */

/** @type {InteractionDef[]} */
const INTERACTIONS = [

  // 1. Logistics split: Dad takes one child, Mom takes the other
  {
    name: 'logistics_split',
    generate(simDateStr, agents) {
      const papa = byId(agents, 'sim-cristian');
      const mamma = byId(agents, 'sim-chiara');
      if (!papa || !mamma) return [];

      const scenarios = [
        {
          a: { agent: papa, text: 'Porto io Viola a danza oggi' },
          b: { agent: mamma, text: 'Ok allora prendo io Asia dal nuoto' },
        },
        {
          a: { agent: mamma, text: 'Io porto Asia a scuola, tu prendi Viola' },
          b: { agent: papa, text: 'Si, passo io a prendere Viola alle 16' },
        },
        {
          a: { agent: papa, text: 'Domani mattina porto io le bambine a scuola' },
          b: { agent: mamma, text: 'Perfetto, allora io vado prima in ufficio' },
        },
        {
          a: { agent: mamma, text: 'Chi va a prendere Viola oggi' },
          b: { agent: papa, text: 'Vado io, esco prima dal lavoro' },
        },
      ];

      const chosen = pickRandom(scenarios);
      return [
        makeTruth(chosen.a.agent, simDateStr, chosen.a.text,
          { intent: 'calendar', category: 'transport', shouldWrite: true }),
        makeTruth(chosen.b.agent, simDateStr, chosen.b.text,
          { intent: 'calendar', category: 'transport', shouldWrite: true }),
      ];
    },
  },

  // 2. Expense coordination: discuss a purchase together
  {
    name: 'expense_coordination',
    generate(simDateStr, agents) {
      const mamma = byId(agents, 'sim-chiara');
      const papa = byId(agents, 'sim-cristian');
      if (!mamma || !papa) return [];

      const scenarios = [
        {
          a: { agent: mamma, text: 'Servono le scarpe nuove per Viola' },
          b: { agent: papa, text: 'Quanto costano' },
          c: { agent: mamma, text: 'Ho visto un paio da 45 euro al Decathlon' },
        },
        {
          a: { agent: papa, text: 'La macchina ha bisogno del tagliando' },
          b: { agent: mamma, text: 'Quanto ci viene a costare' },
          c: { agent: papa, text: 'Il meccanico ha detto circa 200 euro' },
        },
        {
          a: { agent: mamma, text: 'Asia ha bisogno dello zaino nuovo' },
          b: { agent: papa, text: 'Passo io a comprarlo domani' },
        },
      ];

      const chosen = pickRandom(scenarios);
      const phrases = [
        makeTruth(chosen.a.agent, simDateStr, chosen.a.text,
          { intent: 'task', category: 'shopping', shouldWrite: true }),
        makeTruth(chosen.b.agent, simDateStr, chosen.b.text,
          { intent: 'noise', category: null, shouldWrite: false },
          'medium', 'hard'),
      ];
      if (chosen.c) {
        phrases.push(makeTruth(chosen.c.agent, simDateStr, chosen.c.text,
          { intent: 'expense', category: 'shopping', shouldWrite: true }));
      }
      return phrases;
    },
  },

  // 3. Grandparent help: parent can't make it, grandparent steps in
  {
    name: 'grandparent_help',
    generate(simDateStr, agents) {
      const mamma = byId(agents, 'sim-chiara');
      const nonno = byId(agents, 'sim-roberto');
      const nonna = byId(agents, 'sim-mariangela');
      const parent = mamma || byId(agents, 'sim-cristian');
      const elder = nonno || nonna;
      if (!parent || !elder) return [];

      const scenarios = [
        {
          a: { agent: parent, text: 'Domani non riesco a prendere le bambine a scuola' },
          b: { agent: elder, text: 'Ci vado io, non vi preoccupate' },
        },
        {
          a: { agent: parent, text: 'Ho una riunione, chi porta Asia a nuoto' },
          b: { agent: elder, text: 'La porto io, passo alle 15' },
        },
        {
          a: { agent: parent, text: 'Mercoledi ho il dentista, serve qualcuno per le bambine' },
          b: { agent: elder, text: 'Vengo io a casa vostra nel pomeriggio' },
        },
      ];

      const chosen = pickRandom(scenarios);
      return [
        makeTruth(chosen.a.agent, simDateStr, chosen.a.text,
          { intent: 'calendar', category: 'transport', shouldWrite: true },
          'medium', 'hard'),
        makeTruth(chosen.b.agent, simDateStr, chosen.b.text,
          { intent: 'calendar', category: 'transport', shouldWrite: true }),
      ];
    },
  },

  // 4. Meal planning: family coordinates dinner
  {
    name: 'meal_planning',
    generate(simDateStr, agents) {
      const mamma = byId(agents, 'sim-chiara');
      const nonna = byId(agents, 'sim-mariangela');
      const papa = byId(agents, 'sim-cristian');
      if (!mamma) return [];

      const scenarios = [
        {
          a: { agent: mamma, text: 'Stasera cosa facciamo per cena' },
          b: nonna
            ? { agent: nonna, text: 'Vi porto il ragu, voi fate la pasta' }
            : { agent: papa, text: 'Ordiniamo la pizza stasera' },
        },
        {
          a: { agent: mamma, text: 'Domenica facciamo le lasagne' },
          b: nonna
            ? { agent: nonna, text: 'Le faccio io, vi porto tutto pronto' }
            : papa
            ? { agent: papa, text: 'Buona idea, compro gli ingredienti sabato' }
            : null,
        },
        {
          a: { agent: mamma, text: 'Non ho voglia di cucinare stasera' },
          b: papa
            ? { agent: papa, text: 'Passo io a prendere le pizze' }
            : null,
        },
      ];

      const chosen = pickRandom(scenarios);
      const phrases = [
        makeTruth(chosen.a.agent, simDateStr, chosen.a.text,
          { intent: 'meal', category: 'dinner', shouldWrite: true },
          'medium', 'medium'),
      ];
      if (chosen.b) {
        phrases.push(makeTruth(chosen.b.agent, simDateStr, chosen.b.text,
          { intent: 'meal', category: 'dinner', shouldWrite: true }));
      }
      return phrases;
    },
  },

  // 5. Task delegation: someone asks who does a chore
  {
    name: 'task_delegation',
    generate(simDateStr, agents) {
      const papa = byId(agents, 'sim-cristian');
      const mamma = byId(agents, 'sim-chiara');
      const viola = byId(agents, 'sim-viola');
      if (!papa) return [];

      const scenarios = [
        {
          a: { agent: papa, text: 'Chi porta fuori il cane stasera' },
          b: viola
            ? { agent: viola, text: 'Lo porto io dopo i compiti' }
            : mamma
            ? { agent: mamma, text: 'Vai tu per favore, io devo preparare la cena' }
            : null,
        },
        {
          a: { agent: mamma || papa, text: 'Bisogna mettere a posto la cameretta' },
          b: viola
            ? { agent: viola, text: 'Lo faccio dopo cena' }
            : null,
        },
        {
          a: { agent: papa, text: 'Devo portare fuori la spazzatura' },
          b: mamma
            ? { agent: mamma, text: 'Porta anche il cartone, e\' pieno' }
            : null,
        },
      ];

      const chosen = pickRandom(scenarios);
      const phrases = [
        makeTruth(chosen.a.agent, simDateStr, chosen.a.text,
          { intent: 'task', category: 'chore', shouldWrite: true },
          'medium', 'medium'),
      ];
      if (chosen.b) {
        phrases.push(makeTruth(chosen.b.agent, simDateStr, chosen.b.text,
          { intent: 'task', category: 'chore', shouldWrite: true },
          'medium', 'hard'));
      }
      return phrases;
    },
  },
];

// ─── MAIN EXPORT ────────────────────────────────────────────

/**
 * Generate a cross-agent interaction for the current simulation day.
 *
 * Picks one of the interaction templates at random and generates
 * 2-3 coordinated ScenarioTruth phrases.
 *
 * @param {string}   simDateStr  - ISO date (YYYY-MM-DD)
 * @param {Object[]} agents      - agent profiles
 * @param {import('../engine/worldState.js').WorldState} worldState
 * @returns {import('../engine/dayLoop.js').ScenarioTruth[]}
 */
export function generateCrossAgentInteraction(simDateStr, agents, worldState) {
  if (!agents || agents.length < 2) return [];

  const interaction = pickRandom(INTERACTIONS);

  try {
    const phrases = interaction.generate(simDateStr, agents, worldState);
    return phrases.filter(Boolean);
  } catch (err) {
    console.warn(`[CrossAgent] Interaction "${interaction.name}" failed: ${err.message}`);
    return [];
  }
}

/**
 * Get the list of all interaction names (for testing / inspection).
 * @returns {string[]}
 */
export function listInteractionNames() {
  return INTERACTIONS.map(i => i.name);
}
