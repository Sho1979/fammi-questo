/**
 * actionBuilder.js — Costruzione azioni dal tipo rilevato + title cleaning.
 */

import { extractLocation, extractActivity } from './entityExtractor.js'
import { levenshtein } from './textUtils.js'

// ═══════════════════════════════════════════════════════════════
// BUILD ACTION — costruisce l'oggetto azione dal tipo
// ═══════════════════════════════════════════════════════════════
export function buildAction(type, sentence, ctx) {
  const { amount, date, time, persons, members, logistics, timeCtx, category } = ctx
  const mainPerson = persons?.[0] || null
  const action = { type, date }

  switch (type) {
    case 'calendar': {
      // Se la logistica ha identificato subject/driver, usali:
      const eventPerson = logistics?.subject || mainPerson
      const driverPerson = logistics?.driver || null
      const activity = extractActivity(sentence)
      const isDropOff = logistics?.actionVerb === 'portare'

      // Titolo intelligente basato su actionVerb e contesto
      const luogo = extractLocation(sentence, members)
      let title = cleanTitle(sentence, eventPerson, members)

      if (logistics?.subject && logistics?.driver) {
        if (isDropOff && activity) {
          title = luogo ? `${activity} ${logistics.subject.name} - ${luogo}` : `${activity} ${logistics.subject.name}`
        } else if (luogo) {
          title = `${activity || 'Arrivo'} ${logistics.subject.name} - ${luogo}`
        } else {
          title = title.length > 3 ? title : `${activity || 'Impegno'} ${logistics.subject.name}`
        }
      } else if (activity && eventPerson) {
        // Persona + attività → titolo strutturato "Allenamento Viola - Falcone"
        title = luogo
          ? `${activity} ${eventPerson.name} - ${luogo}`
          : `${activity} ${eventPerson.name}`
      }

      action.title = title
      action.assignedTo = eventPerson?.name || mainPerson?.name || null
      action.time = time
      if (activity) action.activity = activity
      action.category = category || (activity ? 'sport' : 'altro')
      if (!time) action.incomplete = 'Manca l\'orario'

      // Logistica: driver ≠ eventPerson → metti driver come pickup/accompagnatore
      if (driverPerson && eventPerson && driverPerson.id !== eventPerson.id) {
        if (isDropOff || logistics?.accompaniedBy) {
          action.accompaniedBy = driverPerson.name
        } else if (logistics?.pickupBy) {
          action.pickupBy = driverPerson.name
        } else {
          action.pickupBy = driverPerson.name
        }
      } else {
        if (logistics?.accompaniedBy) action.accompaniedBy = logistics.accompaniedBy.name
        if (logistics?.pickupBy) action.pickupBy = logistics.pickupBy.name
      }
      break
    }

    case 'task':
      action.title = cleanTitle(sentence, mainPerson, members)
      action.assignedTo = mainPerson?.name || null
      if (time) action.time = time
      break

    case 'reminder':
      action.title = cleanTitle(sentence, mainPerson, members)
      action.assignedTo = mainPerson?.name || null
      if (time) action.time = time
      action.category = category || 'promemoria'
      break

    case 'expense': {
      action.amount = amount || 0
      action.category = category || 'altro'
      action.note = sentence
      action.person = mainPerson?.name || null
      const expActivity = extractActivity(sentence)
      if (expActivity) action.activity = expActivity
      const expLocation = extractLocation(sentence, members)
      if (expLocation) action.location = expLocation
      break
    }

    case 'meal': {
      const piatto = sentence
        .replace(/stasera|domani|oggi|per\s+cena|per\s+pranzo|per\s+colazione|si\s+mangia|cuciniamo|mangiamo|facciamo|prepara|preparare/gi, '')
        .trim()
      action.name = piatto.length > 1 ? piatto : sentence
      action.slot = timeCtx?.mealBias || 'cena'
      if (mainPerson) action.person = mainPerson.name
      break
    }

    case 'shopping': {
      const prodotto = sentence
        .replace(/compra|comprare|prendi|prendere|servono|serve|manca|mancano|finit[oaie]|al\s+super(?:mercato)?|alla?\s+lista|da\s+comprare|aggiungi/gi, '')
        .trim()
      action.name = prodotto.length > 1 ? prodotto : sentence
      action.quantity = 1
      action.unit = 'pz'
      if (mainPerson) action.person = mainPerson.name
      break
    }

    case 'note':
      action.text = sentence
      if (mainPerson) action.person = mainPerson.name
      break
  }

  return action
}

// ═══════════════════════════════════════════════════════════════
// GUESS CATEGORY FROM SYNAPSES
// ═══════════════════════════════════════════════════════════════
/** Cerca la migliore categoria dalle sinapsi per un tipo di azione */
export function guessCategoryFromSynapses(actionType, tokens, stems, allSynapses) {
  const categories = new Map()
  for (let i = 0; i < tokens.length; i++) {
    const synapses = [
      ...(allSynapses.get(stems[i]) || []),
      ...(allSynapses.get(tokens[i]) || []),
    ]
    for (const s of synapses) {
      if (s.actionType === actionType && s.category) {
        categories.set(s.category, (categories.get(s.category) || 0) + s.weight)
      }
    }
  }
  let best = 'altro', bestScore = 0
  for (const [cat, score] of categories) {
    if (score > bestScore) { bestScore = score; best = cat }
  }
  return best
}

// ═══════════════════════════════════════════════════════════════
// CLEAN TITLE
// ═══════════════════════════════════════════════════════════════
/** Pulisci il titolo: rimuovi nomi, date, orari, verbi di servizio.
 *  Nota: \b in JS non funziona con caratteri accentati (à, è, ì, ò, ù).
 *  Usiamo (?:^|\s) e (?:\s|$) come boundary alternative.
 */
export function cleanTitle(sentence, mainPerson, members) {
  let title = sentence

  // Helper: boundary-safe replace per parole che possono avere accenti
  const boundaryReplace = (text, word) => {
    return text.replace(new RegExp(`(?:^|\\s)${word}(?:\\s|$)`, 'gi'), ' ')
  }

  // Rimuovi nomi persone (con boundary-safe per accenti)
  for (const m of members) {
    title = boundaryReplace(title, m.name)
  }

  title = title
    // Date
    .replace(/\b(oggi|domani|dopodomani|stasera|domattina|stamattina)\b/gi, '')
    // Giorni settimana (boundary-safe per accenti: lunedì, martedì, ecc.)
    .replace(/(?:^|\s)(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)(?:\s|$)/gi, ' ')
    .replace(/\bsettimana\s+prossima\b/gi, '')
    .replace(/\bmese\s+prossimo\b/gi, '')
    .replace(/(?:^|\s)prossim[oa](?:\s|$)/gi, ' ')
    .replace(/\btra\s+\d+\s+giorni\b/gi, '')
    .replace(/\bil\s+\d{1,2}\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/gi, '')
    // Orari (alle 16, alle 16:30, ore 19, verso le 8)
    .replace(/\ball[e']?\s*\d{1,2}([:.]\d{2})?\b/gi, '')
    .replace(/\b(verso|per|intorno)\s+(le\s+)?\d{1,2}([:.]\d{2})?\b/gi, '')
    .replace(/\bore\s+\d{1,2}([:.]\d{2})?\b/gi, '')
    .replace(/\bh\s*\d{1,2}([:.]\d{2})?\b/gi, '')
    // Verbi di servizio e logistica
    .replace(/\bdeve\b/gi, '')
    .replace(/\bandare\s+a\s+prendere\b/gi, '')
    .replace(/\bandare\s+a\b/gi, '')
    .replace(/\bva\s+a\s+prendere\b/gi, '')
    .replace(/\bva\s+a\b/gi, '')
    .replace(/\bprender[eao]?\b/gi, '')
    .replace(/\bport(?:are|a|o|i|ano)?\b/gi, '')
    .replace(/\baccompagn(?:are|a|o|i|ano)?\b/gi, '')
    .replace(/\britir(?:are|a|o|i|ano)?\b/gi, '')
    .replace(/\briprend(?:ere|e|o|i|ono)?\b/gi, '')
    // Preposizioni orfane a fine/inizio stringa
    .replace(/(^|\s)(alla|all[''\s]*|al|a|in|di|da|per|con)\s*$/gi, '')
    .replace(/^\s*(alla|all[''\s]*|al|a|in|di|da|per|con)(\s|$)/gi, '')
    // Pulizia
    .replace(/^\s*[,.\s]+/, '')
    .replace(/[,.\s]+\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (title.length < 3) {
    title = sentence
    if (mainPerson) title = boundaryReplace(title, mainPerson.name).trim()
    title = title.trim()
  }
  return title.charAt(0).toUpperCase() + title.slice(1)
}
