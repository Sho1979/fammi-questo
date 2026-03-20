/**
 * intentClassifier.js — Parser locale a 3 livelli (L0 pattern + L1 NLP.js + L2 Sinapsi).
 *
 * Questo è il cuore del Cervellone: per ogni frase determina l'intent,
 * estrae entità e costruisce le azioni risultanti.
 *
 * Se viene passato un debugTrace, raccoglie dati dettagliati per ogni frase.
 *
 * ─── POLICY L0 PATTERNS ────────────────────────────────────────────
 * L0 cattura SOLO pattern strutturalmente inequivocabili:
 *   - STRONG (conf ≥ 0.90): importi €, assenze scuola, logistica portare/prendere
 *   - MEDIUM (conf 0.80-0.85): reminder, task espliciti, visitor calendar
 *   - Se un pattern L0 non è ≥ 0.80, NON aggiungerlo a L0 → delegare a L1+L2
 *
 * REGOLA: nuovi intent vanno SEMPRE in L1 training + L2 bootstrap, MAI in L0,
 * a meno che non abbiano un marker strutturale chiaro (es. € per expense).
 * L0 deve restare piccolo per evitare esplosione dei pattern.
 * ────────────────────────────────────────────────────────────────────
 */

import { db } from '../localDb.js'
import { classify, isNlpReady } from '../brainNlp.js'
import { NLP_CONFIDENCE_HIGH, NLP_CONFIDENCE_LOW, SYNAPSE_CONFIDENCE_THRESHOLD, SHADOW_CONFIRM_THRESHOLD } from './config.js'
import { stemIT, tokenizeForMatching, splitSentences, isNegatedAction, isActionable, isPastTenseReport } from './textUtils.js'
import {
  parseLocalDate, parseLocalTime, parseTimeRange,
  parseAmount, extractPersons, extractLogistics,
  extractLocation, extractActivity,
} from './entityExtractor.js'
import { BOOTSTRAP_SYNAPSES } from './patterns.js'
import { getTimeContext, computeSynapseActivations } from './synapseEngine.js'
import { buildAction, guessCategoryFromSynapses } from './actionBuilder.js'
import { addSentenceTrace, isDebugEnabled } from './debugLogger.js'
import { normalizeAndValidateActions } from './actionNormalizer.js'

// ---------------------------------------------------------------
// KEYWORD CATEGORY RESOLVER � override categoria per keyword forti
// ---------------------------------------------------------------
/**
 * Se la frase contiene keyword con una categoria di default forte,
 * e il contesto non specifica un override esplicito, forza la categoria.
 * Es: "riunione" ? "lavoro" (default), "riunione a scuola" ? "scuola" (override)
 */
const KEYWORD_CATEGORY_MAP = [
  { keywords: ['riunione', 'meeting', 'call', 'webinar', 'conferenza'], defaultCat: 'lavoro',
    overrides: { scuola: /\b(?:scuola|scolastica|genitori|professori|insegnanti)\b/i,
                 condominio: /\b(?:condominio|condominiale|condomini|amministratore)\b/i } },
  { keywords: ['massaggio', 'fisioterapia', 'fisio'], defaultCat: 'medico',
    overrides: {} },
  { keywords: ['compleanno', 'festa', 'battesimo', 'comunione', 'matrimonio', 'anniversario'], defaultCat: 'famiglia',
    overrides: {} },
]

function resolveKeywordCategory(sentence, currentCategory) {
  const lower = sentence.toLowerCase()
  for (const entry of KEYWORD_CATEGORY_MAP) {
    const hasKeyword = entry.keywords.some(kw => lower.includes(kw))
    if (!hasKeyword) continue

    // Controlla override espliciti (contesto specifico nella frase)
    for (const [cat, re] of Object.entries(entry.overrides)) {
      if (re.test(lower)) return cat
    }

    // Se la categoria corrente non � quella di default e non c'� un override esplicito,
    // forza la categoria di default della keyword
    return entry.defaultCat
  }
  return currentCategory
}

/**
 * Per ogni frase:
 *   L0: Se c'è un importo chiaro → expense (pattern diretto)
 *   L1: NLP.js classifica l'intent con una rete neurale
 *   L2: Le sinapsi pesate forniscono un secondo parere
 *   Combina L1+L2 per determinare tipo e confidenza
 *
 * @param {string} text - Testo originale
 * @param {Array} members - Membri famiglia
 * @param {string} familyId
 * @param {object} currentMember
 * @param {object} [debugTrace] - Se fornito, raccoglie dati debug per ogni frase
 */
export async function parseLocally(text, members = [], familyId = null, currentMember = null, debugTrace = null) {
  // Check if original text is a question BEFORE splitSentences strips "?"
  const _isOriginalQuestion = /\?\s*$/.test(text.trim())
  const sentences = splitSentences(text)
  const actions = []
  let totalConfidence = 0
  const timeCtx = getTimeContext()
  const debug = debugTrace && isDebugEnabled()

  // Salva le frasi splittate nel trace
  if (debug) {
    debugTrace.sentences = [...sentences]
  }

  // Carica sinapsi apprese dal DB
  // SHADOW LEARNING: sinapsi con confirmCount < SHADOW_CONFIRM_THRESHOLD sono shadow
  // e non vengono incluse nel parsing. Sinapsi bootstrap (senza confirmCount) sono sempre attive.
  const learnedSynapses = new Map()
  if (familyId) {
    try {
      const patterns = await db.patterns
        .where('family_id').equals(familyId)
        .and(p => !p._deleted)
        .toArray()

      for (const p of patterns) {
        if (!p.keyword) continue
        // Shadow filter: sinapsi utente con confirmCount < threshold vengono ignorate
        if (p.source === 'user' && (p.confirmCount || 0) < SHADOW_CONFIRM_THRESHOLD) continue

        const stem = stemIT(p.keyword)
        const weight = 0.2 + 0.7 * (1 - 1 / (1 + (p.score || 0) * 0.15))
        const synapse = { actionType: p.actionType, category: p.category, weight, source: 'learned' }
        if (!learnedSynapses.has(stem)) learnedSynapses.set(stem, [])
        learnedSynapses.get(stem).push(synapse)
        if (!learnedSynapses.has(p.keyword)) learnedSynapses.set(p.keyword, [])
        learnedSynapses.get(p.keyword).push(synapse)
      }
    } catch (err) {
      console.warn('[Brain] Errore caricamento sinapsi:', err)
    }
  }

  // Merge bootstrap + learned
  const allSynapses = new Map(BOOTSTRAP_SYNAPSES)
  for (const [key, syns] of learnedSynapses) {
    if (allSynapses.has(key)) {
      allSynapses.set(key, [...allSynapses.get(key), ...syns])
    } else {
      allSynapses.set(key, syns)
    }
  }

  // Contesto condiviso tra frasi (coreference + spese)
  let lastContext = { location: null, subject: null, activity: null, driver: null, persons: [] }
  let lastDate = null

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()
    const tokens = tokenizeForMatching(sentence)
    const stems = tokens.map(stemIT)
    let persons = extractPersons(sentence, members)
    let date = parseLocalDate(sentence)
    // Propagate date from previous segment if this segment has no explicit date
    const todayStrEarly = new Date().toISOString().slice(0, 10)
    if (date === todayStrEarly && lastDate && lastDate !== todayStrEarly) {
      date = lastDate
    }
    const time = parseLocalTime(sentence)
    const amount = parseAmount(sentence)
    const logistics = extractLogistics(sentence, members)


    // ─── COREFERENCE: risolvi pronomi con contesto frase precedente ───
    // Pronomi italiani cliticizzati: "prendila", "portalo", "accompagnale"
    // e forme libere: "poi prendi lei", "e porta lui"
    if (persons.length === 0 && lastContext.persons.length > 0) {
      const pronounF = /\b(?:prendil[ae]|portal[ae]|accompagnal[ae]|ritiral[ae]|lei)\b/i
      const pronounM = /\b(?:prendil[oi]|portal[oi]|accompagnal[oi]|ritiral[oi]|lui)\b/i
      const pronounPl = /\b(?:prendil[ie]|portal[ie]|accompagnal[ie]|ritiral[ie]|loro)\b/i

      if (pronounF.test(lower)) {
        // Cerca femmina nel contesto precedente
        const femRef = lastContext.persons.find(p =>
          p.gender === 'F' || p.role === 'child' || p.role === 'figlio'
        ) || lastContext.persons[0]
        if (femRef) persons = [femRef]
      } else if (pronounM.test(lower)) {
        const mascRef = lastContext.persons.find(p =>
          p.gender === 'M'
        ) || lastContext.persons[0]
        if (mascRef) persons = [mascRef]
      } else if (pronounPl.test(lower)) {
        persons = [...lastContext.persons]
      }
    }

    // Aggiorna contesto tra frasi
    const sentLocation = extractLocation(sentence, members)
    const sentActivity = extractActivity(sentence)
    if (sentLocation) lastContext.location = sentLocation
    if (sentActivity) lastContext.activity = sentActivity
    if (logistics?.subject) lastContext.subject = logistics.subject
    if (logistics?.driver) lastContext.driver = logistics.driver
    if (persons.length > 0) lastContext.persons = persons

    // Oggetto per raccolta dati debug di questa frase
    const sentenceWarnings = []

    // ─── ACTIONABILITY FILTER: skip frasi senza intent azionabile ───
    // "ciao come stai" → skip. "Ho fame" → skip. "Asia ha preso 8" → skip.
    // Regola: se non c'è verbo d'azione, importo, o entità strutturata → no azione.
    if (!isActionable(sentence) && amount === null) {
      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'not_actionable', confidence: 0, source: 'actionability_filter',
          people: persons.map(p => p.name), date, time, amount: null,
          warnings: ['not_actionable_skipped'],
        })
      }
      continue
    }

    // ─── PAST TENSE FILTER: skip frasi al passato che riportano, non comandano ───
    // "Stamattina ho portato Viola" → skip. "La pizza era buona" → skip.
    // Eccezione: "Ho speso 30 euro" → valid expense.
    if (isPastTenseReport(sentence)) {
      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'past_tense', confidence: 0, source: 'past_tense_filter',
          people: persons.map(p => p.name), date, time, amount: null,
          warnings: ['past_tense_report_skipped'],
        })
      }
      continue
    }

    // ─── NEGATION CHECK: skip frasi negate ("non comprare X", "niente spesa") ───
    // Eccezione: "ricordami di NON X" → la negazione è il contenuto del reminder, non l'intent
    const isReminderWithNegation = /^(?:ricordami|avvisami|ricordaci)\b/i.test(lower.trim())
    if (isNegatedAction(sentence) && !isReminderWithNegation) {
      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'negated', confidence: 0.95, source: 'negation_filter',
          people: persons.map(p => p.name), date, time, amount: null,
          warnings: ['negated_action_skipped'],
        })
      }
      continue
    }

    // ─── HEDGING / QUESTION / POSTPONE FILTER ───
    // Frasi con "forse", "magari", domande, "devo pensarci" non sono azionabili.
    // Il parser non deve creare record per ipotesi o domande consultive.
    // Eccezione: importi espliciti ("forse ho speso 30 euro") e edit ("cancella X?")
    const isEditStart = /^(?:cancella|elimina|rimuovi|togli|sposta|cambia|modifica|annulla)\b/i.test(lower.trim())
    if (!isEditStart && amount === null) {
      const isHedging = /\b(?:forse|magari|probabilmente|credo che|mi sa che)\b/i.test(lower)
      const isQuestion = /\?\s*$/.test(sentence.trim()) || (_isOriginalQuestion && sentences.length === 1)
      const isPostpone = /\b(?:devo pensarci|ci penso|poi vediamo|ti dico dopo|non so se|boh|mah)\b/i.test(lower)
      const isConditional = /\b(?:se riesco|se posso|se ce la faccio|nel caso)\b/i.test(lower)

      if (isHedging || isQuestion || isPostpone || isConditional) {
        if (debug) {
          addSentenceTrace(debugTrace, {
            sentence, intent: 'hedging', confidence: 0, source: 'hedging_filter',
            people: persons.map(p => p.name), date, time, amount: null,
            warnings: [isHedging ? 'hedging' : isQuestion ? 'question' : isPostpone ? 'postpone' : 'conditional'],
          })
        }
        continue
      }
    }

    // ─── L0-EDIT: Frasi di modifica/cancellazione → edit_action con search/patch ───
    // Produce un'azione strutturata per il Resolver (dbResolver.js).
    const editPatterns = [
      { re: /^(?:cancella|elimina|rimuovi|togli)\s+/i, verb: 'delete' },
      { re: /^(?:sposta|cambia|modifica|aggiorna|correggi)\s+/i, verb: 'edit' },
      { re: /(?:sposta|cambia)\s+.*\s+(?:a|al?)\s+/i, verb: 'move' },
      { re: /^(?:annulla|no,?\s*(?:aspetta|scusa)|(?:no,?\s+)?(?:erano|era|non)\s+\d)/i, verb: 'correct' },
    ]
    // "move" overrides "edit" if both match (more specific)
    let editMatch = null
    for (const p of editPatterns) {
      if (p.re.test(lower.trim())) {
        if (!editMatch || p.verb === 'move') editMatch = p
      }
    }
    if (editMatch) {
      // Detect target type (no expense in MVP — no findExpenses yet)
      const targetType =
        /\b(?:task|compito|attività)\b/i.test(lower) ? 'task' :
        /\b(?:evento|appuntamento|dentista|danza|nuoto|scuola|calendario|visita|lezione)\b/i.test(lower) ? 'calendar' :
        /\b(?:lista|shopping|comprare)\b/i.test(lower) ? 'shopping' :
        'unknown'

      // Extract search hints from the sentence
      const activity = sentActivity || lastContext.activity || extractActivity(sentence)
      const titleHintRaw = activity
        ? activity.toLowerCase()
        : lower.replace(editMatch.re, '').replace(/\b(?:di|del|della|dello|il|la|lo|l'|un|una|dei|delle|degli)\b/gi, '').trim().split(/\s+/)[0] || null

      // Extract person from sentence
      const personMatch = persons.length > 0 ? persons[0] : null

      // Extract patch for move/edit verbs
      let patch = null
      if (editMatch.verb === 'move' || editMatch.verb === 'edit') {
        const moveToMatch = lower.match(/\b(?:a|al?|per)\s+(.+)$/i)
        if (moveToMatch) {
          const patchDateRaw = moveToMatch[1].trim()
          const patchDateNorm = parseLocalDate(patchDateRaw)
          const patchTime = parseLocalTime(patchDateRaw)
          patch = {
            dateHintRaw: patchDateRaw,
            dateNorm: patchDateNorm,
            timeHint: patchTime,
          }
        }
      }

      const editAction = {
        type: 'edit_action',
        verb: editMatch.verb,
        targetType,
        search: {
          titleHintRaw: titleHintRaw,
          titleHintNorm: titleHintRaw ? titleHintRaw.toLowerCase() : null,
          dateHintRaw: lower.match(/\b(?:oggi|domani|dopodomani|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica|settimana\s+prossima|[\d]+\s+\w+)\b/i)?.[0] || null,
          dateNorm: date,
          personNameRaw: personMatch?.name || null,
          personId: personMatch?.id || null,
          activityHint: activity || null,
        },
        patch,
        resolved: null,
        _confidence: 0.80,
        _pipelinePath: 'l0_edit',
        _textOriginal: sentence,
      }
      actions.push(editAction)
      totalConfidence += 0.80

      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'edit_action', confidence: 0.80, source: 'l0_edit',
          people: persons.map(p => p.name), date, time,
          actionsGenerated: [editAction], warnings: [],
        })
      }
      continue
    }

    // ─── L0: Pattern strutturali diretti ───

    // Se c'è un importo chiaro → expense (90%)
    if (amount !== null && amount > 0) {
      const action = buildAction('expense', sentence, {
        amount, date, time, persons, members, logistics, timeCtx,
        category: guessCategoryFromSynapses('expense', tokens, stems, allSynapses),
      })
      if (lastContext.location || lastContext.activity) {
        const parts = []
        if (lastContext.activity) parts.push(lastContext.activity)
        if (lastContext.location) parts.push(lastContext.location)
        if (lastContext.subject) parts.push(lastContext.subject.name)
        action.note = parts.join(' - ')
      }
      if (!action.person && lastContext.driver) {
        action.person = lastContext.driver.name
      }
      actions.push(action)
      totalConfidence += 0.90

      // Debug trace per L0 expense
      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence,
          intent: 'expense',
          confidence: 0.90,
          source: 'l0_pattern',
          people: persons.map(p => p.name),
          date, time, amount,
          location: sentLocation,
          activity: sentActivity,
          logistics: logistics ? { driver: logistics.driver?.name, subject: logistics.subject?.name, verb: logistics.actionVerb } : null,
          actionsGenerated: [action],
          warnings: sentenceWarnings,
          hasAmount: true,
        })
      }
      continue
    }

    // ─── L0b: Pattern assenza → evento assenza ───
    const absencePatterns = [
      /(?:non\s+(?:ci\s+)?sono|non\s+(?:sono\s+|è\s+)?disponibile|sono\s+(?:fuori|assente|via|impegnat[oa]))/i,
      /(?:non\s+(?:ci\s+)?sar[oò]|non\s+potr[oò]\s+(?:esserci|venire)|sar[oò]\s+(?:fuori|via|assente|impegnat[oa]))/i,
      /(?:ho\s+un\s+impegno|sono\s+occupat[oa]|non\s+(?:posso|riesco)|(?:è|e')\s+(?:fuori|assent[ea]|via|impegnat[oa]|occupat[oa]))/i,
      // Assenze da scuola/attività
      /(?:non\s+va\s+a\s+scuola|non\s+va\s+all[ae'']\s*\w+|niente\s+scuola|niente\s+lezione)/i,
      /(?:niente\s+(?:pallavolo|allenamento|danza|nuoto|calcio|basket|tennis|karate|ginnastica|catechismo|scout|palestra|corso|partita|gara))/i,
      /(?:non\s+va\s+a\s+(?:danza|nuoto|calcio|basket|palestra|allenamento|lezione|catechismo|scout|tennis|karate|ginnastica|pallavolo))/i,
      /(?:non\s+ha\s+(?:allenamento|lezione|partita|gara|corso|danza|nuoto|palestra|calcio|basket|tennis|karate|ginnastica|catechismo|scout|pallavolo))/i,
      /(?:resta|rimane)\s+a\s+casa/i,
      /(?:ha\s+la\s+febbre|sta\s+male|si\s+sente\s+male|è\s+malat[oa]|sta\s+poco\s+bene|non\s+si\s+sente\s+bene)/i,
      /\bfebbre\s+\w+\b/i,
      /\b(?:è\s+malat[oa]|malat[oa])\b/i,
      // "hanno cancellato la lezione/gita/partita" → assenza/cancellazione evento
      /\b(?:hanno\s+cancellato|è\s+stat[oa]\s+cancellat[oa]|annullat[oa]|sospesa?|rinviat[oa])\s+(?:la\s+|il\s+|lo\s+|l['']\s*)?(?:lezione|gita|partita|gara|allenamento|corso|recita|riunione|attività|saggio)\b/i,
      /\b(?:cancellat[oa]|annullat[oa]|sospesa?|rinviat[oa])\s+(?:la\s+|il\s+|lo\s+|l['']\s*)?(?:lezione|gita|partita|gara|allenamento|corso|recita|riunione|attività|saggio)\b/i,
      // "non viene questa settimana" — persona/servizio che non viene
      /\bnon\s+viene\s+(?:questa|questa\s+settimana|oggi|domani|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\b/i,
      // "non c'è / non c e" con soggetto persona
      /\bnon\s+c\s*[''e]\s*(?:è\s+)?(?:la\s+mattina|il\s+pomeriggio|domani|oggi|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\b/i,
    ]
    const isAbsence = absencePatterns.some(re => re.test(lower))
    if (isAbsence) {
      const absentPerson = persons?.[0] || null
      const timeRange = parseTimeRange(sentence)
      const absentName = absentPerson?.name || currentMember?.name || null

      const title = absentName
        ? `${absentName} non disponibile`
        : 'Non disponibile'

      const calAction = {
        type: 'calendar',
        date,
        title,
        assignedTo: absentName,
        time: timeRange?.start || time || null,
        timeEnd: timeRange?.end || null,
        category: 'assenza',
        isAbsence: true,
      }
      actions.push(calAction)
      const absenceActions = [calAction]

      // ─── Rilevamento "vi ricordate" / "ricordatevi" → promemoria per gli altri ───
      const reminderPatterns = [
        /(?:vi\s+)?ricordat(?:e|evi)\s+che/i,
        /(?:vi\s+)?ricord[oi]\s+che/i,
        /non\s+dimenticat(?:e|evi)\s+che/i,
        /tenete\s+(?:a\s+)?mente\s+che/i,
        /(?:vi\s+)?avvis[oi]\s+che/i,
        /sappiate\s+che/i,
      ]
      const wantsReminder = reminderPatterns.some(re => re.test(lower))

      if (wantsReminder && members.length > 0) {
        const absentId = absentPerson?.id || currentMember?.id || null
        const otherMembers = members.filter(m =>
          m.id !== absentId &&
          (m.role === 'parent' || m.role === 'genitore' || m.role === 'child')
        )

        const timeLabel = timeRange
          ? ` (${timeRange.start}–${timeRange.end})`
          : ''

        for (const member of otherMembers) {
          const reminderAction = {
            type: 'reminder',
            title: `${absentName}${timeLabel} non disponibile`,
            text: `${absentName} ha ricordato: ${date || 'prossimamente'} non sarà disponibile${timeLabel}. Conferma di aver letto.`,
            assignedTo: member.name,
            assignedToId: member.id,
            date,
            needsConfirm: true,
            fromPerson: absentName,
          }
          actions.push(reminderAction)
          absenceActions.push(reminderAction)
        }
      }

      totalConfidence += 0.92

      // Debug trace per assenza
      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence,
          intent: 'absence',
          confidence: 0.92,
          source: 'l0_pattern',
          people: persons.map(p => p.name),
          date, time,
          timeRange: timeRange ? `${timeRange.start}–${timeRange.end}` : null,
          actionsGenerated: absenceActions,
          isAbsence: true,
          warnings: !absentName ? ['absent_person_unknown'] : [],
        })
      }
      continue
    }

    // ─── L0b1: Logistica con soggetto → calendar (intercetta prima di NLP/sinapsi) ───
    if (logistics?.subject && logistics?.actionVerb) {
      const luogo = extractLocation(sentence, members)
      const activity = extractActivity(sentence)
      const isPickup = logistics.actionVerb === 'prendere' || logistics.actionVerb === 'riprendere' || logistics.actionVerb === 'ritirare'
      const isDropOff = logistics.actionVerb === 'portare'

      let calTitle
      if (logistics.driver && logistics.driver.id !== logistics.subject.id) {
        // DUAL ACTION: driver + subject → calendario + task
        if (isDropOff && activity) {
          calTitle = luogo ? `${activity} ${logistics.subject.name} - ${luogo}` : `${activity} ${logistics.subject.name}`
        } else if (isPickup) {
          calTitle = luogo ? `Arrivo ${logistics.subject.name} - ${luogo}` : `Arrivo ${logistics.subject.name}`
        } else {
          calTitle = luogo ? `${activity || 'Impegno'} ${logistics.subject.name} - ${luogo}` : `${activity || 'Impegno'} ${logistics.subject.name}`
        }

        const calAction = {
          type: 'calendar', date, title: calTitle,
          assignedTo: logistics.subject.name, time,
          category: activity ? 'sport' : 'logistica',
          incomplete: !time ? 'Manca l\'orario' : undefined,
        }
        if (activity) calAction.activity = activity
        if (isDropOff) { calAction.accompaniedBy = logistics.driver.name; calAction.needsPickup = true }
        else { calAction.pickupBy = logistics.driver.name }
        actions.push(calAction)
        totalConfidence += 0.88

        let taskTitle = isDropOff
          ? (luogo ? `Portare ${logistics.subject.name} - ${luogo}` : `Portare ${logistics.subject.name}`)
          : (luogo ? `Andare a prendere ${logistics.subject.name} - ${luogo}` : `Andare a prendere ${logistics.subject.name}`)
        const taskAction = { type: 'task', date, title: taskTitle, assignedTo: logistics.driver.name, time }
        actions.push(taskAction)
        totalConfidence += 0.88

        if (isDropOff) {
          // Check: "e [NOME] la/lo riprende (alle HH)" nella stessa frase?
          const _pickupRe = /\be\s+(\w+)\s+(?:(?:la|lo|li|le)\s+|l[''']\s*)?(?:riprende|va\s+a\s+prendere|viene\s+a\s+prendere)/i
          const _pickupM = sentence.match(_pickupRe)
          const _findMem = (n) => { if (!n) return null; const nl = n.toLowerCase(); return members.find(m => m.name.toLowerCase() === nl) || members.find(m => m.aliases?.some(a => a.toLowerCase() === nl)) || null }
          const _pickupPerson = _pickupM ? _findMem(_pickupM[1]) : null
          const _pickupTimeRe = /riprende(?:r.?)?\s+(?:alle?\s*)?(\d{1,2}(?:[:.]\d{2})?)\b/i
          const _pickupTimeM = sentence.match(_pickupTimeRe)
          const _pickupTime = _pickupTimeM ? (() => {
              const _raw = _pickupTimeM[1]
              if (_raw.includes(':') || _raw.includes('.')) return _raw.replace('.', ':').padStart(5, '0')
              return _raw.padStart(2, '0') + ':00'
            })() : null

          if (_pickupPerson) {
            calAction.pickupBy = _pickupPerson.name
            calAction.needsPickup = false
            // Se il tempo globale coincide col pickup time, l'evento danza non ha orario proprio
            if (_pickupTime && time === _pickupTime) {
              calAction.time = null
              calAction.incomplete = "Manca l'orario di inizio"
              // Anche il task portare non ha orario (è prima del pickup)
              taskAction.time = null
            }
            const _pTitle = luogo ? `Riprendere ${logistics.subject.name} - ${luogo}` : `Riprendere ${logistics.subject.name}`
            const _pickupTask = { type: 'task', date, title: _pTitle, assignedTo: _pickupPerson.name, time: _pickupTime }
            actions.push(_pickupTask)
            totalConfidence += 0.85
          } else {
            const reminderAction = { type: 'note', date, text: `Chi va a riprendere ${logistics.subject.name}${luogo ? ` da ${luogo}` : ''}?`, isReminder: true }
            actions.push(reminderAction)
            totalConfidence += 0.7
          }
        }

        if (debug) {
          addSentenceTrace(debugTrace, {
            sentence, intent: 'calendar', confidence: 0.88, source: 'l0_logistics',
            people: persons.map(p => p.name), date, time, amount: null,
            location: luogo, activity: activity,
            logistics: { driver: logistics.driver.name, subject: logistics.subject.name, verb: logistics.actionVerb },
            actionsGenerated: actions.slice(-3), isDualAction: true,
            warnings: [...sentenceWarnings, ...(time ? [] : ['missing_explicit_time']), ...(isDropOff ? ['needs_pickup_person'] : [])],
          })
        }
        continue
      } else {
        // LOGISTICA COLLETTIVA: solo subject, no driver
        if (isPickup) {
          calTitle = luogo ? `Andare a prendere ${logistics.subject.name} - ${luogo}` : `Andare a prendere ${logistics.subject.name}`
        } else if (isDropOff && activity) {
          calTitle = luogo ? `${activity} ${logistics.subject.name} - ${luogo}` : `${activity} ${logistics.subject.name}`
        } else {
          calTitle = luogo ? `${activity || 'Impegno'} ${logistics.subject.name} - ${luogo}` : `${activity || 'Impegno'} ${logistics.subject.name}`
        }

        const calAction = {
          type: 'calendar', date, title: calTitle,
          assignedTo: logistics.subject.name, time,
          location: luogo || null,
          activity: activity || null,
          category: activity ? 'sport' : 'logistica',
          needsDriver: true,
          logistics: { subject: logistics.subject.name, actionVerb: logistics.actionVerb },
          incomplete: 'Manca chi accompagna/riprende',
        }
        actions.push(calAction)
        totalConfidence += 0.85

        if (debug) {
          addSentenceTrace(debugTrace, {
            sentence, intent: 'calendar', confidence: 0.85, source: 'l0_logistics',
            people: persons.map(p => p.name), date, time, amount: null,
            location: luogo, activity: activity,
            logistics: { subject: logistics.subject.name, verb: logistics.actionVerb },
            actionsGenerated: [calAction],
            warnings: [...sentenceWarnings, 'needs_pickup_person', ...(time ? [] : ['missing_explicit_time'])],
          })
        }
        continue
      }
    }

    // ─── L0b2: Pattern "cena fuori / pranzo dai nonni" → calendar (evento sociale, non meal) ───
    const socialDiningPatterns = [
      /cen[ai]\s+(?:fuori|da[il]?\s|con\s|al\s|in\s)/i,
      /pranzo\s+(?:fuori|da[il]?\s|con\s|al\s|in\s)/i,
      /cen[ai]\s+(?:dai\s+|dalla\s+|dagli\s+)/i,
      /pranzo\s+(?:dai\s+|dalla\s+|dagli\s+)/i,
      // "grigliata con gli amici", "barbecue con i colleghi" → evento sociale
      /(?:grigliata|grigliatina|barbecue|bbq)\s+con\s+/i,
      /(?:cena|pranzo)\s+(?:al\s+ristorante|in\s+pizzeria|in\s+trattoria)/i,
      // "vengono a cena/pranzo" → ospiti = evento
      /(?:vengono|viene|arrivano|arriva)\s+a\s+(?:cena|pranzo)/i,
      /a\s+(?:cena|pranzo)\s+(?:viene|vengono|arriva|arrivano)/i,
      // "cena/pranzo + orario specifico" → è un evento
      /(?:cena|pranzo)\s+alle?\s+\d/i,
      // "pranzo dalla nonna", "cena alle X tutti insieme"
      /(?:cena|pranzo)\s+.*(?:tutti|insieme|famiglia)/i,
      // "pranzo di Natale/compleanno/comunione" → evento
      /(?:cena|pranzo)\s+(?:di|del|della|per\s+il|per\s+la)\s+(?:natale|pasqua|compleanno|comunione|battesimo|matrimonio|anniversario|capodanno|festa)/i,
      // "stasera/domani sera + cena con orario"
      /(?:stasera|domani\s+sera|sabato\s+sera|venerdi\s+sera|domenica)\s+(?:cena|pranzo)\s+alle?\s*/i,
      // "film in famiglia dopo cena"
      /(?:film|cinema|serata)\s+(?:in\s+famiglia|con\s+|tutti)/i,
    ]
    const isSocialDiningL0 = socialDiningPatterns.some(re => re.test(lower))
    if (isSocialDiningL0) {
      const action = buildAction('calendar', sentence, {
        amount: null, date, time, persons, members, logistics, timeCtx,
        category: 'famiglia',
      })
      // "di famiglia" / "tutti insieme" -> evento per tutta la famiglia
      const isFamilyWide = /(?:di\s+famiglia|tutti\s+insieme|tutti\s+quanti|con\s+tutti|in\s+famiglia)/i.test(sentence)
      if (isFamilyWide) {
        action.assignedTo = 'Famiglia'
        action.isFamily = true
      }
      actions.push(action)
      totalConfidence += 0.85

      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'calendar', confidence: 0.85, source: 'l0_pattern',
          people: persons.map(p => p.name), date, time, amount: null,
          location: sentLocation, activity: sentActivity,
          actionsGenerated: [action], warnings: sentenceWarnings,
        })
      }
      continue
    }

    // ─── L0b3: Pattern "facciamo/ordiniamo + piatto" o "a pranzo pasta" → meal ───
    const PIATTI = 'pasta|pizza|risotto|lasagn[ea]|gnocchi|polpette|arrosto|grigliata|grigliatina|frittata|insalata|pollo|pesce|carne|sushi|carbonara|minestrone|minestra|zuppa|vellutata|parmigiana|tortellini|ravioli|tagliatelle|penne|spaghetti|hamburger|crepes|focaccia|piadina|riso|torta|pancake|cornetti|polenta|brodo|ragù|ragu|sugo|cotoletta'
    const mealDirectPatterns = [
      new RegExp(`(?:facciamo|cuciniamo|prepariamo|preparo|ordiniamo|cucino)\\s+(?:le?\\s+|il\\s+|la\\s+|i\\s+|gli\\s+|un[oa]?\\s+)?(?:${PIATTI})`, 'i'),
      /(?:grigliat[ai]na?|barbecue|bbq)\s+(?:in\s+|al\s+|a\s+)/i,
      /(?:a\s+pranzo|a\s+cena)\s+(?:facciamo|prepariamo|cuciniamo)\s+/i,
      // "cucina Chiara che io lavoro" — assegnazione cucina a qualcuno
      /(?:sera|pranzo|cena|stasera)\s+cucin[aoei]\s+/i,
      /\bcucin[aoei]\s+\w+\s+(?:che|perché|così|quindi|tanto)\b/i,
      // "a pranzo/cena + piatto" → è meal planning, non evento
      new RegExp(`(?:a\\s+pranzo|a\\s+cena|per\\s+cena|per\\s+pranzo|per\\s+colazione|per\\s+merenda)\\s+(?:${PIATTI})`, 'i'),
      // "domani sera pizza da asporto" — piatto con contesto temporale
      new RegExp(`(?:stasera|domani\\s+sera|domani\\s+a\\s+pranzo|domani\\s+a\\s+cena)\\s+(?:${PIATTI})`, 'i'),
      // "pizza da asporto/a domicilio" → meal
      /(?:pizza|sushi|cinese|giapponese|kebab|poke)\s+(?:da\s+asporto|a\s+domicilio|delivery)/i,
      // "colazione con + cibo"
      new RegExp(`(?:colazione|merenda)\\s+con\\s+(?:i\\s+|le?\\s+|il\\s+)?(?:${PIATTI}|cornetti|pancake|biscotti|yogurt|cereali|latte|succo)`, 'i'),
      // "pensavo di fare + piatto" → meal proposal
      new RegExp(`(?:pensavo|penso)\\s+di\\s+(?:fare|preparare|cucinare)\\s+(?:le?\\s+|il\\s+|la\\s+|i\\s+|gli\\s+|un[oa]?\\s+)?(?:${PIATTI})`, 'i'),
      // "domenica/per domenica preparo + piatto" → meal planning (not task)
      new RegExp(`(?:domenica|sabato|per\\s+(?:domenica|sabato|domani))\\s+(?:preparo|cucino|faccio)\\s+(?:le?\\s+|il\\s+|la\\s+|i\\s+|gli\\s+|un[oa]?\\s+)?(?:${PIATTI})`, 'i'),
      // "vi porto il ragù" → meal contribution (not logistics)
      new RegExp(`(?:vi\\s+porto|porto\\s+io)\\s+(?:il\\s+|la\\s+|le\\s+|i\\s+|lo\\s+)?(?:${PIATTI})`, 'i'),
    ]
    const isDirectMeal = mealDirectPatterns.some(re => re.test(lower))
    if (isDirectMeal) {
      const action = buildAction('meal', sentence, {
        amount: null, date, time, persons, members, logistics, timeCtx,
        category: null,
      })
      actions.push(action)
      totalConfidence += 0.88

      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'meal', confidence: 0.88, source: 'l0_pattern',
          people: persons.map(p => p.name), date, time, amount: null,
          location: sentLocation, activity: sentActivity,
          actionsGenerated: [action], warnings: sentenceWarnings,
        })
      }
      continue
    }

    // ─── L0b4: Pattern "portare/prenotare + visita/veterinario/appuntamento" → calendar ───
    const appointmentPatterns = [
      /(?:portare|porto)\s+(?:il\s+)?(?:cane|gatto)\s+(?:dal|al)\s+(?:veterinario|vet)/i,
      /(?:portare|porto)\s+\w+\s+(?:dal|al|dalla|alla)\s+(?:dottore|dottoressa|pediatra|dentista|oculista|veterinario|meccanico)/i,
      /(?:prenotar[ei]|prenota)\s+(?:visita|appuntamento|controllo)\s/i,
      /(?:appuntamento|visita)\s+(?:dal|al|dalla|alla|con\s+il|con\s+la)\s+/i,
      /(?:l\s+idraulico|il\s+tecnico|il\s+corriere|la\s+baby\s*sitter)\s+(?:viene|arriva|passa)/i,
      /(?:viene|arriva|passa)\s+(?:l\s+idraulico|il\s+tecnico|il\s+corriere|la\s+baby\s*sitter)/i,
      /(?:compleanno|scadenza|saggio|recita|torneo|partita|gara)\s+(?:di|del|della|il|lo|la)\s+/i,
      /\bil\s+compleanno\s+di\b/i,
    ]
    const isAppointmentCalendar = appointmentPatterns.some(re => re.test(lower))
    if (isAppointmentCalendar) {
      const action = buildAction('calendar', sentence, {
        amount: null, date, time, persons, members, logistics, timeCtx,
        category: guessCategoryFromSynapses('calendar', tokens, stems, allSynapses),
      })
      actions.push(action)
      totalConfidence += 0.82

      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'calendar', confidence: 0.82, source: 'l0_pattern',
          people: persons.map(p => p.name), date, time,
          actionsGenerated: [action], warnings: sentenceWarnings,
        })
      }
      continue
    }

    // ─── L0b4c: Pattern eventi sociali/personali brevi ───
    // "vado a dormire da Emma", "sabato ho catechismo", "vado al supermercato"
    // Frasi con giorno esplicito + attività/luogo sociale → calendar
    const socialPersonalPatterns = [
      // "vado a dormire da X" — sleepover
      /\bvado\s+a\s+dormire\s+(?:da|a\s+casa\s+di)\s+/i,
      // "vado a/al/alla + luogo" con giorno esplicito
      /\bvado\s+(?:al|alla|all['']\s*|a)\s+\w+/i,
      // "ho + attività nota" — impegno personale
      /\bho\s+(?:catechismo|danza|nuoto|pallavolo|basket|calcio|tennis|karate|palestra|allenamento|lezione|partita|gara|saggio|recita|corso|la\s+verifica|l['']\s*esame|il\s+torneo)\b/i,
      // "andiamo a/al/da" — uscita di gruppo
      /\bandiamo\s+(?:al?|da[li]?|in)\s+/i,
    ]
    const isSocialPersonal = socialPersonalPatterns.some(re => re.test(lower))
    const hasDateContext = date !== todayStrEarly || /\b(?:domani|dopodomani|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)\b/i.test(lower)
    if (isSocialPersonal && hasDateContext && amount === null) {
      const action = buildAction('calendar', sentence, {
        amount: null, date, time, persons, members, logistics, timeCtx,
        category: guessCategoryFromSynapses('calendar', tokens, stems, allSynapses) || 'personale',
      })
      actions.push(action)
      totalConfidence += 0.75

      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'calendar', confidence: 0.75, source: 'l0_social_personal',
          people: persons.map(p => p.name), date, time,
          actionsGenerated: [action], warnings: sentenceWarnings,
        })
      }
      continue
    }

    // ─── L0b5: Pattern task esplicito — verbi azione domestica/compiti ───
    const TASK_VERBS = /\b(?:pulire|pulizie|lavare|stirare|stendere|apparecchiare|sparecchiare|riordinare|ordinare|svuotare|aspirare|spazzare|innaffiare|scongelare|buttare|cambiare|controllare|firmare|stampare|chiamare|mandare|confermare|rinnovare)\b/i
    const hasTaskVerb = TASK_VERBS.test(lower)
    // Non è task se ha un contesto calendario forte (visita, appuntamento, veterinario)
    const hasCalendarContext = /\b(?:visita|appuntamento|veterinario|dentista|dottore|pediatra|oculista)\b/i.test(lower)
    // Non è task se ha un importo (→ expense)
    if (hasTaskVerb && !hasCalendarContext && amount === null) {
      // Verifica che non sia un meal (preparare la cena)
      const isMealPrep = /\b(?:preparare|prepara)\s+(?:la\s+)?(?:cena|pranzo|colazione|merenda)\b/i.test(lower)
      if (!isMealPrep) {
        const action = buildAction('task', sentence, {
          amount: null, date, time, persons, members, logistics, timeCtx,
          category: null, currentMember,
        })
        actions.push(action)
        totalConfidence += 0.80

        if (debug) {
          addSentenceTrace(debugTrace, {
            sentence, intent: 'task', confidence: 0.80, source: 'l0_pattern',
            people: persons.map(p => p.name), date, time,
            actionsGenerated: [action], warnings: sentenceWarnings,
          })
        }
        continue
      }
    }

    // ─── L0c: Pattern "ricordami / avvisami" → reminder ───
    const reminderDirectPatterns = [
      /^(?:ricordami|avvisami|avvertimi|segnalami)\b/i,
      /^(?:ricorda(?:mi|ci|temi)?)\s+(?:di|che|alle?|domani)/i,
      /^(?:avvisa(?:mi|ci)?)\s+(?:di|che|alle?|domani|quando)/i,
    ]
    const isDirectReminder = reminderDirectPatterns.some(re => re.test(lower.trim()))
    if (isDirectReminder) {
      const action = buildAction('reminder', sentence, {
        amount: null, date, time, persons, members, logistics, timeCtx,
        category: 'promemoria',
      })
      actions.push(action)
      totalConfidence += 0.88

      // --- Scope notifica: 'mi' = personale, 'ci/temi/tevi' = famiglia ---
      const _isForAll = /\b(?:ricordaci|ricordatemi|ricordatevi|avvisaci|avvisateci|avvertici)\b/i.test(lower)
      const _notifyScope = _isForAll ? 'family' : 'personal'
      action.notifyScope = _notifyScope

      // --- DUAL ACTION: se il reminder contiene verbi di acquisto -> genera anche shopping ---
      // MA NON se la frase contiene negazione ("ricordami di NON comprare X")
      const _buyingRe = /\b(?:comprare|compra|acquistare|acquista|prendere|prendi)\s+/i
      const _hasNegationBeforeBuy = /\bnon\s+(?:comprare|compra|acquistare|acquista|prendere|prendi)\b/i.test(lower)
      if (_buyingRe.test(lower) && !_hasNegationBeforeBuy) {
        const shoppingAction = buildAction('shopping', sentence, {
          amount: null, date, time: null, persons, members, logistics, timeCtx,
          category: null, currentMember,
        })
        shoppingAction.notifyScope = _notifyScope
        // Categoria automatica per prodotti noti
        const _lowerName = (shoppingAction.name || '').toLowerCase()
        if (/latte|formaggio|yogurt|burro|panna|mozzarella/.test(_lowerName)) shoppingAction.category = 'latticini'
        else if (/pane|pasta|farina|riso|biscotti|crackers|grissini/.test(_lowerName)) shoppingAction.category = 'pane_pasta'
        else if (/acqua|succo|birra|vino|coca|aranciata|the|caff/.test(_lowerName)) shoppingAction.category = 'bevande'
        else if (/pollo|carne|pesce|salmone|tonno|prosciutto|salame/.test(_lowerName)) shoppingAction.category = 'carne_pesce'
        else if (/mela|banana|pomodor|insalata|verdur|frutta|zucchine|carote|patate/.test(_lowerName)) shoppingAction.category = 'frutta_verdura'
        else if (/detersivo|sapone|shampoo|carta\s*igienica|spazzolino/.test(_lowerName)) shoppingAction.category = 'igiene'
        else shoppingAction.category = 'altro'

        actions.push(shoppingAction)
        totalConfidence += 0.80

      }

      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'reminder', confidence: 0.88, source: 'l0_pattern',
          people: persons.map(p => p.name), date, time, amount: null,
          location: sentLocation, activity: sentActivity,
          actionsGenerated: actions.filter(a => a.type === 'reminder' || a.type === 'shopping'), warnings: sentenceWarnings,
        })
      }
      continue
    }

    // ─── L0d: Pattern "non dimenticare / bisogna / serve / devo / iscrivere" → task ───
    const taskDirectPatterns = [
      /^(?:non\s+dimenticare?\s+(?:di\s+)?)/i,
      /^(?:bisogna|occorre|tocca)\s+(?!andare\s+a\s+prendere)/i,
      /^(?:serve|servono)\s+(?:prenotare|chiamare|fissare|organizzare|preparare|controllare|verificare)/i,
      /^(?:devo|dobbiamo)\s+(?:parlare|chiamare|prenotare|iscrivere|firmare|portare\s+(?:il?|l[aoe])|rinnovare|pagare)/i,
      /^(?:iscrivere|iscrizione|prenotare|fissare|rinnovare)\s+/i,
      /^(?:preparare|consegnare|portare|lavare|stirare|pulire|controllare|organizzare|sistemare)\s+(?:il?|la|le|i|lo|gli|un[oa]?)\b/i,
      // "deve studiare / deve fare i compiti" — compiti scolastici = task, non calendar
      /\bdeve\s+(?:studiare|fare\s+i\s+compiti|ripassare|esercitarsi)\b/i,
      // "da ritirare / da firmare / da consegnare" — azione pendente = task
      /\bda\s+(?:ritirare|firmare|consegnare|compilare|restituire)\b/i,
    ]
    const isDirectTask = taskDirectPatterns.some(re => re.test(lower.trim()))
    // Override: "bisogna/devo comprare" + grocery items → shopping, not task
    const GROCERY_WORDS_RE = /\b(?:pane|latte|uova|formaggio|burro|yogurt|prosciutto|salame|mortadella|verdur[ae]|frutta|carne|pollo|pesce|detersivo|sapone|pannolini|biscotti|crackers|cereali|pasta(?!\s+(?:al|con|di\s+\w+\s+per)))\b/i
    const hasGroceryObject = /\b(?:comprare|compra|prendere|prendi)\b/i.test(lower) && GROCERY_WORDS_RE.test(lower)
    if (isDirectTask && hasGroceryObject) {
      const action = buildAction('shopping', sentence, {
        amount: null, date, time: null, persons, members, logistics, timeCtx,
        category: null, currentMember,
      })
      actions.push(action)
      totalConfidence += 0.82
      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'shopping', confidence: 0.82, source: 'l0d_grocery_override',
          people: persons.map(p => p.name), date, time, amount: null,
          actionsGenerated: [action], warnings: sentenceWarnings,
        })
      }
      continue
    }
    if (isDirectTask) {
      const action = buildAction('task', sentence, {
        amount: null, date, time, persons, members, logistics, timeCtx,
        category: 'altro',
      })
      actions.push(action)
      totalConfidence += 0.82

      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'task', confidence: 0.82, source: 'l0_pattern',
          people: persons.map(p => p.name), date, time, amount: null,
          location: sentLocation, activity: sentActivity,
          actionsGenerated: [action], warnings: sentenceWarnings,
        })
      }
      continue
    }

    // ─── L0e: "Arriva il tecnico / viene l'idraulico" → calendar (visita/appuntamento) ───
    const visitorCalendarPatterns = [
      /(?:arriva|viene|passa)\s+(?:il|la|l['']\s*)\s*(?:tecnico|idraulico|elettricista|muratore|imbianchino|corriere|postino|fattorino|pediatra|dottore|medico|giardiniere|installatore|operaio)\b/i,
    ]
    const isVisitorCalendar = visitorCalendarPatterns.some(re => re.test(lower))
    if (isVisitorCalendar) {
      const action = buildAction('calendar', sentence, {
        amount: null, date, time, persons, members, logistics, timeCtx,
        category: 'casa',
      })
      actions.push(action)
      totalConfidence += 0.85

      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'calendar', confidence: 0.85, source: 'l0_pattern',
          people: persons.map(p => p.name), date, time, amount: null,
          location: sentLocation, activity: sentActivity,
          actionsGenerated: [action], warnings: sentenceWarnings,
        })
      }
      continue
    }

    // ─── L0f: Pattern shopping RESTRITTIVO ───
    // Posizionato DOPO reminder (L0c) e task (L0d) per non rubare i loro match.
    // Cattura SOLO: lista spesa esplicita, "al supermercato/Lidl/Coop", quantità tipiche,
    // "compra/prendi + grocery item" SENZA verbi task/reminder a inizio frase.
    const GROCERY_RE = /\b(?:pane|latte|uova|formaggio|burro|mozzarella|prosciutto|salame|mortadella|yogurt|farina|zucchero|olio|aceto|pannolini|nurofen|tachipirina|detersivo|sapone|shampoo|carta\s*igienica|biscotti|crackers|cereali)\b/i
    const shoppingL0Patterns = [
      // "lista spesa" / "lista della spesa"
      /\blista\s+(?:della\s+)?spesa\b/i,
      // "fare la spesa" / "andare a fare spesa" / "andiamo a fare la spesa"
      /\b(?:fare|andiamo\s+a\s+fare|vai\s+a\s+fare|va\s*['']\s*a\s+fare)\s+(?:la\s+)?spesa\b/i,
      // "al supermercato / alla Coop / al Lidl" — SOLO se è il focus della frase (non "passo al supermercato" in contesto multi)
      /^(?:andiamo|vai|andate|domani(?:\s+mattina)?)\s+(?:al\s+supermercato|alla\s+coop|al\s+lidl|all['']\s*esselunga|al\s+conad|al\s+carrefour)\b/i,
      // "un etto di / tre etti di / mezzo chilo di" — quantità tipiche spesa
      /\b(?:un\s+etto|due\s+etti|tre\s+etti|mezzo\s+chilo|un\s+chilo|due\s+chili|un\s+litro|due\s+litri|una\s+confezione|un\s+pacco|una\s+bottiglia|due\s+bottiglie|una\s+scatola)\s+(?:di\s+)/i,
    ]
    // Guard: no amount, no logistic, no meal context
    const isMealContext = /\b(?:a\s+pranzo|a\s+cena|per\s+cena|per\s+pranzo|si\s+mangia|mangiamo|cuciniamo|prepariamo|menu)\b/i.test(lower)
    const hasLogisticContext = logistics?.subject && logistics?.actionVerb
    const isShoppingL0 = !hasLogisticContext && amount === null && !isMealContext && shoppingL0Patterns.some(re => re.test(lower))
    // Grocery-only list: 2+ grocery items AND no other strong context
    const groceryMatches = lower.match(new RegExp(GROCERY_RE.source, 'gi'))
    const groceryCount = groceryMatches ? groceryMatches.length : 0
    const isPureGroceryList = groceryCount >= 2 && amount === null && !isMealContext && !hasLogisticContext
    if (isShoppingL0 || isPureGroceryList) {
      const action = buildAction('shopping', sentence, {
        amount: null, date, time: null, persons, members, logistics, timeCtx,
        category: null, currentMember,
      })
      actions.push(action)
      totalConfidence += 0.85

      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence, intent: 'shopping', confidence: 0.85, source: 'l0_pattern',
          people: persons.map(p => p.name), date, time, amount: null,
          location: sentLocation, activity: sentActivity,
          actionsGenerated: [action], warnings: sentenceWarnings,
        })
      }
      continue
    }

    // ─── L1: NLP.js (rete neurale) ───
    let nlpType = null
    let nlpCategory = null
    let nlpScore = 0

    if (isNlpReady()) {
      try {
        const nlpResult = await classify(sentence)
        if (nlpResult.intent !== 'None' && nlpResult.score > 0.1) {
          nlpScore = nlpResult.score
          if (nlpResult.action) {
            nlpType = nlpResult.action.type
            nlpCategory = nlpResult.action.category
          }
        }
      } catch (err) {
        console.warn('[Brain] NLP.js classify error:', err)
        if (debug) sentenceWarnings.push('nlp_classify_error')
      }
    } else {
      if (debug) sentenceWarnings.push('nlp_not_ready')
    }

    // ─── CONFIDENCE CAP: NLP.js overconfidence on very short/empty input ───
    // NLP.js gives 1.0 on "ciao come stai" or "si no forse". Only cap on
    // very short sentences (≤3 words) with no structured content.
    // Longer sentences with person+date+activity are legitimate even without verbs.
    const wordCount = lower.split(/\s+/).length
    if (nlpScore > 0.8 && wordCount <= 3 && amount === null && !time && persons.length === 0) {
      nlpScore = Math.min(nlpScore, 0.45)
      if (debug) sentenceWarnings.push('nlp_confidence_capped_short')
    }

    // ─── L2: Sinapsi pesate ───
    const activations = computeSynapseActivations(tokens, stems, allSynapses)

    // Boost contesto temporale per meal (ma non se è cena sociale/fuori)
    const isSocialDining = /cen[ai]\s+(?:fuori|da[li]?\s|con\s|al\s|in\s)/i.test(sentence) || /pranzo\s+(?:fuori|da[li]?\s|con\s|al\s|in\s)/i.test(sentence)
    if (!isSocialDining && (timeCtx.period === 'sera' || /stasera|per\s+cena/i.test(sentence))) {
      const mealAct = activations.get('meal')
      if (mealAct) mealAct.score *= 1.3
    }
    // Se è cena/pranzo sociale → boost calendar
    if (isSocialDining) {
      if (!activations.has('calendar')) {
        activations.set('calendar', { score: 0, keywords: [], categories: new Map() })
      }
      activations.get('calendar').score += 0.5
      // De-boost meal
      const mealAct = activations.get('meal')
      if (mealAct) mealAct.score *= 0.4
    }

    // Boost strutturale: persona + orario/giorno = calendario
    const todayStr = new Date().toISOString().slice(0, 10)
    const hasExplicitDate = date !== todayStr
    const hasTime = time !== null
    const hasPersons = persons.length > 0
    const structuralCalendarBoost = hasPersons && (hasTime || hasExplicitDate) && amount === null

    if (structuralCalendarBoost) {
      if (!activations.has('calendar')) {
        activations.set('calendar', { score: 0, keywords: [], categories: new Map() })
      }
      const calAct = activations.get('calendar')
      calAct.score += 0.6
    }

    // Trova migliore attivazione sinapsi
    let synType = null
    let synScore = 0
    let synCategory = 'altro'
    let synActivation = null

    for (const [actionType, act] of activations) {
      const normalized = act.keywords.length > 0
        ? act.score / Math.sqrt(act.keywords.length)
        : act.score
      if (normalized > synScore) {
        synScore = normalized
        synType = actionType
        synActivation = act
      }
    }

    // Determina categoria sinapsi
    if (synActivation && synActivation.categories.size > 0) {
      let bestCat = 'altro', bestCatScore = 0
      for (const [cat, score] of synActivation.categories) {
        if (score > bestCatScore) { bestCatScore = score; bestCat = cat }
      }
      synCategory = bestCat
    }

    // Confidenza sinapsi (sigmoid)
    const synConfidence = synScore > 0.2 ? 1 / (1 + Math.exp(-3 * (synScore - 0.4))) : 0

    // Raccolta top sinapsi attivate per il debug
    let topSynapsesFired = []
    if (debug && synActivation) {
      topSynapsesFired = synActivation.keywords
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 8)
        .map(k => ({ key: k.word, weight: Math.round(k.weight * 100) / 100, fuzzy: !!k.fuzzy }))
    }

    // ─── COMBINAZIONE L1 + L2 + segnali strutturali ───
    let finalType = null
    let finalCategory = 'altro'
    let finalConfidence = 0
    let decisionSource = null  // per debug: quale branch ha deciso

    const structuralCalendar = hasPersons && (hasTime || hasExplicitDate) && amount === null

    if (structuralCalendar && synType === 'calendar' && synConfidence > 0.3) {
      finalType = 'calendar'
      finalCategory = nlpCategory || synCategory || 'altro'
      finalConfidence = Math.max(synConfidence, nlpScore, 0.80)
      decisionSource = 'structural+l2_synapses'
    } else if (structuralCalendar && nlpType === 'calendar') {
      finalType = 'calendar'
      finalCategory = nlpCategory || synCategory || 'altro'
      finalConfidence = Math.max(nlpScore, 0.85)
      decisionSource = 'structural+l1_nlp'
    } else if (structuralCalendar && nlpType !== 'calendar' && nlpType !== 'expense') {
      finalType = 'calendar'
      finalCategory = synCategory || nlpCategory || 'altro'
      finalConfidence = Math.max(synConfidence, 0.70)
      decisionSource = 'structural_override'
    } else if (nlpScore >= NLP_CONFIDENCE_HIGH) {
      finalType = nlpType
      finalCategory = nlpCategory || synCategory || 'altro'
      finalConfidence = nlpScore
      decisionSource = 'l1_nlp_high'
    } else if (nlpScore >= NLP_CONFIDENCE_LOW && nlpType === synType) {
      finalType = nlpType
      finalCategory = nlpCategory || synCategory
      finalConfidence = Math.min(0.95, nlpScore * 0.6 + synConfidence * 0.4 + 0.1)
      decisionSource = 'l1+l2_combined'
    } else if (nlpScore >= NLP_CONFIDENCE_LOW && synConfidence < 0.3) {
      finalType = nlpType
      finalCategory = nlpCategory || 'altro'
      finalConfidence = nlpScore
      decisionSource = 'l1_nlp_medium'
    } else if (synConfidence >= SYNAPSE_CONFIDENCE_THRESHOLD) {
      finalType = synType
      finalCategory = synCategory
      finalConfidence = synConfidence
      decisionSource = 'l2_synapses'
    } else if (nlpScore > synConfidence && nlpType) {
      finalType = nlpType
      finalCategory = nlpCategory || synCategory || 'altro'
      finalConfidence = nlpScore
      decisionSource = 'l1_nlp_best'
    } else if (synType) {
      finalType = synType
      finalCategory = synCategory
      finalConfidence = synConfidence
      decisionSource = 'l2_synapses_fallback'
    }

    if (!finalType || finalConfidence < 0.15) {
      // Debug: frase ignorata
      if (debug) {
        addSentenceTrace(debugTrace, {
          sentence,
          intent: null,
          confidence: finalConfidence,
          source: 'skipped',
          people: persons.map(p => p.name),
          date, time, amount: null,
          location: sentLocation,
          activity: sentActivity,
          nlpIntent: nlpType, nlpScore,
          synType, synConfidence,
          synapsesFired: topSynapsesFired,
          synCategory,
          hasPersons, hasTime, hasExplicitDate, hasAmount: false,
          calendarBoost: structuralCalendarBoost,
          warnings: ['below_threshold', ...sentenceWarnings],
        })
      }
      continue
    }

    // Override categoria per keyword forti (es. riunione -> lavoro)
    if (finalType === 'calendar') {
      finalCategory = resolveKeywordCategory(sentence, finalCategory)
    }

    // ─── Costruisci azione/i ───
    const ctx = { amount, date, time, persons, members, logistics, timeCtx, category: finalCategory }
    const sentenceActions = []

    // DUAL ACTION: "X deve prendere/portare Y" → calendario per Y + task per X
    let isDualAction = false

    if (finalType === 'calendar' && logistics?.driver && logistics?.subject
        && logistics.driver.id !== logistics.subject.id) {
      isDualAction = true


      const luogo = extractLocation(sentence, members)
      const activity = extractActivity(sentence)
      const isDropOff = logistics.actionVerb === 'portare'
      const isPickup = logistics.actionVerb === 'prendere' || logistics.actionVerb === 'riprendere' || logistics.actionVerb === 'ritirare'

      let calTitle
      if (isDropOff && activity) {
        calTitle = luogo ? `${activity} ${logistics.subject.name} - ${luogo}` : `${activity} ${logistics.subject.name}`
      } else if (isPickup) {
        calTitle = luogo ? `Arrivo ${logistics.subject.name} - ${luogo}` : `Arrivo ${logistics.subject.name}`
      } else {
        calTitle = luogo
          ? `${activity || 'Impegno'} ${logistics.subject.name} - ${luogo}`
          : `${activity || 'Impegno'} ${logistics.subject.name}`
      }

      const calAction = {
        type: 'calendar',
        date,
        title: calTitle,
        assignedTo: logistics.subject.name,
        time,
        category: finalCategory || (activity ? 'sport' : 'altro'),
        incomplete: !time ? 'Manca l\'orario' : undefined,
      }
      if (isDropOff) {
        calAction.accompaniedBy = logistics.driver.name
        calAction.needsPickup = true
      } else {
        calAction.pickupBy = logistics.driver.name
      }
      actions.push(calAction)
      sentenceActions.push(calAction)
      totalConfidence += finalConfidence

      let taskTitle
      if (isDropOff) {
        taskTitle = luogo
          ? `Portare ${logistics.subject.name} - ${luogo}`
          : `Portare ${logistics.subject.name}`
      } else {
        taskTitle = luogo
          ? `Andare a prendere ${logistics.subject.name} - ${luogo}`
          : `Andare a prendere ${logistics.subject.name}`
      }

      const taskAction = {
        type: 'task',
        date,
        title: taskTitle,
        assignedTo: logistics.driver.name,
        time,
      }
      actions.push(taskAction)
      sentenceActions.push(taskAction)
      totalConfidence += finalConfidence

            if (isDropOff) {
        // Check: "e [NOME] la/lo riprende (alle HH)" nella stessa frase?
        const _pickupRe2 = /\be\s+(\w+)\s+(?:(?:la|lo|li|le)\s+|l[''']\s*)?(?:riprende|va\s+a\s+prendere|viene\s+a\s+prendere)/i
        const _pickupM2 = sentence.match(_pickupRe2)
        const _findMem2 = (n) => { if (!n) return null; const nl = n.toLowerCase(); return members.find(m => m.name.toLowerCase() === nl) || members.find(m => m.aliases?.some(a => a.toLowerCase() === nl)) || null }
        const _pickupPerson2 = _pickupM2 ? _findMem2(_pickupM2[1]) : null
        const _pickupTimeRe2 = /riprende(?:r.?)?\s+(?:alle?\s*)?(\d{1,2}(?:[:.]\d{2})?)\b/i
        const _pickupTimeM2 = sentence.match(_pickupTimeRe2)
        const _pickupTime2 = _pickupTimeM2 ? (() => {
              const _raw2 = _pickupTimeM2[1]
              if (_raw2.includes(':') || _raw2.includes('.')) return _raw2.replace('.', ':').padStart(5, '0')
              return _raw2.padStart(2, '0') + ':00'
            })() : null

        if (_pickupPerson2) {
          calAction.pickupBy = _pickupPerson2.name
          calAction.needsPickup = false
          const _pTitle2 = luogo ? `Riprendere ${logistics.subject.name} - ${luogo}` : `Riprendere ${logistics.subject.name}`
          const _pickupTask2 = { type: 'task', date, title: _pTitle2, assignedTo: _pickupPerson2.name, time: _pickupTime2 }
          actions.push(_pickupTask2)
          sentenceActions.push(_pickupTask2)
          totalConfidence += 0.85
        } else {
          const reminderAction = {
            type: 'note', date,
            text: `Chi va a riprendere ${logistics.subject.name}${luogo ? ` da ${luogo}` : ``}? Orario ritorno da definire.`,
            isReminder: true,
          }
          actions.push(reminderAction)
          sentenceActions.push(reminderAction)
          totalConfidence += 0.7
        }
      }// Warnings specifici per dual action
      if (!time) sentenceWarnings.push('missing_explicit_time')
      if (isDropOff) sentenceWarnings.push('needs_pickup_person')
    } else if (finalType === 'calendar' && logistics?.subject && !logistics?.driver && logistics?.actionVerb) {
      // LOGISTICA COLLETTIVA: "dobbiamo andare a prendere Asia in stazione"
      // Subject c'è, driver non definito → evento calendar + task logistico senza driver
      const luogo = extractLocation(sentence, members)
      const activity = extractActivity(sentence)
      const isPickup = logistics.actionVerb === 'prendere' || logistics.actionVerb === 'riprendere' || logistics.actionVerb === 'ritirare'
      const isDropOff = logistics.actionVerb === 'portare'

      let calTitle
      if (isPickup) {
        calTitle = luogo
          ? `Andare a prendere ${logistics.subject.name} - ${luogo}`
          : `Andare a prendere ${logistics.subject.name}`
      } else if (isDropOff && activity) {
        calTitle = luogo ? `${activity} ${logistics.subject.name} - ${luogo}` : `${activity} ${logistics.subject.name}`
      } else {
        calTitle = luogo
          ? `${activity || 'Impegno'} ${logistics.subject.name} - ${luogo}`
          : `${activity || 'Impegno'} ${logistics.subject.name}`
      }

      const calAction = {
        type: 'calendar',
        date,
        title: calTitle,
        assignedTo: logistics.subject.name,
        time,
        location: luogo || null,
        category: finalCategory || (activity ? 'sport' : 'logistica'),
        needsDriver: true,
        logistics: { subject: logistics.subject.name, actionVerb: logistics.actionVerb },
        incomplete: 'Manca chi accompagna/riprende',
      }
      actions.push(calAction)
      sentenceActions.push(calAction)
      totalConfidence += finalConfidence

      sentenceWarnings.push('needs_pickup_person')
      if (!time) sentenceWarnings.push('missing_explicit_time')
    } else {
      // Azione singola standard
      const action = buildAction(finalType, sentence, ctx)
      if (finalType === 'expense' && (!action.amount || action.amount <= 0)) continue
      totalConfidence += finalConfidence
      actions.push(action)
      sentenceActions.push(action)

      // Warnings per azione singola
      if (finalType === 'calendar' && !time) sentenceWarnings.push('missing_explicit_time')
      if (finalType === 'task' && !persons.length) sentenceWarnings.push('no_person_assigned')
    }

    // Debug trace per questa frase
    if (debug) {
      addSentenceTrace(debugTrace, {
        sentence,
        intent: finalType,
        confidence: Math.round(finalConfidence * 100) / 100,
        source: decisionSource,
        people: persons.map(p => p.name),
        date, time,
        amount: null,
        location: sentLocation,
        activity: sentActivity,
        logistics: logistics ? { driver: logistics.driver?.name, subject: logistics.subject?.name, verb: logistics.actionVerb } : null,
        nlpIntent: nlpType,
        nlpScore: Math.round(nlpScore * 100) / 100,
        synType,
        synConfidence: Math.round(synConfidence * 100) / 100,
        synapsesFired: topSynapsesFired,
        synCategory,
        hasPersons, hasTime, hasExplicitDate, hasAmount: false,
        calendarBoost: structuralCalendarBoost,
        actionsGenerated: sentenceActions,
        isDualAction,
        warnings: sentenceWarnings,
      })
    }

    if (date !== todayStrEarly) lastDate = date
  }

  if (actions.length === 0) return null

  const avgConfidence = totalConfidence / actions.length

  // ─── NORMALIZZAZIONE CANONICA ─────────────────────────────────
  // Tutti i rami (L0 pattern, L1 NLP.js, L2 sinapsi) convergono qui.
  // Il normalizzatore converte le shape legacy in canonical:
  //   - assignedTo → personIds / assignedToId
  //   - person → personId
  //   - name → title
  //   - time → timeStart
  //   - accompaniedBy/pickupBy → logistics.{accompaniedById, pickupById}
  //   - nomi → member ID (risoluzione in normalizer, non in executor)
  // Il validatore scarta azioni malformate, le valide entrano in preview.
  const normContext = {
    familyId,
    currentMemberId: currentMember?.id || null,
    members: members,
    source: 'L0',
    textOriginal: text,
    confidence: avgConfidence,
    usedAI: false,
  }

  const { actions: canonical, invalid, warnings: normWarnings } = normalizeAndValidateActions(actions, normContext)

  if (invalid.length > 0) {
    console.warn(`[Brain] ${invalid.length} azioni scartate dal validatore:`, invalid.map(i => i.errors))
  }

  if (canonical.length === 0) return null

  const method = isNlpReady() ? 'NLP+Sinapsi' : 'Sinapsi'

  return {
    actions: canonical,
    confidence: avgConfidence,
    usedAI: false,
    summary: `${canonical.length} ${canonical.length === 1 ? 'azione' : 'azioni'} (${method}, conf. ${(avgConfidence * 100).toFixed(0)}%)`,
    _normalization: { invalid, warnings: normWarnings },
  }
}
