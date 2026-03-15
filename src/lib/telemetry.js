/**
 * Local Telemetry — contatori uso feature per guidare lo sviluppo.
 *
 * Tutto resta in IndexedDB (tabella settings), ZERO server, ZERO privacy issues.
 * Accumula contatori per feature e azioni, resettabili dall'utente.
 *
 * Uso:
 *   import { trackEvent, getTelemetry, resetTelemetry } from './telemetry.js'
 *   trackEvent('task_created')         // incrementa contatore
 *   trackEvent('brain_parse', { level: 'L0' })  // con dettaglio
 *   const data = await getTelemetry()  // legge tutto
 *
 * NOTA: leggero — nessun overhead percepibile (singola put IndexedDB per evento).
 */
import { db } from './localDb.js'
import useAuthStore from '../store/authStore.js'

const TELEMETRY_KEY = 'local-telemetry'

/**
 * Incrementa un contatore locale.
 *
 * @param {string} event — nome evento (es. 'task_created', 'expense_added', 'brain_l3_fallback')
 * @param {Record<string, string>} [tags] — dettagli opzionali (es. { level: 'L0' })
 */
export async function trackEvent(event, tags) {
  if (!event) return

  try {
    const familyId = useAuthStore.getState().familyId
    const key = `${TELEMETRY_KEY}-${familyId || 'anon'}`

    // Carica dati correnti
    const record = await db.settings.get(key)
    const data = record?.value ? JSON.parse(record.value) : { counters: {}, details: {}, firstSeen: new Date().toISOString() }

    // Incrementa contatore principale
    data.counters[event] = (data.counters[event] || 0) + 1
    data.lastUpdated = new Date().toISOString()

    // Contatori dettaglio (es. brain_parse.L0, brain_parse.L1)
    if (tags) {
      if (!data.details[event]) data.details[event] = {}
      for (const [k, v] of Object.entries(tags)) {
        const tagKey = `${k}:${v}`
        data.details[event][tagKey] = (data.details[event][tagKey] || 0) + 1
      }
    }

    // Salva
    await db.settings.put({
      id: key,
      family_id: familyId || 'anon',
      key: 'telemetry',
      value: JSON.stringify(data),
      updatedAt: new Date().toISOString(),
      _synced: 0,
      _deleted: false,
    })
  } catch {
    // Telemetria non deve mai rompere l'app
  }
}

/**
 * Legge tutti i dati telemetrici.
 *
 * @returns {Promise<{
 *   counters: Record<string, number>,
 *   details: Record<string, Record<string, number>>,
 *   firstSeen: string,
 *   lastUpdated: string
 * } | null>}
 */
export async function getTelemetry() {
  try {
    const familyId = useAuthStore.getState().familyId
    const key = `${TELEMETRY_KEY}-${familyId || 'anon'}`
    const record = await db.settings.get(key)
    return record?.value ? JSON.parse(record.value) : null
  } catch {
    return null
  }
}

/**
 * Reset completo della telemetria locale.
 */
export async function resetTelemetry() {
  try {
    const familyId = useAuthStore.getState().familyId
    const key = `${TELEMETRY_KEY}-${familyId || 'anon'}`
    await db.settings.delete(key)
  } catch {
    // noop
  }
}

// ─── Eventi predefiniti (per autocomplete e coerenza) ────────
export const TELEMETRY_EVENTS = {
  // Navigazione
  PAGE_VIEW_DASHBOARD: 'page_dashboard',
  PAGE_VIEW_CALENDAR: 'page_calendar',
  PAGE_VIEW_TASKS: 'page_tasks',
  PAGE_VIEW_EXPENSES: 'page_expenses',
  PAGE_VIEW_DISPENSA: 'page_dispensa',
  PAGE_VIEW_MEALS: 'page_meals',
  PAGE_VIEW_REWARDS: 'page_rewards',
  PAGE_VIEW_SETTINGS: 'page_settings',

  // CRUD
  TASK_CREATED: 'task_created',
  TASK_COMPLETED: 'task_completed',
  TASK_PROPOSED: 'task_proposed',
  EXPENSE_ADDED: 'expense_added',
  EVENT_CREATED: 'event_created',
  SHOPPING_ADDED: 'shopping_added',
  MEAL_PLANNED: 'meal_planned',
  INVENTORY_ADDED: 'inventory_added',

  // Brain / NLP
  BRAIN_PARSE: 'brain_parse',         // tags: { level: 'L0'|'L1'|'L2'|'L3' }
  BRAIN_CONFIRMED: 'brain_confirmed',
  BRAIN_REJECTED: 'brain_rejected',

  // Sync
  SYNC_PUSH: 'sync_push',
  SYNC_PULL: 'sync_pull',
  SYNC_CONFLICT: 'sync_conflict',

  // Notifiche
  NOTIFICATION_SENT: 'notification_sent',
  NOTIFICATION_READ: 'notification_read',
}
