/**
 * STEP 7.7 — Tests for useExpenses hook (pure logic, no rendering).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../lib/localDb.js'
import { createRecord } from '../lib/crud.js'
import useAuthStore from '../store/authStore.js'
import {
  addExpense,
  updateExpense,
  deleteExpense,
  undoDelete,
  computeCategoryTotals,
} from './useExpenses.js'

const FAMILY_ID = 'test-family-expenses'

beforeEach(async () => {
  // Clear tables
  await db.expenses.clear()
  await db.syncLog.clear()
  useAuthStore.getState().fullReset()
  useAuthStore.getState().setFamily(FAMILY_ID)
})

describe('addExpense', () => {
  it('creates an expense record with family_id', async () => {
    const result = await addExpense({
      amount: 25.5,
      category: 'alimentari',
      note: 'Spesa Esselunga',
      person_id: 'p1',
      date: '2026-03-07',
    })
    expect(result.id).toBeDefined()
    expect(result.family_id).toBe(FAMILY_ID)
    expect(result.amount).toBe(25.5)
    expect(result.category).toBe('alimentari')
    expect(result._deleted).toBe(false)
    expect(result._version).toBe(1)
  })

  it('persists to Dexie', async () => {
    const result = await addExpense({ amount: 10, category: 'trasporto', person_id: 'p1', date: '2026-03-07' })
    const stored = await db.expenses.get(result.id)
    expect(stored).toBeDefined()
    expect(stored.amount).toBe(10)
  })
})

describe('updateExpense', () => {
  it('updates fields and increments version', async () => {
    const created = await addExpense({ amount: 10, category: 'altro', person_id: 'p1', date: '2026-03-07' })
    const updated = await updateExpense(created.id, { amount: 20, note: 'Aggiornato' })
    expect(updated.amount).toBe(20)
    expect(updated.note).toBe('Aggiornato')
    expect(updated._version).toBe(2)
  })
})

describe('deleteExpense / undoDelete', () => {
  it('soft-deletes by setting _deleted', async () => {
    const created = await addExpense({ amount: 5, category: 'svago', person_id: 'p1', date: '2026-03-07' })
    const deleted = await deleteExpense(created.id)
    expect(deleted._deleted).toBe(true)
  })

  it('undoDelete restores the record', async () => {
    const created = await addExpense({ amount: 5, category: 'svago', person_id: 'p1', date: '2026-03-07' })
    await deleteExpense(created.id)
    const restored = await undoDelete(created.id)
    expect(restored._deleted).toBe(false)
  })
})

describe('computeCategoryTotals', () => {
  it('computes totals per category', () => {
    const expenses = [
      { category: 'alimentari', amount: 20, _deleted: false },
      { category: 'alimentari', amount: 30, _deleted: false },
      { category: 'trasporto', amount: 15, _deleted: false },
      { category: 'svago', amount: 10, _deleted: true }, // should be excluded
    ]
    const totals = computeCategoryTotals(expenses)
    expect(totals.alimentari).toBe(50)
    expect(totals.trasporto).toBe(15)
    expect(totals.svago).toBeUndefined()
  })

  it('returns empty object for empty array', () => {
    expect(computeCategoryTotals([])).toEqual({})
  })
})
