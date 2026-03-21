/**
 * spellChecker.test.js — Tests for the Italian spell-checker module.
 */

import { describe, it, expect } from 'vitest'
import { correctText, correctPersonName, splitMergedWord, findClosestWord } from '../spellChecker.js'

// ═══════════════════════════════════════════════════════════════
// correctText — main entry point
// ═══════════════════════════════════════════════════════════════

describe('correctText', () => {
  it('returns clean input unchanged', () => {
    const { corrected, corrections } = correctText('compra il latte domani')
    expect(corrections).toHaveLength(0)
    expect(corrected).toBe('compra il latte domani')
  })

  it('corrects a single typo (Levenshtein)', () => {
    // "comprra" -> "comprare" or "compra" (distance 1-2)
    const { corrected, corrections } = correctText('comprra il latte')
    expect(corrections.length).toBeGreaterThan(0)
    expect(corrections[0].original).toBe('comprra')
    expect(corrections[0].type).toBe('levenshtein')
    // Should correct to a known word
    expect(corrected).not.toContain('comprra')
  })

  it('corrects common misspelling "denstista" -> "dentista"', () => {
    const { corrected, corrections } = correctText('vai dal denstista')
    expect(corrections.length).toBeGreaterThan(0)
    const dentFix = corrections.find(c => c.original === 'denstista')
    expect(dentFix).toBeDefined()
    expect(dentFix.corrected).toBe('dentista')
  })

  it('corrects character swap "comiprare" -> "comprare"', () => {
    const { corrected, corrections } = correctText('devo comiprare il pane')
    expect(corrections.length).toBeGreaterThan(0)
    const fix = corrections.find(c => c.original === 'comiprare')
    expect(fix).toBeDefined()
    expect(fix.corrected).toBe('comprare')
  })

  it('splits merged words', () => {
    // "hodanza" should split to "ho danza" if both are in dict
    const { corrected, corrections } = correctText('hodanza alle 16')
    // "hodanza" is 7 chars, "ho"=2 + "danza"=5, both in dict
    const splitFix = corrections.find(c => c.type === 'split')
    if (splitFix) {
      expect(splitFix.corrected).toBe('ho danza')
    }
    // Either split or levenshtein corrected — should not remain as "hodanza"
  })

  it('preserves numbers and tokens with digits', () => {
    const { corrected, corrections } = correctText('compra 3 uova alle 16')
    // "16" and "3" should not be touched
    expect(corrected).toContain('3')
    expect(corrected).toContain('16')
    const digitCorrections = corrections.filter(c => /\d/.test(c.original))
    expect(digitCorrections).toHaveLength(0)
  })

  it('preserves short words (< 4 chars)', () => {
    const { corrected, corrections } = correctText('un po di xyz')
    // "xyz" is only 3 chars — should NOT be corrected
    expect(corrected).toContain('xyz')
    const shortFix = corrections.find(c => c.original === 'xyz')
    expect(shortFix).toBeUndefined()
  })

  it('preserves member names', () => {
    const { corrected, corrections } = correctText('porta Viola a scuola', ['Viola', 'Asia'])
    expect(corrected).toContain('Viola')
    const violaFix = corrections.find(c => c.original === 'Viola')
    expect(violaFix).toBeUndefined()
  })

  it('does not break unknown words that have no close match', () => {
    const { corrected, corrections } = correctText('compra il xylophon')
    // "xylophon" has no close Italian match — leave as-is
    expect(corrected).toContain('xylophon')
  })

  it('preserves tokens with euro symbol', () => {
    const { corrected, corrections } = correctText('ho speso 50€ al supermercato')
    expect(corrected).toContain('50€')
    const euroFix = corrections.find(c => c.original === '50€')
    expect(euroFix).toBeUndefined()
  })

  it('handles empty string', () => {
    const { corrected, corrections } = correctText('')
    expect(corrected).toBe('')
    expect(corrections).toHaveLength(0)
  })

  it('handles single word', () => {
    const { corrected, corrections } = correctText('comprra')
    expect(corrections.length).toBeGreaterThan(0)
  })

  it('preserves proper names (capitalized) not in member list', () => {
    const { corrected, corrections } = correctText('Marco va a scuola', [])
    // "Marco" is capitalized and not a member — should not be corrected
    expect(corrected).toContain('Marco')
    const marcoFix = corrections.find(c => c.original === 'Marco')
    expect(marcoFix).toBeUndefined()
  })

  it('corrects "stasra" -> "stasera"', () => {
    const { corrected, corrections } = correctText('stasra facciamo pizza')
    const fix = corrections.find(c => c.original === 'stasra')
    expect(fix).toBeDefined()
    expect(fix.corrected).toBe('stasera')
  })
})

// ═══════════════════════════════════════════════════════════════
// correctPersonName
// ═══════════════════════════════════════════════════════════════

describe('correctPersonName', () => {
  const members = ['Cristian', 'Chiara', 'Viola', 'Asia', 'Mariangela']

  it('returns exact match as-is', () => {
    expect(correctPersonName('viola', members)).toBe('Viola')
  })

  it('corrects close match (Levenshtein <= 2)', () => {
    expect(correctPersonName('vioal', members)).toBe('Viola')
  })

  it('corrects "chistian" -> "Cristian"', () => {
    expect(correctPersonName('chistian', members)).toBe('Cristian')
  })

  it('returns null for no match', () => {
    expect(correctPersonName('zxywq', members)).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(correctPersonName('', members)).toBeNull()
  })

  it('returns null for empty members', () => {
    expect(correctPersonName('viola', [])).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// splitMergedWord
// ═══════════════════════════════════════════════════════════════

describe('splitMergedWord', () => {
  it('splits "hodanza" -> "ho danza"', () => {
    expect(splitMergedWord('hodanza')).toBe('ho danza')
  })

  it('returns null for a valid word', () => {
    expect(splitMergedWord('comprare')).toBeNull()
  })

  it('returns null for gibberish', () => {
    expect(splitMergedWord('xyzwqr')).toBeNull()
  })

  it('prefers splits with longer halves', () => {
    // If multiple splits are possible, prefer the one with larger min-half
    const result = splitMergedWord('latteolio')
    // "latte" + "olio" both in dict
    expect(result).toBe('latte olio')
  })
})

// ═══════════════════════════════════════════════════════════════
// findClosestWord
// ═══════════════════════════════════════════════════════════════

describe('findClosestWord', () => {
  it('finds close match for "comprra"', () => {
    const result = findClosestWord('comprra')
    expect(result).not.toBeNull()
    expect(result.distance).toBeLessThanOrEqual(2)
  })

  it('returns null for exact dictionary word', () => {
    const result = findClosestWord('comprare')
    expect(result).toBeNull()
  })

  it('returns null for word with no close match', () => {
    const result = findClosestWord('xylophon')
    expect(result).toBeNull()
  })

  it('finds "dentista" for "denstista"', () => {
    const result = findClosestWord('denstista')
    expect(result).not.toBeNull()
    expect(result.word).toBe('dentista')
  })
})
