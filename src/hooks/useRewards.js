/**
 * STEP 13.1 — useRewards: gamification with points, streaks, leaderboard.
 * Points come from completed tasks (task.points). This hook reads from tasks table.
 * Rewards table stores manual bonus/penalty and streak data.
 *
 * Reward schema:
 *   id, family_id, member_id, points, reason, type ('bonus'|'penalty'|'task_complete'),
 *   created_at
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import { createRecord } from '../lib/crud.js'
import useAuthStore from '../store/authStore.js'

// ─── Actions ────────────────────────────────────────────────────

/** Award bonus points to a member. */
export async function awardBonus(memberId, points, reason) {
  const familyId = useAuthStore.getState().familyId
  return createRecord('rewards', {
    family_id: familyId,
    member_id: memberId,
    points,
    reason: reason || 'Bonus',
    type: 'bonus',
  })
}

/** Deduct points (penalty). */
export async function deductPoints(memberId, points, reason) {
  const familyId = useAuthStore.getState().familyId
  return createRecord('rewards', {
    family_id: familyId,
    member_id: memberId,
    points: -Math.abs(points),
    reason: reason || 'Penalità',
    type: 'penalty',
  })
}

/** Record task completion reward (called automatically when task is completed). */
export async function recordTaskReward(memberId, points, taskTitle) {
  const familyId = useAuthStore.getState().familyId
  return createRecord('rewards', {
    family_id: familyId,
    member_id: memberId,
    points,
    reason: `Task: ${taskTitle}`,
    type: 'task_complete',
  })
}

// ─── Live Queries ───────────────────────────────────────────────

/**
 * Leaderboard: total points per member, sorted descending.
 * Returns [{ member_id, totalPoints, taskCount }]
 */
export function useLeaderboard(familyId) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []

      const rewards = await db.rewards
        .where('family_id')
        .equals(familyId)
        .and((r) => !r._deleted)
        .toArray()

      const map = {}
      for (const r of rewards) {
        if (!map[r.member_id]) map[r.member_id] = { member_id: r.member_id, totalPoints: 0, count: 0 }
        map[r.member_id].totalPoints += r.points || 0
        if (r.type === 'task_complete') map[r.member_id].count++
      }

      return Object.values(map).sort((a, b) => b.totalPoints - a.totalPoints)
    },
    [familyId],
    []
  )
}

/**
 * Reward history for a specific member.
 */
export function useRewardHistory(familyId, memberId) {
  return useLiveQuery(
    async () => {
      if (!familyId || !memberId) return []
      return db.rewards
        .where('family_id')
        .equals(familyId)
        .and((r) => !r._deleted && r.member_id === memberId)
        .reverse()
        .sortBy('created_at')
    },
    [familyId, memberId],
    []
  )
}

/**
 * Total points for a member.
 */
export function useMemberPoints(familyId, memberId) {
  return useLiveQuery(
    async () => {
      if (!familyId || !memberId) return 0
      const rewards = await db.rewards
        .where('family_id')
        .equals(familyId)
        .and((r) => !r._deleted && r.member_id === memberId)
        .toArray()
      return rewards.reduce((sum, r) => sum + (r.points || 0), 0)
    },
    [familyId, memberId],
    0
  )
}
