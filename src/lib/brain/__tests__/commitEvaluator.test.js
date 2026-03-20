/**
 * commitEvaluator.test.js — Tests for commit safety classification.
 *
 * Organized by chunk:
 *   - Prerequisites (C1, C2)
 *   - Skeleton (lighter path, sentinel)
 *   - Event rules (1-4 + sub-rules)
 *   - Task rules (5-8)
 *   - Other types (9-12)
 *   - Write guard (canWrite)
 *   - Integration
 */

import { describe, it, expect } from 'vitest'
import { validateAction } from '../actionValidator.js'

// ═══════════════════════════════════════════════════════════════
// SHARED TEST HELPERS
// ═══════════════════════════════════════════════════════════════

const baseMeta = {
  utteranceRef: 'u_test_001',
  actionRef: 'a_0',
  pipelinePath: 'l0_calendar',
  usedAI: false,
}

/** Canonical envelope fields required by validateAction */
const canonicalEnvelope = {
  source: 'L0',
  familyId: 'fam_test',
  createdBy: 'mem_cristian',
  needsConfirm: true,
  incomplete: null,
  warnings: [],
  confidence: 0.88,
  textOriginal: '',
  meta: baseMeta,
}

// ═══════════════════════════════════════════════════════════════
// PREREQUISITES
// ═══════════════════════════════════════════════════════════════

describe('C1: Validator date relaxation for calendar', () => {
  it('should allow calendar action WITHOUT date (warning, not error)', () => {
    const action = {
      ...canonicalEnvelope,
      type: 'calendar',
      title: 'Catechismo',
      date: null,
      timeStart: null,
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      location: null,
      activity: 'catechismo',
      category: 'altro',
      isAbsence: false,
      logistics: null,
      textOriginal: 'ho catechismo',
    }
    const result = validateAction(action)
    expect(result.ok).toBe(true)
    expect(result.warnings).toContain('calendar: date missing (will be evaluated by commit policy)')
  })

  it('should still REQUIRE date for expense actions', () => {
    const action = {
      ...canonicalEnvelope,
      type: 'expense',
      title: 'Spesa',
      amount: 45.50,
      date: null,
      category: 'spesa',
      personId: null,
      personName: null,
      textOriginal: 'spesa 45 euro',
      meta: { ...baseMeta, pipelinePath: 'l0_expense' },
    }
    const result = validateAction(action)
    expect(result.ok).toBe(false)
    expect(result.errors.some(e => e.includes('date'))).toBe(true)
  })

  it('should still accept calendar WITH valid date (no date-missing warning)', () => {
    const action = {
      ...canonicalEnvelope,
      type: 'calendar',
      title: 'Danza Viola',
      date: '2026-03-21',
      timeStart: '16:00',
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      location: null,
      activity: 'danza',
      category: 'sport',
      isAbsence: false,
      logistics: null,
      textOriginal: 'domani viola ha danza alle 16',
    }
    const result = validateAction(action)
    expect(result.ok).toBe(true)
    expect(result.warnings).not.toContain('calendar: date missing (will be evaluated by commit policy)')
  })
})
