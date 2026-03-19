/**
 * dbResolver.js — Query layer + resolver per edit_action.
 *
 * Responsabilita':
 *   - Query eventi/task/shopping per familyId + filtri
 *   - Score composito per ranking candidati
 *   - resolveEditAction: orchestratore che popola resolved{}
 *
 * NON è una funzione pura: accede a Dexie per query DB.
 */

import { db } from '../localDb.js'

// ═══════════════════════════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════════════════════════

/**
 * Score composito per ranking candidati.
 * dateMatch*40 + personMatch*30 + titleMatch*20 + activityMatch*10
 *
 * @param {Object} record - DB record (event/task/shoppingItem)
 * @param {Object} search - { titleHintNorm, dateNorm, personId, activityHint }
 * @returns {number} 0-100
 */
export function scoreCandidate(record, search) {
  let score = 0

  // Date match (40 pts)
  if (search.dateNorm && record.date === search.dateNorm) {
    score += 40
  } else if (search.dateNorm && record.due_date === search.dateNorm) {
    score += 40 // tasks use due_date
  }

  // Person match (30 pts)
  if (search.personId) {
    if (record.person_id === search.personId || record.assigned_to === search.personId) {
      score += 30
    }
  }

  // Title match (20 pts) — fuzzy substring
  if (search.titleHintNorm) {
    const titleLower = (record.title || record.name || '').toLowerCase()
    const hint = search.titleHintNorm.toLowerCase()
    if (titleLower.includes(hint) || hint.includes(titleLower)) {
      score += 20
    } else {
      // Partial word overlap
      const hintWords = hint.split(/\s+/)
      const titleWords = titleLower.split(/\s+/)
      const overlap = hintWords.filter(w => titleWords.some(tw => tw.includes(w) || w.includes(tw)))
      if (overlap.length > 0) {
        score += Math.round(20 * (overlap.length / hintWords.length))
      }
    }
  }

  // Activity match (10 pts)
  if (search.activityHint) {
    const category = (record.category || '').toLowerCase()
    const activity = search.activityHint.toLowerCase()
    if (category.includes(activity) || activity.includes(category)) {
      score += 10
    }
  }

  return score
}

// ═══════════════════════════════════════════════════════════════
// QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Find events matching search criteria.
 * @param {string} familyId
 * @param {Object} search - { personId, dateNorm, activityHint, titleHintNorm }
 * @returns {Promise<Array<{record: Object, score: number}>>}
 */
export async function findEvents(familyId, search) {
  // Use single-field index + in-memory filter (no compound index in schema)
  const records = await db.events
    .where('family_id').equals(familyId)
    .filter(r => !r._deleted && (!search.dateNorm || r.date === search.dateNorm))
    .toArray()

  // Score and rank
  return records
    .map(record => ({ record, score: scoreCandidate(record, search) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

/**
 * Find tasks matching search criteria.
 * @param {string} familyId
 * @param {Object} search - { assignedTo, dueDate, titleHintNorm }
 * @returns {Promise<Array<{record: Object, score: number}>>}
 */
export async function findTasks(familyId, search) {
  // Remap search fields for task schema
  const taskSearch = {
    ...search,
    personId: search.assignedTo || search.personId,
    dateNorm: search.dueDate || search.dateNorm,
  }

  // Use single-field index + in-memory filter (no compound index in schema)
  const records = await db.tasks
    .where('family_id').equals(familyId)
    .filter(r => !r._deleted && r.status !== 'done' && (!taskSearch.dateNorm || r.due_date === taskSearch.dateNorm))
    .toArray()

  return records
    .map(record => ({ record, score: scoreCandidate(record, taskSearch) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

/**
 * Find shopping items matching search criteria.
 * @param {string} familyId
 * @param {Object} search - { nameHint }
 * @returns {Promise<Array<{record: Object, score: number}>>}
 */
export async function findShoppingItems(familyId, search) {
  const records = await db.shoppingItems
    .where('family_id').equals(familyId)
    .filter(r => !r._deleted && !r.checked)
    .toArray()

  const titleSearch = { titleHintNorm: search.nameHint || search.titleHintNorm }

  return records
    .map(record => ({ record, score: scoreCandidate(record, titleSearch) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

// ═══════════════════════════════════════════════════════════════
// PERSON RESOLVER (implicit subjects)
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve a person name hint to a member.
 * Handles exact name, alias, implicit references, partial match.
 *
 * @param {string} familyId - unused (members already passed)
 * @param {string} nameHint
 * @param {Array} members - family members with role, gender, aliases
 * @returns {{ candidates: Array, best: Object|null, confidence: number, ambiguous: boolean }}
 */
export function resolvePerson(familyId, nameHint, members) {
  if (!nameHint || !members?.length) {
    return { candidates: [], best: null, confidence: 0, ambiguous: false }
  }

  const lower = nameHint.toLowerCase().trim()

  // Exact name match
  const exact = members.find(m => m.name.toLowerCase() === lower)
  if (exact) return { candidates: [exact], best: exact, confidence: 1.0, ambiguous: false }

  // Alias match
  for (const m of members) {
    if (m.aliases?.some(a => a.toLowerCase() === lower)) {
      return { candidates: [m], best: m, confidence: 0.95, ambiguous: false }
    }
  }

  // Implicit role-based match
  const implicitResult = resolveImplicitPersonLocal(lower, members)
  if (implicitResult.length === 1) {
    return { candidates: implicitResult, best: implicitResult[0], confidence: 0.85, ambiguous: false }
  }
  if (implicitResult.length > 1) {
    return { candidates: implicitResult, best: implicitResult[0], confidence: 0.5, ambiguous: true }
  }

  // Partial match
  const partial = members.find(m =>
    m.name.toLowerCase().startsWith(lower) || lower.startsWith(m.name.toLowerCase())
  )
  if (partial) return { candidates: [partial], best: partial, confidence: 0.7, ambiguous: false }

  return { candidates: [], best: null, confidence: 0, ambiguous: false }
}

/**
 * Internal implicit person resolver.
 * NOTE: entityExtractor.js will also export a resolveImplicitPerson.
 * This is the dbResolver's own version — used before entityExtractor is updated.
 * After Task 7, this can be replaced with import from entityExtractor.
 */
function resolveImplicitPersonLocal(lower, members) {
  const isFemale = (m) => m.gender === 'F' || /a$/i.test(m.name)
  const isMale = (m) => m.gender === 'M' || !isFemale(m)

  if (lower === 'nonna' || lower === 'dalla nonna') {
    return members.filter(m =>
      (m.role === 'nonno' || m.role === 'nonna' || m.role === 'elder') && isFemale(m)
    )
  }
  if (lower === 'nonno' || lower === 'dal nonno') {
    return members.filter(m =>
      (m.role === 'nonno' || m.role === 'nonna' || m.role === 'elder') && isMale(m)
    )
  }
  if (lower === 'mamma' || lower === 'dalla mamma') {
    return members.filter(m =>
      (m.role === 'genitore' || m.role === 'parent') && isFemale(m)
    )
  }
  if (lower === 'papà' || lower === 'papa' || lower === 'dal papà' || lower === 'dal papa') {
    return members.filter(m =>
      (m.role === 'genitore' || m.role === 'parent') && isMale(m)
    )
  }

  return []
}

// ═══════════════════════════════════════════════════════════════
// MAIN RESOLVER ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve an edit_action by querying the DB for matching records.
 *
 * @param {string} familyId
 * @param {Object} editAction - action with type='edit_action', verb, targetType, search, patch
 * @param {Array} members - family members
 * @returns {Promise<Object>} - editAction with resolved{} populated
 */
export async function resolveEditAction(familyId, editAction, members) {
  const search = { ...(editAction.search || {}) }

  // Resolve person if nameHint present
  if (search.personNameRaw && !search.personId) {
    const personResult = resolvePerson(familyId, search.personNameRaw, members)
    if (personResult.best) {
      search.personId = personResult.best.id
    }
  }

  // Determine search domains — when unknown, search ALL unconditionally
  const targetType = editAction.targetType || 'unknown'
  let candidates = []
  let searchDomains = []

  if (targetType === 'calendar' || targetType === 'unknown') {
    searchDomains.push('events')
    const eventResults = await findEvents(familyId, search)
    candidates.push(...eventResults.map(r => ({ ...r, domain: 'events' })))
  }

  if (targetType === 'task' || targetType === 'unknown') {
    searchDomains.push('tasks')
    const taskResults = await findTasks(familyId, search)
    candidates.push(...taskResults.map(r => ({ ...r, domain: 'tasks' })))
  }

  if (targetType === 'shopping' || targetType === 'unknown') {
    searchDomains.push('shopping')
    const shoppingResults = await findShoppingItems(familyId, search)
    candidates.push(...shoppingResults.map(r => ({ ...r, domain: 'shopping' })))
  }

  // Sort all candidates by score
  candidates.sort((a, b) => b.score - a.score)
  const topCandidates = candidates.slice(0, 5)

  // Determine resolution status
  let status, matchedRecord, resolutionSource

  if (topCandidates.length === 0) {
    status = 'not_found'
    matchedRecord = null
    resolutionSource = 'not_found'
  } else if (topCandidates.length === 1) {
    status = 'resolved'
    matchedRecord = topCandidates[0].record
    resolutionSource = 'single_match'
  } else {
    // Check if top candidate is clearly best (>20pt gap)
    const gap = topCandidates[0].score - topCandidates[1].score
    if (gap >= 20) {
      status = 'resolved'
      matchedRecord = topCandidates[0].record
      resolutionSource = 'single_match'
    } else {
      status = 'ambiguous'
      matchedRecord = null
      resolutionSource = 'ambiguous'
    }
  }

  const resolved = {
    status,
    candidates: topCandidates.map(c => c.record),
    matchedRecord,
    selectedRecord: null,
    requiresConfirmation: true,
    resolutionConfidence: topCandidates.length > 0 ? topCandidates[0].score / 100 : 0,
    resolutionSource,
    resolverTrace: {
      searchDomains,
      query: search,
      candidatesFound: topCandidates.length,
      selectedId: matchedRecord?.id || null,
      reason: status === 'resolved' ? 'single_match' : status,
    },
  }

  return { ...editAction, resolved }
}
