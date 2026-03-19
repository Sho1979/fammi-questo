/**
 * patterns.js — Sinapsi bootstrap (conoscenza innata del Cervellone).
 */

import { stemIT } from './textUtils.js'
import { BASE_WEIGHT } from './config.js'

// ═══════════════════════════════════════════════════════════════
// SINAPSI BOOTSTRAP (conoscenza innata)
// ═══════════════════════════════════════════════════════════════
function buildBootstrapSynapses() {
  const synapses = new Map()

  const add = (word, actionType, category = null, weight = BASE_WEIGHT) => {
    const stem = stemIT(word)
    if (!synapses.has(stem)) synapses.set(stem, [])
    synapses.get(stem).push({ actionType, category, weight, source: 'bootstrap' })
    if (stem !== word.toLowerCase()) {
      if (!synapses.has(word.toLowerCase())) synapses.set(word.toLowerCase(), [])
      synapses.get(word.toLowerCase()).push({ actionType, category, weight: weight * 0.8, source: 'bootstrap' })
    }
  }

  // Calendar
  const calendarWords = {
    medico: ['dentista', 'dottore', 'medico', 'visita', 'appuntamento', 'analisi', 'vaccino', 'pediatra', 'oculista', 'ospedale', 'ecografia', 'ortopedico', 'dermatologo'],
    sport: ['allenamento', 'partita', 'gara', 'torneo', 'palestra', 'piscina', 'calcio', 'basket', 'nuoto', 'danza', 'tennis', 'karate', 'judo', 'atletica', 'ginnastica', 'pallavolo'],
    scuola: ['lezione', 'esame', 'colloquio', 'pagella', 'recita', 'gita', 'interrogazione', 'verifica', 'assemblea'],
    lavoro: ['riunione', 'call', 'meeting', 'ufficio', 'conferenza', 'webinar'],
    famiglia: ['compleanno', 'festa', 'cerimonia', 'matrimonio', 'battesimo', 'comunione', 'nonni', 'cugini', 'zii'],
    viaggio: ['stazione', 'aeroporto', 'treno', 'volo', 'partenza', 'arrivo', 'porto', 'pullman', 'autobus'],
  }
  // Verbi/azioni che implicano un evento calendario
  const calendarVerbs = ['andare', 'deve', 'prendere', 'portare', 'accompagnare', 'ritirare', 'raggiungere', 'arrivare', 'partire']
  for (const w of calendarVerbs) add(w, 'calendar', null, 0.25)
  for (const [cat, words] of Object.entries(calendarWords)) {
    for (const w of words) add(w, 'calendar', cat)
  }

  // Task
  const taskWords = [
    'prepara', 'preparare', 'pulisci', 'pulire', 'lava', 'lavare',
    'stira', 'stirare', 'cucina', 'cucinare', 'apparecchia', 'sparecchia',
    'svuota', 'riordina', 'sistema', 'fai', 'fare',
    'compiti', 'studia', 'studiare', 'butta', 'aspira',
    'passa', 'spazza', 'innaffia', 'carica', 'piega',
    'raccogli', 'metti', 'togli', 'cambia',
  ]
  for (const w of taskWords) add(w, 'task')

  // Expense
  add('euro', 'expense', null, 0.7)
  add('€', 'expense', null, 0.7)
  const expenseActions = ['speso', 'spendere', 'pagato', 'pagare', 'costato', 'costare', 'costo']
  for (const w of expenseActions) add(w, 'expense', null, 0.5)

  const expenseCats = {
    alimentari: ['spesa', 'supermercato', 'conad', 'coop', 'lidl', 'esselunga', 'eurospin', 'carrefour'],
    trasporto: ['benzina', 'diesel', 'gasolio', 'autostrada', 'treno', 'taxi', 'parcheggio', 'meccanico'],
    salute: ['farmacia', 'medicina', 'ricetta', 'ticket'],
    bollette: ['luce', 'gas', 'acqua', 'internet', 'telefono', 'bolletta', 'rata', 'abbonamento', 'mutuo', 'affitto'],
    svago: ['cinema', 'ristorante', 'pizzeria', 'bar', 'aperitivo', 'gelato'],
    abbigliamento: ['vestiti', 'scarpe', 'giacca', 'pantaloni'],
    casa: ['ikea', 'brico', 'ferramenta', 'detersivo'],
    regali: ['regalo', 'regalare'],
  }
  for (const [cat, words] of Object.entries(expenseCats)) {
    for (const w of words) add(w, 'expense', cat)
  }

  // Meal
  const mealCtx = ['pranzo', 'cena', 'colazione', 'merenda', 'cuciniamo', 'mangiamo', 'si mangia']
  for (const w of mealCtx) add(w, 'meal', null, 0.4)
  const dishes = ['pasta', 'pizza', 'risotto', 'insalata', 'frittata', 'pollo', 'pesce', 'carne', 'lasagna', 'gnocchi', 'polpette', 'arrosto', 'carbonara', 'sushi', 'grigliata']
  for (const d of dishes) add(d, 'meal', null, 0.3)

  // Shopping — NOTA: "prendere/prendi" e "serve/manca" hanno peso BASSO
  // perché sono ambigui (prendere = anche andare a prendere qualcuno)
  const shopStrong = ['compra', 'comprare', 'lista', 'da comprare', 'spesa']
  for (const w of shopStrong) add(w, 'shopping', null, 0.5)
  const shopMedium = ['servono', 'mancano', 'finito', 'finiti', 'finita']
  for (const w of shopMedium) add(w, 'shopping', null, 0.3)
  // "prendi/prendere", "serve", "manca" sono troppo ambigui — peso molto basso
  const shopWeak = ['prendi', 'prendere', 'serve', 'manca']
  for (const w of shopWeak) add(w, 'shopping', null, 0.15)

  // Absence — assenze scuola/attività (STRONG: marker strutturale chiaro)
  const absenceWords = ['assente', 'assenza', 'malata', 'malato', 'febbre', 'influenza', 'raffreddata', 'raffreddato']
  for (const w of absenceWords) add(w, 'absence', null, 0.7)
  // Negazioni che implicano assenza (peso medio, servono contesto)
  const absenceNeg = ['niente', 'niente scuola', 'non va', 'resta a casa', 'sta male', 'sta poco bene']
  for (const w of absenceNeg) add(w, 'absence', null, 0.5)

  // Reminder — promemoria espliciti (distinguere da task)
  const reminderWords = ['ricordami', 'ricordati', 'ricordaci', 'ricordare', 'promemoria', 'non dimenticare', 'non scordarti', 'avvisami', 'avvisare', 'memo']
  for (const w of reminderWords) add(w, 'reminder', null, 0.6)

  return synapses
}

export const BOOTSTRAP_SYNAPSES = buildBootstrapSynapses()
