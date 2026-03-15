/**
 * SpesePage — Unified Expenses page with 3 sub-tabs:
 * 1. Lista (expense CRUD)
 * 2. Statistiche (charts, category breakdown, trends)
 * 3. Budget (setup + overview)
 */
import { useState, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import useAuthStore from '../store/authStore.js'
import {
  useExpensesByMonth, useMonthlyTotals,
  addExpense, updateExpense, deleteExpense, undoDelete,
  computeCategoryTotals,
} from '../hooks/useExpenses.js'
import { useBudget, setBudget, checkBudgetThreshold } from '../hooks/useBudget.js'
import { DEFAULT_CATEGORIES } from '../lib/constants.js'
import { formatCurrency } from '../lib/format.js'
import ExpenseList from '../components/expenses/ExpenseList.jsx'
import ExpenseForm from '../components/expenses/ExpenseForm.jsx'
import BudgetOverview from '../components/budget/BudgetOverview.jsx'
import BudgetSetup from '../components/budget/BudgetSetup.jsx'
import { Modal, Toast, ConfirmDialog, EmptyState } from '../components/shared/index.js'
import {
  Wallet, BarChart3, PiggyBank, ChevronLeft, ChevronRight,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

const SUB_TABS = [
  { id: 'lista', label: 'Lista', icon: Wallet },
  { id: 'stats', label: 'Statistiche', icon: BarChart3 },
  { id: 'budget', label: 'Budget', icon: PiggyBank },
]

const MONTHS_IT = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
]
const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
function formatMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS_IT[m - 1]} ${y}`
}
function shiftMonth(ym, d) {
  const [y, m] = ym.split('-').map(Number)
  const dt = new Date(y, m - 1 + d, 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

export default function SpesePage() {
  const { familyId, currentMember } = useAuthStore()
  const isExpensePerson = currentMember?.role === 'parent' || currentMember?.role === 'elder' ||
    currentMember?.role === 'genitore'

  const [tab, setTab] = useState('lista')
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth)
  const [toast, setToast] = useState(null)

  const expenses = useExpensesByMonth(familyId, currentMonth)
  const monthlyTotals = useMonthlyTotals(familyId, 6)
  const budgetData = useBudget(familyId)
  const members = useLiveQuery(
    () => familyId
      ? db.members.where('family_id').equals(familyId).and((m) => !m._deleted).toArray()
      : [],
    [familyId], []
  )

  // CRUD state
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const showToast = (msg, action, onAction) => setToast({ message: msg, action, onAction })

  const handleSave = useCallback(async (data) => {
    if (editingExpense) {
      await updateExpense(editingExpense.id, data)
      showToast('Spesa aggiornata')
    } else {
      await addExpense(data)
      showToast('Spesa aggiunta')
    }
    setShowForm(false)
    setEditingExpense(null)
    // Check budget threshold after expense change (async, fire-and-forget)
    if (budgetData.budget > 0) {
      checkBudgetThreshold(familyId, budgetData.percentage, budgetData.alertLevel).catch(() => {})
    }
  }, [editingExpense, budgetData, familyId])

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
    <div className="flex flex-col gap-0 pb-24" style={{ background: 'var(--bg-main)' }}>
      {/* Sub-tabs */}
      <div className="glass flex border-b border-white/40 px-4 pt-3 pb-0 sticky top-0 z-10"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}>
        {SUB_TABS.map((t) => {
          const Icon = t.icon
          const isActive = tab === t.id
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 pb-3 text-sm font-semibold transition-all duration-200
                ${isActive ? 'text-violet-600' : 'text-gray-400'}`}>
              <Icon size={16} />
              {t.label}
              {isActive && <div className="absolute bottom-0 left-[15%] right-[15%] h-[3px] rounded-t-full"
                style={{ background: 'var(--gradient-primary)' }} />}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {tab === 'lista' && (
        <ExpenseList
          expenses={expenses}
          members={members}
          monthlyTotal={expenses.reduce((s, e) => s + Number(e.amount), 0)}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onAdd={isExpensePerson ? () => { setEditingExpense(null); setShowForm(true) } : null}
          onEdit={isExpensePerson ? (exp) => { setEditingExpense(exp); setShowForm(true) } : null}
          onDelete={isExpensePerson ? (id) => setConfirmDelete(id) : null}
        />
      )}

      {tab === 'stats' && (
        <StatsTab
          expenses={expenses}
          monthlyTotals={monthlyTotals}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          members={members}
        />
      )}

      {tab === 'budget' && (
        <div className="flex flex-col gap-4 px-4 py-4">
          <BudgetOverview
            budget={budgetData.budget}
            spent={budgetData.spent}
            remaining={budgetData.remaining}
            percentage={budgetData.percentage}
            byCategory={budgetData.byCategory}
            alertLevel={budgetData.alertLevel}
          />
          {isExpensePerson && (
            <BudgetSetup
              currentBudget={budgetData.budget}
              onSave={(amount) => setBudget(familyId, amount, budgetData.budgetId)}
            />
          )}
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingExpense(null) }}
        title={editingExpense ? 'Modifica spesa' : 'Nuova spesa'}>
        <ExpenseForm members={members} currentMember={currentMember}
          onSave={handleSave} expense={editingExpense}
          onClose={() => { setShowForm(false); setEditingExpense(null) }} />
      </Modal>

      <ConfirmDialog isOpen={confirmDelete !== null} onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)} title="Elimina spesa"
        message="Vuoi eliminare questa spesa?" confirmLabel="Elimina" danger />

      {toast && <Toast message={toast.message} action={toast.action}
        onAction={toast.onAction} onClose={() => setToast(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// STATS TAB — Charts, category breakdown, per-person, trends
// ═══════════════════════════════════════════════════════════
function StatsTab({ expenses, monthlyTotals, currentMonth, onMonthChange, members }) {
  const categoryTotals = useMemo(() => computeCategoryTotals(expenses), [expenses])
  const totalMonth = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses])

  // Per-person breakdown
  const personTotals = useMemo(() => {
    const map = {}
    for (const e of expenses) {
      const pid = e.person_id || 'unknown'
      map[pid] = (map[pid] || 0) + Number(e.amount)
    }
    return Object.entries(map)
      .map(([id, total]) => {
        const member = members.find((m) => m.id === id)
        return { id, name: member?.name || '?', icon: member?.icon || '👤', total }
      })
      .sort((a, b) => b.total - a.total)
  }, [expenses, members])

  // Daily average
  const daysInMonth = new Date(
    parseInt(currentMonth.split('-')[0]),
    parseInt(currentMonth.split('-')[1]),
    0
  ).getDate()
  const daysPassed = currentMonth === getCurrentMonth()
    ? new Date().getDate()
    : daysInMonth
  const dailyAvg = daysPassed > 0 ? totalMonth / daysPassed : 0

  // Pie data
  const pieData = useMemo(() =>
    DEFAULT_CATEGORIES
      .filter((cat) => categoryTotals[cat.id] > 0)
      .map((cat) => ({ name: cat.label, value: categoryTotals[cat.id], color: cat.color, icon: cat.icon }))
      .sort((a, b) => b.value - a.value),
    [categoryTotals]
  )

  // Bar data
  const barData = useMemo(() =>
    monthlyTotals.map((m) => ({
      name: MONTHS_SHORT[parseInt(m.month.split('-')[1]) - 1] || '',
      totale: Math.round(m.total),
    })),
    [monthlyTotals]
  )

  // Month-over-month comparison
  const prevMonthTotal = monthlyTotals.length >= 2
    ? monthlyTotals[monthlyTotals.length - 2]?.total || 0
    : 0
  const currentMonthTotal = monthlyTotals.length >= 1
    ? monthlyTotals[monthlyTotals.length - 1]?.total || 0
    : 0
  const monthDiff = currentMonthTotal - prevMonthTotal
  const monthDiffPct = prevMonthTotal > 0
    ? Math.round((monthDiff / prevMonthTotal) * 100)
    : 0

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onMonthChange(shiftMonth(currentMonth, -1))}
          className="rounded-lg p-2 hover:bg-gray-100"><ChevronLeft size={20} className="text-gray-600" /></button>
        <span className="text-base font-semibold text-gray-900">{formatMonthLabel(currentMonth)}</span>
        <button type="button" onClick={() => onMonthChange(shiftMonth(currentMonth, 1))}
          className="rounded-lg p-2 hover:bg-gray-100"><ChevronRight size={20} className="text-gray-600" /></button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-violet-50 border border-violet-100 p-3 text-center">
          <p className="text-xs text-violet-500 font-medium">Totale mese</p>
          <p className="text-lg font-bold text-violet-700">{formatCurrency(totalMonth)}</p>
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center">
          <p className="text-xs text-blue-500 font-medium">Media/giorno</p>
          <p className="text-lg font-bold text-blue-700">{formatCurrency(dailyAvg)}</p>
        </div>
        <div className={`rounded-xl p-3 text-center border
          ${monthDiff > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
          <p className={`text-xs font-medium ${monthDiff > 0 ? 'text-red-500' : 'text-green-500'}`}>
            vs mese prec.
          </p>
          <p className={`text-lg font-bold ${monthDiff > 0 ? 'text-red-700' : 'text-green-700'}`}>
            {monthDiff > 0 ? '+' : ''}{monthDiffPct}%
          </p>
        </div>
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={BarChart3} title="Nessun dato" description="Nessuna spesa per questo mese." />
      ) : (
        <>
          {/* Per-person breakdown */}
          {personTotals.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
              <h3 className="mb-3 text-sm font-semibold text-gray-800">Spese per persona</h3>
              <div className="flex flex-col gap-2">
                {personTotals.map((p) => {
                  const pct = totalMonth > 0 ? Math.round((p.total / totalMonth) * 100) : 0
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-lg">{p.icon}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700">{p.name}</span>
                          <span className="font-bold text-gray-900">{formatCurrency(p.total)}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-violet-400 transition-all"
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pie chart — by category */}
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <h3 className="mb-2 text-sm font-semibold text-gray-800">Per categoria</h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Category list */}
            <div className="flex flex-col gap-1.5 mt-3">
              {pieData.map((cat, i) => {
                const pct = totalMonth > 0 ? Math.round((cat.value / totalMonth) * 100) : 0
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-xs text-gray-600 flex-1">{cat.icon} {cat.name}</span>
                    <span className="text-xs font-semibold text-gray-800">{formatCurrency(cat.value)}</span>
                    <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bar chart — 6 months trend */}
          {barData.length > 1 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Andamento 6 mesi</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} width={50} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="totale" fill="#6C5CE7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
