/**
 * brainTrainingSet.js — Training set italiano per NLP.js.
 *
 * Questo è il "DNA iniziale" del cervellone. Contiene frasi di esempio
 * per ogni intento, con varianti naturali di come una famiglia italiana parla.
 *
 * Intenti:
 *   calendar.medico, calendar.sport, calendar.scuola, calendar.lavoro,
 *   calendar.famiglia, calendar.generico
 *   task.cucina, task.pulizia, task.personale, task.generico
 *   expense.generico
 *   meal.generico
 *   shopping.generico
 *   note.generico
 *
 * Le entity (persone, date, orari, importi) vengono estratte dal nostro parser,
 * non da NLP.js — lui si occupa solo di classificare l'INTENTO.
 *
 * IMPORTANTE: queste frasi servono come base. Ogni conferma utente aggiunge
 * nuovi documenti di training, personalizzando la rete per la famiglia.
 */

export const TRAINING_DOCUMENTS = [

  // ═══════════════════════════════════════════════════════════
  // CALENDAR — eventi a calendario
  // ═══════════════════════════════════════════════════════════

  // calendar.medico
  { text: 'dentista domani alle 16', intent: 'calendar.medico' },
  { text: 'visita dal dottore giovedì', intent: 'calendar.medico' },
  { text: 'appuntamento dal medico', intent: 'calendar.medico' },
  { text: 'portare Asia dal dentista', intent: 'calendar.medico' },
  { text: 'controllo dal pediatra', intent: 'calendar.medico' },
  { text: 'visita oculista per Viola', intent: 'calendar.medico' },
  { text: 'analisi del sangue venerdì mattina', intent: 'calendar.medico' },
  { text: 'vaccino per la bambina', intent: 'calendar.medico' },
  { text: 'ecografia domani alle 10', intent: 'calendar.medico' },
  { text: 'ortopedico lunedì', intent: 'calendar.medico' },
  { text: 'visita dermatologica', intent: 'calendar.medico' },
  { text: 'appuntamento in ospedale', intent: 'calendar.medico' },

  // calendar.sport
  { text: 'allenamento di calcio alle 17', intent: 'calendar.sport' },
  { text: 'partita sabato mattina', intent: 'calendar.sport' },
  { text: 'Asia ha nuoto domani', intent: 'calendar.sport' },
  { text: 'gara di atletica domenica', intent: 'calendar.sport' },
  { text: 'lezione di danza alle 15', intent: 'calendar.sport' },
  { text: 'torneo di basket', intent: 'calendar.sport' },
  { text: 'allenamento in palestra', intent: 'calendar.sport' },
  { text: 'piscina giovedì pomeriggio', intent: 'calendar.sport' },
  { text: 'Viola ha tennis alle 16', intent: 'calendar.sport' },
  { text: 'saggio di danza venerdì sera', intent: 'calendar.sport' },
  { text: 'karate mercoledì', intent: 'calendar.sport' },
  { text: 'partita di pallavolo', intent: 'calendar.sport' },

  // calendar.scuola
  { text: 'colloquio con i professori', intent: 'calendar.scuola' },
  { text: 'recita scolastica venerdì', intent: 'calendar.scuola' },
  { text: 'gita scolastica martedì', intent: 'calendar.scuola' },
  { text: 'riunione a scuola', intent: 'calendar.scuola' },
  { text: 'consegna pagelle giovedì', intent: 'calendar.scuola' },
  { text: 'assemblea dei genitori', intent: 'calendar.scuola' },
  { text: 'interrogazione di matematica domani', intent: 'calendar.scuola' },
  { text: 'verifica di italiano lunedì', intent: 'calendar.scuola' },
  { text: 'open day della scuola', intent: 'calendar.scuola' },

  // calendar.lavoro
  { text: 'riunione in ufficio alle 9', intent: 'calendar.lavoro' },
  { text: 'riunione domani alle 10', intent: 'calendar.lavoro' },
  { text: 'riunione alle 15', intent: 'calendar.lavoro' },
  { text: 'ho una riunione', intent: 'calendar.lavoro' },
  { text: 'riunione oggi pomeriggio', intent: 'calendar.lavoro' },
  { text: 'call con il cliente', intent: 'calendar.lavoro' },
  { text: 'meeting domani mattina', intent: 'calendar.lavoro' },
  { text: 'colloquio di lavoro venerdì', intent: 'calendar.lavoro' },
  { text: 'conferenza online alle 14', intent: 'calendar.lavoro' },
  { text: 'presentazione al capo', intent: 'calendar.lavoro' },
  { text: 'webinar alle 11', intent: 'calendar.lavoro' },

  // calendar.famiglia
  { text: 'pranzo dai nonni domenica', intent: 'calendar.famiglia' },
  { text: 'compleanno della zia sabato', intent: 'calendar.famiglia' },
  { text: 'cena con i cugini', intent: 'calendar.famiglia' },
  { text: 'festa di compleanno di Marco', intent: 'calendar.famiglia' },
  { text: 'battesimo domenica', intent: 'calendar.famiglia' },
  { text: 'anniversario di matrimonio', intent: 'calendar.famiglia' },
  { text: 'visita agli zii', intent: 'calendar.famiglia' },

  // calendar.generico
  { text: 'appuntamento alle 15', intent: 'calendar.generico' },
  { text: 'concerto venerdì sera', intent: 'calendar.generico' },
  { text: 'cinema domani pomeriggio', intent: 'calendar.generico' },
  { text: 'teatro sabato', intent: 'calendar.generico' },
  { text: 'partenza per le vacanze', intent: 'calendar.generico' },
  { text: 'volo alle 7 di mattina', intent: 'calendar.generico' },

  // ═══════════════════════════════════════════════════════════
  // TASK — cose da fare
  // ═══════════════════════════════════════════════════════════

  // task.cucina
  { text: 'prepara la cena stasera', intent: 'task.cucina' },
  { text: 'Viola cucina la pasta', intent: 'task.cucina' },
  { text: 'apparecchiare la tavola', intent: 'task.cucina' },
  { text: 'sparecchia dopo cena', intent: 'task.cucina' },
  { text: 'lava i piatti', intent: 'task.cucina' },
  { text: 'svuota la lavastoviglie', intent: 'task.cucina' },
  { text: 'carica la lavastoviglie', intent: 'task.cucina' },
  { text: 'prepara il pranzo per domani', intent: 'task.cucina' },
  { text: 'metti su l\'acqua per la pasta', intent: 'task.cucina' },
  { text: 'scongela la carne per stasera', intent: 'task.cucina' },

  // task.pulizia
  { text: 'pulisci la camera', intent: 'task.pulizia' },
  { text: 'passa l\'aspirapolvere', intent: 'task.pulizia' },
  { text: 'lava il bagno', intent: 'task.pulizia' },
  { text: 'stira le camicie', intent: 'task.pulizia' },
  { text: 'riordina la stanza', intent: 'task.pulizia' },
  { text: 'butta la spazzatura', intent: 'task.pulizia' },
  { text: 'metti a posto i vestiti', intent: 'task.pulizia' },
  { text: 'spazza il terrazzo', intent: 'task.pulizia' },
  { text: 'fai la lavatrice', intent: 'task.pulizia' },
  { text: 'stendi il bucato', intent: 'task.pulizia' },
  { text: 'piega i vestiti', intent: 'task.pulizia' },
  { text: 'cambia le lenzuola', intent: 'task.pulizia' },
  { text: 'pulisci i vetri', intent: 'task.pulizia' },
  { text: 'aspira il divano', intent: 'task.pulizia' },
  { text: 'porta fuori il cane', intent: 'task.pulizia' },

  // task.personale
  { text: 'fai i compiti', intent: 'task.personale' },
  { text: 'studia per l\'esame', intent: 'task.personale' },
  { text: 'Asia studia matematica', intent: 'task.personale' },
  { text: 'prepara lo zaino per domani', intent: 'task.personale' },
  { text: 'dì a Viola di fare i compiti', intent: 'task.personale' },
  { text: 'ricordati di prendere le medicine', intent: 'task.personale' },
  { text: 'chiama l\'idraulico', intent: 'task.personale' },
  { text: 'prenota il ristorante', intent: 'task.personale' },
  { text: 'porta la macchina dal meccanico', intent: 'task.personale' },
  { text: 'paga la bolletta', intent: 'task.personale' },

  // task.generico
  { text: 'fai questa cosa', intent: 'task.generico' },
  { text: 'ricordati di fare', intent: 'task.generico' },
  { text: 'dì a Asia di', intent: 'task.generico' },
  { text: 'Viola deve fare', intent: 'task.generico' },

  // ═══════════════════════════════════════════════════════════
  // EXPENSE — spese
  // ═══════════════════════════════════════════════════════════

  { text: 'ho speso 30 euro al supermercato', intent: 'expense.generico' },
  { text: '45 euro di benzina', intent: 'expense.generico' },
  { text: 'spesa al Conad 62 euro', intent: 'expense.generico' },
  { text: 'pagato 15 euro di parcheggio', intent: 'expense.generico' },
  { text: 'bolletta luce 85 euro', intent: 'expense.generico' },
  { text: '120 euro dal dentista', intent: 'expense.generico' },
  { text: 'ho pagato 25 euro di pizza', intent: 'expense.generico' },
  { text: 'costato 50 euro il regalo', intent: 'expense.generico' },
  { text: '12 euro di gelato', intent: 'expense.generico' },
  { text: 'farmacia 18 euro', intent: 'expense.generico' },
  { text: 'abbonamento palestra 40 euro', intent: 'expense.generico' },
  { text: '30 euro di libri', intent: 'expense.generico' },
  { text: 'rata mutuo 650 euro', intent: 'expense.generico' },
  { text: 'ho messo 35 euro di gasolio', intent: 'expense.generico' },
  { text: 'speso 80 euro in vestiti', intent: 'expense.generico' },
  { text: 'cinema 24 euro', intent: 'expense.generico' },
  { text: 'cena fuori 55 euro', intent: 'expense.generico' },
  { text: '200 euro di assicurazione', intent: 'expense.generico' },

  // ═══════════════════════════════════════════════════════════
  // MEAL — pianificazione pasti
  // ═══════════════════════════════════════════════════════════

  { text: 'stasera si mangia pasta al pomodoro', intent: 'meal.generico' },
  { text: 'per cena facciamo la pizza', intent: 'meal.generico' },
  { text: 'domani cuciniamo il risotto', intent: 'meal.generico' },
  { text: 'pranzo con insalata e pollo', intent: 'meal.generico' },
  { text: 'stasera frittata e insalata', intent: 'meal.generico' },
  { text: 'per pranzo lasagna', intent: 'meal.generico' },
  { text: 'cena con pesce e verdure', intent: 'meal.generico' },
  { text: 'facciamo la grigliata sabato', intent: 'meal.generico' },
  { text: 'domani sera sushi', intent: 'meal.generico' },
  { text: 'stasera carbonara', intent: 'meal.generico' },
  { text: 'per colazione pancake', intent: 'meal.generico' },
  { text: 'polpette e purè per cena', intent: 'meal.generico' },
  { text: 'stasera si mangia leggero', intent: 'meal.generico' },
  { text: 'ordiniamo cinese stasera', intent: 'meal.generico' },

  // ═══════════════════════════════════════════════════════════
  // SHOPPING — lista della spesa
  // ═══════════════════════════════════════════════════════════

  { text: 'compra il latte', intent: 'shopping.generico' },
  { text: 'prendi il pane al supermercato', intent: 'shopping.generico' },
  { text: 'manca la carta igienica', intent: 'shopping.generico' },
  { text: 'serve il detersivo', intent: 'shopping.generico' },
  { text: 'aggiungi uova alla lista', intent: 'shopping.generico' },
  { text: 'è finito il caffè', intent: 'shopping.generico' },
  { text: 'compra frutta e verdura', intent: 'shopping.generico' },
  { text: 'servono i fazzoletti', intent: 'shopping.generico' },
  { text: 'prendi il dentifricio', intent: 'shopping.generico' },
  { text: 'manca lo zucchero', intent: 'shopping.generico' },
  { text: 'compra il sapone per i piatti', intent: 'shopping.generico' },
  { text: 'da comprare i biscotti', intent: 'shopping.generico' },
  { text: 'portare a casa il parmigiano', intent: 'shopping.generico' },
  { text: 'servono le batterie', intent: 'shopping.generico' },
  { text: 'finita la pasta', intent: 'shopping.generico' },

  // ═══════════════════════════════════════════════════════════
  // NOTE — testo non riconosciuto (fallback)
  // ═══════════════════════════════════════════════════════════

  { text: 'ricordami una cosa', intent: 'note.generico' },
  { text: 'nota per me', intent: 'note.generico' },
  { text: 'appunto importante', intent: 'note.generico' },
  { text: 'non dimenticare che', intent: 'note.generico' },
  { text: 'voglio ricordare questo', intent: 'note.generico' },
  { text: 'salva questo pensiero', intent: 'note.generico' },
]

/**
 * Mappa intent NLP → tipo azione + categoria per il nostro sistema
 */
export const INTENT_TO_ACTION = {
  'calendar.medico':   { type: 'calendar', category: 'medico' },
  'calendar.sport':    { type: 'calendar', category: 'sport' },
  'calendar.scuola':   { type: 'calendar', category: 'scuola' },
  'calendar.lavoro':   { type: 'calendar', category: 'lavoro' },
  'calendar.famiglia': { type: 'calendar', category: 'famiglia' },
  'calendar.generico': { type: 'calendar', category: 'altro' },
  'task.cucina':       { type: 'task', category: 'cucina' },
  'task.pulizia':      { type: 'task', category: 'pulizia' },
  'task.personale':    { type: 'task', category: 'personale' },
  'task.generico':     { type: 'task', category: 'altro' },
  'expense.generico':  { type: 'expense', category: null },  // categoria determinata dal nostro parser
  'meal.generico':     { type: 'meal', category: null },
  'shopping.generico': { type: 'shopping', category: null },
  'note.generico':     { type: 'note', category: null },
}

/**
 * Quanti documenti ci sono per intento (per stats)
 */
export function getTrainingStats() {
  const counts = {}
  for (const doc of TRAINING_DOCUMENTS) {
    counts[doc.intent] = (counts[doc.intent] || 0) + 1
  }
  return { total: TRAINING_DOCUMENTS.length, byIntent: counts }
}
