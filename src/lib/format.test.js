/**
 * STEP 1.6 — format: formatCurrency, formatPercent.
 */
import { describe, it, expect } from 'vitest'
import { formatCurrency, formatPercent } from './format.js'

describe('format', () => {
  describe('formatCurrency', () => {
    it('returns "€ 45,50" for 45.5 (it-IT)', () => {
      const result = formatCurrency(45.5)
      expect(result).toMatch(/45[.,]50/)
      expect(result).toContain('€')
    })

    it('formats integer as euros with two decimals', () => {
      const result = formatCurrency(100)
      expect(result).toMatch(/100[.,]00/)
    })

    it('returns fallback for NaN', () => {
      expect(formatCurrency(NaN)).toBe('€ —')
      expect(formatCurrency('not a number')).toBe('€ —')
    })
  })

  describe('formatPercent', () => {
    it('returns "73%" for 0.73', () => {
      expect(formatPercent(0.73)).toBe('73%')
    })

    it('returns "73%" for 73 (already percentage)', () => {
      expect(formatPercent(73)).toBe('73%')
    })

    it('rounds to integer', () => {
      expect(formatPercent(0.735)).toBe('74%')
    })

    it('returns fallback for NaN', () => {
      expect(formatPercent(NaN)).toBe('—%')
    })
  })
})
