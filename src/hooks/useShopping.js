/**
 * R3.1 — useShopping: shopping list CRUD + live queries.
 * Items can be checked off, categorized, and have quantities.
 *
 * ShoppingItem schema (in localDb.js: shoppingItems table):
 *   id, family_id, name, quantity (number), unit ('pz'|'kg'|'L'|'g'|''),
 *   category, checked (bool), added_by (member_id), note, created_at
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import { createRecord, updateRecord, deleteRecord } from '../lib/crud.js'
import { cancelShoppingReminders } from '../lib/notificationScheduler.js'
import useAuthStore from '../store/authStore.js'

// ─── Constants ──────────────────────────────────────────────────

export const SHOPPING_CATEGORIES = [
  { id: 'frutta_verdura', label: 'Frutta e Verdura', icon: '🥬' },
  { id: 'carne_pesce', label: 'Carne e Pesce', icon: '🥩' },
  { id: 'latticini', label: 'Latticini', icon: '🧀' },
  { id: 'pane_pasta', label: 'Pane e Pasta', icon: '🍞' },
  { id: 'bevande', label: 'Bevande', icon: '🥤' },
  { id: 'surgelati', label: 'Surgelati', icon: '🧊' },
  { id: 'igiene', label: 'Igiene', icon: '🧴' },
  { id: 'casa', label: 'Casa', icon: '🏠' },
  { id: 'altro', label: 'Altro', icon: '📦' },
]

export const UNITS = ['pz', 'kg', 'g', 'L', 'mL', '']

// ─── CRUD ───────────────────────────────────────────────────────

/**
 * Aggiunge un item alla lista spesa.
 * Se esiste già un item con lo stesso nome (non spuntato), incrementa la quantità.
 * @returns {{ record, wasMerged: boolean }}
 */
export async function addShoppingItem(data) {
  const state = useAuthStore.getState()
  const familyId = state.familyId

  // Rilevamento duplicati: cerca item con stesso nome non ancora spuntato
  if (familyId && data.name) {
    const normalized = data.name.trim().toLowerCase()
    try {
      const existing = await db.shoppingItems
        .where('family_id').equals(familyId)
        .and(i => !i._deleted && !i.checked && i.name.trim().toLowerCase() === normalized)
        .first()
      if (existing) {
        // Merge: somma quantità
        const newQty = (Number(existing.quantity) || 1) + (Number(data.quantity) || 1)
        await updateRecord('shoppingItems', existing.id, { quantity: newQty })
        return { record: { ...existing, quantity: newQty }, wasMerged: true }
      }
    } catch {}
  }

  const record = await createRecord('shoppingItems', {
    ...data,
    family_id: familyId,
    checked: false,
    added_by: state.currentMember?.id || null,
  })
  return { record, wasMerged: false }
}

export async function updateShoppingItem(id, changes) {
  return updateRecord('shoppingItems', id, changes)
}

export async function toggleItem(id, currentChecked) {
  const result = await updateRecord('shoppingItems', id, { checked: !currentChecked })
  // Se viene spuntato (checked = true), cancella le notifiche programmate
  if (!currentChecked) {
    try { cancelShoppingReminders(id) } catch (e) { /* ignore */ }
  }
  return result
}

export async function deleteShoppingItem(id) {
  return deleteRecord('shoppingItems', id)
}

/** Remove all checked items (clear completed). */
export async function clearCheckedItems(familyId) {
  const checked = await db.shoppingItems
    .where('family_id')
    .equals(familyId)
    .and((i) => !i._deleted && i.checked)
    .toArray()
  for (const item of checked) {
    await deleteRecord('shoppingItems', item.id)
  }
  return checked.length
}

/** Quick add: parse "2 kg pomodori" or "latte" into structured item. */
export function parseQuickAdd(text) {
  const match = text.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|L|mL|pz)?\s+(.+)$/i)
  if (match) {
    return {
      quantity: parseFloat(match[1].replace(',', '.')),
      unit: match[2]?.toLowerCase() || 'pz',
      name: match[3].trim(),
    }
  }
  return { quantity: 1, unit: 'pz', name: text.trim() }
}

// ─── Live Queries ───────────────────────────────────────────────

/** All shopping items, grouped by category, unchecked first. */
export function useShoppingList(familyId) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      const items = await db.shoppingItems
        .where('family_id')
        .equals(familyId)
        .and((i) => !i._deleted)
        .toArray()
      // Sort: unchecked first, then by category, then by name
      return items.sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1
        if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '')
        return (a.name || '').localeCompare(b.name || '')
      })
    },
    [familyId],
    []
  )
}

export function useShoppingCount(familyId) {
  return useLiveQuery(
    async () => {
      if (!familyId) return { total: 0, checked: 0 }
      const items = await db.shoppingItems
        .where('family_id')
        .equals(familyId)
        .and((i) => !i._deleted)
        .toArray()
      return {
        total: items.length,
        checked: items.filter((i) => i.checked).length,
      }
    },
    [familyId],
    { total: 0, checked: 0 }
  )
}
