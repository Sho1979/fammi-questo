// ---------------------------------------------------------------------------
//  Agent: Roberto  --  nonno, 73 anni
//  Quota: 70 % actionable | 20 % borderline | 10 % noise
// ---------------------------------------------------------------------------

const roberto = {
  id: 'sim-roberto',
  name: 'Roberto',
  role: 'nonno',
  gender: 'M',
  aliases: ['nonno', 'nonnino', 'Robi', 'nonno Roberto'],
  age: 73,

  // -- speech style knobs ---------------------------------------------------
  speechStyle: {
    sentenceLength: 'short-medium',
    compoundRate: 0.05,
    dialectRate: 0.10,
    typoRate: 0.08,
    formalRegister: 0.4,
  },

  // -- weekly routine -------------------------------------------------------
  weeklyRoutine: [
    { day: 'sat', time: '08:00', activity: 'Giardinaggio' },
    { day: 'flexible', time: null, activity: 'Trasporto bambini di riserva' },
    { day: 'flexible', time: null, activity: 'Commissioni infrasettimanali' },
  ],

  // -- variable pools -------------------------------------------------------
  variablePools: {
    diy_item: [
      'viti', 'colla vinilica', 'vernice bianca', 'nastro isolante',
      'tubi da giardino', 'silicone', 'carta vetrata', 'chiodi',
      'guarnizioni', 'stucco',
    ],
    errand: [
      'ferramenta', 'giardinaggio', 'mercato', 'vivaio',
      'centro bricolage', 'Brico',
    ],
    transport: [
      'porto io i bambini', 'passo a prendere Asia',
      'accompagno Viola', 'faccio io il giro',
    ],
    person: ['Asia', 'Viola', 'i bambini', 'Chiara', 'Cristian'],
    day: ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'],
    time: ['08:00', '09:00', '10:00', '12:00', '15:00', '16:00'],
    amount: {
      type: 'weighted-range',
      buckets: [
        { min: 3, max: 15, weight: 0.35 },
        { min: 15, max: 40, weight: 0.40 },
        { min: 40, max: 80, weight: 0.20 },
        { min: 80, max: 120, weight: 0.05 },
      ],
    },
    where: [
      'ferramenta', 'Brico', 'vivaio', 'mercato',
      'officina', 'distributore',
    ],
    garden_task: [
      'potare le siepi', 'tagliare il prato', 'sistemare le rose',
      'innaffiare l orto', 'piantare i pomodori',
    ],
    fix_task: [
      'la serratura', 'il rubinetto', 'la persiana',
      'lo scarico', 'la mensola', 'il cancelletto',
    ],
  },

  // -- phrase templates (10 total) ------------------------------------------
  //    7 core (actionable) + 2 borderline + 1 noise
  phraseTemplates: [
    // ---- CORE: actionable (7) ---- 70 % ------------------------------------
    {
      text: 'Sabato mattina devo {{garden_task}}, arrivo per le {{time}}',
      intent: 'calendar',
      category: 'gardening',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['garden_task', 'time'],
      difficulty: 'easy',
    },
    {
      text: 'Ho preso {{diy_item}} e {{diy_item}} al {{where}}, ho speso {{amount}} euro',
      intent: 'expense',
      category: 'diy',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['diy_item', 'diy_item', 'where', 'amount'],
      difficulty: 'easy',
    },
    {
      text: '{{day}} passo a prendere {{person}} alle {{time}}',
      intent: 'calendar',
      category: 'transport',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['day', 'person', 'time'],
      difficulty: 'easy',
    },
    {
      text: 'Oggi aggiusto {{fix_task}}, mi servono {{diy_item}}',
      intent: 'task',
      category: 'diy',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['fix_task', 'diy_item'],
      difficulty: 'medium',
    },
    {
      text: 'Devo andare al {{errand}} a comprare {{diy_item}} per {{fix_task}}',
      intent: 'task',
      category: 'shopping',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['errand', 'diy_item', 'fix_task'],
      difficulty: 'medium',
    },
    {
      text: 'Ho speso {{amount}} euro al {{where}}',
      intent: 'expense',
      category: null,
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['amount', 'where'],
      difficulty: 'easy',
    },
    {
      text: '{{day}} mattina porto io {{person}} cosi voi state tranquilli',
      intent: 'calendar',
      category: 'transport',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['day', 'person'],
      difficulty: 'easy',
    },

    // ---- BORDERLINE: ambiguous (2) ---- 20 % -------------------------------
    {
      text: 'Se serve passo io nel pomeriggio, fammi sapere',
      intent: 'calendar',
      category: 'transport',
      truthConfidence: 'medium',
      shouldWrite: false,
      vars: [],
      difficulty: 'hard',
    },
    {
      text: 'Domani vediamo, dipende dal tempo',
      intent: 'calendar',
      category: null,
      truthConfidence: 'low',
      shouldWrite: false,
      vars: [],
      difficulty: 'hard',
    },

    // ---- NOISE (1) ---- 10 % -----------------------------------------------
    {
      text: 'Questo si aggiusta facile, ci vuole solo un po di pazienza',
      intent: 'noise',
      category: null,
      truthConfidence: 'high',
      shouldWrite: false,
      vars: [],
      difficulty: 'easy',
    },
  ],
};

export default roberto;
