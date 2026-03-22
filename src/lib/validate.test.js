/**
 * Tests for validate.js — all pure validators, no mocking needed.
 */
import { describe, it, expect } from 'vitest'
import {
  isNonEmpty, isValidAmount, isValidQuantity, isValidDate, isValidTime,
  isPositiveInteger, validateExpense, validateEvent, validateTask,
  validateBonusPoints, validateShoppingItem, validateInventoryItem,
} from './validate.js'

// ═══ Primitive Validators ═══

describe('isNonEmpty', () => {
  it('returns false for null/undefined', () => {
    expect(isNonEmpty(null)).toBe(false)
    expect(isNonEmpty(undefined)).toBe(false)
  })
  it('returns false for empty/blank strings', () => {
    expect(isNonEmpty('')).toBe(false)
    expect(isNonEmpty('   ')).toBe(false)
  })
  it('returns true for non-empty strings', () => {
    expect(isNonEmpty('hello')).toBe(true)
    expect(isNonEmpty(' a ')).toBe(true)
  })
  it('returns true for numbers and objects', () => {
    expect(isNonEmpty(0)).toBe(true)
    expect(isNonEmpty(42)).toBe(true)
    expect(isNonEmpty({})).toBe(true)
  })
})

describe('isValidAmount', () => {
  it('rejects null, undefined, empty string', () => {
    expect(isValidAmount(null)).toBe(false)
    expect(isValidAmount(undefined)).toBe(false)
    expect(isValidAmount('')).toBe(false)
  })
  it('accepts positive numbers', () => {
    expect(isValidAmount(10)).toBe(true)
    expect(isValidAmount(0.5)).toBe(true)
  })
  it('rejects zero and negatives', () => {
    expect(isValidAmount(0)).toBe(false)
    expect(isValidAmount(-5)).toBe(false)
  })
  it('handles Italian comma format', () => {
    expect(isValidAmount('12,50')).toBe(true)
    expect(isValidAmount('0,99')).toBe(true)
  })
  it('handles dot format', () => {
    expect(isValidAmount('12.50')).toBe(true)
  })
  it('rejects non-numeric strings', () => {
    expect(isValidAmount('abc')).toBe(false)
    expect(isValidAmount('NaN')).toBe(false)
  })
})

describe('isValidQuantity', () => {
  it('accepts positive numbers and strings', () => {
    expect(isValidQuantity(5)).toBe(true)
    expect(isValidQuantity('3')).toBe(true)
    expect(isValidQuantity(0.5)).toBe(true)
  })
  it('rejects zero, negatives, invalid', () => {
    expect(isValidQuantity(0)).toBe(false)
    expect(isValidQuantity(-1)).toBe(false)
    expect(isValidQuantity(null)).toBe(false)
    expect(isValidQuantity('')).toBe(false)
  })
})

describe('isValidDate', () => {
  it('accepts valid YYYY-MM-DD', () => {
    expect(isValidDate('2026-03-22')).toBe(true)
    expect(isValidDate('2026-01-01')).toBe(true)
    expect(isValidDate('2026-12-31')).toBe(true)
  })
  it('rejects invalid formats', () => {
    expect(isValidDate('22-03-2026')).toBe(false)
    expect(isValidDate('2026/03/22')).toBe(false)
    expect(isValidDate('not-a-date')).toBe(false)
  })
  it('rejects invalid dates (e.g. Feb 31)', () => {
    expect(isValidDate('2026-02-31')).toBe(false)
    expect(isValidDate('2026-13-01')).toBe(false)
  })
  it('rejects non-strings', () => {
    expect(isValidDate(null)).toBe(false)
    expect(isValidDate(undefined)).toBe(false)
    expect(isValidDate(123)).toBe(false)
  })
})

describe('isValidTime', () => {
  it('accepts valid HH:MM', () => {
    expect(isValidTime('00:00')).toBe(true)
    expect(isValidTime('14:30')).toBe(true)
    expect(isValidTime('23:59')).toBe(true)
  })
  it('rejects invalid times', () => {
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('12:60')).toBe(false)
    expect(isValidTime('1:30')).toBe(false)
    expect(isValidTime('abc')).toBe(false)
    expect(isValidTime(null)).toBe(false)
  })
})

describe('isPositiveInteger', () => {
  it('accepts positive integers', () => {
    expect(isPositiveInteger(1)).toBe(true)
    expect(isPositiveInteger(100)).toBe(true)
    expect(isPositiveInteger('5')).toBe(true)
  })
  it('rejects zero, negatives, decimals', () => {
    expect(isPositiveInteger(0)).toBe(false)
    expect(isPositiveInteger(-1)).toBe(false)
    expect(isPositiveInteger(1.5)).toBe(false)
    expect(isPositiveInteger(null)).toBe(false)
    expect(isPositiveInteger('')).toBe(false)
  })
})

// ═══ Form-Level Validators ═══

describe('validateExpense', () => {
  it('returns null for valid expense', () => {
    expect(validateExpense({ amount: 10, category: 'cibo', date: '2026-03-22' })).toBeNull()
  })
  it('returns null when date is omitted', () => {
    expect(validateExpense({ amount: 10, category: 'cibo' })).toBeNull()
  })
  it('rejects invalid amount', () => {
    expect(validateExpense({ amount: 0, category: 'cibo' })).toContain('importo')
  })
  it('rejects empty category', () => {
    expect(validateExpense({ amount: 10, category: '' })).toContain('categoria')
  })
  it('rejects invalid date', () => {
    expect(validateExpense({ amount: 10, category: 'cibo', date: 'bad' })).toContain('data')
  })
  it('rejects recurrence without valid date', () => {
    const result = validateExpense({ amount: 10, category: 'cibo', recurrence: 'weekly' })
    expect(result).toContain('ricorrenza')
  })
})

describe('validateEvent', () => {
  it('returns null for valid event', () => {
    expect(validateEvent({ title: 'Danza', date: '2026-03-25' })).toBeNull()
  })
  it('rejects empty title', () => {
    expect(validateEvent({ title: '', date: '2026-03-25' })).toContain('titolo')
  })
  it('rejects invalid date', () => {
    expect(validateEvent({ title: 'Danza', date: 'bad' })).toContain('data')
  })
  it('rejects invalid time_start', () => {
    expect(validateEvent({ title: 'X', date: '2026-03-25', time_start: '25:00' })).toContain('inizio')
  })
  it('rejects invalid time_end', () => {
    expect(validateEvent({ title: 'X', date: '2026-03-25', time_end: '99:99' })).toContain('fine')
  })
  it('accepts valid times', () => {
    expect(validateEvent({ title: 'X', date: '2026-03-25', time_start: '17:00', time_end: '18:30' })).toBeNull()
  })
})

describe('validateTask', () => {
  it('returns null for valid task', () => {
    expect(validateTask({ title: 'Compiti' })).toBeNull()
  })
  it('rejects empty title', () => {
    expect(validateTask({ title: '' })).toContain('titolo')
  })
  it('rejects invalid due_date', () => {
    expect(validateTask({ title: 'Test', due_date: 'nope' })).toContain('scadenza')
  })
  it('accepts valid due_date', () => {
    expect(validateTask({ title: 'Test', due_date: '2026-04-01' })).toBeNull()
  })
})

describe('validateBonusPoints', () => {
  it('returns null for valid data', () => {
    expect(validateBonusPoints({ memberId: 'm1', points: 5 })).toBeNull()
  })
  it('rejects empty memberId', () => {
    expect(validateBonusPoints({ memberId: '', points: 5 })).toContain('membro')
  })
  it('rejects invalid points', () => {
    expect(validateBonusPoints({ memberId: 'm1', points: 0 })).toContain('punti')
    expect(validateBonusPoints({ memberId: 'm1', points: -1 })).toContain('punti')
  })
})

describe('validateShoppingItem', () => {
  it('returns null for valid item', () => {
    expect(validateShoppingItem({ name: 'Latte' })).toBeNull()
  })
  it('rejects empty name', () => {
    expect(validateShoppingItem({ name: '' })).toContain('nome')
  })
  it('rejects invalid quantity', () => {
    expect(validateShoppingItem({ name: 'Latte', quantity: 0 })).toContain('quantità')
  })
  it('accepts valid quantity', () => {
    expect(validateShoppingItem({ name: 'Latte', quantity: 2 })).toBeNull()
  })
})

describe('validateInventoryItem', () => {
  it('returns null for valid item', () => {
    expect(validateInventoryItem({ name: 'Farina' })).toBeNull()
  })
  it('rejects empty name', () => {
    expect(validateInventoryItem({ name: '' })).toContain('nome')
  })
  it('rejects invalid quantity', () => {
    expect(validateInventoryItem({ name: 'X', quantity: -1 })).toContain('quantità')
  })
  it('rejects invalid expiry_date', () => {
    expect(validateInventoryItem({ name: 'X', expiry_date: 'bad' })).toContain('scadenza')
  })
  it('accepts valid full item', () => {
    expect(validateInventoryItem({ name: 'Farina', quantity: 1, expiry_date: '2026-06-01' })).toBeNull()
  })
})
