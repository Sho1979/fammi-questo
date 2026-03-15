/**
 * actionContract.js — Contratto canonico delle azioni del Cervellone.
 *
 * REGOLE FONDAMENTALI:
 *   1. Nessuna azione entra in preview se non e' canonical + validata.
 *   2. Nessun executor risolve nomi, alias o shape ambigue.
 *   3. Ogni azione ha tutti i campi previsti, con null esplicito dove opzionale.
 *   4. Le azioni nate dalla stessa utterance condividono meta.utteranceRef.
 *   5. Ogni collegamento cross-action usa tempRef prima del persist, realId dopo.
 *
 * FLUSSO:
 *   detectIntent() -> extractEntities() -> buildRawActions()
 *   -> normalizeActions() -> validateActions()
 *   -> previewActions() -> confirmActions() -> persistActions()
 */

// ═══════════════════════════════════════════════════════════════
// ENUM TIPI
// ═══════════════════════════════════════════════════════════════

/** @type {readonly string[]} */
export const ACTION_TYPES = Object.freeze([
  'calendar', 'task', 'expense', 'meal', 'shopping', 'reminder', 'note',
])

/** @type {readonly string[]} */
export const ACTION_SOURCES = Object.freeze([
  'L0', 'L1', 'L2', 'L3', 'memory',
])

/** @type {readonly string[]} */
export const LOGISTICS_VERBS = Object.freeze([
  'portare', 'prendere', 'riprendere', 'ritirare',
])

/** @type {readonly string[]} */
export const MEAL_SLOTS = Object.freeze([
  'breakfast', 'lunch', 'dinner',
])

// ═══════════════════════════════════════════════════════════════
// SHAPE CANONICHE — JSDoc typedef
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ActionMeta
 * @property {string} utteranceRef - ID univoco per tutte le azioni della stessa utterance (es. "u_20260312_x8f29")
 * @property {string} actionRef - ID univoco per questa azione nella stessa utterance (es. "a_0", "a_1")
 * @property {string} pipelinePath - percorso decisionale che ha prodotto l'azione (es. "l0_expense", "l1+l2_combined")
 * @property {string|null} draftId - se l'azione viene da conversation memory
 * @property {boolean} usedAI - true se L3 ha prodotto/validato questa azione
 */

/**
 * @typedef {Object} ActionBase
 * @property {'calendar'|'task'|'expense'|'meal'|'shopping'|'reminder'|'note'} type
 * @property {'L0'|'L1'|'L2'|'L3'|'memory'} source
 * @property {number} confidence - 0.0 a 1.0
 * @property {string} textOriginal - frase originale che ha generato questa azione
 * @property {string} familyId
 * @property {string|null} createdBy - ID del membro che ha dettato
 * @property {boolean} needsConfirm - true se serve conferma esplicita dell'utente
 * @property {string|null} incomplete - descrizione di cosa manca (es. "Manca l'orario")
 * @property {string[]} warnings - warning non bloccanti
 * @property {ActionMeta} meta
 */

/**
 * @typedef {Object} LogisticsShape
 * @property {string|null} subjectId - chi viene portato/preso (member ID)
 * @property {string|null} subjectName - nome per display
 * @property {string|null} accompaniedById - chi accompagna / drop-off (member ID)
 * @property {string|null} accompaniedByName - nome per display
 * @property {string|null} pickupById - chi riprende / pickup (member ID)
 * @property {string|null} pickupByName - nome per display
 * @property {'portare'|'prendere'|'riprendere'|'ritirare'|null} actionVerb
 * @property {boolean} needsDriver - true se manca chi accompagna/riprende
 */

/**
 * @typedef {Object} LinkedEntity
 * @property {'calendar'|'expense'|'shopping'|'meal'} entityType
 * @property {string|null} tempRef - riferimento pre-persist (es. "a_0")
 * @property {string|null} realId - ID reale post-persist
 */

/**
 * @typedef {ActionBase & {
 *   type: 'calendar',
 *   title: string,
 *   date: string,
 *   timeStart: string|null,
 *   timeEnd: string|null,
 *   personIds: string[],
 *   personNames: string[],
 *   location: string|null,
 *   activity: string|null,
 *   category: string|null,
 *   isAbsence: boolean,
 *   logistics: LogisticsShape|null
 * }} CalendarAction
 */

/**
 * @typedef {ActionBase & {
 *   type: 'task',
 *   title: string,
 *   dueDate: string|null,
 *   assignedToId: string|null,
 *   assignedToName: string|null,
 *   category: string|null,
 *   linkedEntity: LinkedEntity|null
 * }} TaskAction
 */

/**
 * @typedef {ActionBase & {
 *   type: 'expense',
 *   title: string,
 *   amount: number,
 *   category: string|null,
 *   date: string,
 *   personId: string|null,
 *   personName: string|null
 * }} ExpenseAction
 */

/**
 * @typedef {ActionBase & {
 *   type: 'meal',
 *   title: string,
 *   date: string,
 *   slot: 'breakfast'|'lunch'|'dinner'|null
 * }} MealAction
 */

/**
 * @typedef {ActionBase & {
 *   type: 'shopping',
 *   title: string,
 *   quantity: number|null,
 *   unit: string|null,
 *   category: string|null
 * }} ShoppingAction
 */

/**
 * @typedef {ActionBase & {
 *   type: 'reminder',
 *   title: string,
 *   date: string|null,
 *   timeStart: string|null,
 *   assignedToId: string|null,
 *   assignedToName: string|null,
 *   fromPersonName: string|null
 * }} ReminderAction
 */

/**
 * @typedef {ActionBase & {
 *   type: 'note',
 *   title: string,
 *   text: string
 * }} NoteAction
 */

/**
 * @typedef {CalendarAction|TaskAction|ExpenseAction|MealAction|ShoppingAction|ReminderAction|NoteAction} CanonicalAction
 */

// ═══════════════════════════════════════════════════════════════
// HELPER: costruzione base con null espliciti
// ═══════════════════════════════════════════════════════════════

/**
 * Genera un utteranceRef univoco.
 * Formato: u_YYYYMMDD_RANDOM
 */
export function generateUtteranceRef() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const r = Math.random().toString(36).slice(2, 8)
  return `u_${d}_${r}`
}

/**
 * Genera un actionRef sequenziale.
 * @param {number} index
 */
export function generateActionRef(index) {
  return `a_${index}`
}

/**
 * Crea l'envelope base con tutti i campi null espliciti.
 * Il caller sovrascrive poi i campi specifici.
 *
 * @param {'calendar'|'task'|'expense'|'meal'|'shopping'|'reminder'|'note'} type
 * @param {Object} context - { familyId, currentMemberId, utteranceRef, source }
 * @param {number} actionIndex
 * @returns {ActionBase}
 */
export function createActionBase(type, context, actionIndex = 0) {
  return {
    type,
    source: context.source || 'L0',
    confidence: 0,
    textOriginal: '',
    familyId: context.familyId || '',
    createdBy: context.currentMemberId || null,
    needsConfirm: false,
    incomplete: null,
    warnings: [],
    meta: {
      utteranceRef: context.utteranceRef || generateUtteranceRef(),
      actionRef: generateActionRef(actionIndex),
      pipelinePath: '',
      draftId: null,
      usedAI: false,
    },
  }
}

/**
 * Crea una CalendarAction con tutti i campi a null.
 * @param {Object} context
 * @param {number} actionIndex
 * @returns {CalendarAction}
 */
export function createCalendarAction(context, actionIndex) {
  return {
    ...createActionBase('calendar', context, actionIndex),
    title: '',
    date: '',
    timeStart: null,
    timeEnd: null,
    personIds: [],
    personNames: [],
    location: null,
    activity: null,
    category: null,
    isAbsence: false,
    logistics: null,
  }
}

/**
 * Crea una TaskAction con tutti i campi a null.
 */
export function createTaskAction(context, actionIndex) {
  return {
    ...createActionBase('task', context, actionIndex),
    title: '',
    dueDate: null,
    assignedToId: null,
    assignedToName: null,
    category: null,
    linkedEntity: null,
  }
}

/**
 * Crea una ExpenseAction con tutti i campi a null.
 */
export function createExpenseAction(context, actionIndex) {
  return {
    ...createActionBase('expense', context, actionIndex),
    title: '',
    amount: 0,
    category: null,
    date: '',
    personId: null,
    personName: null,
  }
}

/**
 * Crea una MealAction con tutti i campi a null.
 */
export function createMealAction(context, actionIndex) {
  return {
    ...createActionBase('meal', context, actionIndex),
    title: '',
    date: '',
    slot: null,
  }
}

/**
 * Crea una ShoppingAction con tutti i campi a null.
 */
export function createShoppingAction(context, actionIndex) {
  return {
    ...createActionBase('shopping', context, actionIndex),
    title: '',
    quantity: null,
    unit: null,
    category: null,
  }
}

/**
 * Crea una ReminderAction con tutti i campi a null.
 */
export function createReminderAction(context, actionIndex) {
  return {
    ...createActionBase('reminder', context, actionIndex),
    title: '',
    date: null,
    timeStart: null,
    assignedToId: null,
    assignedToName: null,
    fromPersonName: null,
  }
}

/**
 * Crea una NoteAction con tutti i campi a null.
 */
export function createNoteAction(context, actionIndex) {
  return {
    ...createActionBase('note', context, actionIndex),
    title: '',
    text: '',
  }
}

/**
 * Crea la shape logistica con tutti i campi null.
 * @returns {LogisticsShape}
 */
export function createLogisticsShape() {
  return {
    subjectId: null,
    subjectName: null,
    accompaniedById: null,
    accompaniedByName: null,
    pickupById: null,
    pickupByName: null,
    actionVerb: null,
    needsDriver: false,
  }
}

/**
 * Crea un linkedEntity con tutti i campi null.
 * @param {'calendar'|'expense'|'shopping'|'meal'} entityType
 * @param {string|null} tempRef
 * @returns {LinkedEntity}
 */
export function createLinkedEntity(entityType, tempRef = null) {
  return {
    entityType,
    tempRef,
    realId: null,
  }
}
