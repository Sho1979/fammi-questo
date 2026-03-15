/**
 * SentenceDetail — explainability per singola frase analizzata.
 * Estratto da BrainDebugPage per modularità.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Brain } from 'lucide-react'
import { explainSentenceDecision } from '../../lib/brain/debugAnalytics.js'
import { IntentBadge, ConfidenceBar } from './DebugShared.jsx'

export default function SentenceDetail({ st, index }) {
  const [open, setOpen] = useState(false)
  const explanation = explainSentenceDecision(st)

  return (
    <div className={`border-l-2 pl-3 py-1 ${explanation.hasIssues ? 'border-amber-300' : 'border-gray-200'}`}>
      <button
        className="flex items-start gap-2 w-full text-left"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={14} className="mt-1 text-gray-400" /> : <ChevronRight size={14} className="mt-1 text-gray-400" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">F{index + 1}</span>
            <IntentBadge intent={st.intent} />
            <ConfidenceBar value={st.confidence} />
            {explanation.hasIssues && <AlertTriangle size={12} className="text-amber-500" />}
          </div>
          <p className="text-sm text-gray-700 truncate mt-0.5">"{st.sentence}"</p>
        </div>
      </button>

      {open && (
        <div className="mt-2 ml-5 space-y-2 text-xs">
          {/* PERCHÉ — il pezzo forte */}
          <div className="bg-blue-50 rounded p-2.5 space-y-1">
            <div className="font-semibold text-blue-700 flex items-center gap-1">
              <Brain size={12} /> Perché questa decisione
            </div>
            <p className="text-blue-800">{explanation.summary}</p>
            {explanation.reasons.length > 1 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {explanation.reasons.map((r, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">{r}</span>
                ))}
              </div>
            )}
          </div>

          {/* Issues */}
          {explanation.issues.length > 0 && (
            <div className="bg-amber-50 rounded p-2.5 space-y-1">
              <div className="font-semibold text-amber-700 flex items-center gap-1">
                <AlertTriangle size={12} /> Problemi rilevati
              </div>
              {explanation.issues.map((issue, i) => (
                <div key={i} className="text-amber-800">• {issue}</div>
              ))}
            </div>
          )}

          {/* Entità */}
          <div>
            <span className="font-semibold text-gray-600">Entità estratte:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {st.entities?.people?.length > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">persone: {st.entities.people.join(', ')}</span>
              )}
              {st.entities?.date && (
                <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded">data: {st.entities.date}</span>
              )}
              {st.entities?.time && (
                <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded">ora: {st.entities.time}</span>
              )}
              {st.entities?.timeRange && (
                <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded">fascia: {st.entities.timeRange}</span>
              )}
              {st.entities?.amount && (
                <span className="px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded">importo: {st.entities.amount}</span>
              )}
              {st.entities?.location && (
                <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">luogo: {st.entities.location}</span>
              )}
              {st.entities?.activity && (
                <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded">attività: {st.entities.activity}</span>
              )}
              {st.entities?.logistics && (
                <span className="px-1.5 py-0.5 bg-cyan-50 text-cyan-700 rounded">
                  logistica: {st.entities.logistics.driver} porta {st.entities.logistics.subject} ({st.entities.logistics.verb})
                </span>
              )}
              {!st.entities?.people?.length && !st.entities?.date && !st.entities?.time && !st.entities?.amount && !st.entities?.location && (
                <span className="text-gray-400 italic">nessuna entità estratta</span>
              )}
            </div>
          </div>

          {/* Dettaglio livelli */}
          <div className="bg-gray-50 rounded p-2 space-y-1">
            <div className="font-semibold text-gray-600">Dettaglio livelli</div>
            <div className="flex gap-4">
              <span className="text-gray-500">L1 NLP.js:</span>
              <span>{st.nlp?.intent || '—'} ({Math.round((st.nlp?.score || 0) * 100)}%)</span>
            </div>
            <div>
              <span className="text-gray-500">L2 Sinapsi:</span>
              <span className="ml-2">{st.synapses?.topType || '—'} ({Math.round((st.synapses?.confidence || 0) * 100)}%) cat: {st.synapses?.category || '—'}</span>
              {st.synapses?.fired?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {st.synapses.fired.map((s, i) => (
                    <span key={i} className={`px-1 py-0.5 rounded ${s.fuzzy ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-700'}`}>
                      {s.key}: {s.weight}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <span className="text-gray-500">Strutturale:</span>
              {st.structural?.hasPersons && <span className="text-blue-600">persone</span>}
              {st.structural?.hasTime && <span className="text-green-600">orario</span>}
              {st.structural?.hasExplicitDate && <span className="text-green-600">data</span>}
              {st.structural?.hasAmount && <span className="text-yellow-600">importo</span>}
              {st.structural?.calendarBoost && <span className="text-cyan-600">cal boost</span>}
              {!st.structural?.hasPersons && !st.structural?.hasTime && !st.structural?.hasExplicitDate && (
                <span className="text-gray-400">nessun segnale forte</span>
              )}
            </div>
          </div>

          {/* Azioni generate */}
          {st.actionsGenerated?.length > 0 && (
            <div>
              <span className="font-semibold text-gray-600">Azioni ({st.actionsGenerated.length}):</span>
              {st.isDualAction && <span className="ml-2 text-indigo-600 font-medium">DUAL ACTION</span>}
              <div className="mt-1 space-y-1">
                {st.actionsGenerated.map((a, i) => (
                  <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded ${a.incomplete ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <IntentBadge intent={a.type} />
                    <span className="text-gray-700">{a.title || a.name || a.text || (a.amount ? `€${a.amount}` : '—')}</span>
                    {a.assignedTo && <span className="text-gray-500">→ {a.assignedTo}</span>}
                    {a.incomplete && <span className="text-red-500 font-medium">incompleto: {a.incomplete}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
