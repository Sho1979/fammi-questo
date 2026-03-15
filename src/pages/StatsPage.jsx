/**
 * STEP 9.1 — StatsPage: month selector + PieChart (categories) + BarChart (6 months) + top 3.
 */
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import useAuthStore from '../store/authStore.js'
import { useExpensesByMonth, useMonthlyTotals, computeCategoryTotals } from '../hooks/useExpenses.js'
import { DEFAULT_CATEGORIES } from '../lib/constants.js'
import { formatCurrency } from '../lib/format.js'
import { EmptyState } from '../components/shared/index.js'

const MONTHS_ITALIAN = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]
const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(yyyy_mm) {
  const [y, m] = yyyy_mm.split('-').map(Number)
  if (!m || m < 1 || m > 12) return yyyy_mm
  return `${MONTHS_ITALIAN[m - 1]} ${y}`
}

function shiftMonth(yyyy_mm, delta) {
  const [y, m] = yyyy_mm.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shortMonthLabel(yyyy_mm) {
  const m = parseInt(yyyy_mm.split('-')[1])
  return MONTHS_SHORT[m - 1] || ''
}

export default function StatsPage() {
  const { familyId } = useAuthStore()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth)

  const expenses = useExpensesByMonth(familyId, currentMonth)
  const monthlyTotals = useMonthlyTotals(familyId, 6)

  const categoryTotals = useMemo(() => computeCategoryTotals(expenses), [expenses])
  const totalMonth = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount), 0),
    [expenses]
  )

  // Pie chart data
  const pieData = useMemo(() => {
    return DEFAULT_CATEGORIES
      .filter((cat) => categoryTotals[cat.id] > 0)
      .map((cat) => ({
        name: cat.label,
        value: categoryTotals[cat.id],
        color: cat.color,
        icon: cat.icon,
      }))
      .sort((a, b) => b.value - a.value)
  }, [categoryTotals])

  // Bar chart data
  const barData = useMemo(() => {
    return monthlyTotals.map((m) => ({
      name: shortMonthLabel(m.month),
      totale: Math.round(m.total),
    }))
  }, [monthlyTotals])

  // Top 3 categories
  const top3 = pieData.slice(0, 3)

  return (
    <div className="flex flex-col gap-5 px-4 py-4 pb-24">
      <h2 className="text-xl font-bold text-gray-900">Statistiche</h2>

      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentMonth(shiftMonth(currentMonth, -1))}
          className="rounded-lg p-2 hover:bg-gray-100 transition-colors"
          aria-label="Mese precedente"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <span className="text-base font-semibold text-gray-900">
          {formatMonthLabel(currentMonth)}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth(shiftMonth(currentMonth, 1))}
          className="rounded-lg p-2 hover:bg-gray-100 transition-colors"
          aria-label="Mese successivo"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nessun dato"
          description="Nessuna spesa per questo mese."
        />
      ) : (
        <>
          {/* Pie Chart — by category */}
          <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <h3 className="mb-2 text-sm font-semibold text-gray-800">Spese per categoria</h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 3 categories */}
          {top3.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
              <h3 className="mb-3 text-sm font-semibold text-gray-800">Top categorie</h3>
              <div className="flex flex-col gap-2">
                {top3.map((cat, i) => {
                  const pct = totalMonth > 0 ? Math.round((cat.value / totalMonth) * 100) : 0
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-lg">{cat.icon}</span>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(cat.value)}</span>
                      <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Bar Chart — last 6 months */}
          {barData.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Ultimi 6 mesi</h3>
              <ResponsiveContainer width="100%" height={200}>
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
