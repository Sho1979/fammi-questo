/**
 * actionNormalizer.js — Normalizza raw actions in shape canoniche.
 *
 * Questo e' il muro portante del sistema. Tutti i rami della pipeline
 * (L0, L1+L2, L3, conversation memory) devono passare da qui
 * prima che le azioni entrino in preview.
 *
 * Responsabilita':
 *   - nome/alias -> memberId
 *   - person/persons/assignedTo/driver/pickupBy -> campi canonici
 *   - undefined/assente -> null
 *   - utteranceRef, actionRef
 *   - source, pipelinePath, createdBy
 *   - normalizzazione logistica -> logistics.{subjectId, accompaniedById, pickupById, ...}
 *
 * NON e' una funzione pura: riceve un context con i members per risolvere nomi->ID.
 */

import {
  generateUtteranceRef, generateActionRef, createActionBase,
  createCalendarAction, createTaskAction, createExpenseAction,
  createMealAction, createShoppingAction, createReminderAction,
  createNoteAction, createLogisticsShape, createLinkedEntity,
} from './actionContract.js'
import { validateActions } from './actionValidator.js'

// ═══════════════════════════════════════════════════════════════
// PUNTO DI INGRESSO UNICO
// ═══════════════════════════════════════════════════════════════

/**
 * Normalizza e valida un array di raw actions.
 *
 * @param {Object[]} rawActions - azioni prodotte dal parser (shape legacy)
 * @param {Object} context
 * @param {string} context.familyId
 * @param {string|null} context.currentMemberId
 * @param {Array<{id: string, name: string, role: string, aliases?: string[], gender?: string}>} context.members
 * @param {string} [context.utteranceRef] - se gia' generato (es. da memory)
 * @param {string} [context.source] - 'L0'|'L1'|'L2'|'L3'|'memory'
 * @param {string} [context.textOriginal] - testo originale dell'intera utterance
 *
 * @returns {{
 *   actions: import('./actionContract.js').CanonicalAction[],
 *   invalid: Array<{action: object, errors: string[]}>,
 *   warnings: string[]
 * }}
 */
export function normalizeAndValidateActions(rawActions, context) {
  if (!rawActions || rawActions.length === 0) {
    return { actions: [], invalid: [], warnings: [] }
  }

  const uRef = context.utteranceRef || generateUtteranceRef()
  const enrichedContext = { ...context, utteranceRef: uRef }

  // 1. Normalizza ogni azione
  const normalized = []
  for (let i = 0; i < rawActions.length; i++) {
    try {
      const canonical = normalizeAction(rawActions[i], enrichedContext, i)
      normalized.push(canonical)
    } catch (err) {
      console.warn('[ActionNormalizer] Errore normalizzazione azione:', err, rawActions[i])
      // Azione non normalizzabile → scartata
    }
  }

  // 2. Risolvi linkedEntity tempRef tra azioni della stessa utterance
  resolveLinkedEntities(normalized)

  // 3. Valida
  const { valid, invalid, allWarnings } = validateActions(normalized)

  return { actions: valid, invalid, warnings: allWarnings }
}

// ═══════════════════════════════════════════════════════════════
// NORMALIZZATORE SINGOLA AZIONE
// ═══════════════════════════════════════════════════════════════

/**
 * Normalizza una singola raw action in forma canonica.
 *
 * @param {Object} raw - azione legacy dal parser
 * @param {Object} ctx - context arricchito
 * @param {number} index - indice nell'array di azioni
 * @returns {import('./actionContract.js').CanonicalAction}
 */
function normalizeAction(raw, ctx, index) {
  const type = raw.type

  switch (type) {
    case 'calendar': return normalizeCalendar(raw, ctx, index)
    case 'task':     return normalizeTask(raw, ctx, index)
    case 'expense':  return normalizeExpense(raw, ctx, index)
    case 'meal':     return normalizeMeal(raw, ctx, index)
    case 'shopping': return normalizeShopping(raw, ctx, index)
    case 'reminder': return normalizeReminder(raw, ctx, index)
    case 'note':     return normalizeNote(raw, ctx, index)
    case 'edit_action': return normalizeEditAction(raw, ctx, index)
    case 'edit_request': return normalizeEditAction(raw, ctx, index) // legacy fallback
    default:
      // Tipo sconosciuto → converti in note
      console.warn(`[ActionNormalizer] Tipo sconosciuto "${type}", converto in note`)
      return normalizeNote({ ...raw, type: 'note', text: raw.title || raw.text || raw.name || '' }, ctx, index)
  }
}

// ═══════════════════════════════════════════════════════════════
// NORMALIZZATORI PER TIPO
// ═══════════════════════════════════════════════════════════════

function normalizeCalendar(raw, ctx, index) {
  const action = createCalendarAction(ctx, index)

  // ─── Base ───
  fillBase(action, raw, ctx, index)

  // ─── Campi specifici ───
  action.title = raw.title || ''
  action.date = normalizeDate(raw.date || raw.startDate)
  action.timeStart = normalizeTime(raw.time || raw.time_start || raw.timeStart || raw.startTime) || null
  action.timeEnd = normalizeTime(raw.timeEnd || raw.time_end) || null
  action.location = raw.location || null
  action.activity = raw.activity || null
  action.category = raw.category || null
  action.isAbsence = raw.isAbsence === true

  // ─── Persone: risolvi nomi → ID ───
  const personIds = []
  const personNames = []

  // assignedTo (legacy: nome stringa)
  // 'Famiglia' = evento per tutta la famiglia
  if (raw.assignedTo === 'Famiglia' || raw.isFamily) {
    personNames.push('Famiglia')
    action.isFamily = true
  } else if (raw.assignedTo) {
    const resolved = resolveMember(raw.assignedTo, ctx.members)
    if (resolved) {
      personIds.push(resolved.id)
      personNames.push(resolved.name)
    } else {
      // Nome non risolto → tieni come name, ID null
      personNames.push(raw.assignedTo)
      action.warnings.push(`person_not_resolved: ${raw.assignedTo}`)
    }
  }

  action.personIds = personIds
  action.personNames = personNames

  // ─── Logistica ───
  action.logistics = normalizeLogistics(raw, ctx)

  // Se la logistica ha un subject non in personIds, aggiungilo
  if (action.logistics && action.logistics.subjectId) {
    if (!action.personIds.includes(action.logistics.subjectId)) {
      action.personIds.push(action.logistics.subjectId)
      action.personNames.push(action.logistics.subjectName || '')
    }
  }

  // ─── Incomplete ───
  if (!action.timeStart && !action.isAbsence) {
    action.incomplete = 'Manca l\'orario'
  } else {
    action.incomplete = raw.incomplete || null
  }

  // Soft warning: orario di fine mancante (non bloccante)
  if (action.timeStart && !action.timeEnd && !action.isAbsence) {
    action.warnings.push("Manca l'orario di fine")
  }
  // -- Logistica mancante per eventi di minori --
  const NEEDS_LOGISTICS_CATEGORIES = ['sport', 'scuola', 'medico']
  const childIds = (ctx.members || []).filter(m => m.role === 'child').map(m => m.id)
  const isChildEvent = action.personIds?.some(id => childIds.includes(id))
  const needsLogisticsCategory = NEEDS_LOGISTICS_CATEGORIES.includes(action.category)
  const hasLogistics = action.logistics && (action.logistics.accompaniedById || action.logistics.pickupById)

  if (isChildEvent && needsLogisticsCategory && !hasLogistics && !action.isAbsence) {
    if (!action.incomplete) {
      action.incomplete = 'Chi porta/riprende? Da definire'
    }
    action.needsPickup = true
  }

  return action
}

function normalizeTask(raw, ctx, index) {
  const action = createTaskAction(ctx, index)
  fillBase(action, raw, ctx, index)

  action.title = raw.title || ''
  action.dueDate = normalizeDate(raw.date || raw.due_date || raw.dueDate) || null
  action.category = raw.category || null

  // assignedTo → assignedToId
  if (raw.assignedTo) {
    const resolved = resolveMember(raw.assignedTo, ctx.members)
    if (resolved) {
      action.assignedToId = resolved.id
      action.assignedToName = resolved.name
    } else {
      action.assignedToName = raw.assignedTo
      action.warnings.push(`person_not_resolved: ${raw.assignedTo}`)
    }
  } else if (raw.assignedToId) {
    // Gia' un ID (es. da reminder)
    action.assignedToId = raw.assignedToId
    const member = ctx.members.find(m => m.id === raw.assignedToId)
    action.assignedToName = member?.name || raw.assignedTo || null
  }

  // linkedEntity: se il task nasce da logistica, lega al calendar
  // Questo viene impostato da resolveLinkedEntities dopo la normalizzazione
  action.linkedEntity = null

  return action
}

function normalizeExpense(raw, ctx, index) {
  const action = createExpenseAction(ctx, index)
  fillBase(action, raw, ctx, index)

  action.title = raw.note || raw.title || raw.textOriginal || ''
  action.amount = typeof raw.amount === 'number' ? raw.amount : parseFloat(raw.amount) || 0
  action.category = raw.category || null
  action.date = normalizeDateWithDefault(raw.date)

  // person → personId
  if (raw.person) {
    const resolved = resolveMember(raw.person, ctx.members)
    if (resolved) {
      action.personId = resolved.id
      action.personName = resolved.name
    } else {
      action.personName = raw.person
    }
  }

  return action
}

function normalizeMeal(raw, ctx, index) {
  const action = createMealAction(ctx, index)
  fillBase(action, raw, ctx, index)

  action.title = raw.name || raw.title || ''
  action.date = normalizeDateWithDefault(raw.date)

  // Normalizza slot: legacy 'cena'→'dinner', 'pranzo'→'lunch', 'colazione'→'breakfast'
  const slotMap = {
    cena: 'dinner', dinner: 'dinner',
    pranzo: 'lunch', lunch: 'lunch',
    colazione: 'breakfast', breakfast: 'breakfast',
    merenda: 'lunch', // fallback ragionevole
  }
  action.slot = slotMap[raw.slot?.toLowerCase()] || null

  return action
}

function normalizeShopping(raw, ctx, index) {
  const action = createShoppingAction(ctx, index)
  fillBase(action, raw, ctx, index)

  action.title = raw.name || raw.title || ''
  action.quantity = typeof raw.quantity === 'number' && raw.quantity > 0 ? raw.quantity : null
  action.unit = raw.unit || null
  action.category = raw.category || null

  return action
}

function normalizeReminder(raw, ctx, index) {
  const action = createReminderAction(ctx, index)
  fillBase(action, raw, ctx, index)

  action.title = raw.title || ''
  action.date = normalizeDate(raw.date) || null
  action.timeStart = normalizeTime(raw.time || raw.timeStart) || null

  // assignedTo
  if (raw.assignedTo) {
    const resolved = resolveMember(raw.assignedTo, ctx.members)
    if (resolved) {
      action.assignedToId = resolved.id
      action.assignedToName = resolved.name
    } else {
      action.assignedToName = raw.assignedTo
    }
  } else if (raw.assignedToId) {
    action.assignedToId = raw.assignedToId
    const member = ctx.members.find(m => m.id === raw.assignedToId)
    action.assignedToName = member?.name || raw.assignedTo || null
  }

  action.fromPersonName = raw.fromPerson || null
  action.needsConfirm = raw.needsConfirm === true

  return action
}

function normalizeNote(raw, ctx, index) {
  const action = createNoteAction(ctx, index)
  fillBase(action, raw, ctx, index)

  action.title = raw.title || raw.text || ''
  action.text = raw.text || raw.title || ''

  return action
}

function normalizeEditAction(raw, ctx, index) {
  // edit_action is a special pass-through type.
  // It carries search{} and patch{} for the resolver, not DB fields.
  const base = createActionBase('edit_action', ctx, index)

  base.source = ctx.source || raw._source || 'L0'
  base.confidence = typeof raw._confidence === 'number' ? raw._confidence : 0.80
  base.textOriginal = raw._textOriginal || raw.textOriginal || ctx.textOriginal || ''
  base.familyId = ctx.familyId || ''
  base.createdBy = ctx.currentMemberId || null
  base.meta.utteranceRef = ctx.utteranceRef
  base.meta.actionRef = generateActionRef(index)
  base.meta.pipelinePath = raw._pipelinePath || 'l0_edit'

  base.verb = raw.verb || 'edit'
  base.targetType = raw.targetType || 'unknown'
  base.search = raw.search || {}
  base.patch = raw.patch || null
  base.resolved = raw.resolved || null

  return base
}

// ═══════════════════════════════════════════════════════════════
// NORMALIZZAZIONE LOGISTICA
// ═══════════════════════════════════════════════════════════════

/**
 * Estrae e normalizza i campi logistici da una raw calendar action.
 *
 * Legacy fields possibili:
 *   - accompaniedBy (nome stringa)
 *   - pickupBy (nome stringa)
 *   - needsPickup (boolean)
 *   - needsDriver (boolean)
 *   - logistics: { subject (nome/oggetto), actionVerb, driver (oggetto) }
 *
 * @returns {import('./actionContract.js').LogisticsShape|null}
 */
function normalizeLogistics(raw, ctx) {
  const hasLogistics = raw.accompaniedBy || raw.pickupBy || raw.needsPickup ||
    raw.needsDriver || raw.logistics?.subject || raw.logistics?.actionVerb

  if (!hasLogistics) return null

  const l = createLogisticsShape()

  // Subject: dalla logistica inline o da assignedTo
  if (raw.logistics?.subject) {
    const subjectName = typeof raw.logistics.subject === 'string'
      ? raw.logistics.subject
      : raw.logistics.subject?.name || null
    if (subjectName) {
      const resolved = resolveMember(subjectName, ctx.members)
      l.subjectId = resolved?.id || null
      l.subjectName = resolved?.name || subjectName
    }
  }

  // AccompaniedBy (drop-off)
  if (raw.accompaniedBy) {
    const resolved = resolveMember(raw.accompaniedBy, ctx.members)
    l.accompaniedById = resolved?.id || null
    l.accompaniedByName = resolved?.name || raw.accompaniedBy
  }

  // PickupBy
  if (raw.pickupBy) {
    const resolved = resolveMember(raw.pickupBy, ctx.members)
    l.pickupById = resolved?.id || null
    l.pickupByName = resolved?.name || raw.pickupBy
  }

  // ActionVerb
  l.actionVerb = raw.logistics?.actionVerb || null
  // Inferisci da campi legacy se manca
  if (!l.actionVerb) {
    if (raw.accompaniedBy) l.actionVerb = 'portare'
    else if (raw.pickupBy) l.actionVerb = 'prendere'
  }

  // NeedsDriver
  l.needsDriver = raw.needsDriver === true ||
    (l.actionVerb !== null && l.accompaniedById === null && l.pickupById === null)

  return l
}

// ═══════════════════════════════════════════════════════════════
// LINKED ENTITIES (cross-action references)
// ═══════════════════════════════════════════════════════════════

/**
 * Risolvi linkedEntity tra azioni della stessa utterance.
 *
 * Pattern: se c'e' un task generato dalla logistica e un calendar nella stessa utterance,
 * il task deve avere linkedEntity che punta al calendar.
 *
 * @param {import('./actionContract.js').CanonicalAction[]} actions
 */
function resolveLinkedEntities(actions) {
  // Trova il primo calendar (se presente)
  const calendarIdx = actions.findIndex(a => a.type === 'calendar')
  if (calendarIdx < 0) return

  const calendarAction = actions[calendarIdx]

  // Se ci sono task con logistica (titolo contiene "Portare" o "prendere"), lega al calendar
  for (const action of actions) {
    if (action.type === 'task' && !action.linkedEntity) {
      const titleLower = action.title.toLowerCase()
      if (titleLower.includes('portar') || titleLower.includes('prender') ||
          titleLower.includes('accompagn') || titleLower.includes('riprender')) {
        action.linkedEntity = createLinkedEntity('calendar', calendarAction.meta.actionRef)
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Riempi i campi base comuni a tutte le azioni.
 */
function fillBase(action, raw, ctx, index) {
  action.source = ctx.source || raw._source || 'L0'
  action.confidence = typeof raw._confidence === 'number' ? raw._confidence : (ctx.confidence || 0)
  action.textOriginal = raw._textOriginal || raw.textOriginal || ctx.textOriginal || ''
  action.familyId = ctx.familyId || ''
  action.createdBy = ctx.currentMemberId || null
  action.needsConfirm = raw.needsConfirm === true
  action.warnings = [...(action.warnings || []), ...(raw._warnings || [])]

  action.meta.utteranceRef = ctx.utteranceRef
  action.meta.actionRef = generateActionRef(index)
  action.meta.pipelinePath = raw._pipelinePath || ctx.pipelinePath || ''
  action.meta.draftId = raw._draftId || ctx.draftId || null
  action.meta.usedAI = raw._usedAI || ctx.usedAI || false
}

/**
 * Risolvi un nome (o alias) in un membro della famiglia.
 *
 * @param {string} nameOrAlias
 * @param {Array<{id: string, name: string, aliases?: string[]}>} members
 * @returns {{id: string, name: string}|null}
 */
function resolveMember(nameOrAlias, members) {
  if (!nameOrAlias || !members || members.length === 0) return null

  const lower = nameOrAlias.toLowerCase().trim()

  // 1. Match esatto nome
  const exact = members.find(m => m.name.toLowerCase() === lower)
  if (exact) return { id: exact.id, name: exact.name }

  // 2. Match alias
  for (const m of members) {
    if (m.aliases) {
      for (const alias of m.aliases) {
        if (alias.toLowerCase() === lower) {
          return { id: m.id, name: m.name }
        }
      }
    }
  }

  // 3. Match parziale (startsWith)
  const partial = members.find(m => m.name.toLowerCase().startsWith(lower) || lower.startsWith(m.name.toLowerCase()))
  if (partial) return { id: partial.id, name: partial.name }

  return null
}

/**
 * Normalizza una data in formato YYYY-MM-DD.
 * Se non valida o mancante, ritorna null (il commit evaluator deciderà il livello).
 * Per i tipi che richiedono una data di default, usare normalizeDateWithDefault().
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  // Prova a parsare
  try {
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  } catch { /* ignore */ }
  return null
}

/**
 * Normalizza una data, con fallback a oggi se mancante.
 * Usare per tipi che DEVONO avere una data (expense, meal, task).
 */
function normalizeDateWithDefault(dateStr) {
  return normalizeDate(dateStr) || new Date().toISOString().slice(0, 10)
}

/**
 * Normalizza un orario in formato HH:MM.
 * @returns {string|null}
 */
function normalizeTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null
  const m = timeStr.match(/^(\d{1,2})[:.:](\d{2})$/)
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`
  // Solo ore
  const m2 = timeStr.match(/^(\d{1,2})$/)
  if (m2) return `${m2[1].padStart(2, '0')}:00`
  return null
}
