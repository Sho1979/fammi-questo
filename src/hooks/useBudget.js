/**
 * STEP 8.1 — useBudget hook: read/update budget, compute spent/remaining.
 * Includes budget threshold alerts (80% warning, 100% exceeded).
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import { createRecord, updateRecord } from '../lib/crud.js'
import { getMonthRange } from '../lib/dates.js'
import { DEFAULT_CATEGORIES } from '../lib/constants.js'
import { notifyParents } from './useNotifications.js'

/**
 * Get current month as YYYY-MM.
 */
function currentYYYYMM() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Live query: budget data + computed spend for the current month.
 * @param {string} familyId
 * @returns {{ budget: number, spent: number, remaining: number, percentage: number, byCategory: Array }}
 */
export function useBudget(familyId) {
  const yyyy_mm = currentYYYYMM()

  return useLiveQuery(
    async () => {
      if (!familyId) {
        return { budget: 0, spent: 0, remaining: 0, percentage: 0, byCategory: [] }
      }

      // 1. Read budget record (global budget: category=null, month=null)
      const budgets = await db.budgets
        .where('family_id')
        .equals(familyId)
        .toArray()

      // Find the global budget (category=null)
      const globalBudget = budgets.find((b) => !b.category && !b.month && !b._deleted)
      const budgetAmount = globalBudget ? Number(globalBudget.monthly_amount) : 0

      // 2. Compute total spent this month
      const { start, end } = getMonthRange(yyyy_mm)
      const expenses = await db.expenses
        .where('family_id')
        .equals(familyId)
        .and((e) => !e._deleted && e.date >= start && e.date <= end)
        .toArray()

      const spent = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
      const remaining = budgetAmount - spent
      const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0

      // 3. By category breakdown
      const catMap = {}
      for (const e of expenses) {
        catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount)
      }

      const byCategory = DEFAULT_CATEGORIES
        .map((cat) => ({
          id: cat.id,
          label: cat.label,
          icon: cat.icon,
          color: cat.color,
          spent: catMap[cat.id] || 0,
        }))
        .filter((c) => c.spent > 0)
        .sort((a, b) => b.spent - a.spent)

      // 4. Determine alert level
      const roundedPct = Math.round(percentage)
      let alertLevel = 'none'
      if (roundedPct >= 100) alertLevel = 'exceeded'
      else if (roundedPct >= 80) alertLevel = 'warning'

      return {
        budget: budgetAmount,
        spent: Math.round(spent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        percentage: roundedPct,
        byCategory,
        budgetId: globalBudget?.id || null,
        alertLevel,
      }
    },
    [familyId, yyyy_mm],
    { budget: 0, spent: 0, remaining: 0, percentage: 0, byCategory: [], budgetId: null, alertLevel: 'none' }
  )
}

/**
 * Check budget threshold and send notification to parents if needed.
 * Uses Dexie settings to avoid duplicate notifications within the same month/level.
 * Call this after adding/updating expenses.
 * @param {string} familyId
 * @param {number} percentage — current budget usage %
 * @param {string} alertLevel — 'none' | 'warning' | 'exceeded'
 */
export async function checkBudgetThreshold(familyId, percentage, alertLevel) {
  if (!familyId || alertLevel === 'none') return

  const yyyy_mm = currentYYYYMM()
  const settingsKey = `budget-alert-${yyyy_mm}`

  // Read last sent alert level for this month
  const record = await db.settings.get(settingsKey)
  const lastLevel = record?.level || 'none'

  // Levels are ordered: none < warning < exceeded
  const LEVELS = ['none', 'warning', 'exceeded']
  const lastIdx = LEVELS.indexOf(lastLevel)
  const currentIdx = LEVELS.indexOf(alertLevel)

  // Only notify if we crossed a new threshold (never downgrade)
  if (currentIdx <= lastIdx) return

  // Persist new alert level
  await db.settings.put({ id: settingsKey, level: alertLevel, month: yyyy_mm })

  // Send notification to parents
  if (alertLevel === 'warning') {
    await notifyParents({
      type: 'budget_warning',
      title: '⚠️ Budget al ' + percentage + '%',
      message: 'Attenzione: avete superato l\'80% del budget mensile.',
      icon: '⚠️',
    })
  } else if (alertLevel === 'exceeded') {
    await notifyParents({
      type: 'budget_exceeded',
      title: '🚨 Budget superato!',
      message: 'Il budget mensile è stato superato (' + percentage + '%). Controllate le spese.',
      icon: '🚨',
    })
  }
}

/**
 * Set/update the monthly budget amount.
 * @param {string} familyId
 * @param {number} amount
 * @param {string|null} existingBudgetId
 */
export async function setBudget(familyId, amount, existingBudgetId) {
  if (existingBudgetId) {
    return updateRecord('budgets', existingBudgetId, { monthly_amount: amount })
  }
  return createRecord('budgets', {
    family_id: familyId,
    monthly_amount: amount,
    category: null,
    month: null,
  })
}
