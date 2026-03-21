/**
 * Mutates existing phrase templates to produce structurally novel phrases.
 * 7 strategies: reorder, register, ellipsis, filler, typo+dialect, context, voice noise.
 * Never changes intent or shouldWrite.
 */

import { pickRandom, applyTypos, addDialect } from '../utils.js'

// ── MUTATION STRATEGIES ─────────────────────────────────

/**
 * Strategy 1: REORDER — move clause order
 * "Ho speso 50 al super" → "Al super ho speso 50"
 */
function reorder(text) {
  // Split at preposition boundary
  const prepositions = /\b(al|alla|dal|dalla|per|in|a|da|con|su|nel|nella|dello|della)\s+/i
  const match = text.match(prepositions)
  if (!match || match.index < 3) return text

  const before = text.slice(0, match.index).trim()
  const after = text.slice(match.index).trim()

  // Move prepositional phrase to front
  return after.charAt(0).toUpperCase() + after.slice(1) + ' ' + before.charAt(0).toLowerCase() + before.slice(1)
}

/**
 * Strategy 2: REGISTER — change formality level
 */
const REGISTER_SWAPS_FORMAL = [
  [/\bho speso\b/gi, 'ho sostenuto una spesa di'],
  [/\bdevo\b/gi, 'avrei necessita di'],
  [/\bporto\b/gi, 'accompagno'],
  [/\bprendo\b/gi, 'passo a ritirare'],
  [/\bcompra\b/gi, 'acquista'],
  [/\bstasera\b/gi, 'questa sera'],
  [/\bdomani\b/gi, 'il giorno seguente'],
]

const REGISTER_SWAPS_INFORMAL = [
  [/\bho speso\b/gi, 'ho lasciato'],
  [/\bacquistare\b/gi, 'prendere'],
  [/\bnecessario\b/gi, 'serve'],
  [/\baccompagno\b/gi, 'porto'],
  [/\bquesta sera\b/gi, 'stasera'],
  [/\beuro\b/gi, 'euri'],
]

function changeRegister(text, formal = true) {
  const swaps = formal ? REGISTER_SWAPS_FORMAL : REGISTER_SWAPS_INFORMAL
  let result = text
  // Apply 1-2 random swaps
  const count = 1 + Math.floor(Math.random() * 2)
  const shuffled = [...swaps].sort(() => Math.random() - 0.5)
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    result = result.replace(shuffled[i][0], shuffled[i][1])
  }
  return result
}

/**
 * Strategy 3: ELLIPSIS — drop subject/verb
 * "Ho speso 50 al super" → "50 euro al super"
 */
function ellipsis(text) {
  // Try dropping "Ho/Devo/Bisogna + verb" prefix
  const prefixRe = /^(?:ho|devo|bisogna|oggi|domani|ieri)\s+\w+\s+/i
  const match = text.match(prefixRe)
  if (match) {
    const rest = text.slice(match[0].length)
    return rest.charAt(0).toUpperCase() + rest.slice(1)
  }
  return text
}

/**
 * Strategy 4: FILLER — add Italian conversation fillers
 */
const FILLERS_PRE = [
  'Ah senti, ', 'Guarda, ', 'Allora, ', 'Sai che ', 'Ma dai, ',
  'Ehi, ', 'Niente, ', 'Comunque, ', 'Vabbè, ', 'Aspetta, ',
]
const FILLERS_POST = [
  ', eh', ', va bene?', ', ok?', ', capito?', ', dai',
  ', che dici?', ', ti avviso', ', niente di che',
]

function addFiller(text) {
  if (Math.random() > 0.5) {
    return pickRandom(FILLERS_PRE) + text.charAt(0).toLowerCase() + text.slice(1)
  }
  return text + pickRandom(FILLERS_POST)
}

/**
 * Strategy 5: TYPO + DIALECT — combine both
 */
function typoAndDialect(text) {
  let result = applyTypos(text, 0.08)  // Higher rate than normal
  result = addDialect(result, 0.20)
  return result
}

/**
 * Strategy 6: CONTEXT — add contextual prefix/suffix
 */
const CONTEXT_PREFIXES = [
  'Tornando da lavoro, ', 'Mentre ero in macchina, ', 'Stamattina presto, ',
  'Prima di uscire, ', 'Appena sveglia, ', 'Dopo pranzo, ',
  'Al telefono mi hanno detto che ', 'Ho pensato che ',
]

function addContext(text) {
  const prefix = pickRandom(CONTEXT_PREFIXES)
  return prefix + text.charAt(0).toLowerCase() + text.slice(1)
}

/**
 * Strategy 7: VOICE NOISE — simulate speech-to-text errors
 */
const NUMBER_WORDS = {
  '5': 'cinque', '10': 'dieci', '15': 'quindici', '20': 'venti',
  '25': 'venticinque', '30': 'trenta', '35': 'trentacinque',
  '40': 'quaranta', '45': 'quarantacinque', '50': 'cinquanta',
  '60': 'sessanta', '70': 'settanta', '80': 'ottanta',
  '90': 'novanta', '100': 'cento', '150': 'centocinquanta',
  '200': 'duecento',
}

function voiceNoise(text) {
  let result = text

  // Numbers → words (30% chance per number)
  result = result.replace(/\b(\d+)\b/g, (match) => {
    if (Math.random() < 0.3 && NUMBER_WORDS[match]) {
      return NUMBER_WORDS[match]
    }
    return match
  })

  // Remove commas between list items (50% chance)
  if (Math.random() > 0.5) {
    result = result.replace(/,\s+/g, ' ')
  }

  // Remove articles (20% chance per article)
  result = result.replace(/\b(il|la|lo|le|li|gli|un|una|l')\s+/gi, (match) => {
    return Math.random() < 0.2 ? '' : match
  })

  // Lowercase everything (voice-to-text often doesn't capitalize)
  if (Math.random() > 0.5) {
    result = result.toLowerCase()
  }

  return result
}

// ── STRATEGY REGISTRY ───────────────────────────────────

const STRATEGIES = [
  { name: 'reorder', fn: reorder, risk: 'low' },
  { name: 'register_formal', fn: (t) => changeRegister(t, true), risk: 'low' },
  { name: 'register_informal', fn: (t) => changeRegister(t, false), risk: 'low' },
  { name: 'ellipsis', fn: ellipsis, risk: 'medium' },
  { name: 'filler', fn: addFiller, risk: 'low' },
  { name: 'typo_dialect', fn: typoAndDialect, risk: 'medium' },
  { name: 'context', fn: addContext, risk: 'medium' },
  { name: 'voice_noise', fn: voiceNoise, risk: 'high' },
]

// ── MAIN: MUTATE TEMPLATE ───────────────────────────────

/**
 * Mutate a single template's text.
 *
 * @param {Object} template - phrase template with .text, .intent, .shouldWrite, etc.
 * @param {'light'|'medium'|'heavy'} level - mutation level
 * @returns {Object} cloned template with mutated text + adjusted truthConfidence
 */
export function mutateTemplate(template, level = 'medium') {
  const clone = { ...template, text: template.text }

  // Select strategies based on level
  let strategyCount, pool
  switch (level) {
    case 'light':
      strategyCount = 1
      pool = STRATEGIES.filter(s => s.risk === 'low')
      clone.truthConfidence = template.truthConfidence || 'high'
      break
    case 'medium':
      strategyCount = 2
      pool = STRATEGIES.filter(s => s.risk !== 'high')
      clone.truthConfidence = 'medium'
      break
    case 'heavy':
    default:
      strategyCount = 2 + Math.floor(Math.random() * 2) // 2-3
      pool = STRATEGIES
      clone.truthConfidence = 'low'
      break
  }

  // Pick random strategies (no duplicates)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, Math.min(strategyCount, shuffled.length))

  // Apply sequentially
  let text = clone.text
  const appliedMutations = []
  for (const strategy of selected) {
    const before = text
    text = strategy.fn(text)
    if (text !== before) {
      appliedMutations.push(strategy.name)
    }
  }

  clone.text = text
  clone._mutations = appliedMutations
  clone._mutationLevel = level

  return clone
}

/**
 * Determine mutation level for a given loop iteration.
 * Progressive: loop 0 = light, loop 1 = medium, loop 2+ = heavy
 */
export function mutationLevelForLoop(loopIndex, mode = 'progressive') {
  if (mode !== 'progressive') return mode
  if (loopIndex === 0) return 'light'
  if (loopIndex === 1) return 'medium'
  return 'heavy'
}

/**
 * Mutate all templates of an agent.
 * Returns new array of mutated templates (originals preserved).
 */
export function mutateAgentTemplates(agent, level = 'medium') {
  return agent.phraseTemplates.map(tpl => mutateTemplate(tpl, level))
}

export { STRATEGIES, NUMBER_WORDS }
