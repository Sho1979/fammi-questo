// ---------------------------------------------------------------------------
//  Agent: Chiara  --  mamma, 42 anni
//  Quota: 70 % actionable | 20 % borderline | 10 % noise
// ---------------------------------------------------------------------------

const chiara = {
  id: 'sim-chiara',
  name: 'Chiara',
  role: 'mamma',
  gender: 'F',
  aliases: ['mamma', 'mammina', 'Chia'],
  age: 42,

  // -- speech style knobs ---------------------------------------------------
  speechStyle: {
    sentenceLength: 'detailed',
    compoundRate: 0.20,
    dialectRate: 0.05,
    typoRate: 0.05,
    formalRegister: 0.5,
  },

  // -- weekly routine -------------------------------------------------------
  weeklyRoutine: [
    { day: 'mon', time: '12:30', activity: 'Prende Asia a scuola' },
    { day: 'mon', time: '15:00', activity: 'Compiti con Asia' },
    { day: 'tue', time: '12:30', activity: 'Prende Asia a scuola' },
    { day: 'tue', time: '15:00', activity: 'Compiti con Asia' },
    { day: 'tue', time: '17:30', activity: 'Riprende Viola dalla danza' },
    { day: 'wed', time: '09:00', activity: 'Lavoro part-time' },
    { day: 'wed', time: '12:30', activity: 'Prende Asia a scuola' },
    { day: 'wed', time: '15:00', activity: 'Compiti con Asia' },
    { day: 'thu', time: '12:30', activity: 'Prende Asia a scuola' },
    { day: 'thu', time: '15:00', activity: 'Compiti con Asia' },
    { day: 'thu', time: '17:30', activity: 'Riprende Viola dalla danza' },
    { day: 'fri', time: '09:00', activity: 'Lavoro part-time' },
    { day: 'fri', time: '12:30', activity: 'Prende Asia a scuola' },
    { day: 'sun', time: '10:00', activity: 'Pianificazione pasti settimanale' },
  ],

  // -- variable pools -------------------------------------------------------
  variablePools: {
    dish: [
      'pasta al ragu', 'pollo arrosto', 'risotto ai funghi',
      'frittata di zucchine', 'minestrone', 'cotolette',
      'pasta al pesto', 'insalata di riso', 'polpette al sugo',
    ],
    grocery: [
      'latte', 'pane', 'uova', 'verdura', 'frutta',
      'detersivo', 'carta igienica', 'yogurt', 'formaggio',
      'pasta', 'riso', 'olio',
    ],
    health: [
      'pediatra', 'dentista', 'oculista', 'allergologo', 'ortopedico',
      'allergologo', 'ortopedico',
    ],
    person: ['Asia', 'Viola', 'Cristian'],
    day: ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'],
    time: ['08:00', '09:00', '12:30', '15:00', '17:30'],
    amount: {
      type: 'weighted-range',
      buckets: [
        { min: 5, max: 20, weight: 0.30 },
        { min: 20, max: 60, weight: 0.40 },
        { min: 60, max: 120, weight: 0.20 },
        { min: 120, max: 250, weight: 0.10 },
      ],
    },
    where: [
      'supermercato', 'farmacia', 'Esselunga', 'mercato',
      'panetteria', 'macelleria',
    ],
    homework: ['matematica', 'italiano', 'inglese', 'scienze', 'storia'],
  },

  // -- phrase templates (14 total) ------------------------------------------
  //    9 core (actionable) + 3 borderline + 2 noise
  phraseTemplates: [
    // ---- CORE: actionable (9) ---- ~64 % ------------------------------------
    {
      text: 'Oggi alle {{time}} devo prendere Asia a scuola e poi abbiamo i compiti di {{homework}}',
      intent: 'calendar',
      category: 'school',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['time', 'homework'],
      difficulty: 'medium',
    },
    {
      text: 'Ho prenotato la visita dal {{health}} per {{person}} {{day}} alle {{time}}',
      intent: 'calendar',
      category: 'health',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['health', 'person', 'day', 'time'],
      difficulty: 'medium',
    },
    {
      text: 'Stasera preparo {{dish}}',
      intent: 'meal',
      category: 'dinner',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['dish'],
      difficulty: 'medium',
    },
    {
      text: 'Ho speso {{amount}} euro al {{where}} per la spesa di questa settimana',
      intent: 'expense',
      category: 'groceries',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['amount', 'where'],
      difficulty: 'easy',
    },
    {
      text: 'Devo passare in {{health}} a prendere le medicine per {{person}}',
      intent: 'task',
      category: 'health',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['health', 'person'],
      difficulty: 'easy',
    },
    {
      text: '{{day}} sera facciamo {{dish}}',
      intent: 'meal',
      category: 'planning',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['day', 'dish'],
      difficulty: 'medium',
    },
    {
      text: 'Mi segni che {{day}} alle {{time}} Viola ha il saggio di danza',
      intent: 'calendar',
      category: 'events',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['day', 'time'],
      difficulty: 'medium',
    },
    {
      text: 'Bisogna comprare {{grocery}}, {{grocery}} e {{grocery}} prima di {{day}}',
      intent: 'shopping',
      category: 'groceries',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['grocery', 'grocery', 'grocery', 'day'],
      difficulty: 'easy',
    },
    {
      text: 'Ho pagato {{amount}} euro in {{health}} per la visita di {{person}}',
      intent: 'expense',
      category: 'health',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['amount', 'health', 'person'],
      difficulty: 'easy',
    },

    // ---- BORDERLINE: ambiguous (3) ---- ~21 % -------------------------------
    {
      text: 'Serve qualcosa per domani ma non mi ricordo cosa',
      intent: 'shopping',
      category: null,
      truthConfidence: 'low',
      shouldWrite: false,
      vars: [],
      difficulty: 'hard',
    },
    {
      text: 'Devo pensarci bene prima di prenotare dal {{health}}',
      intent: 'calendar',
      category: 'health',
      truthConfidence: 'low',
      shouldWrite: false,
      vars: ['health'],
      difficulty: 'hard',
    },
    {
      text: 'Forse {{day}} non riesco a prendere Asia, vediamo come ci organizziamo',
      intent: 'calendar',
      category: 'school',
      truthConfidence: 'medium',
      shouldWrite: false,
      vars: ['day'],
      difficulty: 'hard',
    },

    // ---- NOISE (2) ---- ~14 % -----------------------------------------------
    {
      text: 'Che disordine in questa casa, non si puo vivere cosi',
      intent: 'noise',
      category: null,
      truthConfidence: 'high',
      shouldWrite: false,
      vars: [],
      difficulty: 'easy',
    },
    {
      text: 'Non ne posso piu di queste giornate infinite',
      intent: 'noise',
      category: null,
      truthConfidence: 'high',
      shouldWrite: false,
      vars: [],
      difficulty: 'easy',
    },
  ],
};

export default chiara;
