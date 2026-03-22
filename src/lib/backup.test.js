/**
 * Tests for backup.js — export/import validation and pin_hash exclusion.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './localDb.js'
import { createRecord } from './crud.js'
import { exportBackup, importBackup } from './backup.js'

describe('backup', () => {
  beforeEach(async () => {
    // Clear all relevant tables
    await db.family.clear()
    await db.members.clear()
    await db.expenses.clear()
    await db.budgets.clear()
    await db.events.clear()
    await db.tasks.clear()
  })

  describe('exportBackup — pin_hash exclusion', () => {
    it('excludes pin_hash from exported member records', async () => {
      await createRecord('family', {
        id: 'f1',
        name: 'Test Family',
      })
      await createRecord('members', {
        family_id: 'f1',
        name: 'Papà',
        role: 'parent',
        pin_hash: '$2a$10$secret_hash_value',
        access_level: 'full',
      })

      const blob = await exportBackup('testpin1234')
      const buffer = await blob.arrayBuffer()

      // Decrypt and check
      const { decrypt } = await import('./crypto.js')
      const plaintext = await decrypt(buffer, 'testpin1234')
      const parsed = JSON.parse(plaintext)

      const member = parsed.tables.members[0]
      expect(member.name).toBe('Papà')
      expect(member.pin_hash).toBeUndefined()
      expect(member.role).toBe('parent')
    })

    it('excludes pin_hash from exported family records', async () => {
      await createRecord('family', {
        id: 'f1',
        name: 'Test Family',
        pin_hash: 'family_pin_hash',
      })

      const blob = await exportBackup('testpin1234')
      const buffer = await blob.arrayBuffer()

      const { decrypt } = await import('./crypto.js')
      const plaintext = await decrypt(buffer, 'testpin1234')
      const parsed = JSON.parse(plaintext)

      const family = parsed.tables.family[0]
      expect(family.name).toBe('Test Family')
      expect(family.pin_hash).toBeUndefined()
    })
  })

  describe('importBackup — validation', () => {
    it('imports valid records successfully', async () => {
      // Create data to export
      await createRecord('family', { id: 'f1', name: 'Test' })
      await createRecord('members', { family_id: 'f1', name: 'A', role: 'parent', access_level: 'full' })
      await createRecord('expenses', { family_id: 'f1', date: '2026-01-01', amount: 50, category: 'cibo' })

      const blob = await exportBackup('pin1234')

      // Clear DB
      await db.family.clear()
      await db.members.clear()
      await db.expenses.clear()

      // Import
      const report = await importBackup(blob, 'pin1234')
      expect(report.imported).toBeGreaterThanOrEqual(3)
      expect(report.rejected).toBe(0)

      // Verify data is there
      const families = await db.family.toArray()
      expect(families).toHaveLength(1)
    })

    it('rejects records missing required fields', async () => {
      // Manually craft a backup with invalid records
      const { encrypt } = await import('./crypto.js')
      const payload = JSON.stringify({
        version: 2,
        exported_at: new Date().toISOString(),
        tables: {
          family: [{ id: 'f1', name: 'OK' }],
          members: [
            { id: 'm1', family_id: 'f1', name: 'Valid', role: 'parent' },
            { id: 'm2', family_id: 'f1', name: null, role: 'parent' },  // null name
            { family_id: 'f1', name: 'No ID', role: 'child' },          // missing id
          ],
          expenses: [],
          budgets: [],
          events: [],
          tasks: [],
          taskTemplates: [],
          meals: [],
          mealPlans: [],
          shoppingItems: [],
          inventory: [],
          rewards: [],
          recurrences: [],
          notifications: [],
          settings: [],
          messageContexts: [],
          entityRelations: [],
        },
      })

      const encrypted = await encrypt(payload, 'pin1234')
      const blob = new Blob([encrypted])

      const report = await importBackup(blob, 'pin1234')
      expect(report.rejected).toBe(2) // null name + missing id
      expect(report.imported).toBeGreaterThanOrEqual(2) // family + 1 valid member

      // Only valid member should be in DB
      const members = await db.members.toArray()
      expect(members).toHaveLength(1)
      expect(members[0].name).toBe('Valid')
    })
  })
})
