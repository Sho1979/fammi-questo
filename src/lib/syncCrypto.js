/**
 * syncCrypto.js — Field-level encryption for cloud sync (Opzione B ibrida).
 *
 * Each synced table has a list of SENSITIVE fields that get AES-256-GCM encrypted
 * before push to Supabase, and decrypted after pull.
 *
 * Structural fields (id, family_id, updated_at, _version, _device_id, _deleted, etc.)
 * stay in clear to allow LWW merge, RLS, and Realtime.
 *
 * Encrypted field values are stored as Base64 strings in Supabase
 * with an `_enc` suffix (e.g., `title` → `title_enc`). The original field
 * is set to a placeholder '[encrypted]' so Supabase columns stay non-null.
 *
 * Wire format per field: base64( iv(12) + ciphertext + tag(16) )
 */

// ─── Sensitive fields per table ──────────────────────────────────
// Only data fields that contain personal/family information.
// Structural fields (id, family_id, *_at, _version, _device_id, _deleted, etc.) are NEVER encrypted.
export const SENSITIVE_FIELDS = {
  family: ['name', 'invite_code'],  // pin_hash excluded: never leaves device
  members: ['name', 'surname', 'birth_date', 'avatar', 'role'],  // pin_hash excluded from sync entirely
  expenses: ['amount', 'note', 'category', 'subcategory', 'description'],
  budgets: ['category', 'monthly_amount', 'month'],
  events: ['title', 'description', 'time', 'location', 'type'],
  tasks: ['title', 'description', 'priority', 'status'],
  taskTemplates: ['title', 'description', 'default_priority'],
  meals: ['name', 'type', 'ingredients', 'recipe', 'notes'],
  mealPlans: ['breakfast', 'lunch', 'dinner', 'snack', 'notes'],
  shoppingItems: ['name', 'quantity', 'unit', 'notes', 'category', 'price'],
  inventory: ['name', 'quantity', 'unit', 'location', 'notes'],
  rewards: ['points', 'reason', 'description'],
  recurrences: ['title', 'description', 'type', 'pattern', 'source_type', 'source_id'],
  notifications: ['title', 'body', 'type', 'data'],
  messageContexts: ['raw_text', 'normalized_text'],
  entityRelations: ['metadata_json'],
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Encode a Uint8Array to Base64 string.
 */
function uint8ToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Decode a Base64 string to Uint8Array.
 */
function base64ToUint8(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Encrypt a single field value with AES-256-GCM.
 * Returns a Base64 string: iv(12) + ciphertext+tag
 * @param {*} value — the field value (will be JSON.stringify'd)
 * @param {CryptoKey} key — AES-GCM 256-bit key
 * @returns {Promise<string>} Base64-encoded encrypted payload
 */
async function encryptField(value, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  const plaintext = encoder.encode(JSON.stringify(value))

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  )

  // Concat: iv + ciphertext (which includes the 16-byte auth tag)
  const result = new Uint8Array(iv.length + new Uint8Array(ciphertext).length)
  result.set(iv, 0)
  result.set(new Uint8Array(ciphertext), iv.length)

  return uint8ToBase64(result)
}

/**
 * Decrypt a single Base64-encoded field value.
 * @param {string} base64 — the encrypted Base64 payload
 * @param {CryptoKey} key — AES-GCM 256-bit key
 * @returns {Promise<*>} the original value (JSON.parse'd)
 */
async function decryptField(base64, key) {
  const bytes = base64ToUint8(base64)
  const iv = bytes.slice(0, 12)
  const ciphertext = bytes.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  const plaintext = new TextDecoder().decode(decrypted)
  return JSON.parse(plaintext)
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Encrypt sensitive fields of a record before pushing to Supabase.
 *
 * - Sensitive fields are replaced with '[encrypted]' placeholder
 * - Encrypted values are stored in `<field>_enc` companion fields
 * - Structural fields pass through untouched
 *
 * @param {Object} record — the Dexie record (plain object)
 * @param {string} tableName — Dexie table name (e.g., 'expenses')
 * @param {CryptoKey} syncKey — AES-GCM 256-bit key
 * @returns {Promise<Object>} record ready for Supabase upsert
 */
export async function encryptRecord(record, tableName, syncKey) {
  const fields = SENSITIVE_FIELDS[tableName]
  if (!fields || fields.length === 0) return { ...record }

  const encrypted = { ...record }
  for (const field of fields) {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      encrypted[`${field}_enc`] = await encryptField(encrypted[field], syncKey)
      encrypted[field] = '[encrypted]'
    }
  }
  // Mark record as encrypted so pull knows to decrypt
  encrypted._encrypted = true
  return encrypted
}

/**
 * Decrypt sensitive fields of a record pulled from Supabase.
 *
 * - Reads `<field>_enc` companion fields
 * - Restores original values into the base field names
 * - Removes `_enc` fields and `_encrypted` flag
 *
 * @param {Object} record — the Supabase record
 * @param {string} tableName — Dexie table name
 * @param {CryptoKey} syncKey — AES-GCM 256-bit key
 * @returns {Promise<Object>} record ready for Dexie storage
 */
export async function decryptRecord(record, tableName, syncKey) {
  // If record is not encrypted, return as-is (backward compat with old clear data)
  if (!record._encrypted) return { ...record }

  const fields = SENSITIVE_FIELDS[tableName]
  if (!fields || fields.length === 0) return { ...record }

  const decrypted = { ...record }
  for (const field of fields) {
    const encField = `${field}_enc`
    if (decrypted[encField]) {
      try {
        decrypted[field] = await decryptField(decrypted[encField], syncKey)
      } catch (err) {
        // Hard fail: wrong key would silently nullify ALL data.
        // Better to abort sync than destroy the local database.
        throw new Error(
          `[SyncCrypto] Decriptazione fallita per ${tableName}.${field} (record ${record.id}). ` +
          `Chiave di sync errata o dati corrotti. Sync interrotto per proteggere i dati locali.`
        )
      }
      delete decrypted[encField]
    }
  }
  delete decrypted._encrypted
  return decrypted
}

/**
 * Batch encrypt an array of records.
 */
export async function encryptRecords(records, tableName, syncKey) {
  return Promise.all(records.map((r) => encryptRecord(r, tableName, syncKey)))
}

/**
 * Batch decrypt an array of records.
 */
export async function decryptRecords(records, tableName, syncKey) {
  return Promise.all(records.map((r) => decryptRecord(r, tableName, syncKey)))
}
