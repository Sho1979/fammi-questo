/**
 * R3.3 — useInventory: track what's in the house (pantry, fridge, freezer).
 * Enhanced: smart merge, auto-expiry, receipt-to-inventory, shopping-to-inventory.
 *
 * Inventory schema (in localDb.js: inventory table):
 *   id, family_id, name, quantity, unit, location ('dispensa'|'frigo'|'freezer'|'altro'),
 *   expiry_date (YYYY-MM-DD, nullable), category, note, added_by, created_at
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import { createRecord, updateRecord, deleteRecord } from '../lib/crud.js'
import useAuthStore from '../store/authStore.js'
import { getAutoExpiry, getAutoLocation } from '../lib/receiptOcr.js'

export const LOCATIONS = [
  { id: 'dispensa', label: 'Dispensa', icon: '🗄️' },
  { id: 'frigo', label: 'Frigo', icon: '🧊' },
  { id: 'freezer', label: 'Freezer', icon: '❄️' },
  { id: 'altro', label: 'Altro', icon: '📦' },
]

// ─── CRUD ───────────────────────────────────────────────────────

export async function addInventoryItem(data) {
  const familyId = useAuthStore.getState().familyId
  return createRecord('inventory', { ...data, family_id: familyId })
}

export async function updateInventoryItem(id, changes) {
  return updateRecord('inventory', id, changes)
}

export async function deleteInventoryItem(id) {
  return deleteRecord('inventory', id)
}

// ─── Smart Merge (from api.php receipt_add) ─────────────────────

/**
 * Add item to inventory with smart merge.
 * If an item with the same name (case-insensitive) already exists,
 * merge quantities and extend expiry date.
 */
export async function addOrMergeInventoryItem(data) {
  const familyId = useAuthStore.getState().familyId
  const memberId = useAuthStore.getState().currentMember?.id

  // Look for existing item with same name
  const existing = await db.inventory
    .where('family_id')
    .equals(familyId)
    .and((i) => !i._deleted && i.name.toLowerCase() === data.name.toLowerCase())
    .first()

  if (existing) {
    // Merge: add quantities, extend expiry if newer
    const newQty = (parseFloat(existing.quantity) || 0) + (parseFloat(data.quantity) || 1)
    const changes = { quantity: newQty }

    if (data.expiry_date && (!existing.expiry_date || data.expiry_date > existing.expiry_date)) {
      changes.expiry_date = data.expiry_date
    }

    await updateRecord('inventory', existing.id, changes)
    return { merged: true, item: { ...existing, ...changes } }
  }

  // New item
  const item = await createRecord('inventory', {
    ...data,
    family_id: familyId,
    added_by: memberId,
  })
  return { merged: false, item }
}

/**
 * Add multiple products from receipt OCR to inventory.
 * Uses smart merge for each product.
 * @param {Array<{name, quantity, price, category}>} products
 * @returns {Promise<{added: number, merged: number}>}
 */
export async function addReceiptToInventory(products) {
  let added = 0
  let merged = 0

  for (const p of products) {
    const category = p.category || 'altro'
    const result = await addOrMergeInventoryItem({
      name: p.name,
      quantity: p.quantity || 1,
      unit: 'pz',
      category,
      location: getAutoLocation(category),
      expiry_date: getAutoExpiry(category),
      note: p.price ? `€${p.price}` : '',
    })

    if (result.merged) merged++
    else added++
  }

  return { added, merged }
}

/**
 * Move checked shopping items to inventory.
 * Removes them from shopping list and adds to inventory with smart merge.
 * @param {Array} checkedItems - shopping items that are checked
 * @returns {Promise<{moved: number, merged: number}>}
 */
export async function moveShoppingToInventory(checkedItems) {
  let moved = 0
  let merged = 0

  for (const item of checkedItems) {
    const category = item.category || 'altro'
    const result = await addOrMergeInventoryItem({
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || 'pz',
      category,
      location: getAutoLocation(category),
      expiry_date: getAutoExpiry(category),
    })

    // Soft-delete from shopping list
    await deleteRecord('shoppingItems', item.id)

    if (result.merged) merged++
    else moved++
  }

  return { moved, merged }
}

// ─── Live Queries ───────────────────────────────────────────────

/** All inventory items grouped by location. */
export function useInventory(familyId) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return db.inventory
        .where('family_id')
        .equals(familyId)
        .and((i) => !i._deleted)
        .toArray()
    },
    [familyId],
    []
  )
}

/** Items expiring within N days. */
export function useExpiringItems(familyId, days = 3) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      const today = new Date()
      const limit = new Date(today)
      limit.setDate(limit.getDate() + days)
      const limitStr = limit.toISOString().slice(0, 10)

      return db.inventory
        .where('family_id')
        .equals(familyId)
        .and((i) => !i._deleted && i.expiry_date && i.expiry_date <= limitStr)
        .toArray()
    },
    [familyId, days],
    []
  )
}
