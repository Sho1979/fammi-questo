/**
 * LogEntry — singola riga di log con expand per trace dettagliato.
 * Estratto da BrainDebugPage per modularità.
 */
import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Zap, Clock,
  AlertTriangle, Brain,
} from 'lucide-react'
import { MEMORY_ACTION_LABELS, MEMORY_ACTION_COLORS } from './debugConstants.js'
import { ConfidenceBar } from './DebugShared.jsx'
import SentenceDetail from './SentenceDetail.jsx'

export default function LogEntry({ log }) {
  const [expanded, setExpanded] = useState(false)
  const trace = expanded ? (() => { try { return JSON.parse(log.debug_json) } catch { return null } })() : null

  const timeStr = new Date(log.created_at).toLocaleString('it-IT', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit',
  })

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        <span className="text-xs text-gray-400 w-28 flex-shrink-0">{timeStr}</span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <p className="text-sm text-gray-800 truncate">"{log.input}"</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ConfidenceBar value={log.confidence} />
          <span className="text-xs text-gray-500">{log.action_count} az.</span>
          {log.used_ai && (
            <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-xs">AI</span>
          )}
          {(() => {
            try {
              const t = JSON.parse(log.debug_json)
              if (t?.memory?.action && t.memory.action !== 'ignore') {
                const c = MEMORY_ACTION_COLORS[t.memory.action] || 'bg-gray-100 text-gray-500'
                return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${c}`}>M</span>
              }
            } catch {}
            return null
          })()}
        </div>
      </button>

      {expanded && trace && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div className="text-xs text-gray-500">
            {trace.sentences?.length || trace.sentenceTraces?.length || 0} frasi analizzate
          </div>

          {/* Memory info se presente */}
          {trace.memory && trace.memory.action !== 'ignore' && (
            <div className="bg-blue-50 rounded p-2.5 text-xs space-y-1">
              <div className="font-semibold text-blue-700 flex items-center gap-1">
                <Brain size={12} /> Conversation Memory
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`px-1.5 py-0.5 rounded font-medium ${MEMORY_ACTION_COLORS[trace.memory.action] || 'bg-gray-100'}`}>
                  {MEMORY_ACTION_LABELS[trace.memory.action] || trace.memory.action}
                </span>
                {trace.memory.draftId && (
                  <span className="text-gray-500">draft: {trace.memory.draftId.slice(0, 8)}…</span>
                )}
                {trace.memory.isFragment && (
                  <span className="text-violet-600">frammento</span>
                )}
              </div>
              {trace.memory.mergedFields?.length > 0 && (
                <div className="text-cyan-700">Campi mergiati: {trace.memory.mergedFields.join(', ')}</div>
              )}
              {trace.memory.missingBefore?.length > 0 && (
                <div className="flex gap-3">
                  <span className="text-amber-700">Prima: mancava {trace.memory.missingBefore.join(', ')}</span>
                  <span className="text-green-700">Dopo: {trace.memory.missingAfter?.length > 0 ? `manca ${trace.memory.missingAfter.join(', ')}` : 'completo'}</span>
                </div>
              )}
              {trace.memory.error && (
                <div className="text-red-600">Errore: {trace.memory.error}</div>
              )}
            </div>
          )}
          <div className="space-y-2">
            {trace.sentenceTraces?.map((st, i) => (
              <SentenceDetail key={i} st={st} index={i} />
            ))}
          </div>
          {trace.finalDecision && (
            <div className="bg-gray-50 rounded p-3 text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold text-gray-700">
                <Zap size={14} />
                Decisione finale
              </div>
              <div className="flex gap-4">
                <span>Metodo: <strong>{trace.finalDecision.method}</strong></span>
                <span>Conf: <strong>{Math.round(trace.finalDecision.confidence * 100)}%</strong></span>
                <span>Azioni: <strong>{trace.finalDecision.actionCount}</strong></span>
              </div>
            </div>
          )}
          {Object.keys(trace.timings || {}).length > 0 && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <Clock size={12} />
              {Object.entries(trace.timings).map(([k, v]) => (
                <span key={k}>{k}: <strong>{v}ms</strong></span>
              ))}
            </div>
          )}
          {trace.warnings?.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle size={12} />
              {trace.warnings.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
