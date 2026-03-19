// ---------------------------------------------------------------------------
//  Agent: Mariangela  --  nonna, 70 anni
//  Quota: 70 % actionable | 20 % borderline | 10 % noise
// ---------------------------------------------------------------------------

const mariangela = {
  id: 'sim-mariangela',
  name: 'Mariangela',
  role: 'nonna',
  gender: 'F',
  aliases: ['nonna', 'nonnina', 'Mari', 'nonna Mariangela'],
  age: 70,

  // -- speech style knobs ---------------------------------------------------
  speechStyle: {
    sentenceLength: 'long',
    compoundRate: 0.15,
    dialectRate: 0.0,
    typoRate: 0.03,
    formalRegister: 0.9,
  },

  // -- weekly routine -------------------------------------------------------
  weeklyRoutine: [
    { day: 'sat', time: '10:00', activity: 'Disponibile per i nipoti' },
    { day: 'sun', time: '09:00', activity: 'Prepara il pranzo della domenica' },
    { day: 'sun', time: '12:30', activity: 'Pranzo in famiglia' },
  ],

  // -- variable pools -------------------------------------------------------
  variablePools: {
    dish: [
      'ragu della domenica', 'lasagna', 'arrosto con le patate',
      'polpette della nonna', 'torta della nonna', 'gnocchi al sugo',
      'parmigiana di melanzane', 'zuppa di legumi',
    ],
    ingredient: [
      'pomodori San Marzano', 'basilico fresco', 'parmigiano reggiano',
      'carne macinata', 'ricotta', 'uova fresche', 'farina',
      'burro', 'cipolla', 'sedano', 'carota', 'olio extravergine',
    ],
    person: ['Asia', 'Viola', 'Cristian', 'Chiara', 'i bambini'],
    day: ['sabato', 'domenica', 'lunedi', 'martedi', 'mercoledi'],
    time: ['09:00', '10:00', '12:00', '12:30', '15:00'],
    amount: {
      type: 'weighted-range',
      buckets: [
        { min: 8, max: 25, weight: 0.40 },
        { min: 25, max: 50, weight: 0.35 },
        { min: 50, max: 90, weight: 0.25 },
      ],
    },
    where: ['macelleria', 'mercato', 'Conad', 'panificio', 'ortolano'],
  },

  // -- phrase templates (10 total) ------------------------------------------
  //    7 core (actionable) + 2 borderline + 1 noise
  phraseTemplates: [
    // ---- CORE: actionable (7) ---- 70 % ------------------------------------
    {
      text: 'Domenica preparo {{dish}} per tutta la famiglia',
      intent: 'meal',
      category: 'sunday_lunch',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['dish'],
      difficulty: 'easy',
    },
    {
      text: 'Sabato mattina sono disponibile se avete bisogno, posso stare con {{person}}',
      intent: 'calendar',
      category: 'availability',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['person'],
      difficulty: 'easy',
    },
    {
      text: 'Ho comprato le cose per il pranzo di domenica al {{where}}',
      intent: 'shopping',
      category: 'ingredients',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['where'],
      difficulty: 'easy',
    },
    {
      text: 'Ho speso {{amount}} euro al {{where}} per gli ingredienti della domenica',
      intent: 'expense',
      category: 'groceries',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['amount', 'where'],
      difficulty: 'easy',
    },
    {
      text: 'Domenica alle {{time}} il pranzo e pronto, venite pure quando volete',
      intent: 'calendar',
      category: 'sunday_lunch',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['time'],
      difficulty: 'easy',
    },
    {
      text: 'Per domenica pensavo di fare {{dish}}, che ne dite',
      intent: 'meal',
      category: 'planning',
      truthConfidence: 'medium',
      shouldWrite: true,
      vars: ['dish'],
      difficulty: 'medium',
    },
    {
      text: 'Devo passare dal {{where}} a prendere {{ingredient}} per la {{dish}}',
      intent: 'task',
      category: 'shopping',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['where', 'ingredient', 'dish'],
      difficulty: 'medium',
    },

    // ---- BORDERLINE: ambiguous (2) ---- 20 % -------------------------------
    {
      text: 'Se volete vengo io a prendere {{person}}, basta che mi avvisate in tempo',
      intent: 'calendar',
      category: 'transport',
      truthConfidence: 'medium',
      shouldWrite: false,
      vars: ['person'],
      difficulty: 'hard',
    },
    {
      text: 'Quando serve ci sono, non dovete fare altro che chiamarmi',
      intent: 'calendar',
      category: 'availability',
      truthConfidence: 'low',
      shouldWrite: false,
      vars: [],
      difficulty: 'hard',
    },

    // ---- NOISE (1) ---- 10 % -----------------------------------------------
    {
      text: 'Ai miei tempi era tutto diverso, si mangiava tutti insieme senza tante storie',
      intent: 'noise',
      category: null,
      truthConfidence: 'high',
      shouldWrite: false,
      vars: [],
      difficulty: 'easy',
    },
  ],
};

export default mariangela;
