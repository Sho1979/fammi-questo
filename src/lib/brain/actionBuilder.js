/**
 * actionBuilder.js — Costruzione azioni dal tipo rilevato + title cleaning.
 */

import { extractLocation, extractActivity, extractShoppingQuantity } from './entityExtractor.js'
import { levenshtein } from './textUtils.js'

// ═══════════════════════════════════════════════════════════════
// ACTIVITY → CATEGORY MAPPING
// ═══════════════════════════════════════════════════════════════
const MEDICAL_ACTIVITIES = /^(?:visita|visita medica|controllo|check-?up|dentista|pediatra|oculista|ortopedico|fisioterapia|analisi|ecografia|radiografia|vaccino|vaccinazione)$/i
const SCHOOL_ACTIVITIES = /^(?:scuola|compiti|lezione|ripetizione|studio|interrogazione|verifica|esame|catechismo|scout)$/i
const HOBBY_ACTIVITIES = /^(?:piano|chitarra|violino|canto|disegno|pittura|ceramica|teatro|cinema|museo|mostra)$/i

export function categoryFromActivity(activity) {
  if (!activity) return 'altro'
  if (MEDICAL_ACTIVITIES.test(activity)) return 'medico'
  if (SCHOOL_ACTIVITIES.test(activity)) return 'scuola'
  if (HOBBY_ACTIVITIES.test(activity)) return 'hobby'
  // Default to sport for physical activities (danza, nuoto, allenamento, partita, gara, karate, judo, etc.)
  return 'sport'
}

// ═══════════════════════════════════════════════════════════════
// BUILD ACTION — costruisce l'oggetto azione dal tipo
// ═══════════════════════════════════════════════════════════════
export function buildAction(type, sentence, ctx) {
  const { amount, date, time, persons, members, logistics, timeCtx, category, currentMember } = ctx
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

      // ── ASSEGNAZIONE: chi è il soggetto dell'evento? ──
      // Regola: chi scrive (currentMember) è il soggetto di default.
      // La persona menzionata è "coinvolta" (partecipante), non responsabile.
      // Eccezione: se la frase indica esplicitamente un altro soggetto come attore:
      //   - Logistica con subject esplicito: "porta Viola a danza" → Viola è il subject
      //   - Frase con soggetto grammaticale diverso: "Asia deve..." / "Viola va a..."
      const assignedTo = resolveAssignedTo(sentence, {
        currentMember, mainPerson, eventPerson, logistics, persons, members
      })
      action.assignedTo = assignedTo
      // Aggiungi le persone menzionate come partecipanti (escluso l'assignedTo)
      if (mainPerson && mainPerson.name !== assignedTo) {
        action.withPerson = mainPerson.name
      }

      // Default time for meal context (pranzo 12:30, cena 19:30)
      const lowerForTime = sentence.toLowerCase()
      let effectiveTime = time
      if (!time) {
        if (/\b(?:pranzo|pranzare|pranziamo|mezzogiorno|a\s+pranzo)\b/.test(lowerForTime)) {
          effectiveTime = '12:30'
        } else if (/\b(?:cena|cenare|ceniamo|cenetta|a\s+cena)\b/.test(lowerForTime)) {
          effectiveTime = '19:30'
        } else if (/\b(?:colazione|prima\s+colazione)\b/.test(lowerForTime)) {
          effectiveTime = '08:00'
        }
      }
      action.time = effectiveTime
      if (activity) action.activity = activity
      action.category = category || categoryFromActivity(activity)
      // Flag incomplete if missing critical fields
      if (!date) {
        action.incomplete = 'Manca la data'
        action.warnings = [...(action.warnings || []), 'missing_date']
      } else if (!effectiveTime) {
        action.incomplete = 'Manca l\'orario'
      }

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
      action.assignedTo = resolveAssignedTo(sentence, {
        currentMember, mainPerson, eventPerson: mainPerson, logistics, persons, members
      })
      if (time) action.time = time
      break

    case 'reminder':
      action.title = cleanTitle(sentence, mainPerson, members)
      action.assignedTo = resolveAssignedTo(sentence, {
        currentMember, mainPerson, eventPerson: mainPerson, logistics, persons, members
      })
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

      // Slot: le parole esplicite nella frase battono il timeCtx (ora corrente)
      const lowerSentence = sentence.toLowerCase()
      if (/\b(?:stasera|cena|cenare|ceniamo)\b/.test(lowerSentence)) {
        action.slot = 'cena'
      } else if (/\b(?:pranzo|pranzare|pranziamo|mezzogiorno)\b/.test(lowerSentence)) {
        action.slot = 'pranzo'
      } else if (/\b(?:colazione|stamattina|mattina)\b/.test(lowerSentence)) {
        action.slot = 'colazione'
      } else {
        action.slot = timeCtx?.mealBias || 'cena'
      }

      if (mainPerson) action.person = mainPerson.name
      break
    }

    case 'shopping': {
      const prodotto = sentence
        // Rimuovi verbi reminder/azione
        .replace(/\b(?:ricordami|ricordaci|ricordatemi|ricordateci|ricordatevi|ricorda|ricordo|avvisami|avvisaci|avvertimi|avvertici|segnalami|devo|dobbiamo|bisogna)\b/gi, '')
        // Rimuovi verbi di acquisto
        .replace(/\b(?:comprare|compra|acquistare|acquista|prendi|prendere|servono|serve|manca|mancano|finit[oaie]|aggiungi)\b/gi, '')
        // Rimuovi contesto supermercato/lista
        .replace(/al\s+super(?:mercato)?|alla?\s+lista|da\s+comprare/gi, '')
        // Rimuovi preposizioni/congiunzioni orfane a inizio
        .replace(/^\s*(?:di|che|a|da|per)\s+/gi, '')
        // Rimuovi articoli a inizio stringa
        .replace(/^\s*(?:il|la|lo|le|i|gli|l['']\s*|un[oa]?\s+)/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
      action.name = prodotto.length > 1 ? prodotto : sentence
      const qty = extractShoppingQuantity(action.name)
      action.quantity = qty.quantity
      action.unit = qty.unit
      if (qty.cleanName && qty.cleanName.length > 1) action.name = qty.cleanName
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
// RESOLVE ASSIGNED TO — chi è il soggetto/responsabile dell'evento
// ═══════════════════════════════════════════════════════════════
/**
 * Determina chi è il responsabile (assignedTo) di un'azione.
 *
 * REGOLA FONDAMENTALE: chi scrive (currentMember) è il soggetto di default.
 * La persona menzionata è "coinvolta" ma non responsabile.
 *
 * Eccezioni — l'assignedTo cambia quando:
 *   1. Logistica con subject esplicito diverso dal writer:
 *      "porta Viola a danza" → Viola è il subject, Cristian è il driver
 *   2. Frase con soggetto grammaticale esplicito (nome + verbo d'azione):
 *      "Asia va a danza" / "Viola deve andare" / "Chiara porta Asia"
 *   3. Frase che assegna a qualcuno: "Asia devi portare Viola"
 *
 * @returns {string|null} Nome del responsabile
 */
function resolveAssignedTo(sentence, { currentMember, mainPerson, eventPerson, logistics, persons, members }) {
  const lower = sentence.toLowerCase()

  // 1. Logistica esplicita: se c'è un subject dal logistics, quello è il soggetto dell'evento
  //    Es: "cristian porta viola a danza" → subject=Viola (lei fa danza), driver=Cristian
  //    Es: "chiara va a prendere asia" → subject=Asia (lei viene presa), driver=Chiara
  if (logistics?.subject && logistics?.driver) {
    // Il subject della logistica è la persona per cui l'evento esiste
    return logistics.subject.name
  }

  // 2. Se la persona menzionata è un figlio/elder E la frase indica chiaramente che
  //    l'attività è per loro (verbo d'azione, nome in posizione soggetto)
  if (mainPerson && mainPerson.id !== currentMember?.id) {
    // Pattern di delega/soggetto esplicito:
    // "[Nome] va/deve/deve andare/ha" in posizione iniziale della frase → Nome è il soggetto
    const NAME = mainPerson.name.toLowerCase()
    const delegationPatterns = [
      new RegExp(`^${NAME}\\s+(?:va|deve|ha|deve\\s+andare|deve\\s+fare|fa|farà|andrà)\\b`, 'i'),
      // "[Nome] + attività diretta" in posizione iniziale: "asia dentista", "viola danza"
      new RegExp(`^${NAME}\\s+(?:dentista|pediatra|danza|nuoto|karate|basket|pallavolo|calcio|tennis|ginnastica|piscina|palestra|allenamento|scuola|lezione|corso|catechismo|scout)\\b`, 'i'),
    ]
    const isDelegated = delegationPatterns.some(re => re.test(lower.trim()))
    if (isDelegated) {
      return mainPerson.name
    }

    // Pattern "devi + verbo": "asia devi portare viola" → asia è il soggetto della delega
    const deviPattern = new RegExp(`^${NAME}\\s+devi\\b`, 'i')
    if (deviPattern.test(lower.trim())) {
      return mainPerson.name
    }
  }

  // 3. Default: chi scrive è il soggetto
  if (currentMember) {
    return currentMember.name
  }

  // Fallback: se non c'è currentMember, usa la persona menzionata (backward compat)
  return eventPerson?.name || mainPerson?.name || null
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
    // Verbi reminder
    .replace(/\b(?:ricordami|ricordaci|ricordatemi|ricordateci|ricordatevi|ricorda|ricordo|avvisami|avvisaci|avvertimi|avvertici|segnalami)\b/gi, '')
    // Verbi di servizio e logistica
    .replace(/\b(?:deve|devo|dobbiamo|devono)\b/gi, '')
    .replace(/\bandare\s+a\s+prendere\b/gi, '')
    .replace(/\bandare\s+a\b/gi, '')
    .replace(/\bva\s+a\s+prendere\b/gi, '')
    .replace(/\bva\s+a\b/gi, '')
    .replace(/\bprender[eao]?\b/gi, '')
    .replace(/\bport(?:are|a|o|i|ano)?\b/gi, '')
    .replace(/\baccompagn(?:are|a|o|i|ano)?\b/gi, '')
    .replace(/\britir(?:are|a|o|i|ano)?\b/gi, '')
    .replace(/\briprend(?:ere|e|o|i|ono)?\b/gi, '')
    // Preposizioni temporali orfane a fine stringa
    .replace(/\b(?:entro|fino\s+a[l]?|prima\s+di)\s*$/gi, '')
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
