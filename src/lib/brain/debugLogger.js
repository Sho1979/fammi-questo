/**
 * debugLogger.js — Sistema di logging strutturato per il Cervellone.
 *
 * Ogni parse genera un "trace" che registra:
 * - input originale e frasi splittate
 * - per ogni frase: intent, confidence, source, entità, sinapsi attivate, warnings
 * - azioni generate
 * - timing per stage
 * - esito finale (locale vs AI fallback)
 *
 * Il trace viene persistito in Dexie (tabella nlp_logs) se debug è attivo.
 * Toggle: localStorage.setItem('brain_debug', 'true')
 */

import { db } from '../localDb.js'

// ═══════════════════════════════════════════════════════════════
// DEBUG FLAG
// ═══════════════════════════════════════════════════════════════

/** Controlla se il debug NLP è attivo */
export function isDebugEnabled() {
  try {
    return localStorage.getItem('brain_debug') === 'true'
  } catch {
    return false
  }
}

/** Attiva/disattiva il debug NLP */
export function setDebugEnabled(enabled) {
  try {
    if (enabled) {
      localStorage.setItem('brain_debug', 'true')
    } else {
      localStorage.removeItem('brain_debug')
    }
  } catch {
    // SSR o privacy mode
  }
}

// ═══════════════════════════════════════════════════════════════
// TRACE FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Crea un nuovo debug trace per un parse.
 * @param {string} input - Frase originale inserita dall'utente
 * @returns {object} trace object (mutabile, si riempie lungo la pipeline)
 */
export function createDebugTrace(input) {
  return {
    traceId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    input,
    sentences: [],         // frasi splittate
    sentenceTraces: [],    // dettaglio per ogni frase
    actions: [],           // azioni finali generate
    finalDecision: null,   // { method, confidence, usedAI, actionCount }
    timings: {},           // { total, parseLocally, aiCall }
    warnings: [],          // problemi rilevati
  }
}

// ═══════════════════════════════════════════════════════════════
// SENTENCE-LEVEL TRACE
// ═══════════════════════════════════════════════════════════════

/**
 * Aggiunge il trace di una singola frase analizzata.
 * @param {object} trace - Il trace padre
 * @param {object} payload - Dettagli della frase
 */
export function addSentenceTrace(trace, payload) {
  trace.sentenceTraces.push({
    sentence: payload.sentence,
    // Intent rilevato
    intent: payload.intent || null,
    confidence: payload.confidence || 0,
    source: payload.source || null,  // 'l0_pattern' | 'l1_nlp' | 'l2_synapses' | 'l1+l2_combined' | 'structural'
    // Entità estratte
    entities: {
      people: payload.people || [],
      date: payload.date || null,
      time: payload.time || null,
      timeRange: payload.timeRange || null,
      amount: payload.amount || null,
      location: payload.location || null,
      activity: payload.activity || null,
      logistics: payload.logistics || null,
    },
    // NLP.js L1
    nlp: {
      intent: payload.nlpIntent || null,
      score: payload.nlpScore || 0,
    },
    // Sinapsi L2
    synapses: {
      topType: payload.synType || null,
      confidence: payload.synConfidence || 0,
      fired: payload.synapsesFired || [],  // [{ key, weight, source }]
      category: payload.synCategory || null,
    },
    // Segnali strutturali
    structural: {
      hasPersons: payload.hasPersons || false,
      hasTime: payload.hasTime || false,
      hasExplicitDate: payload.hasExplicitDate || false,
      hasAmount: payload.hasAmount || false,
      calendarBoost: payload.calendarBoost || false,
    },
    // Azioni generate da questa frase
    actionsGenerated: payload.actionsGenerated || [],
    isDualAction: payload.isDualAction || false,
    isAbsence: payload.isAbsence || false,
    // Warning
    warnings: payload.warnings || [],
  })
}

// ═══════════════════════════════════════════════════════════════
// TIMING
// ═══════════════════════════════════════════════════════════════

/** Registra un timing per uno stage */
export function addStageTiming(trace, stage, ms) {
  trace.timings[stage] = Math.round(ms * 100) / 100
}

// ═══════════════════════════════════════════════════════════════
// FINAL DECISION
// ═══════════════════════════════════════════════════════════════

/** Registra la decisione finale del parse */
export function setFinalDecision(trace, payload) {
  trace.finalDecision = {
    method: payload.method,          // 'local' | 'ai_fallback' | 'ai_failed_local_fallback'
    confidence: payload.confidence,
    usedAI: payload.usedAI || false,
    actionCount: payload.actionCount || 0,
    summary: payload.summary || '',
  }
  trace.actions = payload.actions || []
}

// ═══════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════

/**
 * Salva il trace completo in Dexie (tabella nlp_logs).
 * Viene chiamato solo se debug è attivo.
 * Limita a max 200 log per famiglia (auto-pruning).
 */
export async function persistDebugTrace(trace, familyId) {
  if (!isDebugEnabled()) return
  if (!familyId) return

  try {
    await db.nlpLogs.add({
      id: trace.traceId,
      family_id: familyId,
      input: trace.input,
      result_intent: trace.finalDecision?.method || 'unknown',
      confidence: trace.finalDecision?.confidence || 0,
      action_count: trace.finalDecision?.actionCount || 0,
      used_ai: trace.finalDecision?.usedAI || false,
      debug_json: JSON.stringify(trace),
      created_at: trace.createdAt,
    })

    // Auto-pruning: mantieni solo gli ultimi 200 log
    const count = await db.nlpLogs
      .where('family_id').equals(familyId)
      .count()

    if (count > 200) {
      const oldest = await db.nlpLogs
        .where('family_id').equals(familyId)
        .sortBy('created_at')
      const toDelete = oldest.slice(0, count - 200)
      await db.nlpLogs.bulkDelete(toDelete.map(l => l.id))
    }
  } catch (err) {
    console.warn('[BrainDebug] Errore persistenza log:', err)
  }
}

// ═══════════════════════════════════════════════════════════════
// QUERY (per la debug page)
// ═══════════════════════════════════════════════════════════════

/**
 * Recupera gli ultimi N log per una famiglia.
 * @param {string} familyId
 * @param {object} options - { limit, intentFilter, minConfidence, onlyAI }
 */
export async function getDebugLogs(familyId, options = {}) {
  if (!familyId) return []

  const { limit = 50, intentFilter, maxConfidence, onlyAI } = options

  try {
    let logs = await db.nlpLogs
      .where('family_id').equals(familyId)
      .reverse()
      .sortBy('created_at')

    // Filtri
    if (intentFilter) {
      logs = logs.filter(l => {
        const trace = JSON.parse(l.debug_json)
        return trace.sentenceTraces?.some(s => s.intent === intentFilter)
      })
    }

    if (maxConfidence !== undefined) {
      logs = logs.filter(l => l.confidence <= maxConfidence)
    }

    if (onlyAI) {
      logs = logs.filter(l => l.used_ai)
    }

    return logs.slice(0, limit)
  } catch (err) {
    console.warn('[BrainDebug] Errore lettura log:', err)
    return []
  }
}

/** Cancella tutti i log debug per una famiglia */
export async function clearDebugLogs(familyId) {
  if (!familyId) return
  try {
    const ids = await db.nlpLogs
      .where('family_id').equals(familyId)
      .primaryKeys()
    await db.nlpLogs.bulkDelete(ids)
  } catch (err) {
    console.warn('[BrainDebug] Errore cancellazione log:', err)
  }
}
