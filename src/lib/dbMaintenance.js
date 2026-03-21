/**
 * Purge soft-deleted records older than 90 days.
 * Run once per app session to keep IndexedDB lean.
 */
import { db } from './localDb.js'

const PURGE_AFTER_DAYS = 90

export async function purgeTombstones() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - PURGE_AFTER_DAYS)
  const cutoffISO = cutoff.toISOString()

  const tables = ['events', 'tasks', 'expenses', 'shoppingItems', 'meals', 'notifications']
  let total = 0

  for (const table of tables) {
    const stale = await db[table]
      .filter((r) => r._deleted && r.updated_at < cutoffISO)
      .primaryKeys()

    if (stale.length > 0) {
      await db[table].bulkDelete(stale)
      total += stale.length
    }
  }

  if (total > 0) console.info(`[DB] Purged ${total} tombstones older than ${PURGE_AFTER_DAYS}d`)
}
