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

// ─── Role Visibility Rules ───────────────────────────────────────
// Which roles can see notifications for each data table.
// Must match the app's data access policy.

const ROLE_VISIBILITY = {
  events:        { genitore: true, figlio: true, nonno: true },
  tasks:         { genitore: true, figlio: true, nonno: true },
  expenses:      { genitore: true, figlio: false, nonno: false },
  shoppingItems: { genitore: true, figlio: false, nonno: true },
  mealPlans:     { genitore: true, figlio: true, nonno: true },
}

// Map notification types to their corresponding data table for role filtering
const TYPE_TO_TABLE = {
  expense: 'expenses',
  shopping: 'shoppingItems',
  calendar: 'events',
  task_assigned: 'tasks',
  task_complete: 'tasks',
  task_proposed: 'tasks',
  task_approved: 'tasks',
  task_rejected: 'tasks',
  meal: 'mealPlans',
}

/** Check if a member's role is allowed to see notifications for a given type. */
function isRoleAllowed(memberRole, notificationType) {
  const table = TYPE_TO_TABLE[notificationType]
  if (!table) return true // Unknown type → allow (general notifications go to everyone)
  const rules = ROLE_VISIBILITY[table]
  if (!rules) return true
  // Normalize role names: 'parent'/'elder' → app equivalents
  const normalizedRole = memberRole === 'parent' ? 'genitore'
    : memberRole === 'elder' ? 'nonno'
    : memberRole === 'child' ? 'figlio'
    : memberRole // already 'genitore'/'figlio'/'nonno'
  return rules[normalizedRole] !== false
}

// ─── Actions ────────────────────────────────────────────────────

/** Create a notification for a specific member. */
export async function notify(memberId, { type, title, message, icon, data, message_context_id }) {
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
    message_context_id: message_context_id || null,
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

/** Broadcast a notification to all family members (except sender), filtered by role visibility. */
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
    // Role visibility filter: skip members whose role can't see this notification type
    if (!isRoleAllowed(m.role, type)) continue
    await notify(m.id, { type, title, message, icon, data })
  }
}

/** Notify only parents (genitore role). */
export async function notifyParents({ type, title, message, icon, data }) {
  const familyId = useAuthStore.getState().familyId
  if (!familyId) return
  const parents = await db.members
    .where('family_id')
    .equals(familyId)
    .and((m) => !m._deleted && (m.role === 'parent' || m.role === 'genitore'))
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

/**
 * Clustered notification: sends ONE notification for multiple actions
 * born from the same message (same message_context_id).
 *
 * Instead of 3 separate notifications for "porta Viola, compra latte, ricordami bollo",
 * sends: "Dal messaggio di Cristian: portare Viola, comprare latte, ricordare bollo"
 */
export async function notifyCluster(messageContextId, { senderName, senderIcon, actions, excludeMemberId }) {
  if (!actions || actions.length === 0) return

  // Single action = normal notification, no cluster
  if (actions.length === 1) {
    const a = actions[0]
    const typeEmoji = { calendar: '📅', task: '📌', expense: '💰', shopping: '🛒', meal: '🍽️', reminder: '🔔', note: '📝' }
    await notifyAll({
      type: a.type || 'general',
      title: `${senderIcon || '👤'} ${senderName}`,
      message: `${typeEmoji[a.type] || '📌'} ${a.title || a.text || a.name || ''}`,
      icon: typeEmoji[a.type] || '📌',
      data: { message_context_id: messageContextId },
      excludeMemberId,
    })
    return
  }

  // Multiple actions = cluster notification
  const typeEmoji = { calendar: '📅', task: '📌', expense: '💰', shopping: '🛒', meal: '🍽️', reminder: '🔔', note: '📝' }
  const actionSummaries = actions.map(a => {
    const emoji = typeEmoji[a.type] || '📌'
    const label = a.title || a.text || a.name || a.type
    return `${emoji} ${label}`
  })

  const title = `${senderIcon || '👤'} ${senderName} — ${actions.length} azioni`
  const message = actionSummaries.join('\n')

  await notifyAll({
    type: 'brain_cluster',
    title,
    message,
    icon: '🧠',
    data: {
      message_context_id: messageContextId,
      action_count: actions.length,
      action_types: actions.map(a => a.type),
    },
    excludeMemberId,
  })
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
      title: `${personIcon || '👤'} ${personName} ha speso ${(amount || 0).toFixed(2)}€`,
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
    const slotEmoji = (slot === 'pranzo' || slot === 'lunch') ? '🍝' : '🍽️'
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
