/**
 * STEP 1.6 — crud: createRecord, updateRecord, deleteRecord (tombstone), getRecord.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createRecord, updateRecord, deleteRecord, getRecord } from './crud.js'
import { db } from './localDb.js'

describe('crud', () => {
  beforeEach(async () => {
    await db.expenses.clear()
    await db.syncLog.clear()
  })

  it('createRecord adds record with id, timestamps, _version, _device_id', async () => {
    const record = await createRecord('expenses', {
      family_id: 'f1',
      amount: 50,
      category: 'bollette',
      note: 'Luce',
      person_id: 'm1',
      date: '2026-03-06',
    })
    expect(record.id).toBeDefined()
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(record.family_id).toBe('f1')
    expect(record.amount).toBe(50)
    expect(record.created_at).toBeDefined()
    expect(record.updated_at).toBe(record.created_at)
    expect(record._deleted).toBe(false)
    expect(record._version).toBe(1)
    expect(record._device_id).toBeDefined()
  })

  it('getRecord returns the created record', async () => {
    const created = await createRecord('expenses', {
      family_id: 'f1',
      amount: 10,
      category: 'altro',
      note: '',
      person_id: 'm1',
      date: '2026-03-06',
    })
    const found = await getRecord('expenses', created.id)
    expect(found).toBeDefined()
    expect(found.id).toBe(created.id)
    expect(found.amount).toBe(10)
  })

  it('updateRecord increments _version and updates fields', async () => {
    const created = await createRecord('expenses', {
      family_id: 'f1',
      amount: 100,
      category: 'affitto',
      note: 'Mutuo',
      person_id: 'm1',
      date: '2026-03-06',
    })
    const updated = await updateRecord('expenses', created.id, { amount: 150, note: 'Mutuo marzo' })
    expect(updated.amount).toBe(150)
    expect(updated.note).toBe('Mutuo marzo')
    expect(updated._version).toBe(2)
    expect(updated.updated_at).toBeDefined()
    expect(updated.updated_at).not.toBe(created.updated_at)
  })

  it('updateRecord throws if record not found', async () => {
    await expect(updateRecord('expenses', 'non-existent-id', { amount: 1 }))
      .rejects.toThrow('Record non-existent-id not found in expenses')
  })

  it('deleteRecord sets _deleted true (tombstone)', async () => {
    const created = await createRecord('expenses', {
      family_id: 'f1',
      amount: 20,
      category: 'svago',
      note: 'Cinema',
      person_id: 'm1',
      date: '2026-03-06',
    })
    const tombstoned = await deleteRecord('expenses', created.id)
    expect(tombstoned._deleted).toBe(true)
    const found = await getRecord('expenses', created.id)
    expect(found._deleted).toBe(true)
  })

  it('createRecord logs to syncLog for entity tables', async () => {
    const record = await createRecord('expenses', {
      family_id: 'f1',
      amount: 5,
      category: 'altro',
      note: '',
      person_id: 'm1',
      date: '2026-03-06',
    })
    const logEntries = await db.syncLog.where('record_id').equals(record.id).toArray()
    expect(logEntries.length).toBeGreaterThanOrEqual(1)
    expect(logEntries.some(e => e.table_name === 'expenses' && e.action === 'upsert' && e.synced === 0)).toBe(true)
  })
})
