/**
 * STEP 1.6 — localDb: schema Dexie, add/read record from Dexie.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './localDb.js'

describe('localDb', () => {
  beforeEach(async () => {
    await db.expenses.clear()
  })

  it('exposes all required tables from schema', () => {
    expect(db.family).toBeDefined()
    expect(db.members).toBeDefined()
    expect(db.expenses).toBeDefined()
    expect(db.budgets).toBeDefined()
    expect(db.events).toBeDefined()
    expect(db.tasks).toBeDefined()
    expect(db.taskTemplates).toBeDefined()
    expect(db.meals).toBeDefined()
    expect(db.mealPlans).toBeDefined()
    expect(db.shoppingItems).toBeDefined()
    expect(db.inventory).toBeDefined()
    expect(db.notifications).toBeDefined()
    expect(db.recurrences).toBeDefined()
    expect(db.priceHistory).toBeDefined()
    expect(db.rewards).toBeDefined()
    expect(db.brainNotes).toBeDefined()
    expect(db.patterns).toBeDefined()
    expect(db.syncLog).toBeDefined()
    expect(db.settings).toBeDefined()
  })

  it('can add and read a record from expenses (Dexie)', async () => {
    const record = {
      id: 'test-exp-1',
      family_id: 'f1',
      amount: 10,
      category: 'alimentari',
      note: 'Test',
      person_id: 'm1',
      date: '2026-03-06',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _deleted: false,
      _version: 1,
      _device_id: 'device-1',
    }
    await db.expenses.add(record)
    const all = await db.expenses.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('test-exp-1')
    expect(all[0].family_id).toBe('f1')
    expect(all[0].amount).toBe(10)
    expect(all[0].category).toBe('alimentari')
  })

  it('can get a single record by id', async () => {
    const record = {
      id: 'get-test-id',
      family_id: 'f1',
      amount: 25.5,
      category: 'trasporto',
      note: '',
      person_id: 'm1',
      date: '2026-03-07',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _deleted: false,
      _version: 1,
      _device_id: 'd1',
    }
    await db.expenses.add(record)
    const found = await db.expenses.get('get-test-id')
    expect(found).toBeDefined()
    expect(found.amount).toBe(25.5)
    expect(found.category).toBe('trasporto')
  })
})
