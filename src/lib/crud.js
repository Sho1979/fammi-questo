/**
 * Centralized CRUD — all writes go through here (id, timestamps, _version, _device_id, updated_by, tombstone, syncLog).
 * See 1_MASTER_ARCHITECTURE.md §8.3.
 */
import { db } from './localDb.js'
import useAuthStore from '../store/authStore.js'

const DEVICE_ID_KEY = 'fm_device_id'

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

function getCurrentMemberId() {
  try {
    return useAuthStore.getState().currentMember?.id || null
  } catch {
    return null
  }
}

/**
 * Tabelle sincronizzate con Supabase (vedi sync.js TABLE_MAP).
 * Usato per validazione; syncLog writes sono state rimosse (dead code:
 * sync.js non le leggeva, causando I/O inutile su ogni write).
 *
 * Escluse intenzionalmente:
 *   - patterns      → locale, scritta direttamente da learningEngine.js
 *   - priceHistory  → tabella fantasma, zero writer
 *   - brainNotes    → tabella fantasma, zero writer
 *   - nlpDocuments, nlpLogs, conversationDrafts, syncLog, settings → locali by design
 */
const ENTITY_TABLES = new Set([
  'family', 'members', 'expenses', 'budgets', 'events', 'tasks', 'taskTemplates',
  'meals', 'mealPlans', 'shoppingItems', 'inventory', 'rewards', 'notifications', 'recurrences',
  'messageContexts', 'entityRelations',
])

/**
 * @param {string} table - Dexie table name
 * @param {Record<string, unknown>} data - payload (must include family_id for entities)
 * @returns {Promise<Record<string, unknown>>} created record with id, timestamps, _version, _device_id
 */
export async function createRecord(table, data) {
  const now = new Date().toISOString()
  const record = {
    id: crypto.randomUUID(),
    ...data,
    created_at: now,
    updated_at: now,
    _deleted: false,
    _version: 1,
    _device_id: getDeviceId(),
    updated_by: data.updated_by || getCurrentMemberId(),
  }
  await db.table(table).add(record)
  return record
}

/**
 * @param {string} table - Dexie table name
 * @param {string} id - record id
 * @param {Record<string, unknown>} changes - partial update
 * @returns {Promise<Record<string, unknown>>} updated record
 */
export async function updateRecord(table, id, changes) {
  // Atomic read-modify-write in single Dexie transaction
  let updated
  await db.transaction('rw', db.table(table), async () => {
    const existing = await db.table(table).get(id)
    if (!existing) throw new Error(`Record ${id} not found in ${table}`)
    updated = {
      ...existing,
      ...changes,
      updated_at: new Date().toISOString(),
      _version: (existing._version || 0) + 1,
      _device_id: getDeviceId(),
      updated_by: changes.updated_by || getCurrentMemberId(),
    }
    await db.table(table).put(updated)
  })
  return updated
}

/**
 * Tombstone: sets _deleted = true (no real delete). See MASTER_ARCHITECTURE §6.2.
 * @param {string} table - Dexie table name
 * @param {string} id - record id
 * @returns {Promise<Record<string, unknown>>} updated record with _deleted: true
 */
export async function deleteRecord(table, id) {
  const result = await updateRecord(table, id, { _deleted: true })

  // Cleanup: mark entityRelations referencing this record as deleted
  try {
    const fromRels = await db.entityRelations
      .filter(r => !r._deleted && r.from_entity_id === id)
      .toArray()
    const toRels = await db.entityRelations
      .filter(r => !r._deleted && r.to_entity_id === id)
      .toArray()
    const allRels = [...fromRels, ...toRels]
    for (const rel of allRels) {
      await db.entityRelations.update(rel.id, { _deleted: true, updated_at: new Date().toISOString() })
    }
  } catch (err) {
    console.warn('[CRUD] Zombie relation cleanup failed (non-blocking):', err)
  }

  return result
}

/**
 * @param {string} table - Dexie table name
 * @param {string} id - record id (or key for settings)
 * @returns {Promise<Record<string, unknown> | undefined>}
 */
export async function getRecord(table, id) {
  return db.table(table).get(id)
}
