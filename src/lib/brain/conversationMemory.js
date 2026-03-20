/**
 * conversationMemory.js — Memoria conversazionale breve del Cervellone.
 *
 * Gestisce il merge strutturato di frammenti di frase che completano
 * la stessa intenzione nel giro di pochi minuti.
 *
 * Esempio:
 *   "Domani Asia ha danza"      → crea draft calendar
 *   "alle 16"                   → merge: completa time
 *   "la porta Chiara"           → merge: completa dropBy
 *   "la riprende mamma"         → merge: completa pickupBy → auto-commit
 *
 * Supporta: calendar, absence, expense
 * Principi: locale, temporaneo, per utente/famiglia, facile da invalidare.
 *
 * TTL: 15 minuti default, esteso a ogni merge.
 */

import { db } from '../localDb.js'

// ═══════════════════════════════════════════════════════════════
// COSTANTI
// ═══════════════════════════════════════════════════════════════

const DRAFT_TTL_MS = 15 * 60 * 1000       // 15 minuti
const DRAFT_EXTEND_MS = 10 * 60 * 1000    // estendi di 10 min a ogni merge
const MAX_DRAFT_AGE_MS = 30 * 60 * 1000   // max 30 minuti totali

/** Intent supportati dalla memoria breve — all action types that can become drafts */
export const MEMORY_INTENTS = ['calendar', 'absence', 'expense', 'task', 'reminder', 'shopping', 'meal', 'note']

/** Campi minimi per intent (per decidere auto-commit) */
const MIN_FIELDS = {
  calendar: ['date', 'person'],  // data + persona minimi; attività e orario opzionali
  absence: ['absentPerson', 'date'],
  expense: ['amount'],
}

/** Campi opzionali ma utili per intent */
const OPTIONAL_FIELDS = {
  calendar: ['time', 'activity', 'location', 'dropBy', 'pickupBy'],
  absence: ['timeRange', 'reason'],
  expense: ['category', 'person', 'note', 'date'],
}

// ═══════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════

/**
 * Recupera il draft attivo per un autore in una famiglia.
 * Un solo draft attivo per autore alla volta.
 */
export async function getActiveDraft(familyId, createdBy) {
  if (!familyId || !createdBy) return null

  try {
    // Pulisci prima i draft scaduti
    await expireOldDrafts(familyId)

    const drafts = await db.conversationDrafts
      .where('[family_id+created_by+status]')
      .equals([familyId, createdBy, 'draft'])
      .toArray()

    // Prendi il più recente se ce ne sono più d'uno (safety)
    if (drafts.length === 0) return null
    if (drafts.length === 1) return deserializeDraft(drafts[0])

    // Se multipli, tieni il più recente e abbandona gli altri
    const sorted = drafts.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    for (let i = 1; i < sorted.length; i++) {
      await db.conversationDrafts.update(sorted[i].id, { status: 'abandoned' })
    }
    return deserializeDraft(sorted[0])
  } catch (err) {
    console.warn('[ConvMemory] Errore lettura draft:', err)
    return null
  }
}

/**
 * Crea un nuovo draft da un parse iniziale.
 */
export async function createDraft({ familyId, createdBy, intent, entities, parseResult, inputText }) {
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + DRAFT_TTL_MS).toISOString()

  const draft = {
    id: crypto.randomUUID(),
    family_id: familyId,
    created_by: createdBy,
    status: 'draft',
    intent: intent,
    source_sentences: [
      { text: inputText, created_at: now },
    ],
    entities: buildInitialEntities(intent, entities, parseResult),
    actions_preview: parseResult?.actions || [],
    missing_fields: [],
    confidence: {
      current: parseResult?.confidence || 0,
      source: 'initial_parse',
    },
    merge_meta: {
      turn_count: 1,
      last_source: 'initial_parse',
      last_merge_reason: null,
    },
    created_at: now,
    updated_at: now,
    expires_at: expiresAt,
  }

  // Calcola campi mancanti
  draft.missing_fields = computeMissingFields(draft)

  try {
    await db.conversationDrafts.add(serializeDraft(draft))
  } catch (err) {
    console.warn('[ConvMemory] Errore creazione draft:', err)
  }

  return draft
}

/**
 * Aggiorna un draft esistente con nuove informazioni dal merge.
 */
export async function updateDraft(draftId, patch) {
  const now = new Date().toISOString()
  const newExpires = new Date(
    Math.min(
      Date.now() + DRAFT_EXTEND_MS,
      new Date(patch._originalCreatedAt || now).getTime() + MAX_DRAFT_AGE_MS
    )
  ).toISOString()

  const updateObj = {
    ...patch,
    updated_at: now,
    expires_at: newExpires,
  }
  delete updateObj._originalCreatedAt

  try {
    // Serializza campi complessi
    if (updateObj.entities) updateObj.entities_json = JSON.stringify(updateObj.entities)
    if (updateObj.source_sentences) updateObj.source_sentences_json = JSON.stringify(updateObj.source_sentences)
    if (updateObj.actions_preview) updateObj.actions_preview_json = JSON.stringify(updateObj.actions_preview)
    if (updateObj.missing_fields) updateObj.missing_fields_json = JSON.stringify(updateObj.missing_fields)
    if (updateObj.confidence) updateObj.confidence_json = JSON.stringify(updateObj.confidence)
    if (updateObj.merge_meta) updateObj.merge_meta_json = JSON.stringify(updateObj.merge_meta)

    // Rimuovi i campi oggetto (Dexie vuole solo i campi piatti + *_json)
    delete updateObj.entities
    delete updateObj.source_sentences
    delete updateObj.actions_preview
    delete updateObj.missing_fields
    delete updateObj.confidence
    delete updateObj.merge_meta

    await db.conversationDrafts.update(draftId, updateObj)
  } catch (err) {
    console.warn('[ConvMemory] Errore update draft:', err)
  }
}

/** Scade i draft vecchi per una famiglia */
export async function expireOldDrafts(familyId) {
  if (!familyId) return

  try {
    const now = new Date().toISOString()
    const expired = await db.conversationDrafts
      .where('family_id').equals(familyId)
      .and(d => d.status === 'draft' && d.expires_at < now)
      .toArray()

    for (const d of expired) {
      await db.conversationDrafts.update(d.id, { status: 'expired' })
    }
  } catch (err) {
    console.warn('[ConvMemory] Errore pulizia draft:', err)
  }
}

/** Abbandona un draft con motivo */
export async function abandonDraft(draftId, reason = 'topic_change') {
  try {
    await db.conversationDrafts.update(draftId, {
      status: 'abandoned',
      updated_at: new Date().toISOString(),
      abandon_reason: reason,
    })
  } catch (err) {
    console.warn('[ConvMemory] Errore abbandono draft:', err)
  }
}

/** Committa un draft — pronto per generare azioni finali */
export async function commitDraft(draftId) {
  try {
    await db.conversationDrafts.update(draftId, {
      status: 'committed',
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('[ConvMemory] Errore commit draft:', err)
  }
}

// ═══════════════════════════════════════════════════════════════
// SERIALIZZAZIONE (Dexie non supporta nested objects come indici)
// ═══════════════════════════════════════════════════════════════

function serializeDraft(draft) {
  return {
    id: draft.id,
    family_id: draft.family_id,
    created_by: draft.created_by,
    status: draft.status,
    intent: draft.intent,
    entities_json: JSON.stringify(draft.entities),
    source_sentences_json: JSON.stringify(draft.source_sentences),
    actions_preview_json: JSON.stringify(draft.actions_preview),
    missing_fields_json: JSON.stringify(draft.missing_fields),
    confidence_json: JSON.stringify(draft.confidence),
    merge_meta_json: JSON.stringify(draft.merge_meta),
    created_at: draft.created_at,
    updated_at: draft.updated_at,
    expires_at: draft.expires_at,
  }
}

function deserializeDraft(row) {
  return {
    id: row.id,
    family_id: row.family_id,
    created_by: row.created_by,
    status: row.status,
    intent: row.intent,
    entities: safeParse(row.entities_json, {}),
    source_sentences: safeParse(row.source_sentences_json, []),
    actions_preview: safeParse(row.actions_preview_json, []),
    missing_fields: safeParse(row.missing_fields_json, []),
    confidence: safeParse(row.confidence_json, { current: 0, source: 'unknown' }),
    merge_meta: safeParse(row.merge_meta_json, { turn_count: 0 }),
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at,
  }
}

function safeParse(json, fallback) {
  try { return JSON.parse(json) } catch { return fallback }
}

// ═══════════════════════════════════════════════════════════════
// RICONOSCIMENTO FRAMMENTO
// ═══════════════════════════════════════════════════════════════

/**
 * Riconosce se un parse result è un frammento follow-up.
 *
 * È fragment se:
 * - poche parole (< 6)
 * - confidence standalone bassa o nulla
 * - contiene solo 1-2 entità specifiche (tempo, importo, persona, logistica)
 * - oppure contiene pattern di correzione
 */
export function isFollowupFragment(inputText, parseResult) {
  const words = inputText.trim().split(/\s+/)

  // Frasi molto corte con poche entità specifiche
  if (words.length <= 5) {
    // Ha solo tempo?
    if (/^(alle\s+)?\d{1,2}([:.]\d{2})?$/i.test(inputText.trim())) return true
    // Ha solo fascia oraria?
    if (/^(di\s+)?(mattina|pomeriggio|sera|notte)$/i.test(inputText.trim())) return true
    // Ha solo importo?
    if (/^\d+([.,]\d{1,2})?\s*(euro|€)?$/i.test(inputText.trim())) return true
    // Ha pattern logistico puro?
    if (/^(l[ao]\s+)?(porta|riprende|accompagna)\s+\w+$/i.test(inputText.trim())) return true
    // Ha persona + verbo logistico?
    if (/^\w+\s+(porta|riprende|accompagna)$/i.test(inputText.trim())) return true
  }

  // Confidence molto bassa standalone + frase corta
  if (words.length <= 8 && (parseResult?.confidence || 0) < 0.35) {
    return true
  }

  // Pattern di correzione
  if (isCorrection(inputText)) return true

  return false
}

/**
 * Riconosce pattern di correzione esplicita.
 * "no, non Asia, Viola"
 * "anzi alle 17"
 * "volevo dire domani"
 */
export function isCorrection(inputText) {
  const lower = inputText.toLowerCase().trim()
  return /^(no[,.]?\s|anzi\s|volevo dire\s|non\s+\w+[,]\s|intendevo\s|correggo[,:]\s)/i.test(lower)
}

// ═══════════════════════════════════════════════════════════════
// COMPATIBILITÀ
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica se un parse result è compatibile con un draft attivo.
 *
 * Compatibile se:
 * - stesso autore (implicito, già filtrato da getActiveDraft)
 * - draft non scaduto
 * - intent compatibile (stesso, o frammento senza intent forte)
 * - nessun conflitto forte su entità esistenti
 */
export function isCompatibleWithDraft(draft, inputText, parseResult) {
  if (!draft) return false

  // Scaduto?
  if (new Date(draft.expires_at) < new Date()) return false

  // Il nuovo input ha un intent forte e diverso?
  const newIntent = parseResult?.actions?.[0]?.type || parseResult?.type || null
  if (newIntent && newIntent !== draft.intent && (parseResult?.confidence || 0) > 0.6) {
    // Intent forte e diverso → non compatibile (cambio topic)
    return false
  }

  // Se è un frammento puro → compatibile per definizione
  if (isFollowupFragment(inputText, parseResult)) return true

  // Se ha lo stesso intent → compatibile
  if (newIntent === draft.intent) return true

  // Se non ha intent forte (ambiguo) → probabilmente compatibile
  if (!newIntent || (parseResult?.confidence || 0) < 0.5) return true

  return false
}

// ═══════════════════════════════════════════════════════════════
// MERGE
// ═══════════════════════════════════════════════════════════════

/**
 * Mergia un parse result in un draft esistente.
 * Restituisce il draft aggiornato + info sul merge.
 *
 * Regole:
 * 1. Completa buchi (campo mancante → aggiungi)
 * 2. Non sovrascrivere forte con debole
 * 3. Sovrascrivi se più specifico (es: day_period → time_start)
 * 4. Logistica incrementale (dropBy e pickupBy separati)
 * 5. Mantieni source_sentences
 */
export function mergeParseIntoDraft(draft, inputText, parseResult, entities) {
  const mergedFields = []
  const corrections = []
  const isCorrectionInput = isCorrection(inputText)
  const e = draft.entities
  const newE = entities || {}

  // ─── Persone ───
  if (newE.people?.length > 0) {
    if (isCorrectionInput && e.people?.length > 0) {
      corrections.push({ field: 'people', from: e.people, to: newE.people })
      e.people = newE.people
      mergedFields.push('people_corrected')
    } else if (!e.people || e.people.length === 0) {
      e.people = newE.people
      mergedFields.push('people')
    }
  }

  // ─── Data ───
  if (newE.date) {
    if (isCorrectionInput) {
      corrections.push({ field: 'date', from: e.date, to: newE.date })
      e.date = newE.date
      mergedFields.push('date_corrected')
    } else if (!e.date) {
      e.date = newE.date
      mergedFields.push('date')
    }
  }

  // ─── Orario (più specifico vince) ───
  if (newE.time) {
    if (isCorrectionInput && e.time) {
      corrections.push({ field: 'time', from: e.time, to: newE.time })
    }
    // time esplicito batte day_period
    e.time = newE.time
    if (e.day_period && newE.time) e.day_period = null
    mergedFields.push('time')
  }

  // ─── Fascia oraria ───
  if (newE.timeRange && !e.time) {
    // Solo se non c'è già un time esplicito
    e.day_period = newE.timeRange
    mergedFields.push('day_period')
  }

  // ─── Importo ───
  if (newE.amount != null) {
    if (isCorrectionInput && e.amount != null) {
      corrections.push({ field: 'amount', from: e.amount, to: newE.amount })
    }
    e.amount = newE.amount
    mergedFields.push('amount')
  }

  // ─── Attività ───
  if (newE.activity && !e.activity) {
    e.activity = newE.activity
    mergedFields.push('activity')
  }

  // ─── Location ───
  if (newE.location && !e.location) {
    e.location = newE.location
    mergedFields.push('location')
  }

  // ─── Logistica incrementale ───
  if (newE.logistics) {
    if (!e.logistics) e.logistics = {}

    if (newE.logistics.driver && !e.logistics.dropBy) {
      e.logistics.dropBy = newE.logistics.driver
      e.logistics.dropByName = newE.logistics.driverName || newE.logistics.driver
      mergedFields.push('dropBy')
    }
    if (newE.logistics.verb === 'riprende' || newE.logistics.verb === 'riprendere') {
      e.logistics.pickupBy = newE.logistics.driver
      e.logistics.pickupByName = newE.logistics.driverName || newE.logistics.driver
      mergedFields.push('pickupBy')
    }
    // Soggetto logistico
    if (newE.logistics.subject && !e.logistics.subject) {
      e.logistics.subject = newE.logistics.subject
      mergedFields.push('logistics_subject')
    }
  }

  // ─── Absence ───
  if (newE.absence) {
    if (!e.absence) e.absence = {}
    if (newE.absence.isAbsence) e.absence.isAbsence = true
    if (newE.absence.absentPerson) {
      e.absence.absentPerson = newE.absence.absentPerson
      mergedFields.push('absentPerson')
    }
  }

  // ─── Aggiorna meta ───
  const missingBefore = [...draft.missing_fields]

  const updatedDraft = {
    ...draft,
    entities: e,
    source_sentences: [
      ...draft.source_sentences,
      { text: inputText, created_at: new Date().toISOString() },
    ],
    confidence: {
      current: Math.max(draft.confidence.current, parseResult?.confidence || 0),
      source: 'memory_merge',
    },
    merge_meta: {
      turn_count: draft.merge_meta.turn_count + 1,
      last_source: isCorrectionInput ? 'correction' : 'followup_fragment',
      last_merge_reason: mergedFields.length > 0 ? mergedFields.join('+') : 'no_new_fields',
    },
    _originalCreatedAt: draft.created_at,
  }

  updatedDraft.missing_fields = computeMissingFields(updatedDraft)

  return {
    draft: updatedDraft,
    mergedFields,
    corrections,
    missingBefore,
    missingAfter: updatedDraft.missing_fields,
  }
}

// ═══════════════════════════════════════════════════════════════
// MISSING FIELDS
// ═══════════════════════════════════════════════════════════════

/**
 * Calcola i campi mancanti per un draft dato il suo intent.
 */
export function computeMissingFields(draft) {
  const missing = []
  const e = draft.entities || {}
  const intent = draft.intent

  if (intent === 'calendar') {
    if (!e.date) missing.push('date')
    // Persona: opzionale ma utile
    if ((!e.people || e.people.length === 0) && !e.logistics?.subject) {
      missing.push('person')
    }
    if (!e.time && !e.day_period) missing.push('time')
    if (!e.activity && !e.location) missing.push('activity')
    // Logistica
    if (e.logistics?.subject || e.activity) {
      if (!e.logistics?.dropBy) missing.push('dropBy')
      if (!e.logistics?.pickupBy) missing.push('pickupBy')
    }
  }

  if (intent === 'absence') {
    if (!e.absence?.absentPerson && (!e.people || e.people.length === 0)) {
      missing.push('absentPerson')
    }
    if (!e.date) missing.push('date')
  }

  if (intent === 'expense') {
    if (e.amount == null) missing.push('amount')
    if (!e.category) missing.push('category')
  }

  return missing
}

// ═══════════════════════════════════════════════════════════════
// AUTO-COMMIT
// ═══════════════════════════════════════════════════════════════

/**
 * Decide se un draft è pronto per auto-commit.
 *
 * Commit se:
 * - campi minimi presenti
 * - confidence decente
 * - nessun warning grave
 *
 * Non commit se:
 * - mancano campi minimi
 * - logistica ancora parziale su intent calendar con logistica avviata
 * - confidence troppo bassa
 */
export function shouldAutoCommit(draft) {
  const e = draft.entities || {}
  const intent = draft.intent
  const mins = MIN_FIELDS[intent] || []

  // Verifica campi minimi
  for (const field of mins) {
    if (field === 'date' && !e.date) return false
    if (field === 'person' && (!e.people || e.people.length === 0)) return false
    if (field === 'amount' && e.amount == null) return false
    if (field === 'absentPerson' && !e.absence?.absentPerson && (!e.people || e.people.length === 0)) return false
  }

  // Se c'è un verbo di logistica ma nessun driver assegnato → aspetta
  if (intent === 'calendar' && e.logistics?.actionVerb && !e.logistics?.driver) {
    if (draft.merge_meta.turn_count < 3) return false
  }

  // Calendar con logistica avviata ma incompleta: non committare
  if (intent === 'calendar' && e.logistics) {
    const hasDropBy = !!e.logistics.dropBy
    const hasPickupBy = !!e.logistics.pickupBy
    // Se ha un dropBy ma non il pickupBy, il prossimo messaggio potrebbe essere "la riprende X"
    // Aspetta un turno in più — ma solo se meno di 3 turni totali
    if (hasDropBy && !hasPickupBy && draft.merge_meta.turn_count < 4) {
      return false
    }
  }

  // Confidence minima
  if (draft.confidence.current < 0.30) return false

  return true
}

// ═══════════════════════════════════════════════════════════════
// AZIONI FINALI DA DRAFT
// ═══════════════════════════════════════════════════════════════

/**
 * Genera le azioni finali da un draft committato.
 * Trasforma le entità raccolte in azioni concrete.
 */
export function buildActionsFromDraft(draft) {
  const e = draft.entities || {}
  const actions = []

  if (draft.intent === 'calendar') {
    const event = {
      type: 'calendar',
      title: buildDraftTitle(draft),
      date: e.date,
      time: e.time || null,
      day_period: e.day_period || null,
      assignedTo: e.people?.[0] || e.logistics?.subject || null,
      location: e.location || null,
      activity: e.activity || null,
      fromMemory: true,
      turnCount: draft.merge_meta.turn_count,
    }

    // Azione incompleta?
    const incomplete = []
    if (!e.time && !e.day_period) incomplete.push('Manca l\'orario')
    if (!e.people?.length && !e.logistics?.subject) incomplete.push('Manca chi')
    if (incomplete.length > 0) event.incomplete = incomplete.join(', ')

    actions.push(event)

    // Logistica → task/reminder
    if (e.logistics?.dropBy) {
      actions.push({
        type: 'task',
        title: `Accompagna ${e.logistics.subject || e.people?.[0] || '?'} a ${e.activity || e.location || '?'}`,
        assignedTo: e.logistics.dropByName || e.logistics.dropBy,
        date: e.date,
        time: e.time || null,
        linkedTo: 'calendar',
        fromMemory: true,
      })
    }
    if (e.logistics?.pickupBy) {
      actions.push({
        type: 'task',
        title: `Riprendi ${e.logistics.subject || e.people?.[0] || '?'} da ${e.activity || e.location || '?'}`,
        assignedTo: e.logistics.pickupByName || e.logistics.pickupBy,
        date: e.date,
        needsConfirm: true,
        linkedTo: 'calendar',
        fromMemory: true,
      })
    }
  }

  if (draft.intent === 'absence') {
    actions.push({
      type: 'absence',
      title: `${e.absence?.absentPerson || e.people?.[0] || '?'} assente`,
      date: e.date,
      person: e.absence?.absentPerson || e.people?.[0] || null,
      fromMemory: true,
    })
  }

  if (draft.intent === 'expense') {
    actions.push({
      type: 'expense',
      amount: e.amount,
      category: e.category || null,
      note: e.note || null,
      date: e.date || new Date().toISOString().split('T')[0],
      person: e.people?.[0] || null,
      fromMemory: true,
    })
  }

  return actions
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Costruisce le entità iniziali da un parse result */
function buildInitialEntities(intent, rawEntities, parseResult) {
  const e = {
    people: rawEntities?.people || [],
    date: rawEntities?.date || null,
    time: rawEntities?.time || null,
    day_period: rawEntities?.timeRange || null,
    amount: rawEntities?.amount ?? null,
    activity: rawEntities?.activity || null,
    location: rawEntities?.location || null,
    logistics: rawEntities?.logistics ? {
      dropBy: rawEntities.logistics.driver || null,
      dropByName: rawEntities.logistics.driverName || rawEntities.logistics.driver || null,
      pickupBy: null,
      pickupByName: null,
      subject: rawEntities.logistics.subject || null,
    } : null,
    absence: null,
    category: null,
    note: null,
  }

  if (intent === 'absence') {
    e.absence = {
      isAbsence: true,
      absentPerson: rawEntities?.people?.[0] || null,
    }
  }

  return e
}

/** Genera un titolo leggibile dal draft */
function buildDraftTitle(draft) {
  const e = draft.entities || {}
  const parts = []

  if (e.people?.length > 0) parts.push(e.people[0])
  if (e.activity) parts.push(e.activity)
  else if (e.location) parts.push(`a ${e.location}`)

  return parts.length > 0 ? parts.join(' — ') : 'Evento'
}

/**
 * Genera un messaggio di preview human-readable per l'utente.
 * Dice cosa è stato aggiunto e cosa manca ancora.
 */
export function buildDraftPreview(draft, mergeInfo = null) {
  const e = draft.entities || {}
  const parts = []

  // Cosa abbiamo
  if (e.people?.length > 0) parts.push(e.people[0])
  if (e.activity) parts.push(e.activity)
  if (e.location) parts.push(`a ${e.location}`)
  if (e.date) parts.push(formatPreviewDate(e.date))
  if (e.time) parts.push(`alle ${e.time}`)
  else if (e.day_period) parts.push(e.day_period)
  if (e.amount != null) parts.push(`€${e.amount}`)

  const summary = parts.join(', ')

  // Cosa è stato aggiunto
  let mergeNote = ''
  if (mergeInfo?.mergedFields?.length > 0) {
    const fieldLabels = {
      people: 'persona', date: 'data', time: 'orario', day_period: 'fascia oraria',
      amount: 'importo', activity: 'attività', location: 'luogo',
      dropBy: 'chi accompagna', pickupBy: 'chi riprende',
      people_corrected: 'persona corretta', date_corrected: 'data corretta',
      time_corrected: 'orario corretto',
    }
    const labels = mergeInfo.mergedFields.map(f => fieldLabels[f] || f)
    mergeNote = `Aggiunto: ${labels.join(', ')}`
  }

  // Cosa manca
  const missingLabels = {
    date: 'data', time: 'orario', person: 'chi', activity: 'cosa',
    dropBy: 'chi accompagna', pickupBy: 'chi riprende',
    amount: 'importo', category: 'categoria', absentPerson: 'chi è assente',
  }
  const missingText = draft.missing_fields
    .filter(f => missingLabels[f])
    .map(f => missingLabels[f])

  return {
    summary: `Bozza ${draft.intent}: ${summary}`,
    mergeNote,
    missingText: missingText.length > 0
      ? `Mancano: ${missingText.join(', ')}`
      : 'Completo — pronto per conferma',
    isComplete: missingText.length === 0,
    turnCount: draft.merge_meta.turn_count,
  }
}

function formatPreviewDate(dateStr) {
  try {
    const d = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (d.toDateString() === today.toDateString()) return 'oggi'
    if (d.toDateString() === tomorrow.toDateString()) return 'domani'

    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  } catch {
    return dateStr
  }
}
