/**
 * utils.js — Date helpers, random selection, template interpolation,
 *            Italian date formatting, and text realism transforms.
 *
 * All dates use ISO format strings internally (YYYY-MM-DD).
 * @module simulator/utils
 */

// ─── ITALIAN LOCALE TABLES ─────────────────────────────────

/** @type {string[]} Italian day names, Monday-indexed (0 = lunedi) */
const GIORNI = [
  'lunedi', 'martedi', 'mercoledi', 'giovedi',
  'venerdi', 'sabato', 'domenica',
]

/** @type {string[]} Italian day names with accents for display */
const GIORNI_DISPLAY = [
  'luned\u00ec', 'marted\u00ec', 'mercoled\u00ec', 'gioved\u00ec',
  'venerd\u00ec', 'sabato', 'domenica',
]

/** @type {string[]} Italian month names (0-indexed) */
const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

// ─── TYPO & DIALECT TABLES ──────────────────────────────────

/** Common Italian keyboard-adjacent swaps */
const TYPO_SWAPS = {
  a: 's', s: 'a', e: 'r', r: 'e', i: 'o', o: 'i',
  n: 'm', m: 'n', t: 'r', l: 'k', c: 'v', v: 'c',
  b: 'v', g: 'h', h: 'g', d: 'f', f: 'd', p: 'o',
  z: 'x', u: 'i',
}

/** Northern Italian dialect substitutions (Lombardy/Veneto flavour) */
const DIALECT_RULES = [
  { from: /\bdi\b/g, to: 'de' },
  { from: /\bil\b/g, to: "'l" },
  { from: /\bnon\b/g, to: 'mia' },
  { from: /\banche\b/g, to: 'anca' },
  { from: /\badesso\b/g, to: 'adess' },
  { from: /\bqualcosa\b/g, to: 'quaicos' },
  { from: /\bniente\b/g, to: 'gnent' },
  { from: /\bperch[eé]\b/gi, to: 'perch\u00e8' },
  { from: /\bfatto\b/g, to: 'fat' },
  { from: /\bdetto\b/g, to: 'dit' },
  { from: /\bpiccolo\b/g, to: 'piscinin' },
  { from: /\bbene\b/g, to: 'ben' },
  { from: /\bragazzo\b/g, to: 'bocia' },
]

// ─── DATE HELPERS ───────────────────────────────────────────

/**
 * Parse an ISO date string (YYYY-MM-DD) into a Date at noon UTC
 * to avoid timezone shift issues.
 * @param {string} isoStr - ISO date string
 * @returns {Date}
 */
function parseISO(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

/**
 * Format a Date or ISO string to YYYY-MM-DD.
 * @param {Date|string} date
 * @returns {string}
 */
function toISO(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Compute a simulated date from a start date and day offset.
 * @param {string} startDate - ISO start date (YYYY-MM-DD)
 * @param {number} dayOffset - number of days to add
 * @returns {string} ISO date string
 */
export function simDate(startDate, dayOffset) {
  const d = parseISO(startDate)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  return toISO(d)
}

/**
 * Get the Italian day-of-week name for a date.
 * @param {string|Date} date - ISO string or Date
 * @returns {string} e.g. "luned\u00ec", "marted\u00ec"
 */
export function dayOfWeekIT(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  // getUTCDay: 0=Sun, 1=Mon ... 6=Sat  ->  map to GIORNI_DISPLAY (0=Mon)
  const jsDay = d.getUTCDay() // 0=Sun
  const idx = jsDay === 0 ? 6 : jsDay - 1
  return GIORNI_DISPLAY[idx]
}

/**
 * Format a date in Italian style: "luned\u00ec 15 settembre"
 * @param {string|Date} date - ISO string or Date
 * @returns {string}
 */
export function formatDateIT(date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  const giorno = dayOfWeekIT(d)
  const num = d.getUTCDate()
  const mese = MESI[d.getUTCMonth()]
  return `${giorno} ${num} ${mese}`
}

/**
 * Compute the difference in calendar days between two ISO dates.
 * @param {string} a - ISO date
 * @param {string} b - ISO date
 * @returns {number} b - a in days
 */
function diffDays(a, b) {
  const da = parseISO(a)
  const db = parseISO(b)
  return Math.round((db - da) / (24 * 60 * 60 * 1000))
}

/**
 * Produce a natural Italian relative date reference.
 *
 * - 0 days  -> "oggi"
 * - 1 day   -> "domani"
 * - 2 days  -> "dopodomani"
 * - -1 day  -> "ieri"
 * - same week (2-6 days ahead) -> day name, e.g. "marted\u00ec"
 * - otherwise -> "il 20" or "il 3 febbraio" (if different month)
 *
 * @param {string} simDateStr - the current simulated date (YYYY-MM-DD)
 * @param {string} targetDate - the target date (YYYY-MM-DD)
 * @returns {string} Italian relative reference
 */
export function dateRef(simDateStr, targetDate) {
  const delta = diffDays(simDateStr, targetDate)

  if (delta === 0) return 'oggi'
  if (delta === 1) return 'domani'
  if (delta === 2) return 'dopodomani'
  if (delta === -1) return 'ieri'
  if (delta === -2) return "l'altro ieri"

  // 3-6 days ahead: use day name
  if (delta >= 3 && delta <= 6) {
    return dayOfWeekIT(targetDate)
  }

  // Fallback: "il <day>" or "il <day> <month>" if different month
  const sim = parseISO(simDateStr)
  const tgt = parseISO(targetDate)
  const dayNum = tgt.getUTCDate()

  if (sim.getUTCMonth() !== tgt.getUTCMonth() || sim.getUTCFullYear() !== tgt.getUTCFullYear()) {
    return `il ${dayNum} ${MESI[tgt.getUTCMonth()]}`
  }
  return `il ${dayNum}`
}

/**
 * Format a time slot in Italian natural style.
 * @param {number} hour - 0-23
 * @param {number} [minute=0] - 0-59
 * @returns {string} e.g. "alle 16", "alle 8:30", "a mezzanotte", "a mezzogiorno"
 */
export function timeSlot(hour, minute = 0) {
  if (hour === 0 && minute === 0) return 'mezzanotte'
  if (hour === 12 && minute === 0) return 'mezzogiorno'

  const hStr = String(hour)
  if (minute === 0) {
    return hStr  // just the number, template adds "alle"
  }
  const mStr = String(minute).padStart(2, '0')
  return `${hStr}:${mStr}`
}

// ─── RANDOM SELECTION ───────────────────────────────────────

/**
 * Pick a random element from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
export function pickRandom(arr) {
  if (!arr || arr.length === 0) {
    throw new Error('pickRandom: array is empty or undefined')
  }
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Pick a random element from an array using weights.
 * Weights do not need to sum to 1; they are normalised internally.
 *
 * @template T
 * @param {T[]} arr - items to choose from
 * @param {number[]} weights - parallel array of non-negative weights
 * @returns {T}
 */
export function pickWeighted(arr, weights) {
  if (!arr || arr.length === 0) {
    throw new Error('pickWeighted: array is empty or undefined')
  }
  if (arr.length !== weights.length) {
    throw new Error('pickWeighted: array and weights length mismatch')
  }

  const total = weights.reduce((s, w) => s + w, 0)
  if (total <= 0) {
    throw new Error('pickWeighted: total weight must be > 0')
  }

  let r = Math.random() * total
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i]
    if (r <= 0) return arr[i]
  }
  return arr[arr.length - 1]
}

// ─── TEMPLATE INTERPOLATION ─────────────────────────────────

/**
 * Replace `{{varName}}` placeholders in a template string.
 * Unknown placeholders are left as-is.
 *
 * @param {string} template - template with {{var}} placeholders
 * @param {Record<string, string|number>} vars - key-value replacements
 * @returns {string}
 */
export function interpolate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in vars ? String(vars[key]) : match
  })
}

// ─── TEXT REALISM ───────────────────────────────────────────

/**
 * Apply realistic Italian typos to text at a given rate.
 *
 * Typo types (equally weighted):
 *   - char swap (adjacent characters)
 *   - missing letter (deleted character)
 *   - double letter (repeated character)
 *
 * @param {string} text - input text
 * @param {number} [rate=0.02] - probability of typo per character (0-1)
 * @returns {string} text with realistic typos
 */
export function applyTypos(text, rate = 0.02) {
  if (rate <= 0 || text.length < 3) return text

  // Rate is the probability the phrase gets a typo at all.
  // If triggered, apply exactly 1-2 typos (not per-character).
  if (Math.random() > rate) return text // no typo this time
  const numTypos = Math.random() < 0.7 ? 1 : 2 // 70% one typo, 30% two
  const perCharRate = numTypos / text.length // convert to per-char rate

  const chars = [...text]
  const result = []

  for (let i = 0; i < chars.length; i++) {
    if (Math.random() >= perCharRate) {
      result.push(chars[i])
      continue
    }

    const ch = chars[i].toLowerCase()
    const typoType = Math.random()

    if (typoType < 0.4 && TYPO_SWAPS[ch]) {
      // Adjacent-key swap
      const swapped = TYPO_SWAPS[ch]
      result.push(chars[i] === chars[i].toUpperCase() ? swapped.toUpperCase() : swapped)
    } else if (typoType < 0.7 && i > 0) {
      // Missing letter — just skip this character
      // (don't remove first char to avoid empty words)
    } else {
      // Double letter
      result.push(chars[i])
      result.push(chars[i])
    }
  }

  return result.join('')
}

/**
 * Apply Northern Italian dialect mutations at a given rate.
 * Each rule is applied independently with probability = rate.
 *
 * @param {string} text - input text
 * @param {number} [rate=0.15] - probability of each rule firing (0-1)
 * @returns {string} text with dialect touches
 */
export function addDialect(text, rate = 0.15) {
  if (rate <= 0) return text

  let result = text
  for (const rule of DIALECT_RULES) {
    if (Math.random() < rate) {
      result = result.replace(rule.from, rule.to)
    }
  }
  return result
}

// ─── INTERNAL RE-EXPORTS FOR TESTING ────────────────────────

export { parseISO, toISO, diffDays, GIORNI_DISPLAY, MESI }
