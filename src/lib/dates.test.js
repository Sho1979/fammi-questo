/**
 * STEP 1.6 — dates: formatDate, formatDateShort, formatWeekday, getMonthRange, getWeekRange, isToday.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatDate,
  formatDateShort,
  formatWeekday,
  getMonthRange,
  getWeekRange,
  isToday,
} from './dates.js'

describe('dates', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('formatDate', () => {
    it('returns "6 marzo 2026" for 2026-03-06', () => {
      expect(formatDate('2026-03-06')).toBe('6 marzo 2026')
    })

    it('returns Italian month names', () => {
      expect(formatDate('2026-01-15')).toBe('15 gennaio 2026')
      expect(formatDate('2026-12-31')).toBe('31 dicembre 2026')
    })

    it('returns empty string for invalid input', () => {
      expect(formatDate('invalid')).toBe('')
    })
  })

  describe('formatDateShort', () => {
    it('returns "6 mar" for 2026-03-06', () => {
      expect(formatDateShort('2026-03-06')).toBe('6 mar')
    })

    it('returns empty string for invalid input', () => {
      expect(formatDateShort('')).toBe('')
    })
  })

  describe('formatWeekday', () => {
    it('returns "Venerdì" for 2026-03-06 (Friday)', () => {
      expect(formatWeekday('2026-03-06')).toBe('Venerdì')
    })

    it('returns Italian weekday names', () => {
      expect(formatWeekday('2026-03-02')).toBe('Lunedì')
      expect(formatWeekday('2026-03-08')).toBe('Domenica')
    })
  })

  describe('getMonthRange', () => {
    it('returns start and end for 2026-03', () => {
      const range = getMonthRange('2026-03')
      expect(range.start).toBe('2026-03-01')
      expect(range.end).toBe('2026-03-31')
    })

    it('returns empty strings for invalid yyyy_mm', () => {
      expect(getMonthRange('invalid')).toEqual({ start: '', end: '' })
      expect(getMonthRange('2026-13')).toEqual({ start: '', end: '' })
    })
  })

  describe('getWeekRange', () => {
    it('returns monday and sunday for a date in the week', () => {
      // 2026-03-06 is Friday
      const range = getWeekRange('2026-03-06')
      expect(range.monday).toBe('2026-03-02')
      expect(range.sunday).toBe('2026-03-08')
    })

    it('accepts Date object', () => {
      const d = new Date('2026-03-06')
      const range = getWeekRange(d)
      expect(range.monday).toBe('2026-03-02')
      expect(range.sunday).toBe('2026-03-08')
    })
  })

  describe('isToday', () => {
    it('returns true when isoString is today', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-07T12:00:00Z'))
      expect(isToday('2026-03-07')).toBe(true)
      expect(isToday('2026-03-07T10:00:00Z')).toBe(true)
    })

    it('returns false for another day', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-07T12:00:00Z'))
      expect(isToday('2026-03-06')).toBe(false)
      expect(isToday('2026-03-08')).toBe(false)
    })

    it('returns false for invalid input', () => {
      expect(isToday('invalid')).toBe(false)
    })
  })
})
