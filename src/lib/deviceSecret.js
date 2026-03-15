/**
 * deviceSecret.js — Device-specific secret + sync key derivation.
 *
 * Each device generates a unique 32-byte random secret on first use.
 * This secret is stored in Dexie `settings` table (key: 'device_secret').
 *
 * The sync key is derived as:
 *   PBKDF2( PIN + device_secret_hex, family_id_as_salt, 200K iterations ) → AES-256-GCM key
 *
 * This means:
 *   1. A stolen PIN alone is not enough to decrypt (attacker needs the device too)
 *   2. Each family has a different derived key (family_id is the salt)
 *   3. 200K iterations makes brute-force expensive
 *
 * IMPORTANT: The device_secret is NEVER synced to Supabase.
 * If a user joins on a new device, they must re-enter the family PIN
 * and a new device_secret is generated → different key → cannot decrypt
 * old encrypted data UNLESS the family shares the same PIN.
 *
 * For multi-device support, we use a shared family secret instead:
 *   - On family creation: generate a `sync_secret` (stored in Dexie settings)
 *   - On join-by-invite: the sync_secret is transmitted via the invite flow
 *   - Key = PBKDF2( PIN + sync_secret_hex, family_id, 200K )
 *   - This way all family devices with the same PIN derive the same key
 */
import { db } from './localDb.js'

const SYNC_SECRET_KEY = 'sync_secret'

// Versioned PBKDF2 parameters — se cambi le iterazioni, aggiungi una nuova versione
// e aggiorna CURRENT_KDF_VERSION. Le vecchie key potranno ancora essere derivate.
const KDF_VERSIONS = {
  1: { iterations: 200000, hash: 'SHA-256' },
}
const CURRENT_KDF_VERSION = 1

// ─── Sync Secret Management ─────────────────────────────────────

/**
 * Generate a random 32-byte hex string.
 */
function generateSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Get the sync secret for this family, or create one if it doesn't exist.
 * The sync_secret is per-family and shared across all family devices.
 *
 * @param {string} familyId
 * @returns {Promise<string>} hex-encoded 32-byte secret
 */
export async function getOrCreateSyncSecret(familyId) {
  const settingsKey = `${SYNC_SECRET_KEY}_${familyId}`
  const existing = await db.settings.get(settingsKey)
  if (existing?.value) return existing.value

  const secret = generateSecret()
  await db.settings.put({
    id: settingsKey,
    key: settingsKey,
    family_id: familyId,
    value: secret,
    created_at: new Date().toISOString(),
  })
  return secret
}

/**
 * Store a sync secret received during the invite/join flow.
 *
 * @param {string} familyId
 * @param {string} secret — hex-encoded 32-byte secret
 */
export async function setSyncSecret(familyId, secret) {
  const settingsKey = `${SYNC_SECRET_KEY}_${familyId}`
  await db.settings.put({
    id: settingsKey,
    key: settingsKey,
    family_id: familyId,
    value: secret,
    created_at: new Date().toISOString(),
  })
}

/**
 * Check if a sync secret exists for a family.
 */
export async function hasSyncSecret(familyId) {
  const settingsKey = `${SYNC_SECRET_KEY}_${familyId}`
  const existing = await db.settings.get(settingsKey)
  return !!existing?.value
}

// ─── Sync Key Derivation ─────────────────────────────────────────

/**
 * Derive an AES-256-GCM CryptoKey for sync encryption/decryption.
 *
 * Formula: PBKDF2( PIN + sync_secret_hex, UTF8(family_id), 200K, SHA-256 ) → AES-256-GCM
 *
 * @param {string} pin — the family PIN entered by the user
 * @param {string} familyId — used as PBKDF2 salt
 * @param {string} syncSecret — hex-encoded 32-byte secret
 * @returns {Promise<CryptoKey>} AES-GCM key usable with encrypt/decrypt
 */
/**
 * Derive an AES-256-GCM CryptoKey for sync encryption/decryption.
 *
 * Formula: PBKDF2( PIN + sync_secret_hex, UTF8(family_id), iterations, hash ) → AES-256-GCM
 *
 * @param {string} pin — the family PIN entered by the user
 * @param {string} familyId — used as PBKDF2 salt
 * @param {string} syncSecret — hex-encoded 32-byte secret
 * @param {number} [kdfVersion=CURRENT_KDF_VERSION] — versione parametri KDF
 * @returns {Promise<CryptoKey>} AES-GCM key usable with encrypt/decrypt
 */
export async function deriveSyncKey(pin, familyId, syncSecret, kdfVersion = CURRENT_KDF_VERSION) {
  const params = KDF_VERSIONS[kdfVersion]
  if (!params) throw new Error(`KDF version ${kdfVersion} sconosciuta`)

  const encoder = new TextEncoder()

  // Combine PIN + syncSecret as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin + syncSecret),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  // Use family_id as salt (deterministic per family)
  const salt = encoder.encode(familyId)

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: params.iterations,
      hash: params.hash,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** Versione KDF corrente — esposta per salvarla con i dati criptati */
export { CURRENT_KDF_VERSION }

/**
 * Convenience: get or create sync secret, then derive the sync key.
 *
 * @param {string} pin — family PIN
 * @param {string} familyId
 * @returns {Promise<CryptoKey>}
 */
export async function getSyncKey(pin, familyId) {
  const secret = await getOrCreateSyncSecret(familyId)
  return deriveSyncKey(pin, familyId, secret)
}
