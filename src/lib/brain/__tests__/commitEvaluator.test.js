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
import { MEMORY_INTENTS } from '../conversationMemory.js'
import { evaluateCommitPolicy, evaluateSingleAction, REASON_CODES } from '../commitEvaluator.js'

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

describe('C2: MEMORY_INTENTS expanded for all types', () => {
  it('should include all action types that can be drafted', () => {
    const requiredIntents = ['calendar', 'absence', 'expense', 'task', 'reminder', 'shopping', 'meal', 'note']
    for (const intent of requiredIntents) {
      expect(MEMORY_INTENTS, `MEMORY_INTENTS missing: ${intent}`).toContain(intent)
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// SKELETON: Constants, Sentinel, Lighter Path
// ═══════════════════════════════════════════════════════════════

const MEMBERS = [
  { id: 'mem_cristian', name: 'Cristian', role: 'genitore', gender: 'M' },
  { id: 'mem_chiara', name: 'Chiara', role: 'genitore', gender: 'F' },
  { id: 'mem_viola', name: 'Viola', role: 'figlio', gender: 'F' },
  { id: 'mem_asia', name: 'Asia', role: 'figlio', gender: 'F' },
]

const BASE_CTX = {
  speakerRole: 'genitore',
  speakerId: 'mem_cristian',
  speakerName: 'Cristian',
  members: MEMBERS,
}

describe('Commit Evaluator — Constants', () => {
  it('should export all documented reason codes', () => {
    expect(REASON_CODES.MINOR_LOGISTICS_UNRESOLVED).toBe('MINOR_LOGISTICS_UNRESOLVED')
    expect(REASON_CODES.NO_TEMPORAL_CONTEXT).toBe('NO_TEMPORAL_CONTEXT')
    expect(REASON_CODES.PARTIAL_TEMPORAL_CONTEXT).toBe('PARTIAL_TEMPORAL_CONTEXT')
    expect(REASON_CODES.SPEAKER_AUTO_ASSIGNED).toBe('SPEAKER_AUTO_ASSIGNED')
    expect(REASON_CODES.AMBIGUOUS_SUBJECT).toBe('AMBIGUOUS_SUBJECT')
    expect(REASON_CODES.EVALUATED_POST_NORMALIZE).toBe('EVALUATED_POST_NORMALIZE')
  })
})

describe('Commit Evaluator — Sentinel marker', () => {
  it('should append EVALUATED_POST_NORMALIZE to every action', () => {
    const action = {
      type: 'task',
      title: 'Comprare latte',
      assignedToId: 'mem_cristian',
      assignedToName: 'Cristian',
      dueDate: null,
      category: null,
      textOriginal: 'devo comprare latte',
      confidence: 0.88,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit).toBeDefined()
    expect(result.commit.reasonCodes).toContain('EVALUATED_POST_NORMALIZE')
  })
})

describe('Commit Evaluator — Rule 13: Reminder (lighter path)', () => {
  it('should evaluate reminder as commit_light', () => {
    const action = {
      type: 'reminder',
      title: 'Ricordami di chiamare il pediatra',
      assignedToId: 'mem_cristian',
      assignedToName: 'Cristian',
      dueDate: null,
      category: 'promemoria',
      textOriginal: 'ricordami di chiamare il pediatra',
      confidence: 0.85,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.writePolicy).toBe('commit_light')
    expect(result.commit.previewType).toBe('task')
    expect(result.commit.canConfirm).toBe(true)
    expect(result.commit.canWrite).toBe(true)
  })
})

describe('Commit Evaluator — Rule 14: Note (lighter path)', () => {
  it('should evaluate note as commit_strong', () => {
    const action = {
      type: 'note',
      title: 'Asia ha avuto febbre ieri',
      text: 'Asia ha avuto febbre ieri',
      textOriginal: 'Asia ha avuto febbre ieri',
      confidence: 0.80,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.writePolicy).toBe('commit_strong')
    expect(result.commit.canConfirm).toBe(true)
  })
})

describe('Commit Evaluator — Rule 15: Edit action (lighter path)', () => {
  it('should evaluate edit_action as commit_strong passthrough', () => {
    const action = {
      type: 'edit_action',
      editType: 'cancel',
      targetType: 'calendar',
      targetRef: 'a_0',
      textOriginal: 'cancella danza domani',
      confidence: 0.90,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.writePolicy).toBe('commit_strong')
  })
})

describe('Commit Evaluator — Absence (lighter path)', () => {
  it('should evaluate absence as commit_strong', () => {
    const action = {
      type: 'absence',
      title: 'Viola assente',
      textOriginal: 'viola non va a scuola domani',
      confidence: 0.85,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.writePolicy).toBe('commit_strong')
  })
})

describe('Commit Evaluator — Batch evaluation', () => {
  it('should evaluate multiple actions independently', () => {
    const actions = [
      {
        type: 'reminder',
        title: 'Reminder 1',
        textOriginal: 'ricordami cosa',
        confidence: 0.85,
        meta: { ...baseMeta, actionRef: 'a_0' },
      },
      {
        type: 'note',
        title: 'Note 1',
        text: 'nota',
        textOriginal: 'nota importante',
        confidence: 0.80,
        meta: { ...baseMeta, actionRef: 'a_1' },
      },
    ]
    const results = evaluateCommitPolicy(actions, BASE_CTX)
    expect(results).toHaveLength(2)
    expect(results[0].commit.level).toBe('light')  // reminder
    expect(results[1].commit.level).toBe('strong')  // note
    expect(results[0].commit.reasonCodes).toContain('EVALUATED_POST_NORMALIZE')
    expect(results[1].commit.reasonCodes).toContain('EVALUATED_POST_NORMALIZE')
  })
})
