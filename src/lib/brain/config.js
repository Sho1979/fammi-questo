/**
 * config.js — Costanti e configurazione del Cervellone.
 */

// Soglie NLP
export const NLP_CONFIDENCE_HIGH = 0.75   // NLP.js sicuro → non servono sinapsi
export const NLP_CONFIDENCE_LOW = 0.40    // NLP.js incerto → combina con sinapsi
export const SYNAPSE_CONFIDENCE_THRESHOLD = 0.60  // sinapsi da sole bastano
export const FINAL_THRESHOLD = 0.55       // soglia finale per evitare AI

// Fuzzy matching
export const FUZZY_MAX_DISTANCE = 2
export const FUZZY_MIN_LENGTH = 4

// Apprendimento sinapsi
export const LEARNING_RATE = 0.15
export const DECAY_RATE = 0.02
export const DECAY_GRACE_DAYS = 14
export const MAX_SYNAPSES = 800
export const BASE_WEIGHT = 0.35

// Shadow learning — sinapsi apprese dall'utente non si attivano subito.
// Servono SHADOW_CONFIRM_THRESHOLD conferme prima che influenzino il parsing.
// Questo previene che correzioni errate dell'utente inquinino il modello.
export const SHADOW_CONFIRM_THRESHOLD = 3
