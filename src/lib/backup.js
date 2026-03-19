/**
 * backup.js — Export/import full database as encrypted .fmbackup file.
 * Uses crypto.js for AES-256-GCM encryption with PIN (PBKDF2, 200K iterations).
 *
 * Binary format: salt(16) + iv(12) + ciphertext (JSON payload inside)
 */
import { db } from './localDb.js'
import { encrypt, decrypt } from './crypto.js'

const BACKUP_VERSION = 2 // bumped: now includes all synced tables
const TABLES = [
  'family', 'members', 'expenses', 'budgets', 'events',
  'tasks', 'taskTemplates', 'meals', 'mealPlans', 'shoppingItems',
  'inventory', 'rewards', 'recurrences', 'notifications', 'settings',
  'messageContexts', 'entityRelations',
]

/**
 * Export entire database as encrypted backup.
 * @param {string} pin - encryption key
 * @returns {Promise<Blob>} .fmbackup file as Blob
 */
export async function exportBackup(pin) {
  const data = {}
  for (const table of TABLES) {
    data[table] = await db[table].toArray()
  }

  const payload = JSON.stringify({
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    tables: data,
  })

  const encrypted = await encrypt(payload, pin)
  return new Blob([encrypted], { type: 'application/octet-stream' })
}

/**
 * Import database from encrypted .fmbackup file.
 * WARNING: This will REPLACE all existing data!
 * @param {File|Blob} file
 * @param {string} pin - decryption key
 * @returns {Promise<{ tables: number, records: number }>} import stats
 */
export async function importBackup(file, pin) {
  const buffer = await file.arrayBuffer()

  let plaintext
  try {
    plaintext = await decrypt(buffer, pin)
  } catch (err) {
    throw new Error('PIN errato o file corrotto')
  }

  let parsed
  try {
    parsed = JSON.parse(plaintext)
  } catch (err) {
    throw new Error('File backup non valido')
  }

  if (!parsed.version || !parsed.tables) {
    throw new Error('Formato backup non riconosciuto')
  }

  // Clear and import each table
  let totalRecords = 0
  let totalTables = 0

  await db.transaction('rw', TABLES.map((t) => db[t]), async () => {
    for (const table of TABLES) {
      const records = parsed.tables[table]
      if (records && Array.isArray(records)) {
        await db[table].clear()
        await db[table].bulkAdd(records)
        totalRecords += records.length
        totalTables++
      }
    }
  })

  return { tables: totalTables, records: totalRecords }
}

/**
 * Trigger browser download of a Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
