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
  'e', 'o', 'ma', 'che', 'non', 'si', 'mi', 'ti', 'ci', 'vi', 'ne',
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
export function splitSentences(text) {
  // Proteggi i punti negli orari (16.30, 8.00) e nei decimali (3.50 euro)
  // sostituendoli con un placeholder prima dello split
  const protected_ = text.replace(/(\d)[.](\d)/g, '$1\x00$2')

  return protected_
    .split(/[.;!?]+|\bah\s+(?:e|anche|poi)\b|\be\s+poi\b|\be\s+anche\b|\binoltre\b|\bdopo(?:diché)?\b|\bpoi\s+anche\b/i)
    .flatMap(s => {
      const parts = s.split(',')
      if (parts.length > 1 && parts.every(p => p.trim().split(/\s+/).length >= 3)) {
        return parts
      }
      return [s]
    })
    .map(s => s.replace(/\x00/g, '.').trim()) // Ripristina i punti protetti
    .filter(s => s.length > 2)
}
