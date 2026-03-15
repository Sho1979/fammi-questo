/**
 * debugAnalytics.js — Motore di analisi diagnostica per il Cervellone.
 *
 * Funzioni pure: ricevono logs, restituiscono metriche.
 * Separato da UI e persistenza per manutenibilità.
 *
 * Risponde a:
 * - dove sbaglia più spesso?
 * - quando chiama AI inutilmente?
 * - quali entità mancano più spesso?
 * - quali sinapsi aiutano e quali sporcano?
 * - quali frasi generano output incompleti?
 * - quali forme linguistiche portano a fallback?
 */

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Parse sicuro del debug_json da un log */
function safeParseTrace(log) {
  try {
    return JSON.parse(log.debug_json)
  } catch {
    return null
  }
}

/** Estrai tutti i sentenceTraces da un array di log */
function allSentenceTraces(logs) {
  const result = []
  for (const log of logs) {
    const trace = safeParseTrace(log)
    if (!trace?.sentenceTraces) continue
    for (const st of trace.sentenceTraces) {
      result.push({ ...st, _logId: log.id, _usedAI: log.used_ai, _logConfidence: log.confidence })
    }
  }
  return result
}

// ═══════════════════════════════════════════════════════════════
// METRICHE AGGREGATE
// ═══════════════════════════════════════════════════════════════

/**
 * Calcola tutte le metriche diagnostiche aggregate.
 * Chiamata una volta, restituisce tutto.
 */
export function computeDebugMetrics(logs) {
  if (!logs || logs.length === 0) return null

  const parseCount = logs.length
  const localCount = logs.filter(l => !l.used_ai).length
  const aiCount = logs.filter(l => l.used_ai).length
  const avgConfidence = logs.reduce((s, l) => s + (l.confidence || 0), 0) / parseCount

  // Sentence-level analysis
  const sentences = allSentenceTraces(logs)
  const intentCounts = {}
  const intentConfidences = {}
  const warningCounts = {}
  let lowConfidenceCount = 0
  let missingEntityCount = 0
  let incompleteDualCount = 0
  let incompleteActionCount = 0

  // Per analisi sinapsi problematiche
  const synapsesInProblems = {}  // key → { totalWeight, problemCount, contexts }
  // Per analisi forme linguistiche → fallback
  const fallbackPhrases = {}  // forma normalizzata → count

  for (const log of logs) {
    if (log.confidence < 0.55) lowConfidenceCount++

    const trace = safeParseTrace(log)
    if (!trace) continue

    for (const st of (trace.sentenceTraces || [])) {
      const intent = st.intent || 'none'

      // Intent counts
      intentCounts[intent] = (intentCounts[intent] || 0) + 1
      if (!intentConfidences[intent]) intentConfidences[intent] = []
      intentConfidences[intent].push(st.confidence || 0)

      // Warning counts
      for (const w of (st.warnings || [])) {
        warningCounts[w] = (warningCounts[w] || 0) + 1
      }

      // Missing entity
      const hasMissing = st.warnings?.some(w =>
        w === 'missing_explicit_time' ||
        w === 'no_person_assigned' ||
        w === 'absent_person_unknown'
      )
      if (hasMissing) missingEntityCount++

      // Incomplete dual action
      if (st.isDualAction && st.warnings?.includes('needs_pickup_person')) {
        incompleteDualCount++
      }

      // Incomplete action (qualsiasi azione con flag incomplete)
      const hasIncomplete = st.actionsGenerated?.some(a => a.incomplete)
      if (hasIncomplete) incompleteActionCount++

      // Sinapsi nei casi problematici (confidence < 0.55 o con warnings)
      const isProblematic = (st.confidence || 0) < 0.55 || (st.warnings?.length || 0) > 0
      if (isProblematic && st.synapses?.fired?.length > 0) {
        for (const syn of st.synapses.fired) {
          const key = syn.key || syn.keyword
          if (!key) continue
          if (!synapsesInProblems[key]) {
            synapsesInProblems[key] = { totalWeight: 0, problemCount: 0, intents: {} }
          }
          synapsesInProblems[key].totalWeight += (syn.weight || 0)
          synapsesInProblems[key].problemCount++
          const si = st.intent || 'none'
          synapsesInProblems[key].intents[si] = (synapsesInProblems[key].intents[si] || 0) + 1
        }
      }
    }

    // Forme linguistiche che portano a fallback AI
    if (log.used_ai && trace.input) {
      // Normalizza: lowercase, rimuovi numeri, trim
      const normalized = trace.input
        .toLowerCase()
        .replace(/\d+/g, '_N_')
        .replace(/\s+/g, ' ')
        .trim()
      // Prendi i primi 60 char come "forma"
      const form = normalized.length > 60 ? normalized.slice(0, 60) + '…' : normalized
      fallbackPhrases[form] = (fallbackPhrases[form] || 0) + 1
    }
  }

  // Top intent
  const topIntent = Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])[0]

  // Avg confidence per intent
  const avgConfidenceByIntent = {}
  for (const [intent, confs] of Object.entries(intentConfidences)) {
    avgConfidenceByIntent[intent] = confs.reduce((s, c) => s + c, 0) / confs.length
  }

  // Top warnings (top 8)
  const topWarnings = Object.entries(warningCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([warning, count]) => ({ warning, count }))

  // AI fallback probabilmente evitabili:
  // AI usata ma confidence locale > 0.40 (c'era segnale) e segnali strutturali presenti
  let avoidableAICount = 0
  for (const log of logs) {
    if (!log.used_ai) continue
    const trace = safeParseTrace(log)
    if (!trace) continue
    const hasStructuralSignals = trace.sentenceTraces?.some(st =>
      st.structural?.hasPersons || st.structural?.hasTime || st.structural?.hasExplicitDate
    )
    const hasDecentLocal = trace.sentenceTraces?.some(st => (st.confidence || 0) >= 0.40)
    if (hasStructuralSignals && hasDecentLocal) avoidableAICount++
  }

  return {
    parseCount,
    localCount,
    aiCount,
    localPct: Math.round((localCount / parseCount) * 100),
    aiPct: Math.round((aiCount / parseCount) * 100),
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    intentDistribution: intentCounts,
    topIntent: topIntent ? { intent: topIntent[0], count: topIntent[1] } : null,
    avgConfidenceByIntent,
    topWarnings,
    lowConfidenceCount,
    missingEntityCount,
    incompleteDualCount,
    incompleteActionCount,
    avoidableAICount,
  }
}

// ═══════════════════════════════════════════════════════════════
// FILTRI SPECIFICI
// ═══════════════════════════════════════════════════════════════

/** Log con confidence sotto soglia */
export function getLowConfidenceLogs(logs, threshold = 0.55) {
  return logs.filter(l => (l.confidence || 0) < threshold)
}

/** Log che hanno usato AI fallback */
export function getAIFallbackLogs(logs) {
  return logs.filter(l => l.used_ai)
}

/** Log con entità mancanti (time, person, date) */
export function getMissingEntityLogs(logs) {
  return logs.filter(l => {
    const trace = safeParseTrace(l)
    return trace?.sentenceTraces?.some(st =>
      st.warnings?.includes('missing_explicit_time') ||
      st.warnings?.includes('no_person_assigned') ||
      st.warnings?.includes('absent_person_unknown')
    )
  })
}

/** Log con azioni incomplete o dual action parziali */
export function getIncompleteActionLogs(logs) {
  return logs.filter(l => {
    const trace = safeParseTrace(l)
    return trace?.sentenceTraces?.some(st =>
      (st.isDualAction && st.warnings?.includes('needs_pickup_person')) ||
      st.actionsGenerated?.some(a => a.incomplete)
    )
  })
}

/** AI fallback probabilmente evitabili */
export function getAvoidableAILogs(logs) {
  return logs.filter(l => {
    if (!l.used_ai) return false
    const trace = safeParseTrace(l)
    if (!trace) return false
    const hasStructural = trace.sentenceTraces?.some(st =>
      st.structural?.hasPersons || st.structural?.hasTime || st.structural?.hasExplicitDate
    )
    const hasDecentLocal = trace.sentenceTraces?.some(st => (st.confidence || 0) >= 0.40)
    return hasStructural && hasDecentLocal
  })
}

// ═══════════════════════════════════════════════════════════════
// ANALISI SINAPSI PROBLEMATICHE
// ═══════════════════════════════════════════════════════════════

/**
 * Top sinapsi che appaiono nei casi problematici.
 * "Problematico" = confidence < 0.55 o frase con warnings.
 * Restituisce le sinapsi che sporcano il giudizio.
 */
export function getTopSynapsesInProblematicLogs(logs, limit = 10) {
  const synMap = {}

  for (const log of logs) {
    const trace = safeParseTrace(log)
    if (!trace?.sentenceTraces) continue

    for (const st of trace.sentenceTraces) {
      const isProblematic = (st.confidence || 0) < 0.55 || (st.warnings?.length || 0) > 0
      if (!isProblematic || !st.synapses?.fired?.length) continue

      for (const syn of st.synapses.fired) {
        const key = syn.key || syn.keyword
        if (!key) continue
        if (!synMap[key]) {
          synMap[key] = { key, totalWeight: 0, problemCount: 0, intents: {}, fuzzyCount: 0 }
        }
        synMap[key].totalWeight += (syn.weight || 0)
        synMap[key].problemCount++
        if (syn.fuzzy) synMap[key].fuzzyCount++
        const intent = st.intent || 'none'
        synMap[key].intents[intent] = (synMap[key].intents[intent] || 0) + 1
      }
    }
  }

  return Object.values(synMap)
    .sort((a, b) => b.problemCount - a.problemCount)
    .slice(0, limit)
    .map(s => ({
      ...s,
      avgWeight: Math.round((s.totalWeight / s.problemCount) * 100) / 100,
      topIntent: Object.entries(s.intents).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none',
    }))
}

// ═══════════════════════════════════════════════════════════════
// ANALISI FORME LINGUISTICHE → FALLBACK
// ═══════════════════════════════════════════════════════════════

/**
 * Top frasi/forme linguistiche che portano a fallback AI.
 * Normalizza e raggruppa input simili.
 */
export function getTopFallbackPhrases(logs, limit = 10) {
  const phrases = {}

  for (const log of logs) {
    if (!log.used_ai) continue
    const trace = safeParseTrace(log)
    if (!trace?.input) continue

    // Normalizza: lowercase, numeri → _N_, trim
    const normalized = trace.input
      .toLowerCase()
      .replace(/\d+/g, '_N_')
      .replace(/\s+/g, ' ')
      .trim()

    const form = normalized.length > 60 ? normalized.slice(0, 60) + '…' : normalized

    if (!phrases[form]) {
      phrases[form] = { form, count: 0, originals: [] }
    }
    phrases[form].count++
    if (phrases[form].originals.length < 3) {
      phrases[form].originals.push(trace.input)
    }
  }

  return Object.values(phrases)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// ═══════════════════════════════════════════════════════════════
// RAGGRUPPAMENTI
// ═══════════════════════════════════════════════════════════════

/** Raggruppa warning con conteggio */
export function groupWarnings(logs) {
  const counts = {}
  for (const log of logs) {
    const trace = safeParseTrace(log)
    if (!trace?.sentenceTraces) continue
    for (const st of trace.sentenceTraces) {
      for (const w of (st.warnings || [])) {
        counts[w] = (counts[w] || 0) + 1
      }
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([warning, count]) => ({ warning, count }))
}

/** Raggruppa intent con conteggio */
export function groupIntents(logs) {
  const counts = {}
  for (const log of logs) {
    const trace = safeParseTrace(log)
    if (!trace?.sentenceTraces) continue
    for (const st of trace.sentenceTraces) {
      const intent = st.intent || 'none'
      counts[intent] = (counts[intent] || 0) + 1
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([intent, count]) => ({ intent, count }))
}

// ═══════════════════════════════════════════════════════════════
// EXPLAINABILITY PER SINGOLA FRASE
// ═══════════════════════════════════════════════════════════════

/**
 * Genera una spiegazione leggibile del PERCHÉ di una decisione.
 * Non dice solo "intent = calendar", dice perché.
 */
export function explainSentenceDecision(st) {
  const reasons = []
  const issues = []

  // 1. Segnali strutturali
  if (st.structural?.hasPersons) reasons.push('persona rilevata')
  if (st.structural?.hasExplicitDate) reasons.push('data esplicita')
  if (st.structural?.hasTime) reasons.push('orario presente')
  if (st.structural?.hasAmount) reasons.push('importo trovato')
  if (st.structural?.calendarBoost) reasons.push('boost calendario attivo')

  // 2. Source della decisione
  const sourceMap = {
    'l0_pattern': 'pattern strutturale L0 (regola esplicita)',
    'l1_nlp_high': `NLP.js alta confidenza (${Math.round((st.nlp?.score || 0) * 100)}%)`,
    'l1_nlp_medium': `NLP.js media confidenza (${Math.round((st.nlp?.score || 0) * 100)}%)`,
    'l1_nlp_best': `NLP.js miglior match (${Math.round((st.nlp?.score || 0) * 100)}%)`,
    'l2_synapses': `sinapsi L2 dominanti (${st.synapses?.topType || '?'}, ${Math.round((st.synapses?.confidence || 0) * 100)}%)`,
    'l2_synapses_fallback': `fallback su sinapsi L2 (${Math.round((st.synapses?.confidence || 0) * 100)}%)`,
    'l1+l2_combined': `combinazione NLP + sinapsi`,
    'structural+l2_synapses': `segnali strutturali + sinapsi L2`,
    'structural+l1_nlp': `segnali strutturali + NLP.js`,
    'structural_override': `override strutturale (forzatura)`,
    'skipped': 'frase saltata (troppo corta o rumore)',
  }
  if (st.source && sourceMap[st.source]) {
    reasons.push(sourceMap[st.source])
  }

  // 3. Sinapsi rilevanti
  if (st.synapses?.fired?.length > 0) {
    const topSyn = st.synapses.fired.slice(0, 3).map(s => s.key).join(', ')
    reasons.push(`sinapsi attive: ${topSyn}`)
  }

  // 4. Issues / warnings
  for (const w of (st.warnings || [])) {
    const labelMap = {
      'missing_explicit_time': 'manca orario esplicito',
      'no_person_assigned': 'nessuna persona assegnata',
      'needs_pickup_person': 'manca chi riprende',
      'nlp_not_ready': 'modello NLP non ancora caricato',
      'nlp_classify_error': 'errore nella classificazione NLP',
      'below_threshold': 'confidence sotto soglia minima',
      'low_local_confidence': 'confidenza locale bassa → AI chiamato',
      'ai_failed': 'AI fallita, usato fallback locale',
      'absent_person_unknown': 'persona assente non riconosciuta',
    }
    issues.push(labelMap[w] || w)
  }

  // 5. Incomplete actions
  const incomplete = st.actionsGenerated?.filter(a => a.incomplete)
  if (incomplete?.length > 0) {
    for (const a of incomplete) {
      issues.push(`azione incompleta: ${a.incomplete}`)
    }
  }

  return {
    intent: st.intent || 'none',
    confidence: st.confidence || 0,
    reasons,
    issues,
    summary: reasons.length > 0
      ? `Intent ${st.intent || 'none'} scelto perché: ${reasons.join(' + ')}`
      : `Intent ${st.intent || 'none'} scelto senza segnali forti`,
    hasIssues: issues.length > 0,
  }
}

// ═══════════════════════════════════════════════════════════════
// FINESTRE TEMPORALI
// ═══════════════════════════════════════════════════════════════

/**
 * Filtra log per finestra temporale.
 * @param {Array} logs - tutti i log
 * @param {'all'|'24h'|'7d'|'session'} window - finestra selezionata
 * @returns {Array} log filtrati
 */
export function filterByTimeWindow(logs, window = 'all') {
  if (window === 'all' || !logs.length) return logs

  const now = Date.now()

  if (window === '24h') {
    const cutoff = now - 24 * 60 * 60 * 1000
    return logs.filter(l => new Date(l.created_at).getTime() >= cutoff)
  }

  if (window === '7d') {
    const cutoff = now - 7 * 24 * 60 * 60 * 1000
    return logs.filter(l => new Date(l.created_at).getTime() >= cutoff)
  }

  if (window === 'session') {
    // "Ultima sessione" = ultimo gruppo continuo di log
    // con gap massimo di 30 minuti tra uno e l'altro
    const SESSION_GAP_MS = 30 * 60 * 1000
    const sorted = [...logs].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const sessionLogs = [sorted[0]]
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].created_at).getTime()
      const curr = new Date(sorted[i].created_at).getTime()
      if (prev - curr <= SESSION_GAP_MS) {
        sessionLogs.push(sorted[i])
      } else {
        break
      }
    }
    return sessionLogs
  }

  return logs
}

/**
 * Calcola metriche per tutte le finestre temporali in un colpo.
 * Evita di ricalcolare tutto per ogni finestra.
 * @param {Array} logs - tutti i log (già recuperati)
 * @returns {{ all, h24, d7, session }} metriche per finestra
 */
export function computeTemporalMetrics(logs) {
  const windows = {
    all: logs,
    h24: filterByTimeWindow(logs, '24h'),
    d7: filterByTimeWindow(logs, '7d'),
    session: filterByTimeWindow(logs, 'session'),
  }

  const result = {}
  for (const [key, filtered] of Object.entries(windows)) {
    if (filtered.length === 0) {
      result[key] = null
      continue
    }
    result[key] = computeDebugMetrics(filtered)
  }
  return result
}

/**
 * Confronta metriche tra due finestre.
 * Utile per capire se i fix migliorano qualcosa.
 * @returns {{ improved, worsened, stable }} array di KPI con delta
 */
export function compareMetrics(before, after) {
  if (!before || !after) return null

  const comparisons = []
  const keys = [
    { key: 'avgConfidence', label: 'Confidence media', higherIsBetter: true },
    { key: 'localPct', label: '% Locale', higherIsBetter: true },
    { key: 'aiPct', label: '% AI fallback', higherIsBetter: false },
    { key: 'lowConfidenceCount', label: 'Low confidence', higherIsBetter: false },
    { key: 'missingEntityCount', label: 'Entità mancanti', higherIsBetter: false },
    { key: 'incompleteActionCount', label: 'Azioni incomplete', higherIsBetter: false },
    { key: 'avoidableAICount', label: 'AI evitabili', higherIsBetter: false },
  ]

  for (const { key, label, higherIsBetter } of keys) {
    const b = before[key] ?? 0
    const a = after[key] ?? 0
    const delta = a - b
    // Normalizza: per % la media non ha senso fare delta diretto
    const isImproved = higherIsBetter ? delta > 0 : delta < 0
    const isWorsened = higherIsBetter ? delta < 0 : delta > 0

    comparisons.push({
      key,
      label,
      before: b,
      after: a,
      delta,
      status: delta === 0 ? 'stable' : isImproved ? 'improved' : 'worsened',
    })
  }

  return {
    comparisons,
    improved: comparisons.filter(c => c.status === 'improved'),
    worsened: comparisons.filter(c => c.status === 'worsened'),
    stable: comparisons.filter(c => c.status === 'stable'),
  }
}

// ═══════════════════════════════════════════════════════════════
// MEMORY ANALYTICS — KPI specifiche conversazione
// ═══════════════════════════════════════════════════════════════

/**
 * Calcola metriche specifiche per la conversation memory.
 * Lavora sui log che hanno trace.memory (scritto da addMemoryTrace in index.js).
 *
 * KPI:
 * - draftsCreated / draftsCommitted / draftsAbandoned
 * - avgMergesPerDraft
 * - commitByTurnCount (dopo 1,2,3,4+ turni)
 * - correctionsDetected
 * - incompatibilitiesDetected
 * - falseMergeSuspects (merge con compatibility score basso)
 *
 * @param {Array} logs - nlpLogs con debug_json
 * @returns {object|null} metriche memory
 */
export function computeMemoryMetrics(logs) {
  if (!logs || logs.length === 0) return null

  // Estrai tutti i trace.memory dai log
  const memoryEvents = []
  for (const log of logs) {
    const trace = safeParseTrace(log)
    if (!trace?.memory) continue
    memoryEvents.push({
      ...trace.memory,
      _logId: log.id,
      _createdAt: log.created_at,
      _input: trace.input || log.input || '',
    })
  }

  if (memoryEvents.length === 0) return null

  // Conteggi base per azione
  const actionCounts = {}
  for (const ev of memoryEvents) {
    const a = ev.action || 'unknown'
    actionCounts[a] = (actionCounts[a] || 0) + 1
  }

  // Drafts creati (action contiene 'create')
  const draftsCreated = memoryEvents.filter(e =>
    e.action === 'create' || e.action === 'abandon_then_create' || e.action === 'create_then_commit'
  ).length

  // Drafts committati (action contiene 'commit')
  const draftsCommitted = memoryEvents.filter(e =>
    e.action === 'merge_then_commit' || e.action === 'create_then_commit'
  ).length

  // Drafts abbandonati
  const draftsAbandoned = memoryEvents.filter(e =>
    e.action === 'abandon' || e.action === 'abandon_no_new_draft' || e.action === 'abandon_then_create'
  ).length

  // Merge events
  const mergeEvents = memoryEvents.filter(e =>
    e.action === 'merge' || e.action === 'merge_then_commit'
  )

  // Merges per draft (raggruppa per draftId)
  const mergesByDraft = {}
  for (const ev of mergeEvents) {
    if (!ev.draftId) continue
    if (!mergesByDraft[ev.draftId]) mergesByDraft[ev.draftId] = 0
    mergesByDraft[ev.draftId]++
  }
  const draftIds = Object.keys(mergesByDraft)
  const avgMergesPerDraft = draftIds.length > 0
    ? Math.round((draftIds.reduce((s, k) => s + mergesByDraft[k], 0) / draftIds.length) * 10) / 10
    : 0

  // Commit per numero turni (1 = create_then_commit, 2+ = merge_then_commit con N merges)
  const commitByTurnCount = { 1: 0, 2: 0, 3: 0, '4+': 0 }
  // create_then_commit = 1 turno
  commitByTurnCount[1] = memoryEvents.filter(e => e.action === 'create_then_commit').length

  // merge_then_commit → conta i merge precedenti per quel draft
  const commitEvents = memoryEvents.filter(e => e.action === 'merge_then_commit')
  for (const ev of commitEvents) {
    const merges = mergesByDraft[ev.draftId] || 0
    const turns = merges + 1 // +1 per la creazione iniziale
    if (turns <= 1) commitByTurnCount[1]++
    else if (turns === 2) commitByTurnCount[2]++
    else if (turns === 3) commitByTurnCount[3]++
    else commitByTurnCount['4+']++
  }

  // Correzioni riuscite (topic_change con abandon)
  // Proxy: abandon events con hadActiveDraft = true
  const correctionsDetected = memoryEvents.filter(e =>
    (e.action === 'abandon' || e.action === 'abandon_then_create') && e.hadActiveDraft
  ).length

  // Incompatibilità rilevate (abandon perché non compatibile)
  const incompatibilitiesDetected = memoryEvents.filter(e =>
    e.hadActiveDraft && e.compatibilityScore === 0
  ).length

  // False merge sospetti: merge con molti missing after oppure
  // merge dove missingAfter >= missingBefore (il merge non ha migliorato)
  const falseMergeSuspects = mergeEvents.filter(e => {
    const beforeLen = e.missingBefore?.length || 0
    const afterLen = e.missingAfter?.length || 0
    // Se dopo il merge i missing sono uguali o aumentati → sospetto
    return beforeLen > 0 && afterLen >= beforeLen && e.mergedFields?.length === 0
  }).length

  // Frammenti orfani (fragment senza draft)
  const orphanFragments = memoryEvents.filter(e =>
    e.action === 'ignore_orphan_fragment'
  ).length

  // Campi più mergiati
  const mergedFieldCounts = {}
  for (const ev of mergeEvents) {
    for (const field of (ev.mergedFields || [])) {
      mergedFieldCounts[field] = (mergedFieldCounts[field] || 0) + 1
    }
  }
  const topMergedFields = Object.entries(mergedFieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([field, count]) => ({ field, count }))

  return {
    totalMemoryEvents: memoryEvents.length,
    actionCounts,
    draftsCreated,
    draftsCommitted,
    draftsAbandoned,
    avgMergesPerDraft,
    commitByTurnCount,
    correctionsDetected,
    incompatibilitiesDetected,
    falseMergeSuspects,
    orphanFragments,
    topMergedFields,
    // Rate sintetiche
    commitRate: draftsCreated > 0
      ? Math.round((draftsCommitted / draftsCreated) * 100)
      : 0,
    abandonRate: draftsCreated > 0
      ? Math.round((draftsAbandoned / draftsCreated) * 100)
      : 0,
  }
}

/**
 * Estrai log con attività memory per vista dettagliata.
 * @param {Array} logs
 * @returns {Array} log con trace.memory, arricchiti
 */
export function getMemoryLogs(logs) {
  const result = []
  for (const log of logs) {
    const trace = safeParseTrace(log)
    if (!trace?.memory) continue
    result.push({
      ...log,
      _memory: trace.memory,
      _input: trace.input || log.input || '',
    })
  }
  return result.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

// ═══════════════════════════════════════════════════════════════
// ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════

/**
 * Determina se un utente può accedere a /brain-debug.
 * Regole:
 * - parent/genitore → sì sempre
 * - child/elder → no
 * - flag locale brain_debug_enabled → sì (dev only)
 * - env development → parent sì
 *
 * @param {object} member - { role, ... }
 * @param {object} [familySettings] - opzionale, per feature flag futuro
 * @returns {boolean}
 */
export function canAccessBrainDebug(member, familySettings = {}) {
  if (!member) return false

  const role = member.role?.toLowerCase()

  // Parent/genitore → sempre sì
  if (role === 'parent' || role === 'genitore') return true

  // Flag locale dev override
  try {
    if (localStorage.getItem('brain_debug_enabled') === 'true') return true
  } catch {}

  // Feature flag in family settings (per futuro)
  if (familySettings.brainDebugOpen && (role === 'admin' || role === 'dev')) return true

  // Default: no
  return false
}
