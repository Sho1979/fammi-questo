/**
 * spellChecker.js — Lightweight Italian spell-checker for NLP pre-processing.
 *
 * Strategy:
 * 1. Split input into tokens
 * 2. For each token NOT in dictionary AND length >= 4:
 *    a. Try word-split (merged words like "hodanza" -> "ho danza")
 *    b. Try Levenshtein correction against dictionary (distance <= 2)
 *    c. If no correction found, leave as-is (don't break unknown words)
 * 3. Reconstruct sentence with corrections
 *
 * Performance: dictionary candidates are pre-filtered by length (+-2 chars)
 * to avoid scanning the full ~3500 word set for every token.
 */

import { levenshtein } from './textUtils.js'
import { ITALIAN_DICT } from './italianDict.js'

// Pre-index dictionary by word length for fast candidate lookup
const DICT_BY_LENGTH = new Map()
for (const word of ITALIAN_DICT) {
  const len = word.length
  if (!DICT_BY_LENGTH.has(len)) DICT_BY_LENGTH.set(len, [])
  DICT_BY_LENGTH.get(len).push(word)
}

/**
 * Get dictionary candidates within +-2 chars of a given length.
 * @param {number} len - target word length
 * @returns {string[]} candidate words
 */
function getCandidates(len) {
  const candidates = []
  for (let l = Math.max(1, len - 2); l <= len + 2; l++) {
    const bucket = DICT_BY_LENGTH.get(l)
    if (bucket) candidates.push(...bucket)
  }
  return candidates
}

/**
 * Try to split a token into two known dictionary words.
 * E.g. "hodanza" -> "ho danza", "adormire" -> "a dormire"
 *
 * Both halves must be in the dictionary. Prefers splits where
 * both halves are longer (min 2 chars each).
 *
 * @param {string} token - lowercase token to try splitting
 * @returns {string|null} split result ("word1 word2") or null
 */
export function splitMergedWord(token) {
  let bestSplit = null
  let bestMinLen = 0

  for (let i = 2; i <= token.length - 2; i++) {
    const left = token.slice(0, i)
    const right = token.slice(i)

    if (ITALIAN_DICT.has(left) && ITALIAN_DICT.has(right)) {
      const minLen = Math.min(left.length, right.length)
      if (minLen > bestMinLen) {
        bestMinLen = minLen
        bestSplit = `${left} ${right}`
      }
    }
  }

  return bestSplit
}

/**
 * Find the closest dictionary word via Levenshtein distance (max 2).
 * Prefers distance 1 over 2, and same-length words for ties.
 *
 * @param {string} token - lowercase token to correct
 * @returns {{ word: string, distance: number }|null}
 */
export function findClosestWord(token) {
  const candidates = getCandidates(token.length)
  let bestWord = null
  let bestDist = 3 // threshold + 1

  for (const candidate of candidates) {
    const d = levenshtein(token, candidate)
    if (d === 0) return null // exact match, no correction needed
    if (d < bestDist) {
      bestDist = d
      bestWord = candidate
    } else if (d === bestDist && bestWord) {
      // Prefer same-length words on ties
      const currLenDiff = Math.abs(bestWord.length - token.length)
      const newLenDiff = Math.abs(candidate.length - token.length)
      if (newLenDiff < currLenDiff) {
        bestWord = candidate
      }
    }
    if (bestDist === 1 && Math.abs(bestWord.length - token.length) === 0) {
      break // can't do better than distance 1 + same length
    }
  }

  if (bestDist <= 2) {
    return { word: bestWord, distance: bestDist }
  }
  return null
}

/**
 * Try to match a token against family member names with Levenshtein <= 2.
 *
 * @param {string} token - the token to match (lowercase)
 * @param {string[]} members - array of member names
 * @returns {string|null} corrected name or null
 */
export function correctPersonName(token, members) {
  if (!token || !members || members.length === 0) return null
  const lower = token.toLowerCase()

  for (const name of members) {
    const nameLower = name.toLowerCase()
    if (lower === nameLower) return name // exact match
    if (Math.abs(lower.length - nameLower.length) > 2) continue
    const d = levenshtein(lower, nameLower)
    if (d <= 2) return name
  }
  return null
}

/**
 * Check if a token looks like a proper name (starts with uppercase).
 * @param {string} token - original (not lowercased) token
 * @returns {boolean}
 */
function isProperName(token) {
  return /^[A-ZÀÈÉÌÒÙ]/.test(token)
}

/**
 * Main entry point. Corrects spelling in Italian text.
 *
 * @param {string} text - input text
 * @param {string[]} memberNames - family member names to preserve
 * @returns {{ corrected: string, corrections: Array<{original: string, corrected: string, type: string}> }}
 */
export function correctText(text, memberNames = []) {
  if (!text || typeof text !== 'string') {
    return { corrected: text || '', corrections: [] }
  }

  const corrections = []
  // Split preserving whitespace structure
  const tokens = text.split(/(\s+)/)
  const memberNamesLower = memberNames.map(n => n.toLowerCase())

  const result = tokens.map(token => {
    // Preserve whitespace tokens
    if (/^\s+$/.test(token)) return token

    const lower = token.toLowerCase().replace(/[.,;:!?'"()]+$/g, '').replace(/^[.,;:!?'"()]+/g, '')
    // Extract any trailing/leading punctuation
    const leadMatch = token.match(/^([.,;:!?'"()]+)/)
    const trailMatch = token.match(/([.,;:!?'"()]+)$/)
    const leadPunct = leadMatch ? leadMatch[1] : ''
    const trailPunct = trailMatch ? trailMatch[1] : ''
    const cleanToken = token.slice(leadPunct.length, trailPunct.length ? -trailPunct.length : undefined)
    const cleanLower = cleanToken.toLowerCase()

    // Skip: too short
    if (cleanLower.length < 4) return token

    // Skip: contains digits or euro symbol
    if (/[\d€]/.test(cleanToken)) return token

    // Skip: already in dictionary
    if (ITALIAN_DICT.has(cleanLower)) return token

    // Skip: is a member name (exact or fuzzy)
    if (memberNamesLower.includes(cleanLower)) return token
    const nameMatch = correctPersonName(cleanLower, memberNames)
    if (nameMatch) {
      // If the name is close but not exact, correct it
      if (nameMatch.toLowerCase() !== cleanLower) {
        corrections.push({ original: cleanToken, corrected: nameMatch, type: 'name' })
        return leadPunct + nameMatch + trailPunct
      }
      return token // exact match, skip
    }

    // Skip: looks like a proper name not in our member list
    if (isProperName(cleanToken)) return token

    // 1. Try word split
    const split = splitMergedWord(cleanLower)
    if (split) {
      corrections.push({ original: cleanToken, corrected: split, type: 'split' })
      return leadPunct + split + trailPunct
    }

    // 2. Try Levenshtein correction
    const closest = findClosestWord(cleanLower)
    if (closest) {
      corrections.push({ original: cleanToken, corrected: closest.word, type: 'levenshtein' })
      return leadPunct + closest.word + trailPunct
    }

    // 3. No correction found — leave unchanged
    return token
  })

  return {
    corrected: result.join(''),
    corrections,
  }
}
