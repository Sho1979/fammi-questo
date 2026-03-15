/**
 * canonicalPipeline.test.js — Sprint 1 verification.
 *
 * Verifica che normalizeAndValidateActions converta correttamente
 * le raw actions prodotte da parseLocally in shape canoniche validate.
 *
 * 4 frasi target:
 *   1. "Domani Asia ha danza alle 16"
 *   2. "Domani Asia ha danza, la porta Chiara"
 *   3. "Speso 12,50 per il latte"
 *   4. "Porta Asia a danza e compra il latte"
 */

import { describe, it, expect } from 'vitest'
import { normalizeAndValidateActions } from '../actionNormalizer.js'
import { validateAction } from '../actionValidator.js'
import { ACTION_TYPES, ACTION_SOURCES } from '../actionContract.js'

// ─── Contesto famiglia test ───
const MEMBERS = [
  { id: 'mem_cristian', name: 'Cristian', role: 'genitore' },
  { id: 'mem_chiara', name: 'Chiara', role: 'genitore' },
  { id: 'mem_viola', name: 'Viola', role: 'child' },
  { id: 'mem_asia', name: 'Asia', role: 'child' },
  { id: 'mem_mariangela', name: 'Mariangela', role: 'nonno' },
  { id: 'mem_albino', name: 'Albino', role: 'nonno' },
]

const BASE_CONTEXT = {
  familyId: 'fam_test',
  currentMemberId: 'mem_cristian',
  members: MEMBERS,
  source: 'L0',
  textOriginal: '',
  confidence: 0.88,
  usedAI: false,
}

const TOMORROW = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
const TODAY = new Date().toISOString().slice(0, 10)

// ═══════════════════════════════════════════════════════════════
// HELPER: verifica shape canonica base
// ═══════════════════════════════════════════════════════════════

function assertCanonicalBase(action) {
  expect(ACTION_TYPES).toContain(action.type)
  expect(ACTION_SOURCES).toContain(action.source)
  expect(typeof action.confidence).toBe('number')
  expect(action.confidence).toBeGreaterThanOrEqual(0)
  expect(action.confidence).toBeLessThanOrEqual(1)
  expect(typeof action.familyId).toBe('string')
  expect(typeof action.needsConfirm).toBe('boolean')
  expect(action.incomplete === null || typeof action.incomplete === 'string').toBe(true)
  expect(Array.isArray(action.warnings)).toBe(true)
  expect(action.meta).toBeDefined()
  expect(typeof action.meta.utteranceRef).toBe('string')
  expect(typeof action.meta.actionRef).toBe('string')
  expect(typeof action.meta.pipelinePath).toBe('string')
  expect(typeof action.meta.usedAI).toBe('boolean')

  // Nessun campo legacy
  const FORBIDDEN = ['person', 'persons', 'assignedTo', 'driver', 'accompaniedBy',
    'pickupBy', 'dropBy', 'name', 'time', 'startTime', 'endTime',
    'time_start', 'time_end', 'startDate', 'due_date']
  for (const field of FORBIDDEN) {
    // 'slot' è permesso per meal
    if (field === 'slot' && action.type === 'meal') continue
    expect(action).not.toHaveProperty(field)
  }

  // Valida con il validatore
  const result = validateAction(action)
  expect(result.ok).toBe(true)
  if (result.errors.length > 0) {
    throw new Error(`Validation errors: ${result.errors.join(', ')}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// TEST 1: "Domani Asia ha danza alle 16"
// Parser produce: calendar con assignedTo, time, activity
// ═══════════════════════════════════════════════════════════════

describe('Frase 1: "Domani Asia ha danza alle 16"', () => {
  // Simula raw action da L0b1 o L1+L2 path
  const rawActions = [{
    type: 'calendar',
    title: 'Danza Asia',
    assignedTo: 'Asia',
    date: TOMORROW,
    time: '16:00',
    category: 'sport',
    activity: 'Danza',
  }]

  const ctx = { ...BASE_CONTEXT, textOriginal: 'Domani Asia ha danza alle 16' }

  it('produce esattamente 1 azione canonica calendar', () => {
    const { actions, invalid } = normalizeAndValidateActions(rawActions, ctx)
    expect(actions.length).toBe(1)
    expect(invalid.length).toBe(0)
    expect(actions[0].type).toBe('calendar')
  })

  it('risolve Asia → mem_asia con personIds', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    const cal = actions[0]
    expect(cal.personIds).toContain('mem_asia')
    expect(cal.personNames).toContain('Asia')
  })

  it('mappa time → timeStart, mantiene date', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    const cal = actions[0]
    expect(cal.timeStart).toBe('16:00')
    expect(cal.date).toBe(TOMORROW)
  })

  it('nessun campo legacy, shape canonica completa', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    assertCanonicalBase(actions[0])
  })

  it('logistics è null (nessuna logistica)', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    expect(actions[0].logistics).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// TEST 2: "Domani Asia ha danza, la porta Chiara"
// Parser produce: calendar + task (dual action con logistica)
// ═══════════════════════════════════════════════════════════════

describe('Frase 2: "Domani Asia ha danza, la porta Chiara"', () => {
  // Simula raw actions da L0b1 dual action path
  const rawActions = [
    {
      type: 'calendar',
      title: 'Danza Asia',
      assignedTo: 'Asia',
      date: TOMORROW,
      time: null,
      category: 'sport',
      activity: 'Danza',
      accompaniedBy: 'Chiara',
      needsPickup: true,
    },
    {
      type: 'task',
      title: 'Portare Asia',
      assignedTo: 'Chiara',
      date: TOMORROW,
      time: null,
    },
    {
      type: 'note',
      date: TOMORROW,
      text: 'Chi va a riprendere Asia?',
      isReminder: true,
    },
  ]

  const ctx = { ...BASE_CONTEXT, textOriginal: 'Domani Asia ha danza, la porta Chiara' }

  it('produce 3 azioni canoniche: calendar + task + note', () => {
    const { actions, invalid } = normalizeAndValidateActions(rawActions, ctx)
    expect(actions.length).toBe(3)
    expect(invalid.length).toBe(0)
    expect(actions.map(a => a.type)).toEqual(['calendar', 'task', 'note'])
  })

  it('calendar ha logistics con accompaniedBy=Chiara', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    const cal = actions[0]
    expect(cal.logistics).not.toBeNull()
    expect(cal.logistics.accompaniedById).toBe('mem_chiara')
    expect(cal.logistics.accompaniedByName).toBe('Chiara')
    expect(cal.logistics.actionVerb).toBe('portare')
  })

  it('calendar personIds include Asia', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    const cal = actions[0]
    expect(cal.personIds).toContain('mem_asia')
  })

  it('task ha assignedToId=Chiara e linkedEntity al calendar', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    const task = actions[1]
    expect(task.assignedToId).toBe('mem_chiara')
    expect(task.assignedToName).toBe('Chiara')
    // linkedEntity risolto dal normalizzatore
    expect(task.linkedEntity).not.toBeNull()
    expect(task.linkedEntity.entityType).toBe('calendar')
    expect(task.linkedEntity.tempRef).toBe(actions[0].meta.actionRef)
  })

  it('tutte le azioni passano validazione canonica', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    for (const action of actions) {
      assertCanonicalBase(action)
    }
  })

  it('condividono lo stesso utteranceRef', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    const uRef = actions[0].meta.utteranceRef
    expect(actions[1].meta.utteranceRef).toBe(uRef)
    expect(actions[2].meta.utteranceRef).toBe(uRef)
  })

  it('hanno actionRef sequenziali distinti', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    expect(actions[0].meta.actionRef).toBe('a_0')
    expect(actions[1].meta.actionRef).toBe('a_1')
    expect(actions[2].meta.actionRef).toBe('a_2')
  })
})

// ═══════════════════════════════════════════════════════════════
// TEST 3: "Speso 12,50 per il latte"
// Parser produce: expense con amount e note
// ═══════════════════════════════════════════════════════════════

describe('Frase 3: "Speso 12,50 per il latte"', () => {
  const rawActions = [{
    type: 'expense',
    amount: 12.50,
    category: 'spesa',
    note: 'Speso 12,50 per il latte',
    person: null,
    date: TODAY,
  }]

  const ctx = { ...BASE_CONTEXT, textOriginal: 'Speso 12,50 per il latte' }

  it('produce 1 expense canonica', () => {
    const { actions, invalid } = normalizeAndValidateActions(rawActions, ctx)
    expect(actions.length).toBe(1)
    expect(invalid.length).toBe(0)
    expect(actions[0].type).toBe('expense')
  })

  it('mappa note → title, mantiene amount', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    const exp = actions[0]
    expect(exp.title).toBe('Speso 12,50 per il latte')
    expect(exp.amount).toBe(12.50)
    expect(exp.category).toBe('spesa')
    expect(exp.date).toBe(TODAY)
  })

  it('personId è null (nessuna persona esplicita)', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    expect(actions[0].personId).toBeNull()
    expect(actions[0].personName).toBeNull()
  })

  it('shape canonica valida', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    assertCanonicalBase(actions[0])
  })
})

// ═══════════════════════════════════════════════════════════════
// TEST 4: "Porta Asia a danza e compra il latte"
// Parser produce: multi-azione → calendar + task + shopping
// ═══════════════════════════════════════════════════════════════

describe('Frase 4: "Porta Asia a danza e compra il latte"', () => {
  // Simula raw actions: la prima frase genera logistica, la seconda shopping
  const rawActions = [
    {
      type: 'calendar',
      title: 'Danza Asia',
      assignedTo: 'Asia',
      date: TODAY,
      time: null,
      category: 'sport',
      activity: 'Danza',
      needsDriver: true,
      logistics: { subject: 'Asia', actionVerb: 'portare' },
      incomplete: 'Manca chi accompagna/riprende',
    },
    {
      type: 'shopping',
      name: 'il latte',
      quantity: 1,
      unit: 'pz',
    },
  ]

  const ctx = { ...BASE_CONTEXT, textOriginal: 'Porta Asia a danza e compra il latte' }

  it('produce 2 azioni canoniche: calendar + shopping', () => {
    const { actions, invalid } = normalizeAndValidateActions(rawActions, ctx)
    expect(actions.length).toBe(2)
    expect(invalid.length).toBe(0)
    expect(actions[0].type).toBe('calendar')
    expect(actions[1].type).toBe('shopping')
  })

  it('calendar ha logistics con subject=Asia, needsDriver=true', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    const cal = actions[0]
    expect(cal.logistics).not.toBeNull()
    expect(cal.logistics.subjectId).toBe('mem_asia')
    expect(cal.logistics.subjectName).toBe('Asia')
    expect(cal.logistics.needsDriver).toBe(true)
    expect(cal.logistics.actionVerb).toBe('portare')
  })

  it('shopping mappa name → title', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    const shop = actions[1]
    expect(shop.title).toBe('il latte')
    expect(shop.quantity).toBe(1)
    expect(shop.unit).toBe('pz')
  })

  it('tutte le azioni sono canoniche valide', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    for (const action of actions) {
      assertCanonicalBase(action)
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// TEST: idempotenza — stesse raw actions → stesso output
// ═══════════════════════════════════════════════════════════════

describe('Idempotenza e determinismo', () => {
  const rawActions = [{
    type: 'calendar',
    title: 'Danza Asia',
    assignedTo: 'Asia',
    date: TOMORROW,
    time: '16:00',
    category: 'sport',
  }]

  const ctx = {
    ...BASE_CONTEXT,
    textOriginal: 'Domani Asia ha danza alle 16',
    utteranceRef: 'u_20260312_fixed', // fisso per test deterministico
  }

  it('due run producono JSON identico', () => {
    const result1 = normalizeAndValidateActions(rawActions, ctx)
    const result2 = normalizeAndValidateActions(rawActions, ctx)

    // Rimuovi warnings array che potrebbe avere ordine diverso
    const json1 = JSON.stringify(result1.actions)
    const json2 = JSON.stringify(result2.actions)
    expect(json1).toBe(json2)
  })

  it('frasi equivalenti con shape legacy diverse → stesso canonical', () => {
    // Variante 1: usa "time" (legacy)
    const raw1 = [{
      type: 'calendar', title: 'Danza Asia', assignedTo: 'Asia',
      date: TOMORROW, time: '16:00', category: 'sport',
    }]
    // Variante 2: usa "timeStart" (quasi-canonical)
    const raw2 = [{
      type: 'calendar', title: 'Danza Asia', assignedTo: 'Asia',
      date: TOMORROW, timeStart: '16:00', category: 'sport',
    }]
    // Variante 3: usa "startTime" (altro legacy)
    const raw3 = [{
      type: 'calendar', title: 'Danza Asia', assignedTo: 'Asia',
      date: TOMORROW, startTime: '16:00', category: 'sport',
    }]

    const r1 = normalizeAndValidateActions(raw1, ctx)
    const r2 = normalizeAndValidateActions(raw2, ctx)
    const r3 = normalizeAndValidateActions(raw3, ctx)

    // Tutti devono avere timeStart = '16:00'
    expect(r1.actions[0].timeStart).toBe('16:00')
    expect(r2.actions[0].timeStart).toBe('16:00')
    expect(r3.actions[0].timeStart).toBe('16:00')

    // La shape deve essere uguale
    expect(JSON.stringify(r1.actions)).toBe(JSON.stringify(r2.actions))
    expect(JSON.stringify(r1.actions)).toBe(JSON.stringify(r3.actions))
  })
})

// ═══════════════════════════════════════════════════════════════
// TEST: validatore scarta azioni malformate
// ═══════════════════════════════════════════════════════════════

describe('Validatore: reject shape malformate', () => {
  const ctx = { ...BASE_CONTEXT, textOriginal: 'test' }

  it('scarta calendar senza title', () => {
    const raw = [{ type: 'calendar', date: TODAY }]
    const { actions, invalid } = normalizeAndValidateActions(raw, ctx)
    expect(actions.length).toBe(0)
    expect(invalid.length).toBe(1)
  })

  it('scarta expense con amount=0', () => {
    const raw = [{ type: 'expense', amount: 0, date: TODAY, note: 'test' }]
    const { actions, invalid } = normalizeAndValidateActions(raw, ctx)
    expect(actions.length).toBe(0)
    expect(invalid.length).toBe(1)
  })

  it('scarta tipo sconosciuto convertendolo in note', () => {
    const raw = [{ type: 'foobar', title: 'test' }]
    const { actions } = normalizeAndValidateActions(raw, ctx)
    // Tipo sconosciuto → convertito in note dal normalizzatore
    expect(actions.length).toBe(1)
    expect(actions[0].type).toBe('note')
  })
})
