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
import { evaluateCommitPolicy, evaluateSingleAction, canWrite, REASON_CODES } from '../commitEvaluator.js'

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

// ═══════════════════════════════════════════════════════════════
// EVENT RULES (1-4 + sub-rules 1a/3a/3b)
// ═══════════════════════════════════════════════════════════════

describe('Commit Evaluator — Event Rules', () => {
  const calendarBase = {
    type: 'calendar',
    personIds: [],
    personNames: [],
    location: null,
    activity: null,
    category: 'altro',
    isAbsence: false,
    logistics: null,
    confidence: 0.88,
    meta: baseMeta,
  }

  // ── Rule 1: Autonomous adult + date + time → strong ──
  it('Rule 1: adult + date + time → commit_strong', () => {
    const action = {
      ...calendarBase,
      title: 'Riunione ufficio',
      date: '2026-03-21',
      timeStart: '09:00',
      timeEnd: null,
      personIds: ['mem_cristian'],
      personNames: ['Cristian'],
      textOriginal: 'domani riunione alle 9',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.writePolicy).toBe('commit_strong')
    expect(result.commit.previewType).toBe('event')
  })

  // ── Rule 1a: Adult + date, no time → light + PARTIAL_TEMPORAL ──
  it('Rule 1a: adult + date, no time → commit_light + PARTIAL_TEMPORAL_CONTEXT', () => {
    const action = {
      ...calendarBase,
      title: 'Riunione ufficio',
      date: '2026-03-21',
      timeStart: null,
      timeEnd: null,
      personIds: ['mem_cristian'],
      personNames: ['Cristian'],
      textOriginal: 'domani riunione',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.writePolicy).toBe('commit_light')
    expect(result.commit.previewType).toBe('event')
    expect(result.commit.reasonCodes).toContain('PARTIAL_TEMPORAL_CONTEXT')
    expect(result.commit.missingFields).toContain('timeStart')
  })

  // ── Rule 2: Minor + date + time + full logistics → strong ──
  it('Rule 2: minor + date + time + full logistics → commit_strong', () => {
    const action = {
      ...calendarBase,
      title: 'Danza Viola',
      date: '2026-03-21',
      timeStart: '17:00',
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      activity: 'danza',
      category: 'sport',
      textOriginal: 'domani viola ha danza alle 17 la porto io e la riprende chiara',
      logistics: {
        subjectId: 'mem_viola',
        subjectName: 'Viola',
        accompaniedById: 'mem_cristian',
        accompaniedByName: 'Cristian',
        pickupById: 'mem_chiara',
        pickupByName: 'Chiara',
        actionVerb: 'portare',
        needsDriver: true,
      },
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.writePolicy).toBe('commit_strong')
    expect(result.commit.previewType).toBe('event')
  })

  // ── Rule 3: Minor + date + time, incomplete logistics → light ──
  it('Rule 3: minor + date + time, no logistics → commit_light + MINOR_LOGISTICS_UNRESOLVED', () => {
    const action = {
      ...calendarBase,
      title: 'Danza Viola',
      date: '2026-03-21',
      timeStart: '17:30',
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      activity: 'danza',
      category: 'sport',
      textOriginal: 'domani viola ha danza alle 17:30',
      logistics: null,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.writePolicy).toBe('commit_light')
    expect(result.commit.reasonCodes).toContain('MINOR_LOGISTICS_UNRESOLVED')
  })

  // ── Rule 3 variant: drop-off but no pickup → MISSING_PICKUP ──
  it('Rule 3 variant: minor + drop-off only → MISSING_PICKUP_PLAN', () => {
    const action = {
      ...calendarBase,
      title: 'Danza Viola',
      date: '2026-03-21',
      timeStart: '17:30',
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      activity: 'danza',
      category: 'sport',
      textOriginal: 'porto viola a danza domani alle 17:30',
      logistics: {
        subjectId: 'mem_viola',
        subjectName: 'Viola',
        accompaniedById: 'mem_cristian',
        accompaniedByName: 'Cristian',
        pickupById: null,
        pickupByName: null,
        actionVerb: 'portare',
        needsDriver: true,
      },
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.reasonCodes).toContain('MINOR_LOGISTICS_UNRESOLVED')
    expect(result.commit.reasonCodes).toContain('MISSING_PICKUP_PLAN')
  })

  // ── Rule 3a: Minor + date, no time, no logistics ──
  it('Rule 3a: minor + date, no time, no logistics → PARTIAL_TEMPORAL + MINOR_LOGISTICS', () => {
    const action = {
      ...calendarBase,
      title: 'Catechismo Viola',
      date: '2026-03-21',
      timeStart: null,
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      activity: 'catechismo',
      textOriginal: 'domani viola ha catechismo',
      logistics: null,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.reasonCodes).toContain('PARTIAL_TEMPORAL_CONTEXT')
    expect(result.commit.reasonCodes).toContain('MINOR_LOGISTICS_UNRESOLVED')
    expect(result.commit.missingFields).toContain('timeStart')
  })

  // ── Rule 3b: Minor + date, no time, WITH full logistics ──
  it('Rule 3b: minor + date, no time, WITH full logistics → PARTIAL_TEMPORAL only', () => {
    const action = {
      ...calendarBase,
      title: 'Catechismo Viola',
      date: '2026-03-21',
      timeStart: null,
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      activity: 'catechismo',
      textOriginal: 'domani viola ha catechismo la porto e la riprendo',
      logistics: {
        subjectId: 'mem_viola',
        subjectName: 'Viola',
        accompaniedById: 'mem_cristian',
        accompaniedByName: 'Cristian',
        pickupById: 'mem_cristian',
        pickupByName: 'Cristian',
        actionVerb: 'portare',
        needsDriver: true,
      },
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.reasonCodes).toContain('PARTIAL_TEMPORAL_CONTEXT')
    expect(result.commit.reasonCodes).not.toContain('MINOR_LOGISTICS_UNRESOLVED')
    expect(result.commit.missingFields).toContain('timeStart')
  })

  // ── Rule 4: No temporal anchor → draft ──
  // "ho catechismo" — the real phrase that started this whole design
  it('Rule 4: "ho catechismo" (no date, no time) → draft_only + NO_TEMPORAL_CONTEXT', () => {
    const action = {
      ...calendarBase,
      title: 'Catechismo',
      date: null,
      timeStart: null,
      timeEnd: null,
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      activity: 'catechismo',
      textOriginal: 'ho catechismo',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('draft')
    expect(result.commit.writePolicy).toBe('draft_only')
    expect(result.commit.previewType).toBe('draft_event')
    expect(result.commit.reasonCodes).toContain('NO_TEMPORAL_CONTEXT')
    expect(result.commit.canConfirm).toBe(true) // draft is still confirmable
  })

  // ── Real phrase: "domani recita alle 17" (adult speaking about event) ──
  it('Real phrase: "domani recita alle 17" → commit_strong (adult, date+time)', () => {
    const action = {
      ...calendarBase,
      title: 'Recita',
      date: '2026-03-21',
      timeStart: '17:00',
      timeEnd: null,
      personIds: ['mem_cristian'],
      personNames: ['Cristian'],
      activity: 'recita',
      textOriginal: 'domani recita alle 17',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
  })
})

// ═══════════════════════════════════════════════════════════════
// TASK RULES (5-8)
// ═══════════════════════════════════════════════════════════════

describe('Commit Evaluator — Task Rules', () => {
  const taskBase = {
    type: 'task',
    dueDate: null,
    category: null,
    linkedEntity: null,
    confidence: 0.88,
    meta: baseMeta,
  }

  // ── Rule 5: Explicit assignee + clear action → strong ──
  it('Rule 5: task with explicit assignee → commit_strong', () => {
    const action = {
      ...taskBase,
      title: 'Portare Viola a danza',
      assignedToId: 'mem_chiara',
      assignedToName: 'Chiara',
      textOriginal: 'Chiara porta Viola a danza',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.previewType).toBe('task')
  })

  // ── Rule 6: 1st person + strong ownership → light + SPEAKER_AUTO_ASSIGNED ──
  it('Rule 6: "devo fare la lavatrice" → commit_light + SPEAKER_AUTO_ASSIGNED', () => {
    const action = {
      ...taskBase,
      title: 'Fare la lavatrice',
      assignedToId: 'mem_cristian',
      assignedToName: 'Cristian',
      textOriginal: 'devo fare la lavatrice',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.previewType).toBe('task')
    expect(result.commit.reasonCodes).toContain('SPEAKER_AUTO_ASSIGNED')
  })

  // ── Rule 7: Personal need → self_reminder ──
  it('Rule 7: "devo comprare i libri" → commit_light + self_reminder', () => {
    const action = {
      ...taskBase,
      title: 'Comprare libri',
      assignedToId: 'mem_cristian',
      assignedToName: 'Cristian',
      textOriginal: 'devo comprare i libri',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.previewType).toBe('self_reminder')
    expect(result.commit.reasonCodes).toContain('SELF_INTENT_NO_EXTERNAL')
  })

  // ── Rule 8: Impersonal, no context → block ──
  it('Rule 8: "prenota dentista" (bare imperative, no assignee) → block', () => {
    const action = {
      ...taskBase,
      title: 'Prenota dentista',
      assignedToId: null,
      assignedToName: null,
      textOriginal: 'prenota dentista',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('none')
    expect(result.commit.writePolicy).toBe('block')
    expect(result.commit.previewType).toBe('unresolved')
    expect(result.commit.reasonCodes).toContain('AMBIGUOUS_SUBJECT')
    expect(result.commit.canConfirm).toBe(false)
  })

  // ── Rule 6 edge: "mi tocca pagare la bolletta" → SPEAKER_AUTO_ASSIGNED ──
  it('Rule 6 edge: "mi tocca pagare la bolletta" → SPEAKER_AUTO_ASSIGNED', () => {
    const action = {
      ...taskBase,
      title: 'Pagare la bolletta',
      assignedToId: 'mem_cristian',
      assignedToName: 'Cristian',
      textOriginal: 'mi tocca pagare la bolletta',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.reasonCodes).toContain('SPEAKER_AUTO_ASSIGNED')
  })

  // ── Rule 7 edge: "devo prendere le medicine" → self_reminder ──
  it('Rule 7 edge: "devo prendere le medicine" → self_reminder', () => {
    const action = {
      ...taskBase,
      title: 'Prendere le medicine',
      assignedToId: 'mem_cristian',
      assignedToName: 'Cristian',
      textOriginal: 'devo prendere le medicine',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.previewType).toBe('self_reminder')
  })

  // ── Rule 8 edge: "chiamare pediatra" → block ──
  it('Rule 8 edge: "chiamare pediatra" (3rd person, no assignee) → block', () => {
    const action = {
      ...taskBase,
      title: 'Chiamare pediatra',
      assignedToId: null,
      assignedToName: null,
      textOriginal: 'chiamare pediatra',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('none')
    expect(result.commit.writePolicy).toBe('block')
  })

  // ── Rule 6 negative: bare infinitive should NOT auto-assign ──
  it('Rule 6 negative: "comprare libri per Viola" (bare infinitive, no assignee) → block', () => {
    const action = {
      ...taskBase,
      title: 'Comprare libri per Viola',
      assignedToId: null,
      assignedToName: null,
      textOriginal: 'comprare libri per Viola',
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('none')
    expect(result.commit.writePolicy).toBe('block')
  })
})

// ═══════════════════════════════════════════════════════════════
// OTHER TYPES (Rules 9-12)
// ═══════════════════════════════════════════════════════════════

describe('Commit Evaluator — Other Types (Rules 9-12)', () => {
  // ── Rule 9: Expense with amount > 0 → strong ──
  it('Rule 9: expense with amount → commit_strong', () => {
    const action = {
      type: 'expense',
      title: 'Spesa Conad',
      amount: 45.50,
      date: '2026-03-20',
      category: 'spesa',
      personIds: [],
      personNames: [],
      textOriginal: 'spesa conad 45 euro',
      confidence: 0.90,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.previewType).toBe('expense')
  })

  it('Rule 9 edge: expense with amount 0 → light + EXPENSE_MISSING_AMOUNT', () => {
    const action = {
      type: 'expense',
      title: 'Spesa',
      amount: 0,
      date: '2026-03-20',
      category: 'spesa',
      personIds: [],
      personNames: [],
      textOriginal: 'spesa conad',
      confidence: 0.85,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.reasonCodes).toContain('EXPENSE_MISSING_AMOUNT')
  })

  // ── Rule 10: Meal with dish → strong ──
  it('Rule 10: meal with dish → commit_strong', () => {
    const action = {
      type: 'meal',
      title: 'Pasta al pomodoro',
      date: '2026-03-20',
      slot: 'cena',
      personIds: [],
      personNames: [],
      textOriginal: 'stasera pasta al pomodoro',
      confidence: 0.88,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.previewType).toBe('meal')
  })

  // ── Rule 11: Shopping → strong ──
  it('Rule 11: shopping grocery items → commit_strong', () => {
    const action = {
      type: 'shopping',
      title: 'Pannolini e latte',
      personIds: [],
      personNames: [],
      textOriginal: 'servono pannolini e latte',
      confidence: 0.88,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('strong')
    expect(result.commit.previewType).toBe('shopping')
  })

  // ── Rule 12: Child material need → self_reminder ──
  it('Rule 12: child "mi servono le scarpe da danza" → self_reminder', () => {
    const action = {
      type: 'shopping',
      title: 'Scarpe da danza',
      personIds: ['mem_viola'],
      personNames: ['Viola'],
      textOriginal: 'mi servono le scarpe da danza',
      confidence: 0.85,
      meta: baseMeta,
    }
    const childCtx = {
      ...BASE_CTX,
      speakerRole: 'figlio',
      speakerId: 'mem_viola',
      speakerName: 'Viola',
    }
    const result = evaluateSingleAction({ ...action }, childCtx)
    expect(result.commit.level).toBe('light')
    expect(result.commit.previewType).toBe('self_reminder')
    expect(result.commit.reasonCodes).toContain('SELF_INTENT_NO_EXTERNAL')
  })

  // ── Unknown type → default ──
  it('Unknown type → commit_light + UNKNOWN_TYPE_DEFAULTED', () => {
    const action = {
      type: 'future_type',
      title: 'Something',
      textOriginal: 'qualcosa di nuovo',
      confidence: 0.80,
      meta: baseMeta,
    }
    const result = evaluateSingleAction({ ...action }, BASE_CTX)
    expect(result.commit.level).toBe('light')
    expect(result.commit.reasonCodes).toContain('UNKNOWN_TYPE_DEFAULTED')
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

// ═══════════════════════════════════════════════════════════════
// WRITE GUARD (canWrite)
// ═══════════════════════════════════════════════════════════════

describe('Commit Evaluator — Write Guard (canWrite)', () => {
  it('should route commit_strong → target: strong', () => {
    const action = {
      type: 'calendar',
      date: '2026-03-21',
      timeStart: '09:00',
      commit: { level: 'strong', writePolicy: 'commit_strong', canWrite: true },
    }
    const result = canWrite(action)
    expect(result.target).toBe('strong')
    expect(result.reasons).toEqual([])
  })

  it('should route commit_light → target: light', () => {
    const action = {
      type: 'calendar',
      date: '2026-03-21',
      timeStart: null,
      commit: { level: 'light', writePolicy: 'commit_light', canWrite: true },
    }
    const result = canWrite(action)
    expect(result.target).toBe('light')
    expect(result.reasons).toEqual([])
  })

  it('should route draft_only → target: draft', () => {
    const action = {
      type: 'calendar',
      date: null,
      commit: { level: 'draft', writePolicy: 'draft_only', canWrite: false },
    }
    const result = canWrite(action)
    expect(result.target).toBe('draft')
    expect(result.reasons).toEqual([])
  })

  it('should route block → target: block', () => {
    const action = {
      type: 'task',
      commit: { level: 'none', writePolicy: 'block', canWrite: false },
    }
    const result = canWrite(action)
    expect(result.target).toBe('block')
  })

  it('should degrade commit_strong to draft if calendar has no date', () => {
    const action = {
      type: 'calendar',
      date: null,
      timeStart: '09:00',
      commit: { level: 'strong', writePolicy: 'commit_strong', canWrite: true },
    }
    const result = canWrite(action)
    expect(result.target).toBe('draft')
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('should degrade commit_strong to draft if expense has amount 0', () => {
    const action = {
      type: 'expense',
      amount: 0,
      commit: { level: 'strong', writePolicy: 'commit_strong', canWrite: true },
    }
    const result = canWrite(action)
    expect(result.target).toBe('draft')
    expect(result.reasons).toContain('expense: amount must be > 0')
  })

  it('should handle action without commit (no evaluator ran) → block', () => {
    const action = { type: 'task', title: 'Something' }
    const result = canWrite(action)
    expect(result.target).toBe('block')
    expect(result.reasons).toContain('no commit evaluation found')
  })
})
