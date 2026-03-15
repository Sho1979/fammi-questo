/**
 * STEP 11.1 — useCalendar hook: CRUD + live queries for events & recurrences.
 * All persistence via crud.js; components never touch db directly.
 *
 * Event schema:
 *   id, family_id, title, date (YYYY-MM-DD), time_start (HH:MM), time_end (HH:MM),
 *   person_id (owner), category, note, color,
 *   recurrence_id (nullable — links to recurrences table),
 *   logistics: [{ role: 'porta'|'riprende', member_id }]
 *
 * Recurrence schema:
 *   id, family_id, type ('daily'|'weekly'|'monthly'), interval (1=every, 2=every other...),
 *   day_of_week (0-6 for weekly), day_of_month (1-31 for monthly),
 *   start_date, end_date (nullable), event_template (same as event minus date/id)
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import { createRecord, updateRecord, deleteRecord } from '../lib/crud.js'
import useAuthStore from '../store/authStore.js'
import { getMonthRange } from '../lib/dates.js'
import { scheduleEventReminder, cancelEventReminder } from '../lib/notificationScheduler.js'

// ─── CRUD Actions ───────────────────────────────────────────────

/**
 * Add a new event.
 * @param {{ title: string, date: string, time_start?: string, time_end?: string,
 *           person_id: string, category?: string, note?: string, color?: string,
 *           logistics?: Array }} data
 * @returns {Promise<Record<string, unknown>>}
 */
export async function addEvent(data) {
  const familyId = useAuthStore.getState().familyId
  const record = await createRecord('events', { ...data, family_id: familyId })
  // Schedula reminder nativo (noop su web)
  scheduleEventReminder(record)
  return record
}

/**
 * Update an existing event.
 */
export async function updateEvent(id, changes) {
  const record = await updateRecord('events', id, changes)
  // Re-schedula reminder con i nuovi dati (cancella il vecchio automaticamente per id)
  scheduleEventReminder(record)
  return record
}

/**
 * Soft-delete an event.
 */
export async function deleteEvent(id) {
  cancelEventReminder(id)
  return deleteRecord('events', id)
}

/**
 * Undo soft-delete.
 */
export async function undoDeleteEvent(id) {
  return updateRecord('events', id, { _deleted: false })
}

// ─── Recurrence CRUD ────────────────────────────────────────────

/**
 * Create a recurrence rule and its first batch of generated events.
 * @param {{ type: 'daily'|'weekly'|'monthly', interval?: number,
 *           day_of_week?: number, day_of_month?: number,
 *           start_date: string, end_date?: string,
 *           event_template: object }} data
 * @returns {Promise<{ recurrence: object, events: object[] }>}
 */
export async function createRecurrence(data) {
  const familyId = useAuthStore.getState().familyId
  const recurrence = await createRecord('recurrences', {
    ...data,
    family_id: familyId,
  })

  // Generate events for the next 3 months from start_date
  const events = await generateRecurrenceEvents(recurrence, 3)
  return { recurrence, events }
}

/**
 * Delete a recurrence and all its future generated events.
 */
export async function deleteRecurrence(recurrenceId) {
  // Soft-delete the recurrence
  await deleteRecord('recurrences', recurrenceId)

  // Soft-delete all future events for this recurrence
  const today = new Date().toISOString().slice(0, 10)
  const futureEvents = await db.events
    .where('family_id')
    .equals(useAuthStore.getState().familyId)
    .and((e) => !e._deleted && e.recurrence_id === recurrenceId && e.date >= today)
    .toArray()

  for (const ev of futureEvents) {
    await deleteRecord('events', ev.id)
  }
}

/**
 * Generate individual event records from a recurrence rule.
 * @param {object} recurrence
 * @param {number} monthsAhead - how many months to generate
 * @returns {Promise<object[]>} created events
 */
async function generateRecurrenceEvents(recurrence, monthsAhead = 3) {
  const { type, interval = 1, day_of_week, day_of_month, start_date, end_date, event_template, family_id } = recurrence
  const start = new Date(start_date)
  const endLimit = end_date
    ? new Date(end_date)
    : new Date(start.getFullYear(), start.getMonth() + monthsAhead, start.getDate())

  const dates = []
  const current = new Date(start)

  if (type === 'daily') {
    while (current <= endLimit) {
      dates.push(formatYMD(current))
      current.setDate(current.getDate() + interval)
    }
  } else if (type === 'weekly') {
    // Align to the correct day of week
    const targetDay = day_of_week ?? current.getDay()
    const diff = (targetDay - current.getDay() + 7) % 7
    current.setDate(current.getDate() + diff)
    while (current <= endLimit) {
      if (current >= start) dates.push(formatYMD(current))
      current.setDate(current.getDate() + 7 * interval)
    }
  } else if (type === 'monthly') {
    const targetDom = day_of_month ?? current.getDate()
    current.setDate(targetDom)
    if (current < start) current.setMonth(current.getMonth() + interval)
    while (current <= endLimit) {
      // Handle months that don't have enough days (e.g. Feb 30 → skip)
      if (current.getDate() === targetDom) {
        dates.push(formatYMD(current))
      }
      current.setMonth(current.getMonth() + interval)
      current.setDate(targetDom) // reset in case setMonth shifted it
    }
  }

  const events = []
  for (const date of dates) {
    const ev = await createRecord('events', {
      ...event_template,
      family_id,
      date,
      recurrence_id: recurrence.id,
    })
    events.push(ev)
  }
  return events
}

function formatYMD(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ─── Logistics helpers ──────────────────────────────────────────

/**
 * Set logistics (chi porta / chi riprende) for an event.
 * @param {string} eventId
 * @param {Array<{ role: 'porta'|'riprende', member_id: string }>} logistics
 */
export async function setEventLogistics(eventId, logistics) {
  return updateEvent(eventId, { logistics })
}

// ─── Live Queries ───────────────────────────────────────────────

/**
 * Events for a given month (YYYY-MM), not deleted.
 */
export function useEventsByMonth(familyId, yyyy_mm) {
  return useLiveQuery(
    async () => {
      if (!familyId || !yyyy_mm) return []
      const { start, end } = getMonthRange(yyyy_mm)
      if (!start || !end) return []
      return db.events
        .where('family_id')
        .equals(familyId)
        .and((e) => !e._deleted && e.date >= start && e.date <= end)
        .sortBy('date')
    },
    [familyId, yyyy_mm],
    []
  )
}

/**
 * Events for a specific day (YYYY-MM-DD), sorted by time_start.
 */
export function useEventsByDay(familyId, date) {
  return useLiveQuery(
    async () => {
      if (!familyId || !date) return []
      return db.events
        .where('family_id')
        .equals(familyId)
        .and((e) => !e._deleted && e.date === date)
        .sortBy('time_start')
    },
    [familyId, date],
    []
  )
}

/**
 * Today's events.
 */
export function useTodayEvents(familyId) {
  const today = new Date().toISOString().slice(0, 10)
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return db.events
        .where('family_id')
        .equals(familyId)
        .and((e) => !e._deleted && e.date === today)
        .sortBy('time_start')
    },
    [familyId, today],
    []
  )
}

/**
 * Badge count for calendar tab.
 * Counts only incomplete/warning events (missing time, needsPickup).
 * Regular events don't trigger a badge — only warnings do.
 * Badge disappears once the user fixes the incomplete events.
 */
export function useUpcomingEventCount(familyId) {
  return useLiveQuery(
    async () => {
      if (!familyId) return 0
      const events = await db.events
        .where('family_id')
        .equals(familyId)
        .and((e) => !e._deleted && (e.incomplete || e.needsPickup))
        .toArray()
      return events.length
    },
    [familyId],
    0
  )
}

/**
 * All recurrences for the family (not deleted).
 */
export function useRecurrences(familyId) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return db.recurrences
        .where('family_id')
        .equals(familyId)
        .and((r) => !r._deleted)
        .toArray()
    },
    [familyId],
    []
  )
}
