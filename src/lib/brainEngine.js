/**
 * brainEngine.js — WRAPPER BACKWARD-COMPATIBLE
 *
 * Questo file ri-esporta tutto da brain/index.js per compatibilità.
 * Il codice reale è stato modularizzato in src/lib/brain/:
 *
 *   brain/
 *     index.js            — Orchestratore (brainParse) + Stats + Re-exports
 *     config.js            — Costanti e soglie
 *     textUtils.js         — Stemmer, Levenshtein, fuzzy, tokenizer, sentence splitter
 *     entityExtractor.js   — Date, orari, importi, persone, logistica, luoghi, attività
 *     patterns.js          — Sinapsi bootstrap (conoscenza innata)
 *     synapseEngine.js     — Attivazione sinapsi (L2) + contesto temporale
 *     actionBuilder.js     — Costruzione azioni + title cleaning
 *     intentClassifier.js  — Parser locale L0+L1+L2 (parseLocally)
 *     learningEngine.js    — Rinforzo, punizione, decay, pruning
 *
 * NOTA: Tutti i nuovi import dovrebbero puntare a '../lib/brain/index.js'
 * Questo wrapper sarà rimosso in una futura versione.
 */

export {
  brainParse,
  parseLocally,
  learnFromConfirmed,
  learnFromRejected,
  applyDecay,
  getBrainStats,
  // Debug logging
  isDebugEnabled,
  setDebugEnabled,
  getDebugLogs,
  clearDebugLogs,
} from './brain/index.js'
