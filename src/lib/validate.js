/**
 * validate.js — Validatori centralizzati per tutti i form dell'app.
 *
 * Ogni funzione ritorna true se il valore è valido, false altrimenti.
 * Le funzioni `validate*` ritornano una stringa di errore o null se valido.
 */

// ═══════════════════════════════════════════════════════════════
// PRIMITIVE VALIDATORS (boolean)
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica che un valore non sia vuoto (stringa non-blank, non null/undefined).
 * @param {*} value
 * @returns {boolean}
 */
export function isNonEmpty(value) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

/**
 * Verifica che un importo sia un numero finito positivo.
 * Accetta stringhe con virgola italiana (es. "12,50").
 * @param {string|number} value
 * @returns {boolean}
 */
export function isValidAmount(value) {
  if (value == null || value === '') return false
  const num = typeof value === 'string'
    ? parseFloat(value.replace(',', '.'))
    : value
  return Number.isFinite(num) && num > 0
}

/**
 * Verifica che una quantità sia un numero finito > 0.
 * Accetta stringhe numeriche.
 * @param {string|number} value
 * @returns {boolean}
 */
export function isValidQuantity(value) {
  if (value == null || value === '') return false
  const num = typeof value === 'string' ? parseFloat(value) : value
  return Number.isFinite(num) && num > 0
}

/**
 * Verifica che una data sia nel formato YYYY-MM-DD e sia una data valida.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidDate(value) {
  if (!value || typeof value !== 'string') return false
  const match = /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (!match) return false
  const d = new Date(value + 'T12:00:00')
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/**
 * Verifica che un orario sia nel formato HH:MM (24h).
 * @param {string} value
 * @returns {boolean}
 */
export function isValidTime(value) {
  if (!value || typeof value !== 'string') return false
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/**
 * Verifica che un numero intero sia positivo (> 0).
 * Utile per bonusPoints, punteggi, ecc.
 * @param {string|number} value
 * @returns {boolean}
 */
export function isPositiveInteger(value) {
  if (value == null || value === '') return false
  const num = typeof value === 'string' ? parseInt(value, 10) : value
  return Number.isInteger(num) && num > 0
}

// ═══════════════════════════════════════════════════════════════
// FORM-LEVEL VALIDATORS (ritornano stringa errore o null)
// ═══════════════════════════════════════════════════════════════

/**
 * Valida i dati di una spesa.
 * @param {{ amount: number|string, category: string, date?: string, recurrence?: string|null }} data
 * @returns {string|null} messaggio errore o null se valido
 */
export function validateExpense(data) {
  if (!isValidAmount(data.amount)) return 'Inserisci un importo valido (maggiore di 0)'
  if (!isNonEmpty(data.category)) return 'Seleziona una categoria'
  if (data.date && !isValidDate(data.date)) return 'La data non è valida'
  if (data.recurrence && data.recurrence !== 'none' && !isValidDate(data.date)) {
    return 'Per creare una ricorrenza, inserisci una data valida'
  }
  return null
}

/**
 * Valida i dati di un evento calendario.
 * @param {{ title: string, date: string, time_start?: string }} data
 * @returns {string|null}
 */
export function validateEvent(data) {
  if (!isNonEmpty(data.title)) return 'Inserisci un titolo per l\'evento'
  if (!isValidDate(data.date)) return 'La data non è valida'
  if (data.time_start && !isValidTime(data.time_start)) return 'L\'orario di inizio non è valido'
  if (data.time_end && !isValidTime(data.time_end)) return 'L\'orario di fine non è valido'
  return null
}

/**
 * Valida i dati di un task.
 * @param {{ title: string, due_date?: string }} data
 * @returns {string|null}
 */
export function validateTask(data) {
  if (!isNonEmpty(data.title)) return 'Inserisci un titolo per il task'
  if (data.due_date && !isValidDate(data.due_date)) return 'La data di scadenza non è valida'
  return null
}

/**
 * Valida bonus/penalità punti.
 * @param {{ memberId: string, points: string|number }} data
 * @returns {string|null}
 */
export function validateBonusPoints(data) {
  if (!isNonEmpty(data.memberId)) return 'Seleziona un membro'
  if (!isPositiveInteger(data.points)) return 'Inserisci un numero di punti valido (intero positivo)'
  return null
}

/**
 * Valida un item della lista spesa.
 * @param {{ name: string, quantity?: number|string }} data
 * @returns {string|null}
 */
export function validateShoppingItem(data) {
  if (!isNonEmpty(data.name)) return 'Inserisci un nome per il prodotto'
  if (data.quantity != null && !isValidQuantity(data.quantity)) return 'La quantità deve essere maggiore di 0'
  return null
}

/**
 * Valida un item dell'inventario.
 * @param {{ name: string, quantity?: number|string, expiry_date?: string }} data
 * @returns {string|null}
 */
export function validateInventoryItem(data) {
  if (!isNonEmpty(data.name)) return 'Inserisci un nome per il prodotto'
  if (data.quantity != null && !isValidQuantity(data.quantity)) return 'La quantità deve essere maggiore di 0'
  if (data.expiry_date && !isValidDate(data.expiry_date)) return 'La data di scadenza non è valida'
  return null
}
