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
    let records = await db[table].toArray()
    // Strip pin_hash — credentials must never leave the device
    if (table === 'members' || table === 'family') {
      records = records.map(({ pin_hash, ...rest }) => rest)
    }
    data[table] = records
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

  // Minimum required fields per table
  const REQUIRED_FIELDS = {
    family:        ['id', 'name'],
    members:       ['id', 'family_id', 'name', 'role'],
    expenses:      ['id', 'family_id', 'date'],
    events:        ['id', 'family_id', 'date'],
    tasks:         ['id', 'family_id'],
    budgets:       ['id'],
    shoppingItems: ['id', 'family_id'],
    inventory:     ['id', 'family_id'],
    meals:         ['id', 'family_id'],
    notifications: ['id', 'family_id'],
  }

  function validateRecords(tableName, records) {
    const required = REQUIRED_FIELDS[tableName]
    if (!required) return { valid: records, rejected: [] }

    const valid = []
    const rejected = []
    for (const record of records) {
      if (!record || typeof record !== 'object') {
        rejected.push({ record, reason: 'not_an_object' })
        continue
      }
      const missing = required.filter(f => record[f] === undefined || record[f] === null)
      if (missing.length > 0) {
        rejected.push({ record, reason: `missing_fields: ${missing.join(', ')}` })
      } else {
        valid.push(record)
      }
    }
    return { valid, rejected }
  }

  // Clear and import each table with validation
  const importReport = { imported: 0, rejected: 0, tables: 0, details: [] }

  await db.transaction('rw', TABLES.map((t) => db[t]), async () => {
    for (const table of TABLES) {
      const records = parsed.tables[table]
      if (!records || !Array.isArray(records)) continue

      await db[table].clear()

      const { valid, rejected } = validateRecords(table, records)
      if (rejected.length > 0) {
        importReport.rejected += rejected.length
        importReport.details.push({ table, rejected })
        console.warn(`[Backup] ${table}: ${rejected.length} record scartati`, rejected)
      }
      if (valid.length > 0) {
        await db[table].bulkAdd(valid)
        importReport.imported += valid.length
      }
      importReport.tables++
    }
  })

  if (importReport.rejected > 0) {
    console.warn(`[Backup] Import: ${importReport.imported} importati, ${importReport.rejected} scartati`)
  } else {
    console.info(`[Backup] Import completato: ${importReport.imported} record in ${importReport.tables} tabelle`)
  }

  return importReport
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
