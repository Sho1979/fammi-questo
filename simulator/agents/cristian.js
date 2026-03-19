// ---------------------------------------------------------------------------
//  Agent: Cristian  --  papa, 45 anni
//  Quota: 70 % actionable | 20 % borderline | 10 % noise
// ---------------------------------------------------------------------------

const cristian = {
  id: 'sim-cristian',
  name: 'Cristian',
  role: 'papa',
  gender: 'M',
  aliases: ['Cri', 'papa', 'papino', 'cri'],
  age: 45,

  // -- speech style knobs ---------------------------------------------------
  speechStyle: {
    sentenceLength: 'short',
    compoundRate: 0.05,
    dialectRate: 0.15,
    typoRate: 0.10,
    formalRegister: 0.3,
  },

  // -- weekly routine -------------------------------------------------------
  weeklyRoutine: [
    { day: 'mon', time: '07:30', activity: 'Porta Asia a scuola' },
    { day: 'mon', time: '08:30', activity: 'Ufficio' },
    { day: 'tue', time: '08:30', activity: 'Ufficio' },
    { day: 'tue', time: '16:00', activity: 'Porta Viola a danza' },
    { day: 'wed', time: '07:30', activity: 'Porta Asia a scuola' },
    { day: 'wed', time: '08:30', activity: 'Ufficio' },
    { day: 'thu', time: '08:30', activity: 'Ufficio' },
    { day: 'thu', time: '16:00', activity: 'Porta Viola a danza' },
    { day: 'fri', time: '08:30', activity: 'Ufficio' },
    { day: 'sat', time: '10:00', activity: 'Spesa settimanale' },
  ],

  // -- variable pools -------------------------------------------------------
  variablePools: {
    where: [
      'supermercato', 'meccanico', 'farmacia', 'Conad',
      'distributore', 'ferramenta', 'tabacchino',
    ],
    what: [
      'benzina', 'parcheggio', 'revisione auto', 'bolletta',
      'assicurazione', 'bollo auto', 'tagliando', 'gomme nuove',
    ],
    amount: {
      type: 'weighted-range',
      buckets: [
        { min: 15, max: 30, weight: 0.25 },
        { min: 20, max: 80, weight: 0.45 },
        { min: 80, max: 150, weight: 0.15 },
        { min: 150, max: 400, weight: 0.15 },
      ],
    },
    meal: ['pizza', 'panini', 'kebab', 'sushi take-away', 'piadina'],
    person: ['Viola', 'Asia', 'Chiara'],
    day: ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'],
    time: ['07:30', '08:30', '16:00', '18:00', '20:00'],
  },

  // -- phrase templates (12 total) ------------------------------------------
  //    8 core (actionable) + 2 borderline + 2 noise
  phraseTemplates: [
    // ---- CORE: actionable (8) ---- 70 % ------------------------------------
    {
      text: 'Ho speso {{amount}} euro {{where}}',
      intent: 'expense',
      category: null,
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['amount', 'where'],
      difficulty: 'easy',
    },
    {
      text: 'Domani porto Asia a scuola alle {{time}}',
      intent: 'calendar',
      category: 'transport',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['time'],
      difficulty: 'easy',
    },
    {
      text: '{{day}} devo pagare {{what}}',
      intent: 'expense',
      category: 'bills',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['day', 'what'],
      difficulty: 'easy',
    },
    {
      text: 'Stasera {{meal}} per tutti',
      intent: 'meal',
      category: 'dinner',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['meal'],
      difficulty: 'easy',
    },
    {
      text: 'Passo a prendere Viola a danza alle {{time}}',
      intent: 'calendar',
      category: 'transport',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['time'],
      difficulty: 'easy',
    },
    {
      text: 'Ho fatto {{amount}} euro di {{what}}',
      intent: 'expense',
      category: null,
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['amount', 'what'],
      difficulty: 'easy',
    },
    {
      text: 'Sabato mattina vado al {{where}} per la spesa',
      intent: 'calendar',
      category: 'shopping',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['where'],
      difficulty: 'medium',
    },
    {
      text: 'Ricordami di portare la macchina dal {{where}} {{day}}',
      intent: 'task',
      category: 'car',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['where', 'day'],
      difficulty: 'medium',
    },

    // ---- BORDERLINE: ambiguous (2) ---- 20 % -------------------------------
    {
      text: 'Domani forse porto io {{person}}',
      intent: 'calendar',
      category: 'transport',
      truthConfidence: 'low',
      shouldWrite: false,
      vars: ['person'],
      difficulty: 'hard',
    },
    {
      text: 'Poi ci penso io alla {{what}}',
      intent: 'task',
      category: null,
      truthConfidence: 'medium',
      shouldWrite: false,
      vars: ['what'],
      difficulty: 'hard',
    },

    // ---- NOISE (2) ---- 10 % -----------------------------------------------
    {
      text: 'Bella giornata oggi',
      intent: 'noise',
      category: null,
      truthConfidence: 'high',
      shouldWrite: false,
      vars: [],
      difficulty: 'easy',
    },
    {
      text: 'Che stress sto traffico',
      intent: 'noise',
      category: null,
      truthConfidence: 'high',
      shouldWrite: false,
      vars: [],
      difficulty: 'easy',
    },
  ],
};

export default cristian;
