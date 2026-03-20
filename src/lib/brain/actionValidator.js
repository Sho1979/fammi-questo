/**
 * actionValidator.js — Validazione runtime delle azioni canoniche.
 *
 * Validazione semplice, non elegante. Ogni azione deve passare qui
 * PRIMA di entrare in preview. Se non passa, viene scartata o marcata.
 *
 * @param {import('./actionContract.js').CanonicalAction} action
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */

import { ACTION_TYPES, ACTION_SOURCES, LOGISTICS_VERBS, MEAL_SLOTS } from './actionContract.js'

// ═══════════════════════════════════════════════════════════════
// VALIDATORE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

/**
 * Valida una singola azione canonica.
 *
 * Errors = bloccanti (azione invalida, non entra in preview)
 * Warnings = non bloccanti (azione valida ma con problemi)
 *
 * @param {import('./actionContract.js').CanonicalAction} action
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateAction(action) {
  const errors = []
  const warnings = []

  // ─── Base envelope ───
  if (!action || typeof action !== 'object') {
    return { ok: false, errors: ['action is null or not an object'], warnings: [] }
  }

  if (!ACTION_TYPES.includes(action.type)) {
    errors.push(`invalid type: "${action.type}"`)
  }

  if (!ACTION_SOURCES.includes(action.source)) {
    errors.push(`invalid source: "${action.source}"`)
  }

  if (typeof action.confidence !== 'number' || action.confidence < 0 || action.confidence > 1) {
    errors.push(`confidence must be number 0-1, got: ${action.confidence}`)
  }

  if (typeof action.textOriginal !== 'string') {
    errors.push('textOriginal must be string')
  }

  if (!action.familyId || typeof action.familyId !== 'string') {
    errors.push('familyId is required')
  }

  // createdBy: nullable ma se presente deve essere string
  if (action.createdBy !== null && typeof action.createdBy !== 'string') {
    errors.push('createdBy must be string or null')
  }

  if (typeof action.needsConfirm !== 'boolean') {
    errors.push('needsConfirm must be boolean')
  }

  // incomplete: null o string
  if (action.incomplete !== null && typeof action.incomplete !== 'string') {
    errors.push('incomplete must be string or null')
  }

  // warnings: array of string
  if (!Array.isArray(action.warnings)) {
    errors.push('warnings must be array')
  }

  // meta
  if (!action.meta || typeof action.meta !== 'object') {
    errors.push('meta is required')
  } else {
    if (!action.meta.utteranceRef) errors.push('meta.utteranceRef is required')
    if (!action.meta.actionRef) errors.push('meta.actionRef is required')
    if (typeof action.meta.pipelinePath !== 'string') errors.push('meta.pipelinePath must be string')
    if (typeof action.meta.usedAI !== 'boolean') errors.push('meta.usedAI must be boolean')
  }

  // ─── Type-specific ───
  if (errors.length === 0) {
    switch (action.type) {
      case 'calendar':
        validateCalendar(action, errors, warnings)
        break
      case 'task':
        validateTask(action, errors, warnings)
        break
      case 'expense':
        validateExpense(action, errors, warnings)
        break
      case 'meal':
        validateMeal(action, errors, warnings)
        break
      case 'shopping':
        validateShopping(action, errors, warnings)
        break
      case 'reminder':
        validateReminder(action, errors, warnings)
        break
      case 'note':
        validateNote(action, errors, warnings)
        break
      case 'edit_action':
        validateEditAction(action, errors, warnings)
        break
    }
  }

  // ─── Campi sinonimi legacy vietati ───
  checkForbiddenFields(action, errors)

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * Valida un array di azioni canoniche.
 *
 * @param {import('./actionContract.js').CanonicalAction[]} actions
 * @returns {{ valid: import('./actionContract.js').CanonicalAction[], invalid: Array<{action: object, errors: string[]}>, allWarnings: string[] }}
 */
export function validateActions(actions) {
  const valid = []
  const invalid = []
  const allWarnings = []

  for (const action of actions) {
    const result = validateAction(action)
    if (result.ok) {
      // Aggiungi warnings dell'azione stessa
      if (result.warnings.length > 0) {
        action.warnings = [...(action.warnings || []), ...result.warnings]
        allWarnings.push(...result.warnings)
      }
      valid.push(action)
    } else {
      invalid.push({ action, errors: result.errors })
      console.warn('[ActionValidator] Azione scartata:', result.errors, action)
    }
  }

  return { valid, invalid, allWarnings }
}

// ═══════════════════════════════════════════════════════════════
// VALIDATORI PER TIPO
// ═══════════════════════════════════════════════════════════════

function validateCalendar(a, errors, warnings) {
  if (!a.title || typeof a.title !== 'string' || a.title.length < 2) {
    errors.push('calendar: title is required (min 2 chars)')
  }

  if (!a.date || typeof a.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) {
    // C1: date-less calendar actions are allowed through to the commit evaluator.
    // They get a warning (not error) so the evaluator can route them to draft_only.
    // Expense and meal date requirements remain hard errors in their own validators.
    warnings.push('calendar: date missing (will be evaluated by commit policy)')
  }

  // timeStart: null o HH:MM
  if (a.timeStart !== null) {
    if (typeof a.timeStart !== 'string' || !/^\d{2}:\d{2}$/.test(a.timeStart)) {
      errors.push('calendar: timeStart must be null or HH:MM')
    }
  } else {
    warnings.push('calendar: timeStart is null (manca orario)')
  }

  // timeEnd: null o HH:MM
  if (a.timeEnd !== null && (typeof a.timeEnd !== 'string' || !/^\d{2}:\d{2}$/.test(a.timeEnd))) {
    errors.push('calendar: timeEnd must be null or HH:MM')
  }

  // personIds: sempre array
  if (!Array.isArray(a.personIds)) {
    errors.push('calendar: personIds must be array')
  }

  if (!Array.isArray(a.personNames)) {
    errors.push('calendar: personNames must be array')
  }

  // personIds e personNames devono avere stessa lunghezza
  if (Array.isArray(a.personIds) && Array.isArray(a.personNames) && a.personIds.length !== a.personNames.length) {
    errors.push('calendar: personIds and personNames must have same length')
  }

  // location: null o string
  if (a.location !== null && typeof a.location !== 'string') {
    errors.push('calendar: location must be string or null')
  }

  // activity: null o string
  if (a.activity !== null && typeof a.activity !== 'string') {
    errors.push('calendar: activity must be string or null')
  }

  // isAbsence: boolean
  if (typeof a.isAbsence !== 'boolean') {
    errors.push('calendar: isAbsence must be boolean')
  }

  // category: null o string
  if (a.category !== null && typeof a.category !== 'string') {
    errors.push('calendar: category must be string or null')
  }

  // logistics: null o shape completa
  if (a.logistics !== null) {
    if (typeof a.logistics !== 'object') {
      errors.push('calendar: logistics must be object or null')
    } else {
      validateLogistics(a.logistics, a.personIds, errors, warnings)
    }
  }
}

function validateLogistics(l, personIds, errors, warnings) {
  // subjectId: se presente, deve stare in personIds
  if (l.subjectId !== null) {
    if (typeof l.subjectId !== 'string') {
      errors.push('logistics: subjectId must be string or null')
    } else if (Array.isArray(personIds) && !personIds.includes(l.subjectId)) {
      warnings.push('logistics: subjectId not in personIds')
    }
  }

  // accompaniedById
  if (l.accompaniedById !== null && typeof l.accompaniedById !== 'string') {
    errors.push('logistics: accompaniedById must be string or null')
  }

  // pickupById
  if (l.pickupById !== null && typeof l.pickupById !== 'string') {
    errors.push('logistics: pickupById must be string or null')
  }

  // actionVerb
  if (l.actionVerb !== null && !LOGISTICS_VERBS.includes(l.actionVerb)) {
    errors.push(`logistics: actionVerb must be null or one of ${LOGISTICS_VERBS.join(',')}`)
  }

  // needsDriver
  if (typeof l.needsDriver !== 'boolean') {
    errors.push('logistics: needsDriver must be boolean')
  }

  // Se needsDriver=false ma non c'e' accompaniedById ne' pickupById, e' un warning
  if (!l.needsDriver && l.accompaniedById === null && l.pickupById === null && l.actionVerb !== null) {
    warnings.push('logistics: has actionVerb but no driver assigned')
  }
}

function validateTask(a, errors, warnings) {
  if (!a.title || typeof a.title !== 'string' || a.title.length < 2) {
    errors.push('task: title is required (min 2 chars)')
  }

  // dueDate: null o YYYY-MM-DD
  if (a.dueDate !== null && (typeof a.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.dueDate))) {
    errors.push('task: dueDate must be null or YYYY-MM-DD')
  }

  // assignedToId: null o string
  if (a.assignedToId !== null && typeof a.assignedToId !== 'string') {
    errors.push('task: assignedToId must be string or null')
  }

  // assignedToName: null o string
  if (a.assignedToName !== null && typeof a.assignedToName !== 'string') {
    errors.push('task: assignedToName must be string or null')
  }

  // linkedEntity: null o shape
  if (a.linkedEntity !== null) {
    if (typeof a.linkedEntity !== 'object') {
      errors.push('task: linkedEntity must be object or null')
    } else {
      if (!['calendar', 'expense', 'shopping', 'meal'].includes(a.linkedEntity.entityType)) {
        errors.push('task: linkedEntity.entityType invalid')
      }
    }
  }

  if (a.assignedToId === null) {
    warnings.push('task: no assignee')
  }
}

function validateExpense(a, errors, warnings) {
  if (!a.title || typeof a.title !== 'string') {
    errors.push('expense: title is required')
  }

  if (typeof a.amount !== 'number' || a.amount <= 0) {
    errors.push('expense: amount must be number > 0')
  }

  if (!a.date || typeof a.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) {
    errors.push('expense: date is required (YYYY-MM-DD)')
  }

  if (a.personId !== null && typeof a.personId !== 'string') {
    errors.push('expense: personId must be string or null')
  }

  if (a.personName !== null && typeof a.personName !== 'string') {
    errors.push('expense: personName must be string or null')
  }
}

function validateMeal(a, errors, warnings) {
  if (!a.title || typeof a.title !== 'string') {
    errors.push('meal: title is required')
  }

  if (!a.date || typeof a.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) {
    errors.push('meal: date is required (YYYY-MM-DD)')
  }

  if (a.slot !== null && !MEAL_SLOTS.includes(a.slot)) {
    errors.push(`meal: slot must be null or one of ${MEAL_SLOTS.join(',')}`)
  }
}

function validateShopping(a, errors, warnings) {
  if (!a.title || typeof a.title !== 'string') {
    errors.push('shopping: title is required')
  }

  if (a.quantity !== null && (typeof a.quantity !== 'number' || a.quantity <= 0)) {
    errors.push('shopping: quantity must be null or number > 0')
  }
}

function validateReminder(a, errors, warnings) {
  if (!a.title || typeof a.title !== 'string') {
    errors.push('reminder: title is required')
  }

  if (a.date !== null && (typeof a.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.date))) {
    errors.push('reminder: date must be null or YYYY-MM-DD')
  }

  if (a.timeStart !== null && (typeof a.timeStart !== 'string' || !/^\d{2}:\d{2}$/.test(a.timeStart))) {
    errors.push('reminder: timeStart must be null or HH:MM')
  }
}

function validateNote(a, errors, warnings) {
  if (typeof a.text !== 'string') {
    errors.push('note: text must be string')
  }
}

function validateEditAction(a, errors, warnings) {
  if (!['delete', 'edit', 'move', 'correct'].includes(a.verb)) {
    errors.push(`edit_action: verb non valido "${a.verb}"`)
  }
  if (!a.search || typeof a.search !== 'object') {
    errors.push('edit_action: search mancante')
  }
}

// ═══════════════════════════════════════════════════════════════
// CAMPI LEGACY VIETATI
// ═══════════════════════════════════════════════════════════════

/** Campi che NON devono mai comparire nell'azione canonica */
const FORBIDDEN_FIELDS = [
  'person',       // usa personId / personIds
  'persons',      // usa personIds
  'assignedTo',   // usa assignedToId (task) o personIds (calendar)
  'driver',       // usa logistics.accompaniedById / pickupById
  'accompaniedBy', // usa logistics.accompaniedById
  'pickupBy',     // usa logistics.pickupById
  'dropBy',       // usa logistics.accompaniedById
  'name',         // usa title
  'time',         // usa timeStart
  'startTime',    // usa timeStart
  'endTime',      // usa timeEnd
  'time_start',   // usa timeStart
  'time_end',     // usa timeEnd
  'startDate',    // usa date
  'due_date',     // usa dueDate (task) o date (calendar)
  'slot',         // ok per meal, vietato altrove — handled separately
]

function checkForbiddenFields(action, errors) {
  for (const field of FORBIDDEN_FIELDS) {
    // 'slot' e' permesso per meal
    if (field === 'slot' && action.type === 'meal') continue
    if (field in action) {
      errors.push(`forbidden legacy field "${field}" found — use canonical name`)
    }
  }
}
