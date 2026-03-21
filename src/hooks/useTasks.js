/**
 * STEP 12.1 — useTasks hook: CRUD + live queries for family tasks.
 * Modeled after cristianperani.com/spese/api.php task system.
 *
 * Key concepts (from brain.php / api.php):
 * - doneBy: tracks WHO completed the task (not just assigned_to)
 * - assigned_to can be a member_id OR 'tutti' (anyone can do it)
 * - Proposals: children propose tasks THEY ALREADY DID → parent confirms
 * - Gamification: weekly prize, whoever completes more tasks wins
 * - Only parents (role=parent/elder) can: add tasks, approve/reject proposals
 * - Children can: complete assigned tasks, propose completed tasks
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import { createRecord, updateRecord, deleteRecord } from '../lib/crud.js'
import useAuthStore from '../store/authStore.js'
import { notifyEvents } from './useNotifications.js'
import { scheduleTaskReminder, cancelTaskReminder, cancelDailyTaskReminders } from '../lib/notificationScheduler.js'

// ─── CRUD Actions ───────────────────────────────────────────────

export async function addTask(data) {
  const state = useAuthStore.getState()
  const record = await createRecord('tasks', {
    ...data,
    family_id: state.familyId,
    status: data.status || 'todo',
    proposal: data.proposal || false,
    approved: data.approved ?? true,
    points: data.points || 0,
    created_by: data.created_by || state.currentMember?.id,
    done_by: null,
    done_at: null,
  })
  // Schedula reminder nativo per la scadenza (noop su web) — protetto
  try {
    scheduleTaskReminder(record)
  } catch (err) {
    console.warn('[Tasks] scheduleTaskReminder fallito (task comunque salvato):', err)
  }
  return record
}

export async function updateTask(id, changes) {
  const record = await updateRecord('tasks', id, changes)
  // Re-schedula se la data è cambiata — protetto
  if (changes.due_date !== undefined) {
    try { scheduleTaskReminder(record) } catch (err) {
      console.warn('[Tasks] scheduleTaskReminder fallito su update:', err)
    }
  }
  return record
}

export async function deleteTask(id) {
  cancelTaskReminder(id)
  try { cancelDailyTaskReminders(id) } catch (e) { /* ignore */ }
  return deleteRecord('tasks', id)
}

export async function undoDeleteTask(id) {
  return updateRecord('tasks', id, { _deleted: false })
}

/**
 * Mark task as done — tracks WHO completed it (doneBy).
 * This is critical for the leaderboard: the person who
 * completes it gets the point, even if assigned to 'tutti'.
 */
export async function completeTask(id, doneByMemberId) {
  // Cancella tutti i promemoria giornalieri (bollette, scadenze, ecc.)
  try { cancelDailyTaskReminders(id) } catch (e) { /* ignore */ }
  cancelTaskReminder(id)
  const state = useAuthStore.getState()
  const doerId = doneByMemberId || state.currentMember?.id
  await updateRecord('tasks', id, {
    status: 'done',
    done_by: doerId,
    done_at: new Date().toISOString(),
  })
  // Send notifications
  try {
    const task = await db.tasks.get(id)
    const doer = state.currentMember
    if (task && doer) {
      await notifyEvents.taskCompleted(
        doer.name,
        doer.icon || doer.avatar || '👤',
        task.title,
        task.created_by !== doerId ? task.created_by : null
      )
    }
  } catch { /* notifications are best-effort */ }
}

/** Move task back to todo. */
export async function reopenTask(id) {
  return updateRecord('tasks', id, {
    status: 'todo',
    done_by: null,
    done_at: null,
  })
}

/**
 * Child proposes a task they ALREADY DID.
 * Parent must confirm before it counts for the leaderboard.
 * (Like brain.php: "Asia propone: Ho pulito il bagno")
 */
export async function proposeTask(data) {
  const state = useAuthStore.getState()
  const result = await createRecord('tasks', {
    ...data,
    family_id: state.familyId,
    created_by: state.currentMember?.id,
    proposed_by: state.currentMember?.id,
    proposal: true,
    approved: false,
    status: 'done', // Already done — needs confirmation
    done_by: state.currentMember?.id,
    done_at: new Date().toISOString(),
    points: data.points || 5,
  })
  // Notify parents
  try {
    const m = state.currentMember
    if (m) {
      await notifyEvents.taskProposed(m.name, m.icon || m.avatar || '👤', data.title)
    }
  } catch { /* best-effort */ }
  return result
}

/** Parent approves a proposed task — now counts for leaderboard. */
export async function approveTask(id, approvedByMemberId) {
  const state = useAuthStore.getState()
  await updateRecord('tasks', id, {
    approved: true,
    approved_by: approvedByMemberId || state.currentMember?.id,
    approved_at: new Date().toISOString(),
  })
  // Notify proposer
  try {
    const task = await db.tasks.get(id)
    const approver = state.currentMember
    if (task && approver) {
      await notifyEvents.taskApproved(
        approver.name,
        approver.icon || approver.avatar || '👤',
        task.proposed_by || task.done_by,
        task.title
      )
    }
  } catch { /* best-effort */ }
}

/** Parent rejects a proposed task. */
export async function rejectTask(id, rejectedByMemberId) {
  const state = useAuthStore.getState()
  // Read task before deleting to get proposer info
  let task
  try { task = await db.tasks.get(id) } catch { /* ignore */ }

  await updateRecord('tasks', id, {
    _deleted: true,
    rejected_by: rejectedByMemberId || state.currentMember?.id,
    rejected_at: new Date().toISOString(),
  })
  // Notify proposer
  try {
    const rejecter = state.currentMember
    if (task && rejecter) {
      await notifyEvents.taskRejected(
        rejecter.name,
        rejecter.icon || rejecter.avatar || '👤',
        task.proposed_by || task.done_by,
        task.title,
        ''
      )
    }
  } catch { /* best-effort */ }
}

// ─── Template CRUD ──────────────────────────────────────────────

export async function addTemplate(data) {
  const familyId = useAuthStore.getState().familyId
  return createRecord('taskTemplates', { ...data, family_id: familyId })
}

export async function updateTemplate(id, changes) {
  return updateRecord('taskTemplates', id, changes)
}

export async function deleteTemplate(id) {
  return deleteRecord('taskTemplates', id)
}

export async function generateFromTemplates() {
  const familyId = useAuthStore.getState().familyId
  if (!familyId) return []

  const templates = await db.taskTemplates
    .where('family_id')
    .equals(familyId)
    .and((t) => !t._deleted)
    .toArray()

  const today = new Date().toISOString().slice(0, 10)
  const created = []

  for (const tmpl of templates) {
    const existing = await db.tasks
      .where('family_id')
      .equals(familyId)
      .and((t) => !t._deleted && t.template_id === tmpl.id && t.due_date === today)
      .first()

    if (!existing) {
      const task = await createRecord('tasks', {
        family_id: familyId,
        title: tmpl.title,
        description: tmpl.description || '',
        category: tmpl.category || 'altro',
        priority: tmpl.priority || 'medium',
        status: 'todo',
        assigned_to: tmpl.assigned_to || null,
        created_by: 'system',
        due_date: today,
        points: tmpl.points || 0,
        proposal: false,
        approved: true,
        template_id: tmpl.id,
      })
      created.push(task)
    }
  }
  return created
}

// ─── Live Queries ───────────────────────────────────────────────

/** All active tasks (not deleted, approved). */
export function useAllTasks(familyId) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return db.tasks
        .where('family_id')
        .equals(familyId)
        .and((t) => !t._deleted && t.approved)
        .sortBy('due_date')
    },
    [familyId],
    []
  )
}

/** Tasks for a specific member (or assigned to 'tutti'). */
export function useTasksByMember(familyId, memberId) {
  return useLiveQuery(
    async () => {
      if (!familyId || !memberId) return []
      return db.tasks
        .where('family_id')
        .equals(familyId)
        .and((t) => !t._deleted && t.approved && (t.assigned_to === memberId || t.assigned_to === 'tutti'))
        .sortBy('due_date')
    },
    [familyId, memberId],
    []
  )
}

/** Today's tasks. */
export function useTodayTasks(familyId) {
  const today = new Date().toISOString().slice(0, 10)
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return db.tasks
        .where('family_id')
        .equals(familyId)
        .and((t) => !t._deleted && t.approved && t.due_date === today)
        .sortBy('due_date')
    },
    [familyId, today],
    []
  )
}

/** Pending proposals (not yet approved). */
export function usePendingProposals(familyId) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return db.tasks
        .where('family_id')
        .equals(familyId)
        .and((t) => !t._deleted && t.proposal && !t.approved)
        .toArray()
    },
    [familyId],
    []
  )
}

/** All templates. */
export function useTemplates(familyId) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return db.taskTemplates
        .where('family_id')
        .equals(familyId)
        .and((t) => !t._deleted)
        .toArray()
    },
    [familyId],
    []
  )
}

// ─── GAMIFICATION — Weekly Leaderboard ──────────────────────────
// Modeled after api.php rewards_leaderboard

function getMonday(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Weekly leaderboard: who completed the most tasks this week.
 * Only counts children (role = 'child' / figlio).
 * Weekly prize: €20 split if tie.
 */
export function useWeeklyLeaderboard(familyId) {
  return useLiveQuery(
    async () => {
      // Premio configurabile da Settings, fallback €20
      let WEEKLY_PRIZE = 20
      try {
        const setting = await db.settings.get('weekly-prize')
        if (setting?.value) WEEKLY_PRIZE = Number(setting.value) || 20
      } catch {}

      if (!familyId) return { leaderboard: [], weekLabel: '', weeklyPrize: WEEKLY_PRIZE }

      const monday = getMonday()
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      const weekStart = monday.toISOString().slice(0, 10)
      const weekEnd = sunday.toISOString().slice(0, 10)
      const weekLabel = `${monday.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} — ${sunday.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}`

      // Get only children for the leaderboard (gamification is for kids only)
      // Adults get simple tracking, not classifica/premi
      const allMembers = await db.members
        .where('family_id')
        .equals(familyId)
        .and((m) => !m._deleted)
        .toArray()
      const members = allMembers.filter((m) =>
        m.role === 'child' || m.role === 'figlio' || m.role === 'ragazzo'
      )

      // Completed tasks this week (compound index, approved only)
      const weekTasks = await db.tasks
        .where('[family_id+due_date]')
        .between([familyId, weekStart], [familyId, weekEnd], true, true)
        .and((t) => !t._deleted && t.status === 'done' && t.approved)
        .toArray()

      // All-time completed tasks (for total count display)
      const allDoneTasks = await db.tasks
        .where('family_id')
        .equals(familyId)
        .and((t) => !t._deleted && t.status === 'done' && t.approved)
        .toArray()

      // Build leaderboard
      const leaderboard = members.map((m) => {
        // Tasks completed BY this person this week (doneBy takes priority)
        const completedWeek = weekTasks.filter((t) => {
          const doer = t.done_by || t.assigned_to
          return doer === m.id
        })

        // All-time completed
        const completedAll = allDoneTasks.filter((t) => {
          const doer = t.done_by || t.assigned_to
          return doer === m.id
        })

        // Count tasks assigned this week (excluding proposals)
        const assignedWeek = weekTasks.filter((t) =>
          t.assigned_to === m.id || t.assigned_to === 'tutti'
        )

        return {
          member_id: m.id,
          name: m.name,
          avatar: m.avatar,
          assignedWeek: assignedWeek.length,
          completedWeek: completedWeek.length,
          completedAll: completedAll.length,
        }
      })

      // Sort by completedWeek desc
      leaderboard.sort((a, b) => b.completedWeek - a.completedWeek)

      // Check if tie
      const topScore = leaderboard[0]?.completedWeek || 0
      const isParimerito = leaderboard.length > 1 &&
        leaderboard[0].completedWeek === leaderboard[1].completedWeek &&
        topScore > 0
      const weeklyPrizeEach = isParimerito
        ? Math.floor(WEEKLY_PRIZE / leaderboard.filter((l) => l.completedWeek === topScore).length)
        : WEEKLY_PRIZE

      return {
        leaderboard,
        weekLabel,
        weeklyPrize: WEEKLY_PRIZE,
        isParimerito,
        weeklyPrizeEach,
        topScore,
      }
    },
    [familyId],
    { leaderboard: [], weekLabel: '', weeklyPrize: 20, isParimerito: false, weeklyPrizeEach: 20, topScore: 0 }
  )
}

/** Count of pending (not done) tasks — for badge notifications. */
export function usePendingTasksCount(familyId) {
  return useLiveQuery(
    async () => {
      if (!familyId) return 0
      const pending = await db.tasks
        .where('family_id')
        .equals(familyId)
        .and((t) => !t._deleted && t.approved && t.status !== 'done')
        .count()
      return pending
    },
    [familyId],
    0
  )
}

/** Completed tasks count per member (legacy support). */
export function useCompletedTasksStats(familyId) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      const done = await db.tasks
        .where('family_id')
        .equals(familyId)
        .and((t) => !t._deleted && t.status === 'done' && t.approved)
        .toArray()

      const stats = {}
      for (const t of done) {
        const key = t.done_by || t.assigned_to || 'unassigned'
        if (!stats[key]) stats[key] = { member_id: key, count: 0, totalPoints: 0 }
        stats[key].count++
        stats[key].totalPoints += t.points || 0
      }
      return Object.values(stats).sort((a, b) => b.count - a.count)
    },
    [familyId],
    []
  )
}
