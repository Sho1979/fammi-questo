// ---------------------------------------------------------------------------
//  Agent: Asia  --  figlia, 8 anni
//  Quota: 70 % actionable | 20 % borderline | 10 % noise
// ---------------------------------------------------------------------------

const asia = {
  id: 'sim-asia',
  name: 'Asia',
  role: 'figlia',
  gender: 'F',
  aliases: [],
  age: 8,

  // -- speech style knobs ---------------------------------------------------
  speechStyle: {
    sentenceLength: 'very-short',    // simple, short sentences
    compoundRate: 0.00,              // never compound sentences
    dialectRate: 0.00,               // no dialect
    typoRate: 0.08,                  // some typos, still learning to type
    formalRegister: 0.00,            // never formal
  },

  // -- weekly routine -------------------------------------------------------
  weeklyRoutine: [
    { day: 'mon', time: '08:00', activity: 'Scuola elementare' },
    { day: 'mon', time: '15:00', activity: 'Nuoto' },
    { day: 'tue', time: '08:00', activity: 'Scuola elementare' },
    { day: 'wed', time: '08:00', activity: 'Scuola elementare' },
    { day: 'wed', time: '15:00', activity: 'Nuoto' },
    { day: 'thu', time: '08:00', activity: 'Scuola elementare' },
    { day: 'fri', time: '08:00', activity: 'Scuola elementare' },
    { day: 'sat', time: '10:00', activity: 'Catechismo' },
  ],

  // -- variable pools -------------------------------------------------------
  variablePools: {
    chore: [
      'rifare il letto', 'mettere in ordine', 'apparecchiare',
    ],
    snack: [
      'merenda', 'gelato', 'biscotti',
    ],
    time: ['08:00', '12:30', '15:00', '16:00', '10:00'],
    day: [
      'lunedi', 'mercoledi', 'sabato',
    ],
  },

  // -- phrase templates (8 total) --------------------------------------------
  //    5 core (actionable) + 2 borderline + 1 noise
  phraseTemplates: [
    // ---- CORE: actionable (5) ---- 70 % ------------------------------------
    {
      text: 'Oggi ho nuoto alle {{time}}',
      intent: 'calendar',
      category: 'sport',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['time'],
      difficulty: 'easy',
    },
    {
      text: '{{day}} ho catechismo',
      intent: 'calendar',
      category: 'religion',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['day'],
      difficulty: 'easy',
    },
    {
      text: 'Ho rifatto il letto',
      intent: 'none',
      category: 'status_report',
      truthConfidence: 'high',
      shouldWrite: false,
      vars: [],
      difficulty: 'easy',
    },
    {
      text: 'Ho messo in ordine',
      intent: 'none',
      category: 'status_report',
      truthConfidence: 'high',
      shouldWrite: false,
      vars: [],
      difficulty: 'easy',
    },
    {
      text: 'Mamma mi ha detto di {{chore}}',
      intent: 'task',
      category: 'chores',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['chore'],
      difficulty: 'medium',
    },

    // ---- BORDERLINE: ambiguous (2) ---- 20 % -------------------------------
    {
      text: 'Domani nuoto?',
      intent: 'calendar',
      category: 'sport',
      truthConfidence: 'low',
      shouldWrite: false,
      vars: [],
      difficulty: 'hard',
    },
    {
      text: 'Devo fare una cosa',
      intent: 'task',
      category: null,
      truthConfidence: 'low',
      shouldWrite: false,
      vars: [],
      difficulty: 'hard',
    },

    // ---- NOISE (1) ---- 10 % -----------------------------------------------
    {
      text: 'Mi annoio',
      intent: 'noise',
      category: null,
      truthConfidence: 'high',
      shouldWrite: false,
      vars: [],
      difficulty: 'easy',
    },
  ],
};

export default asia;
