/**
 * STEP 7.5 — ExpenseList: month selector + total + list + FAB.
 * Props: expenses[], members[], monthlyTotal, currentMonth (YYYY-MM),
 *        onMonthChange(yyyy_mm), onAdd(), onEdit(expense), onDelete(expenseId)
 */
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Wallet, Filter } from 'lucide-react'
import ExpenseCard from './ExpenseCard.jsx'
import { EmptyState } from '../shared/index.js'
import { formatCurrency } from '../../lib/format.js'
import { DEFAULT_CATEGORIES } from '../../lib/constants.js'

const MONTHS_ITALIAN = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

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

export default function ExpenseList({
  expenses,
  members,
  monthlyTotal,
  currentMonth,
  onMonthChange,
  onAdd,
  onEdit,
  onDelete,
}) {
  const [filterCat, setFilterCat] = useState('')
  const [filterPerson, setFilterPerson] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    let list = expenses
    if (filterCat) list = list.filter(e => e.category === filterCat)
    if (filterPerson) list = list.filter(e => e.person_id === filterPerson)
    return list
  }, [expenses, filterCat, filterPerson])

  const hasActiveFilter = filterCat || filterPerson

  // Categorie effettivamente usate questo mese
  const usedCategories = useMemo(() => {
    const cats = new Set(expenses.map(e => e.category).filter(Boolean))
    return DEFAULT_CATEGORIES.filter(c => cats.has(c.id))
  }, [expenses])

  // Proiezione fine mese: media giornaliera × giorni nel mese
  const projection = useMemo(() => {
    if (expenses.length === 0) return null
    const now = new Date()
    const [y, m] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const dayOfMonth = (y === now.getFullYear() && m === now.getMonth() + 1)
      ? now.getDate()
      : daysInMonth // mese passato: usa tutti i giorni
    if (dayOfMonth === 0) return null
    const dailyAvg = monthlyTotal / dayOfMonth
    return { dailyAvg, projected: dailyAvg * daysInMonth }
  }, [expenses, monthlyTotal, currentMonth])

  return (
    <div className="flex flex-col pb-24">
      {/* Month selector */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(currentMonth, -1))}
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
          onClick={() => onMonthChange(shiftMonth(currentMonth, 1))}
          className="rounded-lg p-2 hover:bg-gray-100 transition-colors"
          aria-label="Mese successivo"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Monthly total + proiezione */}
      <div className="mx-4 mb-4 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 px-5 py-4 shadow-lg">
        <p className="text-xs font-medium text-violet-200">Totale mese</p>
        <p className="text-2xl font-bold text-white">{formatCurrency(monthlyTotal)}</p>
        {projection && (
          <div className="flex gap-4 mt-2">
            <div>
              <p className="text-[10px] text-violet-300">Media/giorno</p>
              <p className="text-xs font-semibold text-white">{formatCurrency(projection.dailyAvg)}</p>
            </div>
            <div>
              <p className="text-[10px] text-violet-300">Proiezione mese</p>
              <p className="text-xs font-semibold text-white">{formatCurrency(projection.projected)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Filtri */}
      <div className="px-4 mb-3">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all
            ${hasActiveFilter ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}
          aria-label="Filtri"
        >
          <Filter size={13} />
          {hasActiveFilter ? 'Filtri attivi' : 'Filtra'}
        </button>

        {showFilters && (
          <div className="mt-2 flex flex-col gap-2">
            {/* Filtro categoria */}
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setFilterCat('')}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all
                  ${!filterCat ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                Tutte
              </button>
              {usedCategories.map(c => (
                <button key={c.id} type="button" onClick={() => setFilterCat(filterCat === c.id ? '' : c.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all
                    ${filterCat === c.id ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                  style={filterCat === c.id ? { background: c.color } : {}}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            {/* Filtro persona */}
            {members && members.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setFilterPerson('')}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all
                    ${!filterPerson ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  Tutti
                </button>
                {members.map(m => (
                  <button key={m.id} type="button" onClick={() => setFilterPerson(filterPerson === m.id ? '' : m.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all
                      ${filterPerson === m.id ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {m.avatar || m.icon || '👤'} {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expense list or empty state */}
      {filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Wallet}
            title={hasActiveFilter ? 'Nessun risultato' : 'Nessuna spesa'}
            description={hasActiveFilter
              ? 'Nessuna spesa corrisponde ai filtri selezionati.'
              : 'Nessuna spesa questo mese. Tocca + per aggiungerne una.'}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-4">
          {filtered.map((e) => (
            <ExpenseCard
              key={e.id}
              expense={e}
              members={members}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* FAB — only for parents (EXPENSE_PERSONS) */}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center
            rounded-full bg-violet-600 text-white shadow-xl
            hover:bg-violet-700 active:scale-95 transition-all"
          aria-label="Aggiungi spesa"
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  )
}
