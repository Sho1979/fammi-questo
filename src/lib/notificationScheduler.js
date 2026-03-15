/**
 * Notification Scheduler — schedula notifiche native per eventi e task.
 *
 * Chiamato quando si crea/aggiorna un evento o task con data/ora.
 * Usa @capacitor/local-notifications (via nativeNotifications.js).
 *
 * Reminder di default:
 * - Eventi calendario: 30 minuti prima
 * - Task con scadenza: alle 8:00 del giorno stesso
 */
import {
  scheduleNativeNotification,
  cancelNativeNotification,
  isNativeNotifAvailable,
} from './nativeNotifications.js'

/**
 * Genera un id numerico stabile da un UUID string (per il sistema notifiche Android).
 * @param {string} uuid
 * @returns {number}
 */
function uuidToNotifId(uuid) {
  let hash = 0
  for (let i = 0; i < uuid.length; i++) {
    hash = ((hash << 5) - hash + uuid.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 2147483647
}

/**
 * Schedula un reminder nativo per un evento calendario.
 *
 * @param {{ id: string, title: string, date: string, time_start?: string, person_id?: string }} event
 * @param {string} [personName] — nome della persona associata
 */
export function scheduleEventReminder(event, personName) {
  if (!isNativeNotifAvailable()) return

  const { id, title, date, time_start } = event
  if (!date || !time_start) return // senza orario non possiamo schedulare

  // Calcola 30 minuti prima dell'evento
  const [h, m] = time_start.split(':').map(Number)
  const eventDate = new Date(`${date}T${time_start}:00`)
  const reminderDate = new Date(eventDate.getTime() - 30 * 60 * 1000)

  // Non schedulare nel passato
  if (reminderDate.getTime() <= Date.now()) return

  const body = personName
    ? `${title} — ${personName} alle ${time_start}`
    : `${title} alle ${time_start}`

  scheduleNativeNotification({
    title: '📅 Tra 30 minuti',
    body,
    at: reminderDate,
    id: uuidToNotifId(id),
    extra: { type: 'event_reminder', eventId: id },
  })
}

/**
 * Cancella il reminder di un evento (es. quando viene eliminato o modificato).
 * @param {string} eventId
 */
export function cancelEventReminder(eventId) {
  if (!isNativeNotifAvailable()) return
  cancelNativeNotification(uuidToNotifId(eventId))
}

/**
 * Schedula un reminder nativo per un task con scadenza.
 * Notifica alle 8:00 del giorno della scadenza.
 *
 * @param {{ id: string, title: string, due_date: string, assigned_to?: string }} task
 * @param {string} [assigneeName]
 */
export function scheduleTaskReminder(task, assigneeName) {
  if (!isNativeNotifAvailable()) return

  const { id, title, due_date } = task
  if (!due_date) return

  // Reminder alle 8:00 del giorno
  const reminderDate = new Date(`${due_date}T08:00:00`)

  // Non schedulare nel passato
  if (reminderDate.getTime() <= Date.now()) return

  const body = assigneeName
    ? `${title} — assegnato a ${assigneeName}`
    : title

  scheduleNativeNotification({
    title: '📌 Task per oggi',
    body,
    at: reminderDate,
    id: uuidToNotifId(id),
    extra: { type: 'task_reminder', taskId: id },
  })
}

/**
 * Cancella il reminder di un task.
 * @param {string} taskId
 */
export function cancelTaskReminder(taskId) {
  if (!isNativeNotifAvailable()) return
  cancelNativeNotification(uuidToNotifId(taskId))
}


/**
 * Schedula reminder per un item della lista spesa.
 * Notifiche alle 12:00 e 18:00 del giorno stesso: "Hai preso [item]?"
 *
 * @param {{ id: string, name: string, date?: string, notifyScope?: 'personal'|'family' }} item
 *
 * - notifyScope 'personal' (default): notifica nativa solo su questo dispositivo
 * - notifyScope 'family': notifica nativa locale + in-app a tutti i membri
 *
 * La notifica in-app (family) viene creata subito come "heads-up".
 * Le notifiche native alle 12 e 18 partono solo su questo dispositivo.
 */
export function scheduleShoppingReminders(item) {
  const { id, name, notifyScope } = item
  if (!name) return

  const today = new Date().toISOString().slice(0, 10)
  const date = item.date || today

  // --- Notifiche native locali (funzionano solo su questo dispositivo) ---
  if (isNativeNotifAvailable()) {
    // Reminder alle 12:00
    const noon = new Date(date + 'T12:00:00')
    if (noon.getTime() > Date.now()) {
      scheduleNativeNotification({
        title: '🛒 Lista spesa',
        body: 'Hai preso ' + name + '?',
        at: noon,
        id: uuidToNotifId(id + '_noon'),
        extra: { type: 'shopping_reminder', itemId: id },
      })
    }

    // Reminder alle 18:00
    const evening = new Date(date + 'T18:00:00')
    if (evening.getTime() > Date.now()) {
      scheduleNativeNotification({
        title: '🛒 Lista spesa',
        body: 'Hai preso ' + name + '?',
        at: evening,
        id: uuidToNotifId(id + '_eve'),
        extra: { type: 'shopping_reminder', itemId: id },
      })
    }
  }

  // --- Se scope = family, salva il flag sull'item per notify in-app (gestito da useBrain) ---
  // Il flag notifyScope viene usato da useBrain.js per creare in-app notifications
  // a tutti i membri della famiglia tramite notifyAll()
  return { scheduled: true, notifyScope: notifyScope || 'personal' }
}

/**
 * Cancella i reminder di un item della lista spesa.
 * @param {string} itemId
 */
export function cancelShoppingReminders(itemId) {
  if (!isNativeNotifAvailable()) return
  cancelNativeNotification(uuidToNotifId(itemId + '_noon'))
  cancelNativeNotification(uuidToNotifId(itemId + '_eve'))
}

// ═══════════════════════════════════════════════════════════════
// TASK CON SCADENZA: PROMEMORIA GIORNALIERO + NOTIFICA SCADENZA
// ═══════════════════════════════════════════════════════════════

/**
 * Schedula promemoria ricorrenti per un task con scadenza (es. bolletta).
 *
 * - Notifica giornaliera alle 10:00 da oggi fino alla due_date (max 14 giorni)
 * - Notifica extra il giorno della scadenza alle 10:00 con urgenza
 * - Tutte le notifiche vengono cancellate quando il task viene completato
 *
 * @param {{ id: string, title: string, due_date: string }} task
 */
export function scheduleDailyTaskReminders(task) {
  if (!isNativeNotifAvailable()) return

  const { id, title, due_date } = task
  if (!due_date) return

  const dueDate = new Date(due_date + 'T10:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dueDateClean = new Date(due_date)
  dueDateClean.setHours(0, 0, 0, 0)

  // Calcola i giorni da oggi alla scadenza (max 14 per non sovraccaricare)
  const diffDays = Math.min(
    Math.ceil((dueDateClean.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    14
  )

  // Schedula una notifica alle 10:00 per ogni giorno
  for (let d = 0; d <= diffDays; d++) {
    const notifDate = new Date(today)
    notifDate.setDate(notifDate.getDate() + d)
    notifDate.setHours(10, 0, 0, 0)

    // Non schedulare nel passato
    if (notifDate.getTime() <= Date.now()) continue

    const isLastDay = d === diffDays
    const daysLeft = diffDays - d

    let body
    if (isLastDay) {
      body = '⚠️ SCADENZA OGGI: ' + title
    } else if (daysLeft === 1) {
      body = '⏰ Scade domani: ' + title
    } else {
      body = title + ' (scade tra ' + daysLeft + ' giorni)'
    }

    scheduleNativeNotification({
      title: isLastDay ? '🔴 Scadenza!' : '📌 Promemoria',
      body,
      at: notifDate,
      id: uuidToNotifId(id + '_day_' + d),
      extra: { type: 'task_daily_reminder', taskId: id, dayIndex: d },
    })
  }
}

/**
 * Cancella TUTTI i promemoria giornalieri di un task (fino a 15 notifiche).
 * Chiamare quando il task viene completato o eliminato.
 *
 * @param {string} taskId
 */
export function cancelDailyTaskReminders(taskId) {
  if (!isNativeNotifAvailable()) return
  // Cancella le notifiche giornaliere (max 15: indici 0-14)
  for (let d = 0; d <= 14; d++) {
    cancelNativeNotification(uuidToNotifId(taskId + '_day_' + d))
  }
  // Cancella anche il reminder standard (8:00)
  cancelNativeNotification(uuidToNotifId(taskId))
}