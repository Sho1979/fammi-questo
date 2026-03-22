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
  getWeekDays,
  formatDayShort,
  addDays,
  getCalendarGrid,
  formatMonthYear,
  formatTime,
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

  describe('getWeekDays', () => {
    it('returns 7 days starting from Monday', () => {
      const days = getWeekDays('2026-03-25') // Wednesday
      expect(days).toHaveLength(7)
      expect(days[0]).toBe('2026-03-23') // Monday
      expect(days[6]).toBe('2026-03-29') // Sunday
    })
    it('handles Sunday input', () => {
      const days = getWeekDays('2026-03-22') // Sunday
      expect(days[0]).toBe('2026-03-16')
      expect(days[6]).toBe('2026-03-22')
    })
    it('returns empty array for invalid', () => {
      expect(getWeekDays('bad')).toEqual([])
    })
  })

  describe('formatDayShort', () => {
    it('formats as "Lun 23"', () => {
      expect(formatDayShort('2026-03-23T00:00:00')).toBe('Lun 23')
    })
    it('formats Sunday', () => {
      expect(formatDayShort('2026-03-22T00:00:00')).toBe('Dom 22')
    })
    it('returns empty for invalid', () => {
      expect(formatDayShort('nope')).toBe('')
    })
  })

  describe('addDays', () => {
    it('adds positive days', () => {
      expect(addDays('2026-03-22', 3)).toBe('2026-03-25')
    })
    it('subtracts with negative offset', () => {
      expect(addDays('2026-03-22', -5)).toBe('2026-03-17')
    })
    it('crosses month boundary', () => {
      expect(addDays('2026-03-30', 5)).toBe('2026-04-04')
    })
  })

  describe('getCalendarGrid', () => {
    it('returns grid divisible by 7', () => {
      const grid = getCalendarGrid(2026, 2) // March 2026
      expect(grid.length % 7).toBe(0)
    })
    it('marks current month days correctly', () => {
      const grid = getCalendarGrid(2026, 2)
      const marchDays = grid.filter(d => d.isCurrentMonth)
      expect(marchDays).toHaveLength(31)
      expect(marchDays[0].day).toBe(1)
      expect(marchDays[30].day).toBe(31)
    })
    it('includes padding days from adjacent months', () => {
      const grid = getCalendarGrid(2026, 2)
      const padding = grid.filter(d => !d.isCurrentMonth)
      expect(padding.length).toBeGreaterThan(0)
    })
    it('each cell has required properties', () => {
      const grid = getCalendarGrid(2026, 2)
      expect(grid[0]).toHaveProperty('date')
      expect(grid[0]).toHaveProperty('day')
      expect(grid[0]).toHaveProperty('isCurrentMonth')
      expect(grid[0]).toHaveProperty('isToday')
    })
  })

  describe('formatMonthYear', () => {
    it('returns capitalized Italian month + year', () => {
      expect(formatMonthYear(2026, 2)).toBe('Marzo 2026')
      expect(formatMonthYear(2026, 0)).toBe('Gennaio 2026')
      expect(formatMonthYear(2026, 11)).toBe('Dicembre 2026')
    })
  })

  describe('formatTime', () => {
    it('passes through valid time', () => {
      expect(formatTime('14:30')).toBe('14:30')
    })
    it('returns empty for falsy', () => {
      expect(formatTime('')).toBe('')
      expect(formatTime(null)).toBe('')
      expect(formatTime(undefined)).toBe('')
    })
  })
})
