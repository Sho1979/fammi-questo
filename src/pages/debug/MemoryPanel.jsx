/**
 * MemoryPanel — KPI e timeline della conversation memory.
 * Estratto da BrainDebugPage per modularità.
 */
import { useState } from 'react'
import {
  Brain, Zap, AlertCircle, Activity, ShieldAlert,
  Search, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, Clock,
} from 'lucide-react'
import { MEMORY_ACTION_LABELS, MEMORY_ACTION_COLORS } from './debugConstants.js'
import { KpiCard } from './DebugShared.jsx'

export default function MemoryPanel({ metrics, memoryLogs }) {
  const [showTimeline, setShowTimeline] = useState(false)

  if (!metrics) {
    return (
      <div className="text-center text-gray-400 text-sm py-4">
        Nessun dato di conversation memory ancora registrato.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* KPI riga 1: draft lifecycle */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard icon={Brain} label="Draft creati" value={metrics.draftsCreated} color="text-blue-600" />
        <KpiCard
          icon={Zap} label="Committati"
          value={metrics.draftsCommitted}
          sub={metrics.commitRate > 0 ? `${metrics.commitRate}% commit rate` : ''}
          color="text-green-600"
        />
        <KpiCard
          icon={AlertCircle} label="Abbandonati"
          value={metrics.draftsAbandoned}
          sub={metrics.abandonRate > 0 ? `${metrics.abandonRate}% abandon rate` : ''}
          color={metrics.draftsAbandoned > 0 ? 'text-red-600' : 'text-gray-400'}
        />
      </div>

      {/* KPI riga 2: qualità merge */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard icon={Activity} label="Merge medi/draft" value={metrics.avgMergesPerDraft} color="text-cyan-600" />
        <KpiCard
          icon={ShieldAlert} label="False merge"
          value={metrics.falseMergeSuspects}
          color={metrics.falseMergeSuspects > 0 ? 'text-amber-600' : 'text-gray-400'}
        />
        <KpiCard
          icon={Search} label="Frammenti orfani"
          value={metrics.orphanFragments}
          color={metrics.orphanFragments > 0 ? 'text-amber-600' : 'text-gray-400'}
        />
      </div>

      {/* Commit per turni */}
      <div className="bg-white rounded-lg border border-gray-100 p-3">
        <div className="text-xs font-semibold text-gray-600 mb-2">Commit per numero turni</div>
        <div className="flex gap-3">
          {Object.entries(metrics.commitByTurnCount).map(([turns, count]) => (
            <div key={turns} className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${count > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {turns} turno{turns !== '1' ? 'i' : ''}
              </span>
              <span className="text-xs text-gray-600 font-medium">{count}x</span>
            </div>
          ))}
        </div>
      </div>

      {/* Correzioni e incompatibilità */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-3">
          <RefreshCw size={18} className={metrics.correctionsDetected > 0 ? 'text-amber-600' : 'text-gray-400'} />
          <div>
            <div className={`text-lg font-bold ${metrics.correctionsDetected > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
              {metrics.correctionsDetected}
            </div>
            <div className="text-xs text-gray-500">Correzioni rilevate</div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-3">
          <AlertTriangle size={18} className={metrics.incompatibilitiesDetected > 0 ? 'text-red-600' : 'text-gray-400'} />
          <div>
            <div className={`text-lg font-bold ${metrics.incompatibilitiesDetected > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {metrics.incompatibilitiesDetected}
            </div>
            <div className="text-xs text-gray-500">Incompatibilità</div>
          </div>
        </div>
      </div>

      {/* Campi più mergiati */}
      {metrics.topMergedFields?.length > 0 && (
        <div className="bg-white rounded-lg border border-cyan-100 p-3">
          <div className="text-xs font-semibold text-cyan-600 mb-2">Campi più mergiati</div>
          <div className="flex flex-wrap gap-2">
            {metrics.topMergedFields.map(({ field, count }) => (
              <div key={field} className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-cyan-50 text-cyan-700 rounded text-xs">{field}</span>
                <span className="text-xs text-gray-500">{count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline eventi memoria */}
      {memoryLogs.length > 0 && (
        <div className="bg-white rounded-lg border border-blue-100 p-3">
          <button
            className="flex items-center gap-2 text-xs font-semibold text-blue-600 w-full"
            onClick={() => setShowTimeline(!showTimeline)}
          >
            {showTimeline ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Clock size={12} />
            Timeline memoria ({memoryLogs.length} eventi)
          </button>

          {showTimeline && (
            <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
              {memoryLogs.slice(0, 30).map((log, i) => {
                const mem = log._memory
                const timeStr = new Date(log.created_at).toLocaleString('it-IT', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                  day: '2-digit', month: '2-digit',
                })
                const actionLabel = MEMORY_ACTION_LABELS[mem.action] || mem.action
                const actionColor = MEMORY_ACTION_COLORS[mem.action] || 'bg-gray-100 text-gray-500'

                return (
                  <div key={log.id || i} className="flex items-start gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-400 w-24 flex-shrink-0">{timeStr}</span>
                    <span className={`px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${actionColor}`}>
                      {actionLabel}
                    </span>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="text-gray-700 truncate">"{log._input}"</p>
                      <div className="flex gap-2 flex-wrap">
                        {mem.draftId && (
                          <span className="text-gray-400">draft: {mem.draftId.slice(0, 8)}…</span>
                        )}
                        {mem.mergedFields?.length > 0 && (
                          <span className="text-cyan-600">+{mem.mergedFields.join(', ')}</span>
                        )}
                        {mem.missingAfter?.length > 0 && (
                          <span className="text-amber-600">manca: {mem.missingAfter.join(', ')}</span>
                        )}
                        {mem.isFragment && (
                          <span className="text-violet-500">frammento</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
