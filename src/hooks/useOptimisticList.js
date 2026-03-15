/**
 * R4.2 — useOptimisticList: React 19 optimistic updates for Dexie live queries.
 *
 * Wraps useLiveQuery results with useOptimistic to provide instant UI
 * feedback for CRUD operations (add, update, delete, toggle).
 *
 * Pattern:
 *   1. User action → optimistic update (instant UI) + Dexie write
 *   2. Dexie live query picks up real change → replaces optimistic state
 *
 * This is most valuable for:
 *   - Shopping list toggles (checked/unchecked)
 *   - Task completion (status → done)
 *   - Any list where the user expects instant response
 */
import { useOptimistic, useTransition, useCallback } from 'react'

/**
 * Wraps a Dexie live query result list with optimistic update capabilities.
 *
 * @param {Array} liveItems — result from useLiveQuery (the "real" data)
 * @returns {{ items, optimisticUpdate, optimisticRemove, optimisticAdd, isPending }}
 */
export default function useOptimisticList(liveItems) {
  const [isPending, startTransition] = useTransition()

  // useOptimistic: takes real state + reducer that applies optimistic changes
  const [optimisticItems, applyOptimistic] = useOptimistic(
    liveItems,
    (currentItems, action) => {
      switch (action.type) {
        case 'update': {
          // Update a single item in-place
          return currentItems.map((item) =>
            item.id === action.id ? { ...item, ...action.changes } : item
          )
        }
        case 'remove': {
          // Remove item from list (soft delete preview)
          return currentItems.filter((item) => item.id !== action.id)
        }
        case 'add': {
          // Add new item to list
          return [...currentItems, action.item]
        }
        default:
          return currentItems
      }
    }
  )

  /**
   * Optimistically update an item and run the actual async action.
   * @param {string} id — item id
   * @param {object} changes — fields to update optimistically
   * @param {Function} action — async function that performs the real update
   */
  const optimisticUpdate = useCallback((id, changes, action) => {
    startTransition(async () => {
      applyOptimistic({ type: 'update', id, changes })
      await action()
    })
  }, [applyOptimistic])

  /**
   * Optimistically remove an item and run the actual async delete.
   * @param {string} id — item id
   * @param {Function} action — async function that performs the real delete
   */
  const optimisticRemove = useCallback((id, action) => {
    startTransition(async () => {
      applyOptimistic({ type: 'remove', id })
      await action()
    })
  }, [applyOptimistic])

  /**
   * Optimistically add an item and run the actual async create.
   * @param {object} tempItem — temporary item for instant UI
   * @param {Function} action — async function that performs the real create
   */
  const optimisticAdd = useCallback((tempItem, action) => {
    startTransition(async () => {
      applyOptimistic({ type: 'add', item: tempItem })
      await action()
    })
  }, [applyOptimistic])

  return {
    items: optimisticItems,
    optimisticUpdate,
    optimisticRemove,
    optimisticAdd,
    isPending,
  }
}
