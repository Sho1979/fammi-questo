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
// ACTIONABILITY FILTER
// ═══════════════════════════════════════════════════════════════
/**
 * Check if a sentence is NON-actionable chatter that should be blocked.
 * Inverted approach: block ONLY known chatter patterns, let everything else through.
 * This prevents over-filtering legitimate Italian commands that lack explicit action verbs.
 *
 * "ciao come stai" → blocked (greeting)
 * "ho fame" → blocked (state, not command)
 * "Asia ha preso 8" → blocked (report, not command)
 * "Martedì Viola ha il dentista" → allowed (calendar intent)
 * "latte uova pane" → allowed (shopping list)
 */
const CHATTER_PATTERNS = [
  // Greetings and social
  /^(?:ciao|buongiorno|buonasera|salve|hey|ehi)\b/i,
  /\b(?:come\s+stai|come\s+va|tutto\s+bene|bella\s+giornata)\b/i,
  // Pure confirmations/reactions (no content)
  /^(?:ok|va\s+bene|si|no|boh|forse|perfetto|grazie|dai|bella|bene|bravo|brava)\s*$/i,
  /^(?:si\s+no\s+forse|hm\s+si\s+ok|si\s+ok\s+va\s+bene|ok\s+va\s+bene|perfetto\s+cos[iì]|va\s+bene\s+(?:dai|ok|grazie|così))\b/i,
  // Opinions/states with no actionable content
  /^(?:ho\s+fame|ho\s+sete|ho\s+sonno|sono\s+stanco|sono\s+stanca)\s*$/i,
  // "X ha preso N" (grade report, not command) -- but NOT "X ha danza/dentista"
  /\bha\s+preso\s+\d/i,
  // Questions about cost/info with no action
  /^quanto\s+cost[ai]/i,
  // Compliments/descriptions that aren't commands
  /\b(?:è\s+(?:un\s+)?bel\s|è\s+bell[oa]|è\s+brav[oa])\b/i,
]

// ─── CONTEXTUAL PREFIX STRIPPER ─────────────────────────────────
// Strips conversational context prefixes that confuse the NLP classifier.
// "Tornando da lavoro, martedi sera facciamo frittata" → "martedi sera facciamo frittata"
// "Mentre ero in macchina, ho speso 50 euro" → "ho speso 50 euro"
// Entities (date, person, amount) are extracted from the FULL text before stripping.
const CONTEXT_PREFIXES_RE = /^(?:tornando\s+da\s+\w+|mentre\s+(?:ero|eravamo|stavo)\s+(?:in|al|a)\s+\w+|al\s+telefono\s+(?:mi|ci)\s+hanno\s+detto\s+che|ho\s+pensato\s+che|prima\s+di\s+uscire|appena\s+(?:sveglia?o?|arrivat[oa])|dopo\s+(?:pranzo|cena|lavoro|scuola)|stamattina\s+presto|(?:ah\s+)?senti|guarda|allora|sai\s+che|ma\s+dai|ehi|niente|comunque|vabb[eè]|aspetta)\s*[,.]?\s+/i

/**
 * Remove conversational context prefixes from a sentence.
 * These prefixes add context but confuse NLP intent classification.
 * Returns the sentence with the prefix removed (if any).
 */
export function stripContextPrefix(sentence) {
  let stripped = sentence.replace(CONTEXT_PREFIXES_RE, '')
  // Don't strip if it would remove the entire sentence or leave < 3 words
  if (stripped.length < 5) stripped = sentence
  // Also strip conversational suffixes that confuse NLP
  stripped = stripConversationalSuffix(stripped)
  return stripped
}

// ─── CONVERSATIONAL SUFFIX STRIPPER ─────────────────────────────
// Strips trailing conversational fillers: "ok?", "che dici?", "va bene?", "dai", etc.
const CONVERSATIONAL_SUFFIX_RE = /[,.]?\s*(?:ok\??|che (?:dici|dico|ne dici|ne pensi)\??|va bene\??|d'accordo\??|capito\??|eh\??|no\??|dai|si\??)\s*$/i

export function stripConversationalSuffix(sentence) {
  const stripped = sentence.replace(CONVERSATIONAL_SUFFIX_RE, '')
  if (stripped.length < 5) return sentence
  return stripped
}

// ─── MERGED WORD SPLITTER ─────────────────────────────────────────
// Italian colloquial speech often merges small words with the next:
//   "hodanza" → "ho danza", "adormire" → "a dormire"
// Applied early in parsing to normalize text before NLP classification.
const MERGED_WORD_FIXES = [
  // "ho" + activity: hodanza, holezione, honuoto, hocalcio, etc.
  [/\bho(danza|lezione|nuoto|calcio|palestra|catechismo|basket|tennis|karate|allenamento|ginnastica|partita|gara|saggio|corso)\b/gi, 'ho $1'],
  // "a" + infinitive: adormire, aprendere, afare, agiocare
  [/\ba(dormire|prendere|portare|fare|giocare|mangiare|comprare|andare)\b/gi, 'a $1'],
]

export function splitMergedWords(text) {
  let result = text
  for (const [re, replacement] of MERGED_WORD_FIXES) {
    result = result.replace(re, replacement)
  }
  return result
}

// Single word that is clearly not a command (too ambiguous alone)
const SINGLE_WORD_BLOCK = /^(?:ciao|ok|si|no|boh|forse|grazie|bene|bella|bravo|brava|niente|nulla)$/i

export function isActionable(sentence) {
  const lower = sentence.trim().toLowerCase()
  const words = lower.split(/\s+/).filter(w => w.length > 0)

  // Single word: block only known non-commands
  if (words.length === 1) {
    return !SINGLE_WORD_BLOCK.test(lower)
  }

  // Block known chatter patterns
  if (CHATTER_PATTERNS.some(re => re.test(lower))) return false

  // Everything else: let the parser decide
  return true
}

// Past tense markers that indicate reporting, not commanding
const PAST_TENSE_CHECK = /(?:ho|ha|abbiamo|hanno)\s+(?:portato|comprato|pagato|fatto|preso|messo|detto|visto|chiamato|mangiato|cucinato|lavato|pulito|finito|completato|preparato|sistemato|riordinato|rifatto|stirato|spazzato|apparecchiato|sparecchiato)/i
const PAST_TENSE_STATE = /\b(?:era\s+(?:buon[oa]|bell[oa])|erano\s+|è\s+stat[oa]\s+(?:spostat|cancellat|bell|buon)|è\s+andat[oa]|sono\s+andat[ei]|siamo\s+andat[ei])\b/i

// Exception: "ho speso/pagato X euro" is a valid expense
const PAST_TENSE_EXPENSE = /(?:ho|ha|abbiamo)\s+(?:speso|pagato|preso)\s+\d/i
// Exception: "ha fatto la spesa X euro" is valid
const PAST_TENSE_EXPENSE2 = /(?:ha|ho)\s+(?:fatto\s+la\s+spesa|speso|pagato).*\d+\s*(?:euro|€)/i
// Exception: "ho prenotato la visita" creates a future event, not a report
const PAST_TENSE_FUTURE_ACTION = /(?:ho|ha|abbiamo)\s+(?:prenotato|fissato|iscritto|confermato)\s+/i
// Exception: "mi ha detto di + infinitive" is an order/task, not a report
const PAST_TENSE_INDIRECT_ORDER = /(?:mi|ci)\s+ha\s+detto\s+di\s+/i

export function isPastTenseReport(sentence) {
  const lower = sentence.trim().toLowerCase()
  // Exceptions: expense/cost reports with amounts are valid actions
  if (PAST_TENSE_EXPENSE.test(lower)) return false
  if (PAST_TENSE_EXPENSE2.test(lower)) return false
  // Exception: "ho prenotato/fissato" creates future events
  if (PAST_TENSE_FUTURE_ACTION.test(lower)) return false
  // Exception: "mi ha detto di fare X" is an indirect order
  if (PAST_TENSE_INDIRECT_ORDER.test(lower)) return false
  // Check for past tense verbs or state descriptions
  if (PAST_TENSE_CHECK.test(lower)) return true
  if (PAST_TENSE_STATE.test(lower)) return true
  return false
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
const ACTION_VERBS_RE = /^(?:compra|comprare|prendi|prendere|porta|portare|segna|segnare|ricordami|ricordaci|ricorda|ricordati|ricordatevi|avvisami|avvisaci|prenota|prenotare|paga|pagare|chiama|chiamare|fissa|fissare|lava|lavare|pulisci|pulire|stira|stirare|prepara|preparare|preparo|cucina|cucinare|cucino|ordina|ordinare|metti|mettere|togli|togliere|butta|buttare|controlla|controllare|sistema|sistemare|svuota|svuotare|riordina|riordinare|stendi|stendere|apparecchia|sparecchia|spazza|aspira|innaffia|firma|firmare|stampa|stampare|rinnova|rinnovare|iscrivere|iscrivi|consegna|consegnare|devi|dovete|bisogna|facciamo|faccio|fai|fa|fanno|andiamo|vado|vai|va)$/i

/** Parole temporali che possono precedere un verbo d'azione dopo "e" / "," */
const TIME_WORDS_RE = /^(?:domani|dopodomani|stasera|stanotte|stamattina|oggi|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica|lunedi|martedi|mercoledi|giovedi|venerdi|dopo|prima|alle|la|il|nel|per)$/i

export function splitSentences(text) {
  // Proteggi punti e virgole negli orari (16.30, 18,30) e nei decimali (3.50, 3,50 euro)
  const protected_ = text.replace(/(\d)[.](\d)/g, '$1\x00$2').replace(/(\d)[,](\d)/g, '$1\x01$2')

  // Phase 1: split on explicit delimiters and Italian speech interruptions
  const phase1 = protected_
    .split(/[.;!?]+|\bah\s+(?:e|anche|poi)\b|\be\s+poi\b|\bpoi\s+anche\b|\be\s+anche\b|\binoltre\b|\bdopo(?:diché)?\b|(?<!\bo\s)\bpoi\b/i)

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
      const wordsAfterE = afterE.split(/\s+/)
      const firstWord = wordsAfterE[0]

      let hasVerb = firstWord && ACTION_VERBS_RE.test(firstWord)

      // If first word is a time reference ("domenica", "domani", "stasera"),
      // check subsequent words for an action verb (up to 3 words ahead)
      if (!hasVerb && firstWord && TIME_WORDS_RE.test(firstWord)) {
        for (let wi = 1; wi < Math.min(wordsAfterE.length, 4); wi++) {
          if (ACTION_VERBS_RE.test(wordsAfterE[wi])) {
            hasVerb = true
            break
          }
          // Stop scanning if we hit another time word (keep looking) or a non-time non-verb word
          if (!TIME_WORDS_RE.test(wordsAfterE[wi])) break
        }
      }

      if (hasVerb) {
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
        const words = commaParts[i].trim().split(/\s+/)
        const firstWord = words[0]
        let hasVerb = firstWord && ACTION_VERBS_RE.test(firstWord)
        // Check past time word for verb (same logic as Phase 2)
        if (!hasVerb && firstWord && TIME_WORDS_RE.test(firstWord)) {
          for (let wi = 1; wi < Math.min(words.length, 4); wi++) {
            if (ACTION_VERBS_RE.test(words[wi])) { hasVerb = true; break }
            if (!TIME_WORDS_RE.test(words[wi])) break
          }
        }
        if (hasVerb) {
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
    .map(s => s.replace(/\x00/g, '.').replace(/\x01/g, ',').trim())
    .filter(s => s.length > 2)
}
