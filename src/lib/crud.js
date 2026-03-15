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
 * Tabelle che generano entry in syncLog quando scritte via createRecord/updateRecord.
 * SOLO tabelle effettivamente sincronizzate con Supabase (vedi sync.js TABLE_MAP).
 *
 * Escluse intenzionalmente:
 *   - patterns      → locale, scritta direttamente da learningEngine.js (bypassa crud.js)
 *   - priceHistory  → tabella fantasma, zero writer, candidata rimozione schema
 *   - brainNotes    → tabella fantasma, zero writer, candidata rimozione schema
 *   - nlpDocuments, nlpLogs, conversationDrafts, syncLog, settings → locali by design
 */
const ENTITY_TABLES = new Set([
  'family', 'members', 'expenses', 'budgets', 'events', 'tasks', 'taskTemplates',
  'meals', 'mealPlans', 'shoppingItems', 'inventory', 'rewards', 'notifications', 'recurrences',
])

function shouldLogSync(table) {
  return ENTITY_TABLES.has(table)
}

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
  if (shouldLogSync(table)) {
    await db.syncLog.add({
      table_name: table,
      record_id: record.id,
      action: 'upsert',
      synced: 0,
    })
  }
  return record
}

/**
 * @param {string} table - Dexie table name
 * @param {string} id - record id
 * @param {Record<string, unknown>} changes - partial update
 * @returns {Promise<Record<string, unknown>>} updated record
 */
export async function updateRecord(table, id, changes) {
  const existing = await db.table(table).get(id)
  if (!existing) throw new Error(`Record ${id} not found in ${table}`)
  const updated = {
    ...existing,
    ...changes,
    updated_at: new Date().toISOString(),
    _version: (existing._version || 0) + 1,
    _device_id: getDeviceId(),
    updated_by: changes.updated_by || getCurrentMemberId(),
  }
  await db.table(table).put(updated)
  if (shouldLogSync(table)) {
    await db.syncLog.add({
      table_name: table,
      record_id: id,
      action: 'upsert',
      synced: 0,
    })
  }
  return updated
}

/**
 * Tombstone: sets _deleted = true (no real delete). See MASTER_ARCHITECTURE §6.2.
 * @param {string} table - Dexie table name
 * @param {string} id - record id
 * @returns {Promise<Record<string, unknown>>} updated record with _deleted: true
 */
export async function deleteRecord(table, id) {
  return updateRecord(table, id, { _deleted: true })
}

/**
 * @param {string} table - Dexie table name
 * @param {string} id - record id (or key for settings)
 * @returns {Promise<Record<string, unknown> | undefined>}
 */
export async function getRecord(table, id) {
  return db.table(table).get(id)
}
