/**
 * STEP 7.1 — useExpenses hook: CRUD + live queries for expenses.
 * All persistence via crud.js; components never touch db directly.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import { createRecord, updateRecord, deleteRecord } from '../lib/crud.js'
import useAuthStore from '../store/authStore.js'
import { getMonthRange } from '../lib/dates.js'

/**
 * Add a new expense.
 * @param {{ amount: number, category: string, note?: string, person_id: string, date: string }} data
 */
export async function addExpense(data) {
  const familyId = useAuthStore.getState().familyId
  return createRecord('expenses', { ...data, family_id: familyId })
}

/**
 * Update an existing expense.
 * @param {string} id
 * @param {Record<string, unknown>} changes
 */
export async function updateExpense(id, changes) {
  return updateRecord('expenses', id, changes)
}

/**
 * Soft-delete an expense (tombstone).
 * @param {string} id
 */
export async function deleteExpense(id) {
  return deleteRecord('expenses', id)
}

/**
 * Undo a soft-delete.
 * @param {string} id
 */
export async function undoDelete(id) {
  return updateRecord('expenses', id, { _deleted: false })
}

// ─── Expense Recurrences ─────────────────────────────────────────

/**
 * Create an expense recurrence rule and generate upcoming expenses.
 * Uses the shared `recurrences` table with source_type='expense'.
 * @param {{ type: 'daily'|'weekly'|'monthly', interval?: number,
 *           day_of_week?: number, day_of_month?: number,
 *           start_date: string, end_date?: string,
 *           expense_template: { amount, category, note, person_id } }} data
 */
export async function createExpenseRecurrence(data) {
  const familyId = useAuthStore.getState().familyId
  const recurrence = await createRecord('recurrences', {
    ...data,
    family_id: familyId,
    source_type: 'expense',
  })
  // Generate expenses for the next 3 months
  const expenses = await generateExpenseRecurrenceEvents(recurrence, 3)
  return { recurrence, expenses }
}

/**
 * Delete an expense recurrence and all its future generated expenses.
 */
export async function deleteExpenseRecurrence(recurrenceId) {
  await deleteRecord('recurrences', recurrenceId)
  const today = new Date().toISOString().slice(0, 10)
  const familyId = useAuthStore.getState().familyId
  const futureExpenses = await db.expenses
    .where('family_id')
    .equals(familyId)
    .and((e) => !e._deleted && e.recurrence_id === recurrenceId && e.date >= today)
    .toArray()
  for (const exp of futureExpenses) {
    await deleteRecord('expenses', exp.id)
  }
}

/**
 * Generate individual expense records from an expense recurrence.
 */
async function generateExpenseRecurrenceEvents(recurrence, monthsAhead = 3) {
  const { type, interval = 1, day_of_week, day_of_month, start_date, end_date, expense_template, family_id } = recurrence
  const start = new Date(start_date)
  const endLimit = end_date
    ? new Date(end_date)
    : new Date(start.getFullYear(), start.getMonth() + monthsAhead, start.getDate())

  const dates = []
  const current = new Date(start)

  if (type === 'daily') {
    while (current <= endLimit) {
      dates.push(fmtYMD(current))
      current.setDate(current.getDate() + interval)
    }
  } else if (type === 'weekly') {
    const targetDay = day_of_week ?? current.getDay()
    const diff = (targetDay - current.getDay() + 7) % 7
    current.setDate(current.getDate() + diff)
    while (current <= endLimit) {
      if (current >= start) dates.push(fmtYMD(current))
      current.setDate(current.getDate() + 7 * interval)
    }
  } else if (type === 'monthly') {
    const targetDom = day_of_month ?? current.getDate()
    current.setDate(targetDom)
    if (current < start) current.setMonth(current.getMonth() + interval)
    while (current <= endLimit) {
      if (current.getDate() === targetDom) dates.push(fmtYMD(current))
      current.setMonth(current.getMonth() + interval)
      current.setDate(targetDom)
    }
  }

  const expenses = []
  for (const date of dates) {
    const exp = await createRecord('expenses', {
      ...expense_template,
      family_id,
      date,
      recurrence_id: recurrence.id,
    })
    expenses.push(exp)
  }
  return expenses
}

/**
 * Re-generate future expenses for existing recurrences (call on app start).
 * Only creates expenses that don't already exist for a given recurrence+date.
 */
export async function refreshExpenseRecurrences() {
  const familyId = useAuthStore.getState().familyId
  if (!familyId) return []
  const recurrences = await db.recurrences
    .where('family_id')
    .equals(familyId)
    .and((r) => !r._deleted && r.source_type === 'expense')
    .toArray()

  const created = []
  for (const rec of recurrences) {
    const { type, interval = 1, day_of_week, day_of_month, start_date, end_date, expense_template, family_id: fId } = rec
    const today = new Date()
    const endLimit = end_date
      ? new Date(end_date)
      : new Date(today.getFullYear(), today.getMonth() + 3, today.getDate())
    const start = new Date(Math.max(new Date(start_date).getTime(), today.getTime()))
    const current = new Date(start)

    const dates = []
    if (type === 'daily') {
      while (current <= endLimit) { dates.push(fmtYMD(current)); current.setDate(current.getDate() + interval) }
    } else if (type === 'weekly') {
      const td = day_of_week ?? current.getDay()
      const diff = (td - current.getDay() + 7) % 7
      current.setDate(current.getDate() + diff)
      while (current <= endLimit) { if (current >= start) dates.push(fmtYMD(current)); current.setDate(current.getDate() + 7 * interval) }
    } else if (type === 'monthly') {
      const dom = day_of_month ?? current.getDate()
      current.setDate(dom)
      if (current < start) current.setMonth(current.getMonth() + interval)
      while (current <= endLimit) { if (current.getDate() === dom) dates.push(fmtYMD(current)); current.setMonth(current.getMonth() + interval); current.setDate(dom) }
    }

    for (const date of dates) {
      const exists = await db.expenses
        .where('family_id').equals(fId)
        .and((e) => !e._deleted && e.recurrence_id === rec.id && e.date === date)
        .first()
      if (!exists) {
        const exp = await createRecord('expenses', { ...expense_template, family_id: fId, date, recurrence_id: rec.id })
        created.push(exp)
      }
    }
  }
  return created
}

function fmtYMD(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Live query: expenses for a given month, not deleted, ordered by date desc.
 * @param {string} familyId
 * @param {string} yyyy_mm - "YYYY-MM"
 */
export function useExpensesByMonth(familyId, yyyy_mm) {
  return useLiveQuery(
    async () => {
      if (!familyId || !yyyy_mm) return []
      const { start, end } = getMonthRange(yyyy_mm)
      if (!start || !end) return []
      return db.expenses
        .where('family_id')
        .equals(familyId)
        .and((e) => !e._deleted && e.date >= start && e.date <= end)
        .sortBy('date')
        .then((arr) => arr.reverse()) // desc
    },
    [familyId, yyyy_mm],
    []
  )
}

/**
 * Compute category totals for a month (in JS, from live query data).
 * @param {Array} expenses - already filtered expense list
 * @returns {Record<string, number>} categoryId → total
 */
export function computeCategoryTotals(expenses) {
  const totals = {}
  for (const e of expenses) {
    if (!e._deleted) {
      totals[e.category] = (totals[e.category] || 0) + Number(e.amount)
    }
  }
  return totals
}

/**
 * Live query: monthly totals for the last N months.
 * @param {string} familyId
 * @param {number} numMonths
 */
export function useMonthlyTotals(familyId, numMonths = 6) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      const now = new Date()
      const results = []

      for (let i = 0; i < numMonths; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const yyyy_mm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const { start, end } = getMonthRange(yyyy_mm)
        if (!start) continue

        const expenses = await db.expenses
          .where('family_id')
          .equals(familyId)
          .and((e) => !e._deleted && e.date >= start && e.date <= end)
          .toArray()

        const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
        results.push({ month: yyyy_mm, total })
      }

      return results.reverse() // chronological order
    },
    [familyId, numMonths],
    []
  )
}

/**
 * Live query: current month expenses grouped by person_id.
 * Returns array of { person_id, total }.
 */
export function useMonthExpensesByPerson(familyId) {
  const yyyy_mm = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  return useLiveQuery(
    async () => {
      if (!familyId) return []
      const { start, end } = getMonthRange(yyyy_mm)
      if (!start || !end) return []
      const expenses = await db.expenses
        .where('family_id')
        .equals(familyId)
        .and((e) => !e._deleted && e.date >= start && e.date <= end)
        .toArray()

      const byPerson = {}
      for (const e of expenses) {
        const pid = e.person_id || 'non_assegnato'
        byPerson[pid] = (byPerson[pid] || 0) + Number(e.amount)
      }
      return Object.entries(byPerson).map(([person_id, total]) => ({
        person_id,
        total: Math.round(total * 100) / 100,
      }))
    },
    [familyId, yyyy_mm],
    []
  )
}

/**
 * Live query: today's expenses.
 * @param {string} familyId
 */
export function useTodayExpenses(familyId) {
  const today = new Date().toISOString().slice(0, 10)
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return db.expenses
        .where('family_id')
        .equals(familyId)
        .and((e) => !e._deleted && e.date === today)
        .toArray()
    },
    [familyId, today],
    []
  )
}

/**
 * Count today's expenses created after a given timestamp (for badge notification).
 * @param {string} familyId
 * @param {string|null} afterTimestamp - ISO timestamp; only count items created after this
 */
export function useTodayExpenseCount(familyId, afterTimestamp = null) {
  const today = new Date().toISOString().slice(0, 10)
  return useLiveQuery(
    async () => {
      if (!familyId) return 0
      const items = await db.expenses
        .where('family_id')
        .equals(familyId)
        .and((e) => !e._deleted && e.date === today &&
          (!afterTimestamp || e.created_at > afterTimestamp))
        .toArray()
      return items.length
    },
    [familyId, today, afterTimestamp],
    0
  )
}
