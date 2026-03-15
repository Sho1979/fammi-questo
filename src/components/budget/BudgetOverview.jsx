/**
 * STEP 8.2 — BudgetOverview: progress bar + category breakdown.
 * Props: budget, spent, remaining, percentage, byCategory[], alertLevel?
 */
import { AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../../lib/format.js'

function getBarColor(percentage) {
  if (percentage >= 100) return 'bg-red-600'
  if (percentage >= 80) return 'bg-red-500'
  if (percentage >= 50) return 'bg-yellow-500'
  return 'bg-green-500'
}

function getTextColor(percentage) {
  if (percentage >= 100) return 'text-red-700'
  if (percentage >= 80) return 'text-red-600'
  if (percentage >= 50) return 'text-yellow-600'
  return 'text-green-600'
}

export default function BudgetOverview({ budget, spent, remaining, percentage, byCategory, alertLevel }) {
  const clampedPct = Math.min(percentage, 100)
  const barColor = getBarColor(percentage)
  const txtColor = getTextColor(percentage)

  return (
    <div className="flex flex-col gap-5">
      {/* Threshold alert banner */}
      {alertLevel === 'exceeded' && (
        <div className="flex items-center gap-3 rounded-xl p-3 border"
          style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">Budget superato!</p>
            <p className="text-xs text-red-500">Hai speso il {percentage}% del budget mensile.</p>
          </div>
        </div>
      )}
      {alertLevel === 'warning' && (
        <div className="flex items-center gap-3 rounded-xl p-3 border"
          style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)' }}>
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Attenzione: budget quasi esaurito</p>
            <p className="text-xs text-amber-500">Hai raggiunto il {percentage}% del budget mensile.</p>
          </div>
        </div>
      )}

      {/* Main progress */}
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500">Speso questo mese</p>
            <p className={`text-2xl font-bold ${txtColor}`}>{formatCurrency(spent)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Budget</p>
            <p className="text-lg font-semibold text-gray-700">{formatCurrency(budget)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${clampedPct}%` }}
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>{percentage}% utilizzato</span>
          <span>Rimanente: {formatCurrency(remaining)}</span>
        </div>
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Per categoria</h3>
          <div className="flex flex-col gap-3">
            {byCategory.map((cat) => {
              const catPct = budget > 0 ? Math.round((cat.spent / budget) * 100) : 0
              return (
                <div key={cat.id} className="flex items-center gap-3">
                  <span className="text-lg">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700 truncate">{cat.label}</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(cat.spent)}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(catPct, 100)}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
