// ---------------------------------------------------------------------------
//  Agent: Viola  --  figlia, 12 anni
//  Quota: 70 % actionable | 20 % borderline | 10 % noise
// ---------------------------------------------------------------------------

const viola = {
  id: 'sim-viola',
  name: 'Viola',
  role: 'figlia',
  gender: 'F',
  aliases: [],
  age: 12,

  // -- speech style knobs ---------------------------------------------------
  speechStyle: {
    sentenceLength: 'short',        // teen speak, to the point
    compoundRate: 0.10,             // occasional compound sentences
    dialectRate: 0.00,              // no dialect
    typoRate: 0.12,                 // teens type fast on phone
    formalRegister: 0.001,          // almost never formal
  },

  // -- weekly routine -------------------------------------------------------
  weeklyRoutine: [
    { day: 'mon', time: '08:00', activity: 'Scuola media' },
    { day: 'mon', time: '15:00', activity: 'Compiti' },
    { day: 'tue', time: '08:00', activity: 'Scuola media' },
    { day: 'tue', time: '15:00', activity: 'Compiti' },
    { day: 'tue', time: '16:00', activity: 'Danza' },
    { day: 'wed', time: '08:00', activity: 'Scuola media' },
    { day: 'wed', time: '15:00', activity: 'Compiti' },
    { day: 'thu', time: '08:00', activity: 'Scuola media' },
    { day: 'thu', time: '15:00', activity: 'Compiti' },
    { day: 'thu', time: '16:00', activity: 'Danza' },
    { day: 'fri', time: '08:00', activity: 'Scuola media' },
    { day: 'fri', time: '15:00', activity: 'Compiti' },
  ],

  // -- variable pools -------------------------------------------------------
  variablePools: {
    subject: [
      'matematica', 'italiano', 'storia', 'scienze', 'inglese',
    ],
    friend: [
      'Sofia', 'Giulia', 'Emma', 'Marco',
    ],
    activity: [
      'danza', 'festa', 'studio',
    ],
    time: ['08:00', '13:00', '15:00', '16:00', '17:30'],
    day: [
      'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato',
    ],
  },

  // -- phrase templates (10 total) -------------------------------------------
  //    7 core (actionable) + 2 borderline + 1 noise
  phraseTemplates: [
    // ---- CORE: actionable (7) ---- 70 % ------------------------------------
    {
      text: 'Domani ho danza alle {{time}}',
      intent: 'calendar',
      category: 'sport',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['time'],
      difficulty: 'easy',
    },
    {
      text: '{{day}} ho la verifica di {{subject}}',
      intent: 'calendar',
      category: 'school',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['day', 'subject'],
      difficulty: 'easy',
    },
    {
      text: 'Devo fare i compiti di {{subject}} per domani',
      intent: 'task',
      category: 'homework',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['subject'],
      difficulty: 'easy',
    },
    {
      text: 'Ricordami la festa di {{friend}} {{day}}',
      intent: 'reminder',
      category: 'social',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['friend', 'day'],
      difficulty: 'easy',
    },
    {
      text: 'Ho finito i compiti di {{subject}}',
      intent: 'none',
      category: 'status_report',
      truthConfidence: 'high',
      shouldWrite: false,
      vars: ['subject'],
      difficulty: 'easy',
    },
    {
      text: 'Sabato vado a dormire da {{friend}}',
      intent: 'calendar',
      category: 'social',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['friend'],
      difficulty: 'medium',
    },
    {
      text: 'Mi servono le scarpe da {{activity}} per {{day}}',
      intent: 'task',
      category: 'sport',
      truthConfidence: 'high',
      shouldWrite: true,
      vars: ['activity', 'day'],
      difficulty: 'medium',
    },

    // ---- BORDERLINE: ambiguous (2) ---- 20 % -------------------------------
    {
      text: 'Forse domani esco con {{friend}}',
      intent: 'calendar',
      category: 'social',
      truthConfidence: 'low',
      shouldWrite: false,
      vars: ['friend'],
      difficulty: 'hard',
    },
    {
      text: 'Poi vediamo per i compiti',
      intent: 'task',
      category: 'homework',
      truthConfidence: 'low',
      shouldWrite: false,
      vars: [],
      difficulty: 'hard',
    },

    // ---- NOISE (1) ---- 10 % -----------------------------------------------
    {
      text: 'Che noia i compiti',
      intent: 'noise',
      category: null,
      truthConfidence: 'high',
      shouldWrite: false,
      vars: [],
      difficulty: 'easy',
    },
  ],
};

export default viola;
