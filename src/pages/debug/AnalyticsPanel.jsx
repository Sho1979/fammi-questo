/**
 * AnalyticsPanel — KPI cards, confidence per intent, warning, sinapsi, fallback.
 * Estratto da BrainDebugPage per modularità.
 */
import {
  BarChart3, Cpu, CloudLightning, Target, TrendingUp,
  AlertTriangle, Search, AlertCircle, ShieldAlert, Lightbulb, Activity,
} from 'lucide-react'
import { WARNING_LABELS } from './debugConstants.js'
import { IntentBadge, KpiCard } from './DebugShared.jsx'

export default function AnalyticsPanel({ analytics, problemSynapses, fallbackPhrases }) {
  if (!analytics) {
    return (
      <div className="text-center text-gray-400 text-sm py-4">
        Non ci sono ancora dati sufficienti per le analytics.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Riga 1: KPI base */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard icon={BarChart3} label="Parse totali" value={analytics.parseCount} />
        <KpiCard
          icon={Cpu} label="Locali"
          value={`${analytics.localPct}%`}
          sub={`${analytics.localCount} parse`}
          color="text-green-600"
        />
        <KpiCard
          icon={CloudLightning} label="AI fallback"
          value={`${analytics.aiPct}%`}
          sub={`${analytics.aiCount} parse`}
          color={analytics.aiPct > 20 ? 'text-red-600' : 'text-violet-600'}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <KpiCard
          icon={Target} label="Confidence media"
          value={`${Math.round(analytics.avgConfidence * 100)}%`}
          color={analytics.avgConfidence >= 0.75 ? 'text-green-600' : 'text-amber-600'}
        />
        <KpiCard
          icon={TrendingUp} label="Top intent"
          value={analytics.topIntent?.intent || '—'}
          sub={analytics.topIntent ? `${analytics.topIntent.count}x` : ''}
          color="text-blue-600"
        />
        <KpiCard
          icon={AlertTriangle} label="Low confidence"
          value={analytics.lowConfidenceCount}
          sub={analytics.lowConfidenceCount > 0 ? 'sotto 55%' : ''}
          color={analytics.lowConfidenceCount > 5 ? 'text-red-600' : 'text-gray-600'}
        />
      </div>

      {/* Riga 2: Problemi specifici */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-3">
          <Search size={18} className="text-amber-600" />
          <div>
            <div className="text-lg font-bold text-amber-600">{analytics.missingEntityCount}</div>
            <div className="text-xs text-gray-500">Entità mancanti</div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-3">
          <AlertCircle size={18} className={analytics.incompleteActionCount > 0 ? 'text-red-600' : 'text-gray-400'} />
          <div>
            <div className={`text-lg font-bold ${analytics.incompleteActionCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {analytics.incompleteActionCount}
            </div>
            <div className="text-xs text-gray-500">Azioni incomplete</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-3">
          <ShieldAlert size={18} className={analytics.incompleteDualCount > 0 ? 'text-red-600' : 'text-gray-400'} />
          <div>
            <div className={`text-lg font-bold ${analytics.incompleteDualCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {analytics.incompleteDualCount}
            </div>
            <div className="text-xs text-gray-500">Dual action parziali</div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-3">
          <Lightbulb size={18} className={analytics.avoidableAICount > 0 ? 'text-amber-600' : 'text-gray-400'} />
          <div>
            <div className={`text-lg font-bold ${analytics.avoidableAICount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
              {analytics.avoidableAICount}
            </div>
            <div className="text-xs text-gray-500">AI prob. evitabili</div>
            <div className="text-xs text-gray-400">segnali strutturali presenti</div>
          </div>
        </div>
      </div>

      {/* Confidence per intent */}
      {Object.keys(analytics.avgConfidenceByIntent).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-xs font-semibold text-gray-600 mb-2">Confidence media per intent</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(analytics.avgConfidenceByIntent)
              .filter(([k]) => k !== 'none')
              .sort((a, b) => a[1] - b[1])
              .map(([intent, conf]) => (
                <div key={intent} className="flex items-center gap-1.5">
                  <IntentBadge intent={intent} />
                  <span className={`text-xs font-medium ${conf >= 0.75 ? 'text-green-600' : conf >= 0.55 ? 'text-amber-600' : 'text-red-600'}`}>
                    {Math.round(conf * 100)}%
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Top warnings */}
      {analytics.topWarnings.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="text-xs font-semibold text-gray-600 mb-2">Warning frequenti</div>
          <div className="space-y-1">
            {analytics.topWarnings.map(({ warning, count }) => (
              <div key={warning} className="flex items-center justify-between text-xs">
                <span className="text-amber-700">{WARNING_LABELS[warning] || warning}</span>
                <span className="text-gray-500 font-medium">{count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sinapsi problematiche */}
      {problemSynapses.length > 0 && (
        <div className="bg-white rounded-lg border border-red-100 p-3">
          <div className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
            <Activity size={12} />
            Sinapsi nei casi problematici
          </div>
          <div className="space-y-1">
            {problemSynapses.map(s => (
              <div key={s.key} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`font-mono px-1.5 py-0.5 rounded ${s.fuzzyCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                    {s.key}
                  </span>
                  <span className="text-gray-400">→ {s.topIntent}</span>
                  {s.fuzzyCount > 0 && <span className="text-amber-500 text-[10px]">fuzzy:{s.fuzzyCount}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">peso: {s.avgWeight}</span>
                  <span className="text-red-500 font-medium">{s.problemCount}x</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forme linguistiche → fallback */}
      {fallbackPhrases.length > 0 && (
        <div className="bg-white rounded-lg border border-violet-100 p-3">
          <div className="text-xs font-semibold text-violet-600 mb-2 flex items-center gap-1">
            <CloudLightning size={12} />
            Forme linguistiche → AI fallback
          </div>
          <div className="space-y-1.5">
            {fallbackPhrases.map((p, i) => (
              <div key={i} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 italic">"{p.form}"</span>
                  <span className="text-violet-600 font-medium">{p.count}x</span>
                </div>
                {p.originals.length > 0 && p.count > 1 && (
                  <div className="text-[10px] text-gray-400 ml-2 mt-0.5">
                    es: {p.originals[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
