/**
 * brain/index.js — Orchestratore principale del Cervellone + Memory + Stats + Re-exports.
 *
 * Questo file è il punto d'ingresso unico per il sistema NLP.
 * Tutti i consumer importano da qui (backward compatible con brainEngine.js).
 *
 * Flusso brainParse:
 *   input → parse locale/AI → check draft attivo → decide:
 *   A) creare nuovo draft  B) merge nel draft attivo
 *   C) committare draft    D) abbandonare draft + nuova parse
 *   → ritorna actions finali o preview draft
 */

import { parseVoiceWithAI } from '../voice.js'
import { isNlpReady } from '../brainNlp.js'
import { db } from '../localDb.js'
import { trackEvent, TELEMETRY_EVENTS } from '../telemetry.js'
export { getTelemetry, resetTelemetry, TELEMETRY_EVENTS } from '../telemetry.js'
import { FINAL_THRESHOLD } from './config.js'
import { parseLocally } from './intentClassifier.js'
import { normalizeAndValidateActions } from './actionNormalizer.js'
import {
  isDebugEnabled, createDebugTrace,
  addStageTiming, setFinalDecision, persistDebugTrace,
} from './debugLogger.js'
import {
  getActiveDraft, createDraft, updateDraft,
  abandonDraft, commitDraft,
  isFollowupFragment, isCompatibleWithDraft,
  mergeParseIntoDraft, shouldAutoCommit,
  buildActionsFromDraft, buildDraftPreview,
  computeMissingFields,
} from './conversationMemory.js'

// Re-export per backward compatibility
export { parseLocally } from './intentClassifier.js'
export { learnFromConfirmed, learnFromRejected, applyDecay } from './learningEngine.js'
export { isDebugEnabled, setDebugEnabled, getDebugLogs, clearDebugLogs } from './debugLogger.js'
export { canAccessBrainDebug, explainSentenceDecision, computeDebugMetrics, computeTemporalMetrics, filterByTimeWindow, compareMetrics, computeMemoryMetrics, getMemoryLogs } from './debugAnalytics.js'
export { runTestBatch, compareTestRuns, TEST_PHRASES } from './testBatch.js'
export { runMemoryTests, MEMORY_TEST_CASES } from './testMemory.js'
export {
  getActiveDraft, createDraft, abandonDraft, commitDraft,
  buildDraftPreview, buildActionsFromDraft,
} from './conversationMemory.js'

// Intent supportati dalla memoria breve
const MEMORY_INTENTS = ['calendar', 'absence', 'expense']

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATORE PRINCIPALE — 3 livelli + memoria conversazionale
// ═══════════════════════════════════════════════════════════════
export async function brainParse(text, context = {}) {
  const { members = [], currentMember, familyId } = context
  const createdBy = currentMember?.id || currentMember?.name || 'unknown'
  const debug = isDebugEnabled()
  const trace = debug ? createDebugTrace(text) : null
  const t0 = performance.now()

  // ─── 1. Parser locale (L0 + L1 NLP.js + L2 Sinapsi) ───
  const tLocal0 = performance.now()
  const localResult = await parseLocally(text, members, familyId, currentMember, trace)
  const tLocal1 = performance.now()

  if (debug) addStageTiming(trace, 'parseLocally', tLocal1 - tLocal0)

  // ─── 2. Conversation Memory: check draft attivo ───
  const tMem0 = performance.now()
  const memoryResult = await handleConversationMemory(
    text, localResult, familyId, createdBy, members, debug ? trace : null
  )
  const tMem1 = performance.now()

  if (debug) addStageTiming(trace, 'conversationMemory', tMem1 - tMem0)

  // Se la memoria ha gestito l'input (merge/create/commit), ritorna il suo risultato
  if (memoryResult) {
    trackEvent(TELEMETRY_EVENTS.BRAIN_PARSE, { level: 'memory' })

    if (debug) {
      addStageTiming(trace, 'total', performance.now() - t0)
      setFinalDecision(trace, {
        method: memoryResult.committed ? 'memory_commit' : 'memory_draft',
        confidence: memoryResult.confidence || 0,
        usedAI: false,
        actionCount: memoryResult.actions?.length || 0,
        summary: memoryResult.summary || '',
        actions: memoryResult.actions || [],
      })
      await persistDebugTrace(trace, familyId)
    }

    return { ok: true, ...memoryResult }
  }

  // ─── 3. Flusso normale (nessun draft coinvolto) ───
  if (localResult && localResult.confidence >= FINAL_THRESHOLD) {
    trackEvent(TELEMETRY_EVENTS.BRAIN_PARSE, { level: 'local' })

    if (debug) {
      addStageTiming(trace, 'total', performance.now() - t0)
      setFinalDecision(trace, {
        method: 'local',
        confidence: localResult.confidence,
        usedAI: false,
        actionCount: localResult.actions.length,
        summary: localResult.summary,
        actions: localResult.actions,
      })
      await persistDebugTrace(trace, familyId)
    }

    return { ok: true, ...localResult }
  }

  // ─── 4. L3: AI remota (Claude Haiku) ───
  if (debug) trace.warnings.push(`low_local_confidence: ${((localResult?.confidence || 0) * 100).toFixed(0)}%`)

  if (debug) trace.warnings.push('low_local_confidence')

  try {
    const tAI0 = performance.now()
    const aiResult = await parseVoiceWithAI(text, context, localResult)
    const tAI1 = performance.now()

    if (debug) {
      addStageTiming(trace, 'aiCall', tAI1 - tAI0)
      addStageTiming(trace, 'total', performance.now() - t0)
      setFinalDecision(trace, {
        method: 'ai_fallback',
        confidence: 1.0,
        usedAI: true,
        actionCount: aiResult.actions?.length || 0,
        summary: aiResult.summary || 'AI parse',
        actions: aiResult.actions || [],
      })
      await persistDebugTrace(trace, familyId)
    }

    trackEvent(TELEMETRY_EVENTS.BRAIN_PARSE, { level: 'L3' })

    return {
      ...aiResult,
      usedAI: true,
      confidence: 1.0,
      localAttempt: localResult,
    }
  } catch (err) {
    if (localResult && localResult.actions.length > 0) {
      console.warn('[Brain] AI fallita, uso risultato locale (offline)')
      trackEvent(TELEMETRY_EVENTS.BRAIN_PARSE, { level: 'L3_failed' })

      if (debug) {
        trace.warnings.push('ai_failed')
        addStageTiming(trace, 'total', performance.now() - t0)
        setFinalDecision(trace, {
          method: 'ai_failed_local_fallback',
          confidence: localResult.confidence,
          usedAI: false,
          actionCount: localResult.actions.length,
          summary: localResult.summary + ' (offline)',
          actions: localResult.actions,
        })
        await persistDebugTrace(trace, familyId)
      }

      return { ok: true, ...localResult, summary: localResult.summary + ' (offline)' }
    }
    throw err
  }
}

// ═══════════════════════════════════════════════════════════════
// CONVERSATION MEMORY HANDLER
// ═══════════════════════════════════════════════════════════════

/**
 * Gestisce la logica di memoria conversazionale.
 *
 * Ritorna:
 * - null se la memoria non ha gestito l'input (flusso normale)
 * - oggetto risultato se gestito (draft creato/aggiornato/committato)
 */
async function handleConversationMemory(text, parseResult, familyId, createdBy, members, trace) {
  if (!familyId || !createdBy) return null

  const activeDraft = await getActiveDraft(familyId, createdBy)
  const isFragment = isFollowupFragment(text, parseResult)
  const resultIntent = parseResult?.actions?.[0]?.type || parseResult?.type || null
  const resultEntities = extractEntitiesFromParse(parseResult)

  // Info debug
  const memoryDebug = {
    hadActiveDraft: !!activeDraft,
    action: 'ignore',
    draftId: activeDraft?.id || null,
    compatibilityScore: 0,
    mergedFields: [],
    missingBefore: activeDraft?.missing_fields || [],
    missingAfter: [],
    isFragment,
  }

  try {
    // ─── CASO A: C'è un draft attivo ───
    if (activeDraft) {
      const compatible = isCompatibleWithDraft(activeDraft, text, parseResult)
      memoryDebug.compatibilityScore = compatible ? 1.0 : 0.0

      if (compatible) {
        // Merge nel draft
        const mergeInfo = mergeParseIntoDraft(activeDraft, text, parseResult, resultEntities)
        const updatedDraft = mergeInfo.draft

        memoryDebug.action = 'merge'
        memoryDebug.mergedFields = mergeInfo.mergedFields
        memoryDebug.missingBefore = mergeInfo.missingBefore
        memoryDebug.missingAfter = mergeInfo.missingAfter

        // Persisti l'aggiornamento
        await updateDraft(activeDraft.id, updatedDraft)

        // Auto-commit?
        if (shouldAutoCommit(updatedDraft)) {
          memoryDebug.action = 'merge_then_commit'
          await commitDraft(activeDraft.id)

          const rawMemoryActions = buildActionsFromDraft(updatedDraft)
          const finalActions = normalizeMemoryActions(rawMemoryActions, familyId, createdBy, members)
          const preview = buildDraftPreview(updatedDraft, mergeInfo)

          if (trace) addMemoryTrace(trace, memoryDebug)

          return {
            committed: true,
            fromMemory: true,
            actions: finalActions,
            confidence: updatedDraft.confidence.current,
            summary: preview.summary,
            preview,
            draft: updatedDraft,
            memoryAction: 'commit',
          }
        }

        // Draft ancora aperto
        const preview = buildDraftPreview(updatedDraft, mergeInfo)

        if (trace) addMemoryTrace(trace, memoryDebug)

        return {
          committed: false,
          fromMemory: true,
          actions: [],
          confidence: updatedDraft.confidence.current,
          summary: preview.summary,
          preview,
          draft: updatedDraft,
          memoryAction: 'merge',
          missingFields: updatedDraft.missing_fields,
        }
      } else {
        // Non compatibile → abbandona draft + procedi normalmente
        memoryDebug.action = 'abandon'
        await abandonDraft(activeDraft.id, 'topic_change')

        if (trace) addMemoryTrace(trace, memoryDebug)

        // Non ritornare nulla: lascia il flusso normale gestire
        // Ma se il nuovo input può creare un draft, fallo
        return await tryCreateNewDraft(
          text, parseResult, resultIntent, resultEntities,
          familyId, createdBy, members, trace, memoryDebug
        )
      }
    }

    // ─── CASO B: Nessun draft attivo ───

    // Se è un frammento puro senza draft → non possiamo fare nulla
    if (isFragment && !activeDraft) {
      memoryDebug.action = 'ignore_orphan_fragment'
      if (trace) addMemoryTrace(trace, memoryDebug)
      return null // flusso normale
    }

    // Se il parse ha un intent supportato e la frase non è già completa,
    // potrebbe servire un draft
    return await tryCreateNewDraft(
      text, parseResult, resultIntent, resultEntities,
      familyId, createdBy, members, trace, memoryDebug
    )
  } catch (err) {
    console.warn('[Brain] Errore conversation memory:', err)
    if (trace) {
      memoryDebug.action = 'error'
      memoryDebug.error = err.message
      addMemoryTrace(trace, memoryDebug)
    }
    return null // fallback a flusso normale
  }
}

/**
 * Prova a creare un nuovo draft se l'input è parziale e supportato.
 */
async function tryCreateNewDraft(text, parseResult, resultIntent, resultEntities, familyId, createdBy, members, trace, memoryDebug) {
  // L'intent deve essere supportato dalla memoria
  if (!resultIntent || !MEMORY_INTENTS.includes(resultIntent)) {
    memoryDebug.action = memoryDebug.action === 'abandon' ? 'abandon_no_new_draft' : 'ignore'
    if (trace) addMemoryTrace(trace, memoryDebug)
    return null
  }

  // Se la confidence è alta e le azioni sono complete, non serve un draft
  if (parseResult?.confidence >= FINAL_THRESHOLD) {
    const actions = parseResult?.actions || []
    const hasIncomplete = actions.some(a => a.incomplete)
    const missingFields = computeMissingFieldsFromParse(resultIntent, resultEntities)

    // Se tutto è completo e confidence alta → niente draft
    if (!hasIncomplete && missingFields.length <= 1) {
      memoryDebug.action = memoryDebug.action === 'abandon' ? 'abandon_complete_new' : 'ignore_complete'
      if (trace) addMemoryTrace(trace, memoryDebug)
      return null // flusso normale
    }
  }

  // Crea draft
  const draft = await createDraft({
    familyId,
    createdBy,
    intent: resultIntent,
    entities: resultEntities,
    parseResult,
    inputText: text,
  })

  memoryDebug.action = memoryDebug.action === 'abandon' ? 'abandon_then_create' : 'create'
  memoryDebug.draftId = draft.id
  memoryDebug.missingAfter = draft.missing_fields

  if (trace) addMemoryTrace(trace, memoryDebug)

  // Se subito auto-committabile (input completo ma con missing opzionali)
  if (shouldAutoCommit(draft)) {
    memoryDebug.action = 'create_then_commit'
    await commitDraft(draft.id)

    const rawMemoryActions = buildActionsFromDraft(draft)
    const finalActions = normalizeMemoryActions(rawMemoryActions, familyId, createdBy, members)
    const preview = buildDraftPreview(draft)

    return {
      committed: true,
      fromMemory: true,
      actions: finalActions,
      confidence: draft.confidence.current,
      summary: preview.summary,
      preview,
      draft,
      memoryAction: 'create_and_commit',
    }
  }

  // Draft creato, non ancora completo
  const preview = buildDraftPreview(draft)

  return {
    committed: false,
    fromMemory: true,
    actions: [],
    confidence: draft.confidence.current,
    summary: preview.summary,
    preview,
    draft,
    memoryAction: 'create',
    missingFields: draft.missing_fields,
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Estrai entità aggregate dal parse result.
 *  Supporta sia azioni canoniche (Sprint 1+) che legacy (L3/memory non ancora migrati).
 */
function extractEntitiesFromParse(parseResult) {
  if (!parseResult) return {}

  // Se il parseResult ha entità dirette
  if (parseResult.entities) return parseResult.entities

  // Prova a estrarre dalle azioni
  const entities = {}
  const actions = parseResult.actions || []

  for (const a of actions) {
    // Persone: canoniche (personNames/personIds) o legacy (assignedTo)
    if (a.personNames?.length > 0) {
      if (!entities.people) entities.people = []
      entities.people.push(...a.personNames)
    } else if (a.assignedToName) {
      if (!entities.people) entities.people = []
      entities.people.push(a.assignedToName)
    } else if (a.assignedTo) {
      // Legacy fallback (L3/memory non ancora migrati)
      if (!entities.people) entities.people = []
      entities.people.push(a.assignedTo)
    }

    // Date: canonical date o dueDate, legacy startDate
    if (a.date) entities.date = a.date
    else if (a.dueDate) entities.date = a.dueDate

    // Time: canonical timeStart, legacy time/startTime
    if (a.timeStart) entities.time = a.timeStart
    else if (a.time) entities.time = a.time

    if (a.amount) entities.amount = a.amount
    if (a.activity) entities.activity = a.activity
    if (a.location) entities.location = a.location
    if (a.logistics) entities.logistics = a.logistics
  }

  return entities
}

/** Calcola missing fields da entità raw + intent */
function computeMissingFieldsFromParse(intent, entities) {
  const missing = []
  if (intent === 'calendar') {
    if (!entities.date) missing.push('date')
    if (!entities.time && !entities.timeRange) missing.push('time')
    if (!entities.people?.length) missing.push('person')
  }
  if (intent === 'absence') {
    if (!entities.people?.length) missing.push('absentPerson')
    if (!entities.date) missing.push('date')
  }
  if (intent === 'expense') {
    if (entities.amount == null) missing.push('amount')
  }
  return missing
}

/**
 * Normalizza le raw actions prodotte dalla conversation memory.
 * Stessa pipeline di parseLocally: raw → normalizer → validator.
 * Le azioni invalide vengono scartate con warning in console.
 */
function normalizeMemoryActions(rawActions, familyId, createdBy, members) {
  if (!rawActions || rawActions.length === 0) return []

  const normContext = {
    familyId,
    currentMemberId: createdBy,
    members: members.map(m => ({ id: m.id, name: m.name, role: m.role, aliases: m.aliases, gender: m.gender })),
    source: 'memory',
    textOriginal: '',
    confidence: 0.85,
    usedAI: false,
  }

  const { actions: canonical, invalid } = normalizeAndValidateActions(rawActions, normContext)

  if (invalid.length > 0) {
    console.warn(`[Brain/Memory] ${invalid.length} azioni memoria scartate:`, invalid.map(i => i.errors))
  }

  return canonical
}

/** Aggiunge info memoria al debug trace */
function addMemoryTrace(trace, memoryDebug) {
  if (!trace) return
  trace.memory = {
    hadActiveDraft: memoryDebug.hadActiveDraft,
    action: memoryDebug.action,
    draftId: memoryDebug.draftId,
    isFragment: memoryDebug.isFragment,
    compatibilityScore: memoryDebug.compatibilityScore,
    mergedFields: memoryDebug.mergedFields,
    missingBefore: memoryDebug.missingBefore,
    missingAfter: memoryDebug.missingAfter,
    error: memoryDebug.error || null,
  }
}

// ═══════════════════════════════════════════════════════════════
// STATS & DEBUG
// ═══════════════════════════════════════════════════════════════
export async function getBrainStats(familyId) {
  if (!familyId) return { totalSynapses: 0, avgWeight: 0, topKeywords: [], healthScore: 0, nlpReady: false }

  const patterns = await db.patterns
    .where('family_id').equals(familyId)
    .and(p => !p._deleted)
    .toArray()

  const total = patterns.length
  const avgScore = total > 0 ? patterns.reduce((s, p) => s + (p.score || 0), 0) / total : 0
  const strongCount = patterns.filter(p => (p.score || 0) >= 3).length
  const healthScore = total > 0 ? Math.round((strongCount / total) * 100) : 0

  const topKeywords = patterns
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10)
    .map(p => ({ keyword: p.keyword, type: p.actionType, score: Math.round((p.score || 0) * 10) / 10 }))

  let nlpUserDocs = 0
  try {
    nlpUserDocs = await db.nlpDocuments
      .where('family_id').equals(familyId)
      .and(d => !d._deleted)
      .count()
  } catch (_) {}

  return {
    totalSynapses: total,
    avgWeight: avgScore.toFixed(1),
    topKeywords,
    healthScore,
    strongCount,
    nlpReady: isNlpReady(),
    nlpUserDocs,
  }
}
