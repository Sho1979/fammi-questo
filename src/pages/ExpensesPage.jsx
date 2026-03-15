/**
 * STEP 7.6 — ExpensesPage: full expense management.
 * Uses useExpenses hook for data, manages modal state for add/edit.
 */
import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import useAuthStore from '../store/authStore.js'
import {
  useExpensesByMonth,
  addExpense,
  updateExpense,
  deleteExpense,
  undoDelete,
  createExpenseRecurrence,
} from '../hooks/useExpenses.js'
import ExpenseList from '../components/expenses/ExpenseList.jsx'
import ExpenseForm from '../components/expenses/ExpenseForm.jsx'
import { Modal, Toast, ConfirmDialog } from '../components/shared/index.js'

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function ExpensesPage() {
  const { familyId, currentMember } = useAuthStore()
  // EXPENSE_PERSONS: only parents can manage expenses (from api.php)
  const isExpensePerson = currentMember?.role === 'parent' || currentMember?.role === 'elder' ||
    currentMember?.role === 'genitore'
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth)

  // Live queries
  const expenses = useExpensesByMonth(familyId, currentMonth)
  const members = useLiveQuery(
    () => familyId
      ? db.members.where('family_id').equals(familyId).and((m) => !m._deleted).toArray()
      : [],
    [familyId],
    []
  )

  const monthlyTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  // Modal state
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Toast state
  const [toast, setToast] = useState(null)

  const showToast = (message, action, onAction) => {
    setToast({ message, action, onAction })
  }

  const handleAdd = () => {
    setEditingExpense(null)
    setShowForm(true)
  }

  const handleEdit = (expense) => {
    setEditingExpense(expense)
    setShowForm(true)
  }

  const handleSave = useCallback(async (data) => {
    const { recurrence, ...expenseData } = data
    if (editingExpense) {
      await updateExpense(editingExpense.id, expenseData)
      showToast('Spesa aggiornata')
    } else if (recurrence) {
      // Create recurring expense
      const dateObj = new Date(expenseData.date)
      const recurrenceData = {
        type: recurrence,
        start_date: expenseData.date,
        expense_template: {
          amount: expenseData.amount,
          category: expenseData.category,
          note: expenseData.note,
          person_id: expenseData.person_id,
        },
      }
      // Set appropriate day fields
      if (recurrence === 'weekly') {
        recurrenceData.day_of_week = dateObj.getDay()
      } else if (recurrence === 'monthly') {
        recurrenceData.day_of_month = dateObj.getDate()
      }
      const result = await createExpenseRecurrence(recurrenceData)
      showToast(`Spesa ricorrente creata (${result.expenses.length} generate)`)
    } else {
      await addExpense(expenseData)
      showToast('Spesa aggiunta')
    }
    setShowForm(false)
    setEditingExpense(null)
  }, [editingExpense])

  const handleDeleteRequest = (expenseId) => {
    setConfirmDelete(expenseId)
  }

  const handleDeleteConfirm = useCallback(async () => {
    const id = confirmDelete
    setConfirmDelete(null)
    await deleteExpense(id)
    showToast('Spesa eliminata', 'Annulla', async () => {
      await undoDelete(id)
      showToast('Spesa ripristinata')
    })
  }, [confirmDelete])

  return (
    <div>
      <ExpenseList
        expenses={expenses}
        members={members}
        monthlyTotal={monthlyTotal}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        onAdd={isExpensePerson ? handleAdd : null}
        onEdit={isExpensePerson ? handleEdit : null}
        onDelete={isExpensePerson ? handleDeleteRequest : null}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingExpense(null) }}
        title={editingExpense ? 'Modifica spesa' : 'Nuova spesa'}
      >
        <ExpenseForm
          members={members}
          currentMember={currentMember}
          onSave={handleSave}
          expense={editingExpense}
          onClose={() => { setShowForm(false); setEditingExpense(null) }}
        />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
        title="Elimina spesa"
        message="Vuoi eliminare questa spesa? Potrai annullare l'operazione."
        confirmLabel="Elimina"
        danger
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          action={toast.action}
          onAction={toast.onAction}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
