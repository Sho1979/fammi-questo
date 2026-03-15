/**
 * Componenti UI piccoli condivisi fra i pannelli di BrainDebugPage.
 */
import { INTENT_COLORS } from './debugConstants.js'

export function IntentBadge({ intent }) {
  const cls = INTENT_COLORS[intent] || INTENT_COLORS.null
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {intent || 'none'}
    </span>
  )
}

export function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 55 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-8">{pct}%</span>
    </div>
  )
}

export function KpiCard({ icon: Icon, label, value, sub, color = 'text-gray-700' }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-3">
      <Icon size={18} className={color} />
      <div>
        <div className={`text-lg font-bold ${color}`}>{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  )
}
