/**
 * useDebugAnalytics.js — Hook React che espone le metriche diagnostiche del Cervellone.
 *
 * Delega tutto il calcolo a src/lib/brain/debugAnalytics.js (funzioni pure).
 * L'hook si occupa solo di: fetch log → compute → state React.
 *
 * Espone:
 * - analytics: metriche aggregate per la finestra temporale selezionata
 * - temporal: metriche per tutte le finestre { all, h24, d7, session }
 * - problemSynapses: top sinapsi nei casi problematici
 * - fallbackPhrases: forme linguistiche che portano a fallback AI
 * - timeWindow / setTimeWindow: selettore finestra temporale
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getDebugLogs } from '../lib/brain/index.js'
import {
  computeDebugMetrics,
  computeTemporalMetrics,
  getTopSynapsesInProblematicLogs,
  getTopFallbackPhrases,
  filterByTimeWindow,
  computeMemoryMetrics,
  getMemoryLogs,
} from '../lib/brain/debugAnalytics.js'

export default function useDebugAnalytics(familyId) {
  const [allLogs, setAllLogs] = useState([])
  const [temporal, setTemporal] = useState({ all: null, h24: null, d7: null, session: null })
  const [problemSynapses, setProblemSynapses] = useState([])
  const [fallbackPhrases, setFallbackPhrases] = useState([])
  const [memoryMetrics, setMemoryMetrics] = useState(null)
  const [memoryLogs, setMemoryLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [timeWindow, setTimeWindow] = useState('all')

  const compute = useCallback(async () => {
    if (!familyId) return
    setLoading(true)

    try {
      const logs = await getDebugLogs(familyId, { limit: 500 })
      setAllLogs(logs)

      if (logs.length === 0) {
        setTemporal({ all: null, h24: null, d7: null, session: null })
        setProblemSynapses([])
        setFallbackPhrases([])
        setMemoryMetrics(null)
        setMemoryLogs([])
        setLoading(false)
        return
      }

      // Metriche per tutte le finestre temporali
      setTemporal(computeTemporalMetrics(logs))

      // Sinapsi e fallback sui log della finestra attiva
      const windowLogs = filterByTimeWindow(logs, timeWindow)
      setProblemSynapses(getTopSynapsesInProblematicLogs(windowLogs, 10))
      setFallbackPhrases(getTopFallbackPhrases(windowLogs, 8))

      // Memory analytics
      setMemoryMetrics(computeMemoryMetrics(windowLogs))
      setMemoryLogs(getMemoryLogs(windowLogs))
    } catch (err) {
      console.warn('[DebugAnalytics] Error:', err)
      setTemporal({ all: null, h24: null, d7: null, session: null })
      setProblemSynapses([])
      setFallbackPhrases([])
      setMemoryMetrics(null)
      setMemoryLogs([])
    }

    setLoading(false)
  }, [familyId, timeWindow])

  useEffect(() => {
    compute()
  }, [compute])

  // Metriche della finestra selezionata
  const analytics = useMemo(() => {
    const windowKey = timeWindow === '24h' ? 'h24' : timeWindow === '7d' ? 'd7' : timeWindow
    return temporal[windowKey] || null
  }, [temporal, timeWindow])

  return {
    analytics,
    temporal,
    problemSynapses,
    fallbackPhrases,
    memoryMetrics,
    memoryLogs,
    loading,
    timeWindow,
    setTimeWindow,
    refresh: compute,
  }
}
