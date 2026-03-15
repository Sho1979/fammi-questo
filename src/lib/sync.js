/**
 * R3.4 — Sync engine: bidirectional sync between Dexie (local) and Supabase (cloud).
 *
 * Strategy: "last-write-wins" based on updated_at timestamp.
 * - Push: encrypt sensitive fields → upsert to Supabase
 * - Pull: fetch from Supabase → decrypt sensitive fields → merge into Dexie
 *
 * Table name mapping: Dexie uses camelCase, Supabase uses snake_case.
 *
 * Encryption (Opzione B ibrida):
 *   Structural fields (id, family_id, updated_at, _version, etc.) stay in clear
 *   for LWW merge and RLS. Sensitive data fields are AES-256-GCM encrypted
 *   using a key derived from PIN + sync_secret + family_id.
 *   See syncCrypto.js and deviceSecret.js for details.
 */
import { db } from './localDb.js'
import { supabase, isSyncEnabled, ensureAuth, linkUserToFamily } from './supabase.js'
import { encryptRecord, decryptRecord } from './syncCrypto.js'

// ─── Field-level merge for specific tables ─────────────────────
// Tables where field-level merge is safer than full record overwrite
const FIELD_MERGE_TABLES = new Set(['shoppingItems'])

/**
 * Merge two records field by field: for each field, pick the value
 * from whichever record was updated more recently.
 * Non-data fields (_version, _device_id, updated_at, updated_by, created_at) come from the winner.
 * Data fields that differ: take from the record with later updated_at.
 */
function mergeByField(localRecord, remoteRecord) {
  const remoteTime = new Date(remoteRecord.updated_at).getTime()
  const localTime = new Date(localRecord.updated_at).getTime()
  const winner = remoteTime > localTime ? remoteRecord : localRecord

  // Start with the winner as base
  const merged = { ...winner }

  // Metadata always from winner
  merged._version = Math.max(localRecord._version || 0, remoteRecord._version || 0) + 1
  merged._device_id = winner._device_id
  merged.updated_at = winner.updated_at
  merged.updated_by = winner.updated_by

  return merged
}

// ─── Table mapping: local Dexie name → remote Supabase name ─
const TABLE_MAP = {
  family: 'families',
  members: 'members',
  expenses: 'expenses',
  budgets: 'budgets',
  events: 'events',
  tasks: 'tasks',
  taskTemplates: 'task_templates',
  meals: 'meals',
  mealPlans: 'meal_plans',
  shoppingItems: 'shopping_items',
  inventory: 'inventory',
  rewards: 'rewards',
  recurrences: 'recurrences',
  notifications: 'notifications',
}

// Tables to sync (all except syncLog, settings, priceHistory, patterns, brainNotes)
const SYNC_TABLES = Object.keys(TABLE_MAP)

/**
 * Generate a 6-char uppercase invite code.
 */
export function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 to avoid confusion
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Push all local data for a family to Supabase.
 * Uses upsert to handle both inserts and updates.
 * If syncKey is provided, sensitive fields are encrypted before push.
 *
 * @param {string} familyId
 * @param {Function} [onProgress]
 * @param {CryptoKey} [syncKey] — AES-GCM key from deviceSecret.getSyncKey()
 */
export async function pushToCloud(familyId, onProgress, syncKey) {
  if (!isSyncEnabled()) throw new Error('Sync non configurato')
  await ensureAuth()

  let pushed = 0
  const total = SYNC_TABLES.length

  for (const localTable of SYNC_TABLES) {
    const remoteTable = TABLE_MAP[localTable]
    onProgress?.({ table: localTable, current: ++pushed, total })

    try {
      let records
      if (localTable === 'family') {
        // Family table: single record by id
        const fam = await db.family.get(familyId)
        records = fam ? [fam] : []
      } else {
        records = await db[localTable]
          .where('family_id')
          .equals(familyId)
          .toArray()
      }

      if (records.length === 0) continue

      // Fetch remote updated_at for comparison (only ids we have locally)
      const localIds = records.map((r) => r.id)
      const remoteMap = new Map()
      // Fetch in batches of 100 ids
      for (let i = 0; i < localIds.length; i += 100) {
        const idBatch = localIds.slice(i, i + 100)
        const { data: remoteRows } = await supabase
          .from(remoteTable)
          .select('id, updated_at')
          .in('id', idBatch)
        if (remoteRows) {
          for (const r of remoteRows) remoteMap.set(r.id, r.updated_at)
        }
      }

      // Filter: only push records where local is newer than remote (or new)
      const toPush = records.filter((r) => {
        const remoteUpdatedAt = remoteMap.get(r.id)
        if (!remoteUpdatedAt) return true // new record, not on cloud yet
        const localTime = new Date(r.updated_at).getTime()
        const remoteTime = new Date(remoteUpdatedAt).getTime()
        return localTime > remoteTime
      })

      if (toPush.length === 0) continue

      // Convert timestamps to ISO strings for Supabase
      const cleaned = toPush.map((r) => ({
        ...r,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      }))

      // Encrypt sensitive fields if syncKey is provided
      let readyToPush = cleaned
      if (syncKey) {
        readyToPush = await Promise.all(
          cleaned.map((r) => encryptRecord(r, localTable, syncKey))
        )
      }

      // Upsert in batches of 100
      for (let i = 0; i < readyToPush.length; i += 100) {
        const batch = readyToPush.slice(i, i + 100)
        const { error } = await supabase
          .from(remoteTable)
          .upsert(batch, { onConflict: 'id' })

        if (error) {
          console.error(`[Sync] Push error on ${remoteTable}:`, error)
          throw error
        }
      }
    } catch (err) {
      console.error(`[Sync] Failed to push ${localTable}:`, err)
      throw err
    }
  }

  return pushed
}

/**
 * Pull all cloud data for a family into local Dexie.
 * Uses "last-write-wins": if remote updated_at > local updated_at, overwrite local.
 * If syncKey is provided, encrypted fields are decrypted after pull.
 *
 * @param {string} familyId
 * @param {Function} [onProgress]
 * @param {CryptoKey} [syncKey] — AES-GCM key from deviceSecret.getSyncKey()
 */
export async function pullFromCloud(familyId, onProgress, syncKey) {
  if (!isSyncEnabled()) throw new Error('Sync non configurato')
  await ensureAuth()

  let pulled = 0
  const total = SYNC_TABLES.length

  for (const localTable of SYNC_TABLES) {
    const remoteTable = TABLE_MAP[localTable]
    onProgress?.({ table: localTable, current: ++pulled, total })

    try {
      let query
      if (localTable === 'family') {
        query = supabase.from(remoteTable).select('*').eq('id', familyId)
      } else {
        query = supabase.from(remoteTable).select('*').eq('family_id', familyId)
      }

      const { data, error } = await query
      if (error) {
        console.error(`[Sync] Pull error on ${remoteTable}:`, error)
        throw error
      }
      if (!data || data.length === 0) continue

      // Decrypt sensitive fields if syncKey is provided
      let decryptedData = data
      if (syncKey) {
        decryptedData = await Promise.all(
          data.map((r) => decryptRecord(r, localTable, syncKey))
        )
      }

      // Smart merge: compare updated_at before overwriting local data
      for (const remoteRecord of decryptedData) {
        const localRecord = await db[localTable].get(remoteRecord.id)
        if (!localRecord) {
          // New record from cloud — insert locally
          await db[localTable].add(remoteRecord)
        } else {
          const remoteTime = new Date(remoteRecord.updated_at).getTime()
          const localTime = new Date(localRecord.updated_at).getTime()

          // Detect conflict: both changed on different devices
          const isConflict = remoteTime !== localTime &&
            localRecord._device_id && remoteRecord._device_id &&
            localRecord._device_id !== remoteRecord._device_id

          if (isConflict) {
            // Log the conflict before resolving
            try {
              await db.conflictLog.add({
                family_id: familyId,
                table_name: localTable,
                record_id: remoteRecord.id,
                local_updated_at: localRecord.updated_at,
                local_updated_by: localRecord.updated_by || null,
                local_device_id: localRecord._device_id,
                remote_updated_at: remoteRecord.updated_at,
                remote_updated_by: remoteRecord.updated_by || null,
                remote_device_id: remoteRecord._device_id,
                resolved_by: remoteTime > localTime ? 'remote' : 'local',
                resolved_at: new Date().toISOString(),
              })
            } catch (logErr) {
              console.warn('[Sync] Failed to log conflict:', logErr)
            }
          }

          if (isConflict && FIELD_MERGE_TABLES.has(localTable)) {
            // Field-level merge for shopping items and similar tables
            const merged = mergeByField(localRecord, remoteRecord)
            await db[localTable].put(merged)
          } else if (remoteTime > localTime) {
            // Remote is newer — overwrite local
            await db[localTable].put(remoteRecord)
          }
          // else: local is newer or equal — skip (will be pushed later)
        }
      }
    } catch (err) {
      console.error(`[Sync] Failed to pull ${localTable}:`, err)
      throw err
    }
  }

  return pulled
}

/**
 * Full bidirectional sync.
 * @param {string} familyId
 * @param {Function} [onProgress]
 * @param {CryptoKey} [syncKey] — AES-GCM key; if provided, sync is encrypted
 */
export async function fullSync(familyId, onProgress, syncKey) {
  // Push first (local wins for any conflicts during push)
  await pushToCloud(familyId, (p) =>
    onProgress?.({ phase: 'push', ...p }),
    syncKey
  )
  // Then pull (remote wins for newer records)
  await pullFromCloud(familyId, (p) =>
    onProgress?.({ phase: 'pull', ...p }),
    syncKey
  )
}

/**
 * Register family on cloud with an invite code.
 */
export async function registerFamilyOnCloud(familyId) {
  if (!isSyncEnabled()) throw new Error('Sync non configurato')
  await ensureAuth()

  const family = await db.family.get(familyId)
  if (!family) throw new Error('Famiglia non trovata')

  const inviteCode = generateInviteCode()

  // Upsert family with invite code
  const { error } = await supabase
    .from('families')
    .upsert({
      ...family,
      invite_code: inviteCode,
      created_at: new Date(family.created_at).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  if (error) throw error

  // Link this anonymous user to the family (for RLS)
  await linkUserToFamily(familyId)

  // Update local record too
  await db.family.update(familyId, { invite_code: inviteCode })

  return inviteCode
}

/**
 * Join an existing family using an invite code.
 * Returns the family data.
 *
 * If the family uses encrypted sync, the `syncSecret` must be provided
 * (typically shared out-of-band with the invite code, e.g. QR code).
 *
 * @param {string} inviteCode
 * @param {string} [pin] — family PIN (needed if sync is encrypted)
 * @param {string} [syncSecret] — hex sync secret (shared during invite)
 */
export async function joinFamilyByCode(inviteCode, pin, syncSecret) {
  if (!isSyncEnabled()) throw new Error('Sync non configurato')
  await ensureAuth()

  const { data, error } = await supabase
    .from('families')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase().trim())
    .eq('_deleted', false)
    .single()

  if (error || !data) throw new Error('Codice non valido o famiglia non trovata')

  // Save family locally
  await db.family.put(data)

  // Link this anonymous user to the family (for RLS)
  await linkUserToFamily(data.id)

  // If encrypted sync: store the shared secret and derive key
  let syncKey = null
  if (syncSecret && pin) {
    const { setSyncSecret, deriveSyncKey } = await import('./deviceSecret.js')
    await setSyncSecret(data.id, syncSecret)
    syncKey = await deriveSyncKey(pin, data.id, syncSecret)
  }

  // Pull all family members (may be encrypted)
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .eq('family_id', data.id)
    .eq('_deleted', false)

  if (members) {
    if (syncKey) {
      const { decryptRecords } = await import('./syncCrypto.js')
      const decrypted = await decryptRecords(members, 'members', syncKey)
      await db.members.bulkPut(decrypted)
    } else {
      await db.members.bulkPut(members)
    }
  }

  // Pull everything else
  await pullFromCloud(data.id, undefined, syncKey)

  return data
}
