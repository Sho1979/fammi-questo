/**
 * useBadgeCounts — Single consolidated live query for all BottomNav badge counts.
 * Replaces N+1 separate hook calls with one Dexie transaction.
 *
 * Returns: { tasks, calendar, dispensa, expenses }
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'

export function useBadgeCounts(familyId, expenseLastVisited = null) {
  return useLiveQuery(
    async () => {
      const empty = { tasks: 0, calendar: 0, dispensa: 0, expenses: 0 }
      if (!familyId) return empty

      const today = new Date().toISOString().slice(0, 10)
      const threeDaysLater = new Date()
      threeDaysLater.setDate(threeDaysLater.getDate() + 3)
      const expiryLimit = threeDaysLater.toISOString().slice(0, 10)

      // Run all queries in parallel within a single read transaction
      const [tasks, pendingEvents, expiringItems, newExpenses] = await Promise.all([
        // 1. Pending tasks count (not done, not deleted)
        db.tasks
          .where('family_id').equals(familyId)
          .and((t) => !t._deleted && t.status !== 'done')
          .count(),

        // 2. Upcoming incomplete events (today or future, missing info)
        db.events
          .where('family_id').equals(familyId)
          .and((e) => !e._deleted && e.date >= today && (e.incomplete || e.needsPickup))
          .count(),

        // 3. Expiring inventory items (within 3 days)
        db.inventory
          .where('family_id').equals(familyId)
          .and((i) => !i._deleted && i.expiry_date && i.expiry_date <= expiryLimit)
          .count(),

        // 4. Today's expenses since last visit
        db.expenses
          .where('family_id').equals(familyId)
          .and((e) => !e._deleted && e.date === today &&
            (!expenseLastVisited || e.created_at > expenseLastVisited))
          .count(),
      ])

      return {
        tasks,
        calendar: pendingEvents,
        dispensa: expiringItems,
        expenses: newExpenses,
      }
    },
    [familyId, expenseLastVisited],
    { tasks: 0, calendar: 0, dispensa: 0, expenses: 0 }
  )
}
