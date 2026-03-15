/**
 * Costanti UI condivise dalla BrainDebugPage e dai sotto-componenti.
 * Estratte per ridurre la dimensione del file principale.
 */

export const INTENT_COLORS = {
  calendar: 'bg-blue-100 text-blue-800',
  task: 'bg-green-100 text-green-800',
  expense: 'bg-yellow-100 text-yellow-800',
  meal: 'bg-orange-100 text-orange-800',
  shopping: 'bg-purple-100 text-purple-800',
  absence: 'bg-red-100 text-red-800',
  reminder: 'bg-violet-100 text-violet-800',
  note: 'bg-gray-100 text-gray-700',
  none: 'bg-gray-100 text-gray-500',
  null: 'bg-gray-100 text-gray-500',
}

export const WARNING_LABELS = {
  missing_explicit_time: 'Orario mancante',
  no_person_assigned: 'Persona non trovata',
  needs_pickup_person: 'Chi riprende?',
  nlp_not_ready: 'NLP non pronto',
  nlp_classify_error: 'Errore NLP',
  below_threshold: 'Sotto soglia',
  low_local_confidence: 'Conf. bassa → AI',
  ai_failed: 'AI fallita',
  absent_person_unknown: 'Assente sconosciuto',
}

export const QUICK_VIEWS = [
  { id: 'all', label: 'Tutti', iconName: 'BarChart3' },
  { id: 'low_conf', label: 'Low conf', iconName: 'Target' },
  { id: 'ai_fallback', label: 'AI fallback', iconName: 'CloudLightning' },
  { id: 'avoidable_ai', label: 'AI evitabili', iconName: 'Lightbulb' },
  { id: 'missing', label: 'Entità manc.', iconName: 'Search' },
  { id: 'incomplete', label: 'Incompleti', iconName: 'ShieldAlert' },
  { id: 'memory', label: 'Memoria', iconName: 'Brain' },
]

export const MEMORY_ACTION_LABELS = {
  create: 'Draft creato',
  merge: 'Merge nel draft',
  merge_then_commit: 'Merge → Commit',
  create_then_commit: 'Creato → Commit',
  abandon: 'Abbandonato',
  abandon_no_new_draft: 'Abbandonato (no nuovo)',
  abandon_then_create: 'Abbandonato → Nuovo',
  ignore: 'Ignorato',
  ignore_complete: 'Ignorato (completo)',
  ignore_orphan_fragment: 'Frammento orfano',
  error: 'Errore',
}

export const MEMORY_ACTION_COLORS = {
  create: 'bg-blue-100 text-blue-700',
  merge: 'bg-cyan-100 text-cyan-700',
  merge_then_commit: 'bg-green-100 text-green-700',
  create_then_commit: 'bg-green-100 text-green-700',
  abandon: 'bg-red-100 text-red-700',
  abandon_no_new_draft: 'bg-red-100 text-red-600',
  abandon_then_create: 'bg-amber-100 text-amber-700',
  ignore: 'bg-gray-100 text-gray-500',
  ignore_complete: 'bg-gray-100 text-gray-500',
  ignore_orphan_fragment: 'bg-amber-100 text-amber-600',
  error: 'bg-red-200 text-red-800',
}
