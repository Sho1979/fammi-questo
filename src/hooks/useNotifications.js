/**
 * STEP 15.1 — useNotifications: in-app notification system.
 * Enhanced to match api.php addNotification patterns.
 *
 * Notification schema:
 *   id, family_id, member_id (recipient), type, title, message, icon,
 *   read (bool), data (JSON), created_at
 *
 * Keeps max 50 per member. Includes convenience helpers for each notification type.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import { createRecord, updateRecord, deleteRecord } from '../lib/crud.js'
import useAuthStore from '../store/authStore.js'
import { showNativeNotification } from '../lib/nativeNotifications.js'

// ─── Actions ────────────────────────────────────────────────────

/** Create a notification for a specific member. */
export async function notify(memberId, { type, title, message, icon, data }) {
  const familyId = useAuthStore.getState().familyId
  if (!familyId) return

  await createRecord('notifications', {
    family_id: familyId,
    member_id: memberId,
    type: type || 'general',
    title,
    message: message || '',
    icon: icon || '📌',
    read: false,
    data: data || null,
  })

  // Trigger native push se la notifica è per il membro corrente sul dispositivo
  const currentMemberId = useAuthStore.getState().currentMember?.id
  if (memberId === currentMemberId) {
    showNativeNotification({
      title: title || 'Fammi Questo',
      body: message || '',
      extra: { type: type || 'general', memberId },
    })
  }

  // Trim to last 50 notifications per member
  const all = await db.notifications
    .where('family_id')
    .equals(familyId)
    .and((n) => !n._deleted && n.member_id === memberId)
    .toArray()

  if (all.length > 50) {
    const sorted = all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    const toDelete = sorted.slice(50)
    for (const n of toDelete) {
      await deleteRecord('notifications', n.id)
    }
  }
}

/** Broadcast a notification to all family members (except sender). */
export async function notifyAll({ type, title, message, icon, data, excludeMemberId }) {
  const familyId = useAuthStore.getState().familyId
  if (!familyId) return
  const members = await db.members
    .where('family_id')
    .equals(familyId)
    .and((m) => !m._deleted)
    .toArray()
  for (const m of members) {
    if (excludeMemberId && m.id === excludeMemberId) continue
    await notify(m.id, { type, title, message, icon, data })
  }
}

/** Notify only parents. */
export async function notifyParents({ type, title, message, icon, data }) {
  const familyId = useAuthStore.getState().familyId
  if (!familyId) return
  const parents = await db.members
    .where('family_id')
    .equals(familyId)
    .and((m) => !m._deleted && (m.role === 'parent' || m.role === 'elder' || m.role === 'genitore'))
    .toArray()
  for (const m of parents) {
    await notify(m.id, { type, title, message, icon, data })
  }
}

/** Mark a notification as read. */
export async function markAsRead(id) {
  return updateRecord('notifications', id, { read: true })
}

/** Mark all notifications for current member as read. */
export async function markAllAsRead() {
  const state = useAuthStore.getState()
  if (!state.familyId || !state.currentMember) return
  const unread = await db.notifications
    .where('family_id')
    .equals(state.familyId)
    .and((n) => !n._deleted && n.member_id === state.currentMember.id && !n.read)
    .toArray()
  for (const n of unread) {
    await updateRecord('notifications', n.id, { read: true })
  }
}

// ─── Convenience helpers (match api.php patterns) ───────────────

export const notifyEvents = {
  /** Task assigned: notify both creator and assignee */
  taskAssigned: async (creatorName, creatorIcon, assigneeName, assigneeId, taskTitle, dateLabel) => {
    // Notify the assignee
    if (assigneeId) {
      await notify(assigneeId, {
        type: 'task_assigned',
        title: `${creatorIcon || '👤'} ${creatorName} ti ha assegnato un task`,
        message: `📌 "${taskTitle}" ${dateLabel || ''}`,
        icon: '📌',
      })
    }
  },

  /** Task completed: notify completor + creator */
  taskCompleted: async (doneByName, doneByIcon, taskTitle, creatorId) => {
    // Notify the creator
    if (creatorId) {
      await notify(creatorId, {
        type: 'task_complete',
        title: `${doneByIcon || '👤'} ${doneByName} ha completato il task!`,
        message: `✅ "${taskTitle}" — fatto! +1 punto 🏆`,
        icon: '🏆',
      })
    }
  },

  /** Task proposed (child says "l'ho fatto"): notify all parents */
  taskProposed: async (proposerName, proposerIcon, taskTitle) => {
    await notifyParents({
      type: 'task_proposed',
      title: `${proposerIcon || '👤'} ${proposerName} dice: Ho fatto!`,
      message: `📣 "${taskTitle}" — Confermi? ✅`,
      icon: '📣',
    })
  },

  /** Task approved: notify proposer */
  taskApproved: async (approverName, approverIcon, proposerId, taskTitle) => {
    if (proposerId) {
      await notify(proposerId, {
        type: 'task_approved',
        title: `${approverIcon || '👤'} ${approverName} ha confermato! +1 punto 🏆`,
        message: `✅ "${taskTitle}" approvato!`,
        icon: '🏆',
      })
    }
  },

  /** Task rejected: notify proposer */
  taskRejected: async (rejecterName, rejecterIcon, proposerId, taskTitle, reason) => {
    if (proposerId) {
      await notify(proposerId, {
        type: 'task_rejected',
        title: `${rejecterIcon || '👤'} ${rejecterName} non ha confermato`,
        message: `❌ "${taskTitle}" — ${reason || 'non approvato'}`,
        icon: '❌',
      })
    }
  },

  /** Expense added: notify all (expense type, parents only like api.php) */
  expenseAdded: async (personName, personIcon, amount, note) => {
    await notifyParents({
      type: 'expense',
      title: `${personIcon || '👤'} ${personName} ha speso ${amount.toFixed(2)}€`,
      message: note || '',
      icon: '💰',
    })
  },

  /** Calendar event created: notify all family */
  eventCreated: async (creatorName, creatorIcon, eventTitle, dateStr, assignLabel) => {
    await notifyAll({
      type: 'calendar',
      title: `${creatorIcon || '👤'} ${creatorName} ha aggiunto un impegno`,
      message: `📅 ${eventTitle} (${dateStr})${assignLabel ? ` → ${assignLabel}` : ''}`,
      icon: '📅',
      excludeMemberId: useAuthStore.getState().currentMember?.id,
    })
  },

  /** Shopping item added: notify all */
  shoppingAdded: async (adderName, adderIcon, itemName, urgent) => {
    await notifyAll({
      type: 'shopping',
      title: '🛒 Lista spesa',
      message: `${adderIcon || '👤'} ${adderName} ha aggiunto: ${itemName}${urgent ? ' ⚡ URGENTE' : ''}`,
      icon: '🛒',
      excludeMemberId: useAuthStore.getState().currentMember?.id,
    })
  },

  /** Meal assigned: notify cook */
  mealAssigned: async (cookId, dish, slot) => {
    const slotEmoji = slot === 'pranzo' ? '🍝' : '🍽️'
    if (cookId) {
      await notify(cookId, {
        type: 'meal',
        title: `${slotEmoji} Tocca a te cucinare!`,
        message: `Prepara: ${dish} per ${slot}`,
        icon: '👨‍🍳',
      })
    }
  },
}

// ─── Live Queries ───────────────────────────────────────────────

/** All notifications for current member, newest first. */
export function useNotifications(familyId, memberId) {
  return useLiveQuery(
    async () => {
      if (!familyId || !memberId) return []
      const all = await db.notifications
        .where('family_id')
        .equals(familyId)
        .and((n) => !n._deleted && n.member_id === memberId)
        .toArray()
      return all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    },
    [familyId, memberId],
    []
  )
}

/** Unread count for badge. */
export function useUnreadCount(familyId, memberId) {
  return useLiveQuery(
    async () => {
      if (!familyId || !memberId) return 0
      return db.notifications
        .where('family_id')
        .equals(familyId)
        .and((n) => !n._deleted && n.member_id === memberId && !n.read)
        .count()
    },
    [familyId, memberId],
    0
  )
}
