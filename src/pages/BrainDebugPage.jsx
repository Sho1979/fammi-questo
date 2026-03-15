/**
 * BrainDebugPage — Console diagnostica del Cervellone NLP.
 *
 * NON è un semplice viewer di log. È una console che risponde a:
 * - dove sbaglia più spesso?
 * - quando chiama AI inutilmente?
 * - quali entità mancano più spesso?
 * - quali sinapsi aiutano e quali sporcano?
 * - quali frasi generano output incompleti?
 *
 * Sezioni:
 * 1. KPI cards (2 righe: base + problemi)
 * 2. Confidence per intent
 * 3. Warning frequenti
 * 4. Sinapsi problematiche
 * 5. Forme linguistiche → fallback
 * 6. Quick views + filtri
 * 7. Lista log con explainability vera
 *
 * ACCESSO: canAccessBrainDebug (parent/genitore + dev flag)
 *
 * REFACTOR: componenti estratti in src/pages/debug/
 */
import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore.js'
import useDebugAnalytics from '../hooks/useDebugAnalytics.js'
import {
  isDebugEnabled, setDebugEnabled,
  getDebugLogs, clearDebugLogs,
} from '../lib/brain/index.js'
import { canAccessBrainDebug } from '../lib/brain/debugAnalytics.js'
import {
  Bug, Trash2, ChevronDown, ChevronRight,
  Filter, ToggleLeft, ToggleRight, RefreshCw,
  BarChart3, Brain,
} from 'lucide-react'

// ─── Sotto-componenti estratti ──────────────────────────────────
import { QUICK_VIEWS } from './debug/debugConstants.js'
import AnalyticsPanel from './debug/AnalyticsPanel.jsx'
import MemoryPanel from './debug/MemoryPanel.jsx'
import LogEntry from './debug/LogEntry.jsx'

// Mappa iconName → componente per QUICK_VIEWS
import {
  Target, CloudLightning, Lightbulb, Search, ShieldAlert,
} from 'lucide-react'

const QUICK_VIEW_ICONS = {
  BarChart3, Target, CloudLightning, Lightbulb, Search, ShieldAlert, Brain,
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function BrainDebugPage() {
  const { familyId, currentMember } = useAuthStore()

  // ─── Tutti gli hooks PRIMA di qualsiasi return condizionale ───
  const [debugOn, setDebugOn] = useState(isDebugEnabled())
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeView, setActiveView] = useState('all')
  const [showAnalytics, setShowAnalytics] = useState(true)
  const [intentFilter, setIntentFilter] = useState('')
  const [maxConfidence, setMaxConfidence] = useState('')
  const [onlyAI, setOnlyAI] = useState(false)

  const {
    analytics, temporal, problemSynapses, fallbackPhrases,
    memoryMetrics, memoryLogs,
    timeWindow, setTimeWindow, refresh: refreshAnalytics,
  } = useDebugAnalytics(familyId)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const opts = { limit: 50 }

    if (activeView === 'low_conf') opts.maxConfidence = 0.55
    else if (activeView === 'ai_fallback') opts.onlyAI = true
    else if (activeView === 'avoidable_ai') opts.onlyAI = true

    if (intentFilter) opts.intentFilter = intentFilter
    if (maxConfidence) opts.maxConfidence = parseFloat(maxConfidence)
    if (onlyAI) opts.onlyAI = true

    let result = await getDebugLogs(familyId, opts)

    // Filtri client-side per viste avanzate
    if (activeView === 'missing') {
      result = result.filter(l => {
        try {
          const trace = JSON.parse(l.debug_json)
          return trace.sentenceTraces?.some(st =>
            st.warnings?.includes('missing_explicit_time') ||
            st.warnings?.includes('no_person_assigned') ||
            st.warnings?.includes('absent_person_unknown')
          )
        } catch { return false }
      })
    } else if (activeView === 'incomplete') {
      result = result.filter(l => {
        try {
          const trace = JSON.parse(l.debug_json)
          return trace.sentenceTraces?.some(st =>
            (st.isDualAction && st.warnings?.includes('needs_pickup_person')) ||
            st.actionsGenerated?.some(a => a.incomplete)
          )
        } catch { return false }
      })
    } else if (activeView === 'avoidable_ai') {
      result = result.filter(l => {
        try {
          const trace = JSON.parse(l.debug_json)
          const hasStructural = trace.sentenceTraces?.some(st =>
            st.structural?.hasPersons || st.structural?.hasTime || st.structural?.hasExplicitDate
          )
          const hasDecentLocal = trace.sentenceTraces?.some(st => (st.confidence || 0) >= 0.40)
          return hasStructural && hasDecentLocal
        } catch { return false }
      })
    } else if (activeView === 'memory') {
      result = result.filter(l => {
        try {
          const trace = JSON.parse(l.debug_json)
          return !!trace.memory
        } catch { return false }
      })
    }

    setLogs(result)
    setLoading(false)
  }, [familyId, activeView, intentFilter, maxConfidence, onlyAI])

  useEffect(() => {
    if (familyId) loadLogs()
  }, [familyId, loadLogs])

  // ─── Protezione accesso (DOPO tutti gli hooks) ───
  if (!canAccessBrainDebug(currentMember)) {
    return <Navigate to="/dashboard" replace />
  }

  const handleToggleDebug = () => {
    const next = !debugOn
    setDebugEnabled(next)
    setDebugOn(next)
  }

  const handleClear = async () => {
    if (!confirm('Cancellare tutti i log debug?')) return
    await clearDebugLogs(familyId)
    setLogs([])
    refreshAnalytics()
  }

  const handleRefresh = () => {
    loadLogs()
    refreshAnalytics()
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug size={24} className="text-gray-700" />
          <h1 className="text-xl font-bold text-gray-800">Brain Debug</h1>
        </div>
        <button
          onClick={handleToggleDebug}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            debugOn ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {debugOn ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {debugOn ? 'Debug ON' : 'Debug OFF'}
        </button>
      </div>

      {!debugOn && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Il debug è disattivato. Attiva il toggle per registrare i parse del Cervellone.
        </div>
      )}

      {/* Analytics Section */}
      {debugOn && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <button
              className="flex items-center gap-2 text-sm font-medium text-gray-600"
              onClick={() => setShowAnalytics(!showAnalytics)}
            >
              {showAnalytics ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <BarChart3 size={14} />
              Analytics e diagnostica
            </button>

            {/* Selettore finestra temporale */}
            <div className="flex gap-1">
              {[
                { id: 'all', label: 'Tutti' },
                { id: '24h', label: '24h' },
                { id: '7d', label: '7gg' },
                { id: 'session', label: 'Sessione' },
              ].map(tw => (
                <button
                  key={tw.id}
                  onClick={() => setTimeWindow(tw.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    timeWindow === tw.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {tw.label}
                  {temporal[tw.id === '24h' ? 'h24' : tw.id === '7d' ? 'd7' : tw.id]?.parseCount != null && (
                    <span className="ml-1 opacity-70">
                      ({temporal[tw.id === '24h' ? 'h24' : tw.id === '7d' ? 'd7' : tw.id].parseCount})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {showAnalytics && (
            <AnalyticsPanel
              analytics={analytics}
              problemSynapses={problemSynapses}
              fallbackPhrases={fallbackPhrases}
            />
          )}
        </div>
      )}

      {/* Memory Panel — visibile quando quick view = memory */}
      {debugOn && activeView === 'memory' && (
        <div>
          <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-600">
            <Brain size={14} />
            Conversation Memory — Diagnostica
          </div>
          <MemoryPanel metrics={memoryMetrics} memoryLogs={memoryLogs} />
        </div>
      )}

      {/* Quick Views */}
      <div className="flex gap-1 overflow-x-auto">
        {QUICK_VIEWS.map(v => {
          const Icon = QUICK_VIEW_ICONS[v.iconName]
          return (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeView === v.id
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {Icon && <Icon size={12} />}
              {v.label}
            </button>
          )
        })}
      </div>

      {/* Filtri avanzati */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-gray-400" />

        <select
          value={intentFilter}
          onChange={e => setIntentFilter(e.target.value)}
          className="text-xs border rounded px-2 py-1"
        >
          <option value="">Tutti gli intent</option>
          <option value="calendar">calendar</option>
          <option value="task">task</option>
          <option value="expense">expense</option>
          <option value="meal">meal</option>
          <option value="shopping">shopping</option>
          <option value="absence">absence</option>
          <option value="reminder">reminder</option>
        </select>

        <select
          value={maxConfidence}
          onChange={e => setMaxConfidence(e.target.value)}
          className="text-xs border rounded px-2 py-1"
        >
          <option value="">Tutte le confidence</option>
          <option value="0.5">{'< 50%'}</option>
          <option value="0.7">{'< 70%'}</option>
          <option value="0.85">{'< 85%'}</option>
        </select>

        <button
          onClick={() => setOnlyAI(!onlyAI)}
          className={`text-xs px-2 py-1 rounded border ${onlyAI ? 'bg-violet-100 border-violet-300 text-violet-700' : 'text-gray-500'}`}
        >
          Solo AI
        </button>

        <button onClick={handleRefresh} className="text-xs px-2 py-1 rounded border text-gray-500 hover:bg-gray-50">
          <RefreshCw size={12} />
        </button>

        <div className="flex-1" />

        <button
          onClick={handleClear}
          className="text-xs px-2 py-1 rounded border text-red-500 hover:bg-red-50 flex items-center gap-1"
        >
          <Trash2 size={12} /> Svuota
        </button>
      </div>

      {/* Lista log */}
      {loading ? (
        <div className="text-center text-gray-400 py-8">Caricamento...</div>
      ) : logs.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          {debugOn ? 'Nessun log per questa vista.' : 'Attiva il debug per iniziare.'}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-gray-400">{logs.length} log</div>
          {logs.map(log => (
            <LogEntry key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  )
}
