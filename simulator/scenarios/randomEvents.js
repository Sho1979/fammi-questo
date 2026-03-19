/**
 * randomEvents.js — Pool of random life events for the simulation.
 *
 * Each event has a per-day probability and generates 1-3 ScenarioTruth
 * phrases involving the appropriate family agents.
 *
 * Events are rolled independently by the dayLoop; this module handles
 * the internal probability weighting and phrase generation.
 *
 * @module simulator/scenarios/randomEvents
 */

import { pickRandom, pickWeighted, dateRef } from '../utils.js';

// ─── HELPERS ────────────────────────────────────────────────

let _counter = 0;

/**
 * Build a ScenarioTruth-shaped object for a random event.
 * @param {Object}  agent
 * @param {string}  simDateStr
 * @param {string}  text
 * @param {Object}  expected
 * @param {string}  [confidence='high']
 * @param {string}  [difficulty='easy']
 * @returns {import('../engine/dayLoop.js').ScenarioTruth}
 */
function makeTruth(agent, simDateStr, text, expected, confidence = 'high', difficulty = 'easy') {
  _counter++;
  return {
    id: `rnd-${simDateStr}-${agent.id}-${_counter}`,
    agentId: agent.id,
    agentName: agent.name,
    rawText: text,
    simDate: simDateStr,
    source: 'random_event',
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

/** @param {Object[]} agents @param {string} role */
const byRole = (agents, role) => agents.find(a => a.role === role);

/** Get a random parent agent */
const randomParent = (agents) =>
  pickRandom(agents.filter(a => a.role === 'papa' || a.role === 'mamma' || a.role === 'genitore'));

/** Get a random child agent */
const randomChild = (agents) =>
  pickRandom(agents.filter(a => a.role === 'figlio' || a.role === 'figlia'));

// ─── EVENT DEFINITIONS ──────────────────────────────────────

/**
 * @typedef {Object} EventDef
 * @property {string}   name        - internal event name
 * @property {number}   probability - per-day trigger probability
 * @property {function} generate    - (simDateStr, agents, worldState) => ScenarioTruth[]
 */

/** @type {EventDef[]} */
const EVENTS = [

  // 1. Child sick — parent reports absence + buys medicine
  {
    name: 'child_sick',
    probability: 0.03,
    generate(simDateStr, agents) {
      const phrases = [];
      const parent = randomParent(agents);
      const child = randomChild(agents);
      if (!parent || !child) return phrases;

      phrases.push(makeTruth(parent, simDateStr,
        `${child.name} sta male, ${pickRandom(['ha la febbre', 'ha mal di pancia', 'ha il raffreddore'])}. Oggi niente scuola`,
        { intent: 'calendar', category: 'absence', shouldWrite: true },
      ));
      phrases.push(makeTruth(parent, simDateStr,
        pickRandom([
          'Passo in farmacia a prendere il Tachipirina',
          `Comprata la medicina per ${child.name}, 12 euro`,
          'Devo andare in farmacia per lo sciroppo',
        ]),
        { intent: 'expense', category: 'health', shouldWrite: true },
      ));
      return phrases;
    },
  },

  // 2. Car breakdown — expense + grandpa transport backup
  {
    name: 'car_breakdown',
    probability: 0.005,
    generate(simDateStr, agents) {
      const phrases = [];
      const papa = byId(agents, 'sim-cristian');
      const nonno = byId(agents, 'sim-roberto');
      if (!papa) return phrases;

      phrases.push(makeTruth(papa, simDateStr,
        pickRandom([
          'La macchina non parte, devo chiamare il meccanico',
          'Si e\' accesa la spia del motore, porto la macchina in officina',
          'Ho forato una gomma, devo farla cambiare',
        ]),
        { intent: 'task', category: 'car', shouldWrite: true },
      ));
      phrases.push(makeTruth(papa, simDateStr,
        pickRandom([
          'Il meccanico ha detto 350 euro di riparazione',
          'Speso 120 euro dal gommista',
          'La riparazione costa 280 euro',
        ]),
        { intent: 'expense', category: 'car', shouldWrite: true },
      ));

      if (nonno) {
        phrases.push(makeTruth(nonno, simDateStr,
          'Vengo io a prendere le bambine oggi che Cristian ha la macchina rotta',
          { intent: 'calendar', category: 'transport', shouldWrite: true },
          'medium', 'medium',
        ));
      }
      return phrases;
    },
  },

  // 3. Birthday party invitation
  {
    name: 'birthday_party',
    probability: 0.02,
    generate(simDateStr, agents) {
      const phrases = [];
      const parent = randomParent(agents);
      const child = randomChild(agents);
      if (!parent || !child) return phrases;

      const amico = pickRandom(['Giulia', 'Marco', 'Sofia', 'Lorenzo', 'Emma', 'Luca']);
      const giorno = pickRandom(['sabato', 'domenica']);

      phrases.push(makeTruth(parent, simDateStr,
        `${child.name} e\' invitata alla festa di ${amico} ${giorno} pomeriggio`,
        { intent: 'calendar', category: 'activity', shouldWrite: true },
      ));
      phrases.push(makeTruth(parent, simDateStr,
        pickRandom([
          `Devo comprare il regalo per ${amico}`,
          `Comprato il regalo per la festa, 25 euro`,
          `Preso un gioco per ${amico}, 20 euro`,
        ]),
        { intent: 'expense', category: 'shopping', shouldWrite: true },
      ));
      return phrases;
    },
  },

  // 4. Plumber call
  {
    name: 'plumber',
    probability: 0.008,
    generate(simDateStr, agents) {
      const phrases = [];
      const parent = randomParent(agents);
      if (!parent) return phrases;

      phrases.push(makeTruth(parent, simDateStr,
        pickRandom([
          'Perde il rubinetto del bagno, devo chiamare l\'idraulico',
          'Il lavandino e\' intasato, serve l\'idraulico',
          'Si e\' rotta la lavatrice, chiamo il tecnico',
        ]),
        { intent: 'task', category: 'home', shouldWrite: true },
      ));
      phrases.push(makeTruth(parent, simDateStr,
        pickRandom([
          'L\'idraulico viene domani alle 10',
          'Il tecnico puo\' martedi mattina',
        ]),
        { intent: 'calendar', category: 'home', shouldWrite: true },
        'medium', 'medium',
      ));
      return phrases;
    },
  },

  // 5. Family dinner
  {
    name: 'family_dinner',
    probability: 0.03,
    generate(simDateStr, agents) {
      const phrases = [];
      const mamma = byId(agents, 'sim-chiara');
      const nonna = byId(agents, 'sim-mariangela');

      if (mamma) {
        phrases.push(makeTruth(mamma, simDateStr,
          pickRandom([
            'Stasera vengono a cena i nonni',
            'Domenica pranzo tutti insieme dai nonni',
            'Organizziamo una cena di famiglia sabato sera',
          ]),
          { intent: 'calendar', category: 'dinner', shouldWrite: true },
        ));
        phrases.push(makeTruth(mamma, simDateStr,
          pickRandom([
            'Devo fare la spesa per la cena di famiglia',
            'Comprate le cose per la cena, 60 euro',
          ]),
          { intent: 'expense', category: 'shopping', shouldWrite: true },
        ));
      }

      if (nonna) {
        phrases.push(makeTruth(nonna, simDateStr,
          pickRandom([
            'Vi porto il tiramisu per stasera',
            'Preparo io il primo, voi pensate al secondo',
          ]),
          { intent: 'meal', category: 'dinner', shouldWrite: true },
          'medium', 'medium',
        ));
      }

      return phrases;
    },
  },

  // 6. School meeting
  {
    name: 'school_meeting',
    probability: 0.02,
    generate(simDateStr, agents) {
      const phrases = [];
      const parent = randomParent(agents);
      if (!parent) return phrases;

      phrases.push(makeTruth(parent, simDateStr,
        pickRandom([
          'Mercoledi c\'e\' il colloquio con la maestra alle 16:30',
          'Hanno messo la riunione dei genitori giovedi alle 17',
          'Devo andare al ricevimento dei professori venerdi',
        ]),
        { intent: 'calendar', category: 'school', shouldWrite: true },
      ));
      return phrases;
    },
  },

  // 7. Dentist emergency
  {
    name: 'dentist_emergency',
    probability: 0.01,
    generate(simDateStr, agents) {
      const phrases = [];
      const parent = randomParent(agents);
      const child = randomChild(agents);
      if (!parent || !child) return phrases;

      phrases.push(makeTruth(parent, simDateStr,
        `${child.name} ha mal di denti, devo prenotare il dentista`,
        { intent: 'calendar', category: 'health', shouldWrite: true },
      ));
      phrases.push(makeTruth(parent, simDateStr,
        pickRandom([
          'Dentista prenotato per domani, 80 euro la visita',
          'Il dentista costa 120 euro',
        ]),
        { intent: 'expense', category: 'health', shouldWrite: true },
      ));
      return phrases;
    },
  },

  // 8. Weather cancellation
  {
    name: 'weather_cancel',
    probability: 0.02,
    generate(simDateStr, agents) {
      const phrases = [];
      const parent = randomParent(agents);
      if (!parent) return phrases;

      phrases.push(makeTruth(parent, simDateStr,
        pickRandom([
          'Piove troppo, oggi niente parco',
          'Con questo temporale saltiamo la passeggiata',
          'Annullata la partita per pioggia',
          'Troppo freddo per il giro in bici, restiamo a casa',
        ]),
        { intent: 'calendar', category: 'absence', shouldWrite: false },
        'high', 'easy',
      ));
      return phrases;
    },
  },

  // 9. Lost item
  {
    name: 'lost_item',
    probability: 0.01,
    generate(simDateStr, agents) {
      const phrases = [];
      const parent = randomParent(agents);
      const child = randomChild(agents);
      if (!parent || !child) return phrases;

      const item = pickRandom([
        'la felpa della scuola', 'l\'astuccio', 'la borraccia',
        'il diario', 'le scarpe da ginnastica',
      ]);

      phrases.push(makeTruth(parent, simDateStr,
        `${child.name} ha perso ${item}, devo ricomprarl${item.startsWith('le') ? 'e' : item.startsWith('l\'') ? 'o' : 'a'}`,
        { intent: 'task', category: 'shopping', shouldWrite: true },
        'high', 'medium',
      ));
      return phrases;
    },
  },

  // 10. Grandparent visit
  {
    name: 'grandparent_visit',
    probability: 0.04,
    generate(simDateStr, agents) {
      const phrases = [];
      const nonna = byId(agents, 'sim-mariangela');
      const nonno = byId(agents, 'sim-roberto');
      const mamma = byId(agents, 'sim-chiara');

      const elder = nonna || nonno;
      if (!elder) return phrases;

      phrases.push(makeTruth(elder, simDateStr,
        pickRandom([
          'Passo nel pomeriggio a trovare le bambine',
          'Vengo a pranzo da voi domani',
          'Oggi sto io con le bambine dopo scuola',
        ]),
        { intent: 'calendar', category: 'visit', shouldWrite: true },
      ));

      if (mamma) {
        phrases.push(makeTruth(mamma, simDateStr,
          pickRandom([
            'La nonna viene a pranzo, preparo la pasta al forno',
            'I nonni vengono, faccio un dolce',
          ]),
          { intent: 'meal', category: 'dinner', shouldWrite: true },
        ));
      }

      return phrases;
    },
  },

  // 11. Friend playdate
  {
    name: 'friend_playdate',
    probability: 0.03,
    generate(simDateStr, agents) {
      const phrases = [];
      const child = randomChild(agents);
      const parent = randomParent(agents);
      if (!child || !parent) return phrases;

      const amico = pickRandom(['Giulia', 'Marco', 'Sofia', 'Lorenzo', 'Emma', 'Chiara']);

      phrases.push(makeTruth(child, simDateStr,
        `Posso invitare ${amico} a giocare ${pickRandom(['domani', 'sabato', 'dopo scuola'])}?`,
        { intent: 'calendar', category: 'activity', shouldWrite: true },
        'medium', 'medium',
      ));
      phrases.push(makeTruth(parent, simDateStr,
        `Ok, ${amico} viene ${pickRandom(['domani pomeriggio', 'sabato mattina', 'dopo pranzo'])}`,
        { intent: 'calendar', category: 'activity', shouldWrite: true },
      ));

      return phrases;
    },
  },

  // 12. Urgent grocery run
  {
    name: 'grocery_run',
    probability: 0.05,
    generate(simDateStr, agents) {
      const phrases = [];
      const parent = randomParent(agents);
      if (!parent) return phrases;

      phrases.push(makeTruth(parent, simDateStr,
        pickRandom([
          'Finito il latte, passo al Conad prima di tornare',
          'Manca il pane, devo fare un salto al supermercato',
          'Servono le uova e la farina, vado a fare spesa veloce',
          'Non c\'e\' piu\' niente in frigo, devo fare spesa',
        ]),
        { intent: 'task', category: 'shopping', shouldWrite: true },
      ));
      return phrases;
    },
  },
];

// ─── MAIN EXPORT ────────────────────────────────────────────

/**
 * Roll for a random event and generate associated phrases.
 *
 * Internally rolls each event's independent probability. If multiple
 * events trigger, only the first one is used (to keep volume reasonable).
 *
 * @param {string}   simDateStr  - ISO date (YYYY-MM-DD)
 * @param {Object[]} agents      - agent profiles
 * @param {import('../engine/worldState.js').WorldState} worldState
 * @returns {import('../engine/dayLoop.js').ScenarioTruth[]}
 */
export function rollRandomEvent(simDateStr, agents, worldState) {
  if (!agents || agents.length === 0) return [];

  // Collect all events that triggered
  const triggered = [];

  for (const evt of EVENTS) {
    if (Math.random() < evt.probability) {
      triggered.push(evt);
    }
  }

  if (triggered.length === 0) return [];

  // Pick the first triggered event (or weight towards rarer ones)
  const chosen = triggered.length === 1
    ? triggered[0]
    : pickWeighted(
        triggered,
        triggered.map(e => 1 / (e.probability + 0.001)), // rarer events get higher weight
      );

  try {
    return chosen.generate(simDateStr, agents, worldState);
  } catch (err) {
    console.warn(`[RandomEvents] Event "${chosen.name}" generation failed: ${err.message}`);
    return [];
  }
}

/**
 * Get the list of all event names (for testing / inspection).
 * @returns {string[]}
 */
export function listEventNames() {
  return EVENTS.map(e => e.name);
}
