/**
 * R3.2 — useMeals: weekly meal planning.
 *
 * MealPlan schema (in localDb.js: mealPlans table):
 *   id, family_id, date (YYYY-MM-DD), slot ('colazione'|'pranzo'|'cena'|'snack'),
 *   name, note, recipe_url, created_by
 *
 * Meals table: reusable saved meals/recipes
 *   id, family_id, name, ingredients (text), category, favorite (bool)
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import { createRecord, updateRecord, deleteRecord } from '../lib/crud.js'
import useAuthStore from '../store/authStore.js'

export const MEAL_SLOTS = [
  { id: 'colazione', label: 'Colazione', icon: '🥐', time: '07:30' },
  { id: 'pranzo', label: 'Pranzo', icon: '🍝', time: '12:30' },
  { id: 'cena', label: 'Cena', icon: '🥗', time: '19:30' },
  { id: 'snack', label: 'Snack', icon: '🍎', time: '16:00' },
]

// ─── Meal Plan CRUD ─────────────────────────────────────────────

export async function addMealPlan(data) {
  const state = useAuthStore.getState()
  return createRecord('mealPlans', {
    ...data,
    family_id: state.familyId,
    created_by: state.currentMember?.id || null,
  })
}

export async function updateMealPlan(id, changes) {
  return updateRecord('mealPlans', id, changes)
}

export async function deleteMealPlan(id) {
  return deleteRecord('mealPlans', id)
}

// ─── Saved Meals CRUD ───────────────────────────────────────────

export async function saveMeal(data) {
  const familyId = useAuthStore.getState().familyId
  return createRecord('meals', { ...data, family_id: familyId, favorite: false })
}

export async function toggleFavorite(id, current) {
  return updateRecord('meals', id, { favorite: !current })
}

export async function deleteMeal(id) {
  return deleteRecord('meals', id)
}

// ─── Live Queries ───────────────────────────────────────────────

/** Meal plans for a week (7 days starting from date). */
export function useWeekMealPlans(familyId, startDate) {
  return useLiveQuery(
    async () => {
      if (!familyId || !startDate) return []
      const start = new Date(startDate)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      const endStr = end.toISOString().slice(0, 10)

      return db.mealPlans
        .where('family_id')
        .equals(familyId)
        .and((m) => !m._deleted && m.date >= startDate && m.date <= endStr)
        .sortBy('date')
    },
    [familyId, startDate],
    []
  )
}

/** All saved meals/recipes. */
export function useSavedMeals(familyId) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return db.meals
        .where('family_id')
        .equals(familyId)
        .and((m) => !m._deleted)
        .toArray()
    },
    [familyId],
    []
  )
}

/** Today's meal plans (for Dashboard). */
export function useTodayMeals(familyId) {
  const todayStr = new Date().toISOString().slice(0, 10)
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return db.mealPlans
        .where('family_id')
        .equals(familyId)
        .and((m) => !m._deleted && m.date === todayStr)
        .sortBy('slot')
    },
    [familyId, todayStr],
    []
  )
}

/** Get Monday of current week. */
export function getMonday(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}
