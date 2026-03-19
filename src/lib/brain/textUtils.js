/**
 * textUtils.js — Stemmer italiano, Levenshtein, fuzzy matching, tokenizer, sentence splitter.
 */

import { FUZZY_MAX_DISTANCE, FUZZY_MIN_LENGTH } from './config.js'

// ═══════════════════════════════════════════════════════════════
// STEMMER ITALIANO (leggero, rule-based)
// ═══════════════════════════════════════════════════════════════
const STEM_SUFFIXES = [
  'azione', 'zione', 'mente', 'ibile', 'abile',
  'ando', 'endo', 'ato', 'ata', 'ati', 'ate',
  'uto', 'uta', 'uti', 'ute', 'ito', 'ita', 'iti', 'ite',
  'are', 'ere', 'ire', 'anno', 'ono', 'ano',
  'iamo', 'iate', 'isce',
  'ista', 'isti', 'iste', 'ismo',
  'tore', 'tori', 'trice', 'trici',
  'iere', 'iera', 'ieri',
  'ezza', 'anza', 'enza',
  'ino', 'ina', 'ini', 'ine',
  'one', 'oni', 'ona',
  'etto', 'etta', 'etti', 'ette',
  'ello', 'ella', 'elli', 'elle',
  'chi', 'che', 'ghi', 'ghe',
  'ci', 'ce', 'gi', 'ge',
  'ie', 'io',
  'i', 'e', 'o', 'a',
]

const STEM_CACHE = new Map()

const STEM_EXCEPTIONS = new Map([
  ['cucina', 'cucin'], ['cucine', 'cucin'],
  ['medicina', 'medicin'], ['piscina', 'piscin'],
  ['cantina', 'cantin'], ['vetrina', 'vetrin'],
  ['pagina', 'pagin'], ['routine', 'routin'], ['online', 'onlin'],
])

export function stemIT(word) {
  if (!word || word.length < 3) return word
  const w = word.toLowerCase()
  if (STEM_CACHE.has(w)) return STEM_CACHE.get(w)
  if (STEM_EXCEPTIONS.has(w)) {
    const stem = STEM_EXCEPTIONS.get(w)
    STEM_CACHE.set(w, stem)
    return stem
  }
  let stem = w
  for (const suffix of STEM_SUFFIXES) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      const candidate = w.slice(0, -suffix.length)
      if (candidate.length >= 3) { stem = candidate; break }
    }
  }
  if (stem.length < 3) stem = w
  STEM_CACHE.set(w, stem)
  return stem
}

// ═══════════════════════════════════════════════════════════════
// LEVENSHTEIN DISTANCE (fuzzy matching)
// ═══════════════════════════════════════════════════════════════
export function levenshtein(a, b) {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  if (Math.abs(a.length - b.length) > FUZZY_MAX_DISTANCE) return FUZZY_MAX_DISTANCE + 1
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[b.length][a.length]
}

export function fuzzyMatch(input, targets) {
  if (!input || input.length < FUZZY_MIN_LENGTH) return null
  let bestTarget = null
  let bestDistance = FUZZY_MAX_DISTANCE + 1
  for (const target of targets) {
    const d = levenshtein(input, target)
    if (d < bestDistance) { bestDistance = d; bestTarget = target }
    if (d === 0) break
  }
  if (bestDistance > FUZZY_MAX_DISTANCE) return null
  const maxLen = Math.max(input.length, bestTarget.length)
  return { target: bestTarget, distance: bestDistance, score: 1 - (bestDistance / maxLen) }
}

// ═══════════════════════════════════════════════════════════════
// TOKENIZER + STOPWORDS
// ═══════════════════════════════════════════════════════════════
const STOPWORDS = new Set([
  'il', 'lo', 'la', 'le', 'li', 'gli', 'un', 'uno', 'una',
  'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
  'e', 'o', 'ma', 'che', 'si', 'mi', 'ti', 'ci', 'vi', 'ne',
  // "non" RIMOSSO da stopwords — deve essere visibile al parser per gestire negazioni
  'al', 'del', 'dal', 'nel', 'sul', 'allo', 'dello', 'dallo', 'nello', 'sullo',
  'alla', 'della', 'dalla', 'nella', 'sulla',
  'alle', 'delle', 'dalle', 'nelle', 'sulle',
  'ha', 'ho', 'hai', 'è', 'sono', 'sta', 'sei', 'siamo', 'hanno',
  'poi', 'anche', 'ancora', 'già', 'ora', 'qui', 'là', 'così',
  'questo', 'quello', 'questa', 'quella', 'questi', 'quelli',
  'mio', 'mia', 'miei', 'mie', 'tuo', 'tua', 'suo', 'sua',
  'molto', 'poco', 'tanto', 'troppo', 'tutto', 'ogni',
  'come', 'dove', 'quando', 'perché', 'cosa',
])

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[''`]/g, ' ')
    .replace(/[^\w\sàèéìòù€]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0)
}

export function tokenizeForMatching(text) {
  return tokenize(text).filter(t => !STOPWORDS.has(t) && t.length > 1)
}

/**
 * Detect negation in a sentence. Returns true if the sentence
 * contains a negation that should prevent action creation.
 *
 * Patterns:
 *   "non comprare X"  -> true (negated action)
 *   "niente spesa"     -> true (negated intent)
 *   "non X" before a verb -> true
 *   "ricordami di NON X" -> false (negation is the CONTENT, not the intent)
 */
const NEGATION_PATTERNS = [
  /^non\s+(?:comprare|compra|portare|porta|prendere|prendi|fare|fai|andare|vai)\b/i,
  /^(?:niente|nessun[oa]?)\s+(?:spesa|shopping|compere|acquisti)\b/i,
  /^(?:oggi|domani|stasera)\s+(?:non|niente)\b/i,
  /^non\s+(?:serve|servono|occorre|bisogna)\b/i,
]

export function isNegatedAction(sentence) {
  const trimmed = sentence.trim().toLowerCase()
  return NEGATION_PATTERNS.some(re => re.test(trimmed))
}

// ═══════════════════════════════════════════════════════════════
// SENTENCE SPLITTER
// ═══════════════════════════════════════════════════════════════
/**
 * Divide testo in frasi separate.
 *
 * INTERRUPTION HANDLING: gestisce le interruzioni tipiche del parlato italiano
 * dove l'utente cambia intent mid-sentence:
 *   "porta Viola a danza, ah e compra il latte"  → 2 frasi
 *   "domani dentista Viola e poi ricordami la bolletta" → 2 frasi
 *   "compra latte ah anche pane e uova" → 2 frasi
 *
 * Separatori:
 *   - Punteggiatura: . ; ! ?
 *   - Connettivi sequenziali: "e poi", "inoltre", "dopodiché"
 *   - Interruzioni parlato: "ah e", "ah anche", "ah poi", "e anche"
 *   - Virgole tra frasi lunghe (≥3 parole ciascuna)
 */
/**
 * Verbi d'azione che segnalano un cambio di intent quando preceduti da "e" o ",".
 * "Luca e Giulia" non splitta (congiunzione tra entità, non verbo dopo "e").
 * "e compra latte" splitta (cambio intent: verbo d'azione dopo "e").
 */
const ACTION_VERBS_RE = /^(?:compra|comprare|prendi|prendere|porta|portare|segna|segnare|ricordami|ricordaci|ricorda|avvisami|avvisaci|prenota|prenotare|paga|pagare|chiama|chiamare|fissa|fissare|lava|lavare|pulisci|pulire|stira|stirare|prepara|preparare|cucina|cucinare|ordina|ordinare|metti|mettere|togli|togliere|butta|buttare|controlla|controllare|sistema|sistemare|svuota|svuotare|riordina|riordinare|stendi|stendere|apparecchia|sparecchia|spazza|aspira|innaffia|firma|firmare|stampa|stampare|rinnova|rinnovare|iscrivere|iscrivi|consegna|consegnare)$/i

export function splitSentences(text) {
  // Proteggi i punti negli orari (16.30, 8.00) e nei decimali (3.50 euro)
  const protected_ = text.replace(/(\d)[.](\d)/g, '$1\x00$2')

  // Phase 1: split on explicit delimiters and Italian speech interruptions
  const phase1 = protected_
    .split(/[.;!?]+|\bah\s+(?:e|anche|poi)\b|\be\s+poi\b|\be\s+anche\b|\binoltre\b|\bdopo(?:diché)?\b|\bpoi\s+anche\b/i)

  // Phase 2: verb-transition splitting on "e" and ","
  // Split when "e" or "," is followed by a known action verb (= intent change).
  // "Luca e Giulia" stays together (Giulia is not a verb).
  // "e compra latte" splits (compra is an action verb).
  const phase2 = phase1.flatMap(segment => {
    // Try verb-transition split on " e " first
    const ePattern = /\s+e\s+/gi
    const parts = []
    let lastIdx = 0
    let match

    while ((match = ePattern.exec(segment)) !== null) {
      const afterE = segment.slice(match.index + match[0].length).trim()
      const firstWordAfterE = afterE.split(/\s+/)[0]

      if (firstWordAfterE && ACTION_VERBS_RE.test(firstWordAfterE)) {
        // Split here: action verb after "e" = new intent
        parts.push(segment.slice(lastIdx, match.index))
        lastIdx = match.index + match[0].length
      }
      // else: "Luca e Giulia" → don't split
    }
    parts.push(segment.slice(lastIdx))

    // Phase 2b: comma split — split on "," when followed by action verb OR
    // when all parts have ≥3 words (original behavior)
    return parts.flatMap(s => {
      const commaParts = s.split(',')
      if (commaParts.length <= 1) return [s]

      // Check if any comma is followed by an action verb
      const verbSplit = []
      let current = commaParts[0]
      for (let i = 1; i < commaParts.length; i++) {
        const firstWord = commaParts[i].trim().split(/\s+/)[0]
        if (firstWord && ACTION_VERBS_RE.test(firstWord)) {
          verbSplit.push(current)
          current = commaParts[i]
        } else {
          current += ',' + commaParts[i]
        }
      }
      verbSplit.push(current)
      if (verbSplit.length > 1) return verbSplit

      // Fallback: original comma-split when all parts have ≥3 words
      if (commaParts.every(p => p.trim().split(/\s+/).length >= 3)) {
        return commaParts
      }
      return [s]
    })
  })

  return phase2
    .map(s => s.replace(/\x00/g, '.').trim())
    .filter(s => s.length > 2)
}
