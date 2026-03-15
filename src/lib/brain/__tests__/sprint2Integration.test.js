/**
 * sprint2Integration.test.js — Sprint 2 verification.
 *
 * Verifica che:
 * 1. L'executor in useBrain.js legge solo campi canonici (no findMember)
 * 2. Il persist orchestrator risolve linkedEntity tempRef → realId
 * 3. Le azioni da conversationMemory passano per il normalizer
 * 4. Le azioni da voice.js (L3 Haiku) passano per il normalizer
 * 5. extractEntitiesFromParse legge campi canonici
 */

import { describe, it, expect } from 'vitest'
import { normalizeAndValidateActions } from '../actionNormalizer.js'

// ─── Contesto famiglia test ───
const MEMBERS = [
  { id: 'mem_cristian', name: 'Cristian', role: 'genitore' },
  { id: 'mem_chiara', name: 'Chiara', role: 'genitore' },
  { id: 'mem_viola', name: 'Viola', role: 'child' },
  { id: 'mem_asia', name: 'Asia', role: 'child' },
]

const TODAY = new Date().toISOString().slice(0, 10)

// ═══════════════════════════════════════════════════════════════
// TEST: executor mapping — canonical → DB record shape
// Simula cosa vede l'executor con azioni canoniche.
// ═══════════════════════════════════════════════════════════════

describe('Executor mapping: canonical → DB record', () => {
  const ctx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    source: 'L0',
    textOriginal: 'test',
    confidence: 0.88,
    usedAI: false,
  }

  it('calendar: personIds[0] → person_id, timeStart → time_start', () => {
    const raw = [{
      type: 'calendar', title: 'Danza Asia', assignedTo: 'Asia',
      date: TODAY, time: '16:00', category: 'sport',
    }]
    const { actions } = normalizeAndValidateActions(raw, ctx)
    const cal = actions[0]

    // Simula executor mapping
    const dbRecord = {
      title: cal.title,
      date: cal.date,
      time_start: cal.timeStart,
      time_end: cal.timeEnd,
      category: cal.category,
      person_id: cal.personIds?.[0] || 'mem_cristian',
    }

    expect(dbRecord.title).toBe('Danza Asia')
    expect(dbRecord.time_start).toBe('16:00')
    expect(dbRecord.person_id).toBe('mem_asia')
    expect(cal).not.toHaveProperty('assignedTo')
    expect(cal).not.toHaveProperty('time')
  })

  it('task: assignedToId → assigned_to, dueDate → due_date', () => {
    const raw = [{
      type: 'task', title: 'Portare Asia', assignedTo: 'Chiara',
      date: TODAY,
    }]
    const { actions } = normalizeAndValidateActions(raw, ctx)
    const task = actions[0]

    const dbRecord = {
      title: task.title,
      assigned_to: task.assignedToId || 'mem_cristian',
      due_date: task.dueDate,
    }

    expect(dbRecord.assigned_to).toBe('mem_chiara')
    expect(dbRecord.due_date).toBe(TODAY)
    expect(task).not.toHaveProperty('assignedTo')
    expect(task).not.toHaveProperty('date')
  })

  it('expense: personId → person_id, title → note', () => {
    const raw = [{
      type: 'expense', amount: 12.50, category: 'spesa',
      note: 'Speso 12,50 per il latte', person: 'Chiara', date: TODAY,
    }]
    const { actions } = normalizeAndValidateActions(raw, ctx)
    const exp = actions[0]

    const dbRecord = {
      amount: exp.amount,
      category: exp.category,
      note: exp.title, // executor maps title → note
      person_id: exp.personId || 'mem_cristian',
      date: exp.date,
    }

    expect(dbRecord.person_id).toBe('mem_chiara')
    expect(dbRecord.note).toBe('Speso 12,50 per il latte')
    expect(exp).not.toHaveProperty('person')
    expect(exp).not.toHaveProperty('note')
  })

  it('meal: slot canonical (dinner) → DB Italian (cena), title → name', () => {
    const raw = [{
      type: 'meal', name: 'Pasta al pomodoro', slot: 'cena', date: TODAY,
    }]
    const { actions } = normalizeAndValidateActions(raw, ctx)
    const meal = actions[0]

    // Executor reverse-maps slot
    const SLOT_TO_DB = { dinner: 'cena', lunch: 'pranzo', breakfast: 'colazione' }
    const dbSlot = SLOT_TO_DB[meal.slot] || meal.slot || 'cena'

    expect(meal.title).toBe('Pasta al pomodoro')
    expect(meal.slot).toBe('dinner') // canonical
    expect(dbSlot).toBe('cena') // DB italiano
    expect(meal).not.toHaveProperty('name')
  })

  it('shopping: title → name in DB', () => {
    const raw = [{
      type: 'shopping', name: 'il latte', quantity: 1, unit: 'pz',
    }]
    const { actions } = normalizeAndValidateActions(raw, ctx)
    const shop = actions[0]

    const dbRecord = {
      name: shop.title, // executor maps title → name
      quantity: shop.quantity,
      unit: shop.unit,
    }

    expect(dbRecord.name).toBe('il latte')
    expect(shop).not.toHaveProperty('name')
  })

  it('reminder: assignedToId → assigned_to, fromPersonName → fromPerson', () => {
    const raw = [{
      type: 'reminder', title: 'Asia non disponibile',
      assignedTo: 'Chiara', date: TODAY,
      needsConfirm: true, fromPerson: 'Asia',
    }]
    const { actions } = normalizeAndValidateActions(raw, ctx)
    const rem = actions[0]

    const dbRecord = {
      title: `🔔 ${rem.title}`,
      assigned_to: rem.assignedToId,
      due_date: rem.date,
      fromPerson: rem.fromPersonName,
    }

    expect(dbRecord.assigned_to).toBe('mem_chiara')
    expect(dbRecord.fromPerson).toBe('Asia')
    expect(rem).not.toHaveProperty('assignedTo')
    expect(rem).not.toHaveProperty('fromPerson')
  })
})

// ═══════════════════════════════════════════════════════════════
// TEST: linked entity resolution (persist orchestrator)
// ═══════════════════════════════════════════════════════════════

describe('Linked entity resolution (persist orchestrator)', () => {
  const ctx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    source: 'L0',
    textOriginal: 'Domani Asia ha danza, la porta Chiara',
    confidence: 0.88,
    utteranceRef: 'u_test_linked',
  }

  const rawActions = [
    {
      type: 'calendar', title: 'Danza Asia', assignedTo: 'Asia',
      date: TODAY, time: null, category: 'sport',
      accompaniedBy: 'Chiara', needsPickup: true,
    },
    {
      type: 'task', title: 'Portare Asia', assignedTo: 'Chiara',
      date: TODAY,
    },
  ]

  it('task ha linkedEntity.tempRef che punta al calendar actionRef', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    const cal = actions.find(a => a.type === 'calendar')
    const task = actions.find(a => a.type === 'task')

    expect(task.linkedEntity).not.toBeNull()
    expect(task.linkedEntity.entityType).toBe('calendar')
    expect(task.linkedEntity.tempRef).toBe(cal.meta.actionRef)
  })

  it('simula persist orchestrator: independent → capture ID → resolve dependent', () => {
    const { actions } = normalizeAndValidateActions(rawActions, ctx)
    const independent = actions.filter(a => !a.linkedEntity)
    const dependent = actions.filter(a => a.linkedEntity)

    // Fase 1: persist independent, cattura ID
    const refToIdMap = new Map()
    for (const action of independent) {
      const fakeDbId = `db_${action.type}_${Math.random().toString(36).slice(2, 8)}`
      refToIdMap.set(action.meta.actionRef, fakeDbId)
    }

    // Fase 2: resolve tempRef → realId
    for (const action of dependent) {
      if (action.linkedEntity?.tempRef) {
        const realId = refToIdMap.get(action.linkedEntity.tempRef)
        if (realId) action.linkedEntity.realId = realId
      }
    }

    expect(dependent.length).toBe(1)
    expect(dependent[0].linkedEntity.realId).toBeDefined()
    expect(dependent[0].linkedEntity.realId).toMatch(/^db_calendar_/)
  })
})

// ═══════════════════════════════════════════════════════════════
// TEST: conversationMemory actions pass through normalizer
// ═══════════════════════════════════════════════════════════════

describe('conversationMemory → normalizer', () => {
  const memCtx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    source: 'memory',
    textOriginal: '',
    confidence: 0.85,
  }

  it('normalizza calendar da draft con campi legacy', () => {
    // Shape legacy prodotta da buildActionsFromDraft
    const rawMemory = [{
      type: 'calendar',
      title: 'Dentista Asia',
      date: TODAY,
      time: '16:00',
      assignedTo: 'Asia',
      location: 'Studio Bianchi',
      fromMemory: true,
      turnCount: 2,
    }]

    const { actions } = normalizeAndValidateActions(rawMemory, memCtx)
    expect(actions.length).toBe(1)
    expect(actions[0].type).toBe('calendar')
    expect(actions[0].personIds).toContain('mem_asia')
    expect(actions[0].timeStart).toBe('16:00')
    expect(actions[0].source).toBe('memory')
    expect(actions[0]).not.toHaveProperty('assignedTo')
    expect(actions[0]).not.toHaveProperty('time')
    expect(actions[0]).not.toHaveProperty('fromMemory')
    expect(actions[0]).not.toHaveProperty('turnCount')
  })

  it('normalizza expense da draft', () => {
    const rawMemory = [{
      type: 'expense',
      amount: 45,
      category: 'spesa',
      note: 'spesa al Conad',
      person: 'Cristian',
      date: TODAY,
      fromMemory: true,
    }]

    const { actions } = normalizeAndValidateActions(rawMemory, memCtx)
    expect(actions.length).toBe(1)
    expect(actions[0].personId).toBe('mem_cristian')
    expect(actions[0].title).toBe('spesa al Conad')
    expect(actions[0]).not.toHaveProperty('person')
    expect(actions[0]).not.toHaveProperty('note')
  })
})

// ═══════════════════════════════════════════════════════════════
// TEST: L3 Haiku actions pass through normalizer
// ═══════════════════════════════════════════════════════════════

describe('voice.js L3 → normalizer', () => {
  const l3Ctx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    source: 'L3',
    textOriginal: 'Domani dentista Asia alle 16',
    confidence: 1.0,
    usedAI: true,
  }

  it('normalizza JSON Haiku con shape legacy', () => {
    // Shape che Claude Haiku produce (legacy)
    const rawHaiku = [{
      type: 'calendar',
      title: 'Dentista Asia',
      assignedTo: 'Asia',
      date: TODAY,
      time: '16:00',
      category: 'medico',
      accompaniedBy: 'Chiara',
      pickupBy: 'Cristian',
    }]

    const { actions } = normalizeAndValidateActions(rawHaiku, l3Ctx)
    expect(actions.length).toBe(1)

    const cal = actions[0]
    expect(cal.source).toBe('L3')
    expect(cal.personIds).toContain('mem_asia')
    expect(cal.timeStart).toBe('16:00')
    expect(cal.logistics).not.toBeNull()
    expect(cal.logistics.accompaniedById).toBe('mem_chiara')
    expect(cal.logistics.pickupById).toBe('mem_cristian')

    // Nessun campo legacy
    expect(cal).not.toHaveProperty('assignedTo')
    expect(cal).not.toHaveProperty('accompaniedBy')
    expect(cal).not.toHaveProperty('pickupBy')
    expect(cal).not.toHaveProperty('time')
  })

  it('normalizza expense Haiku con campi legacy', () => {
    const rawHaiku = [{
      type: 'expense',
      amount: 45,
      category: 'spesa',
      note: 'spesa al Conad',
      person: 'Cristian',
    }]

    const { actions } = normalizeAndValidateActions(rawHaiku, l3Ctx)
    expect(actions[0].personId).toBe('mem_cristian')
    expect(actions[0].title).toBe('spesa al Conad')
    expect(actions[0]).not.toHaveProperty('person')
  })

  it('Haiku con tipo invalido → convertito in note', () => {
    const rawHaiku = [{ type: 'unknown_type', text: 'qualcosa' }]
    const { actions } = normalizeAndValidateActions(rawHaiku, l3Ctx)
    expect(actions.length).toBe(1)
    expect(actions[0].type).toBe('note')
  })
})

// ═══════════════════════════════════════════════════════════════
// TEST: extractEntitiesFromParse compatibility
// ═══════════════════════════════════════════════════════════════

describe('extractEntitiesFromParse: reads canonical fields', () => {
  // Simula la funzione per testabilità
  function extractEntitiesFromParse(parseResult) {
    if (!parseResult) return {}
    if (parseResult.entities) return parseResult.entities
    const entities = {}
    const actions = parseResult.actions || []
    for (const a of actions) {
      if (a.personNames?.length > 0) {
        if (!entities.people) entities.people = []
        entities.people.push(...a.personNames)
      } else if (a.assignedToName) {
        if (!entities.people) entities.people = []
        entities.people.push(a.assignedToName)
      }
      if (a.date) entities.date = a.date
      else if (a.dueDate) entities.date = a.dueDate
      if (a.timeStart) entities.time = a.timeStart
      if (a.amount) entities.amount = a.amount
      if (a.activity) entities.activity = a.activity
      if (a.location) entities.location = a.location
      if (a.logistics) entities.logistics = a.logistics
    }
    return entities
  }

  const ctx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    source: 'L0',
    textOriginal: 'test',
    confidence: 0.88,
  }

  it('estrae people da personNames (calendar canonical)', () => {
    const raw = [{
      type: 'calendar', title: 'Danza Asia', assignedTo: 'Asia',
      date: TODAY, time: '16:00',
    }]
    const { actions } = normalizeAndValidateActions(raw, ctx)
    const entities = extractEntitiesFromParse({ actions })

    expect(entities.people).toContain('Asia')
    expect(entities.date).toBe(TODAY)
    expect(entities.time).toBe('16:00')
  })

  it('estrae people da assignedToName (task canonical)', () => {
    const raw = [{
      type: 'task', title: 'Compra latte', assignedTo: 'Chiara',
      date: TODAY,
    }]
    const { actions } = normalizeAndValidateActions(raw, ctx)
    const entities = extractEntitiesFromParse({ actions })

    expect(entities.people).toContain('Chiara')
    expect(entities.date).toBe(TODAY)
  })

  it('estrae amount da expense canonical', () => {
    const raw = [{
      type: 'expense', amount: 25, note: 'test', date: TODAY,
    }]
    const { actions } = normalizeAndValidateActions(raw, ctx)
    const entities = extractEntitiesFromParse({ actions })

    expect(entities.amount).toBe(25)
    expect(entities.date).toBe(TODAY)
  })
})

// ═══════════════════════════════════════════════════════════════
// TEST: convergenza pipeline — tutti i path producono canonical
// ═══════════════════════════════════════════════════════════════

describe('Convergenza: tutti i path → stessa shape canonica', () => {
  const baseCtx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    textOriginal: 'Domani Asia ha danza alle 16',
    confidence: 0.88,
    utteranceRef: 'u_convergence_test',
  }

  it('L0, L3, memory producono shape identica per stessa azione', () => {
    // Raw action identica, da 3 source diverse
    const rawAction = {
      type: 'calendar', title: 'Danza Asia', assignedTo: 'Asia',
      date: TODAY, time: '16:00', category: 'sport',
    }

    const fromL0 = normalizeAndValidateActions([rawAction], { ...baseCtx, source: 'L0' })
    const fromL3 = normalizeAndValidateActions([rawAction], { ...baseCtx, source: 'L3' })
    const fromMem = normalizeAndValidateActions([rawAction], { ...baseCtx, source: 'memory' })

    // Shape identica eccetto source
    const stripMeta = (a) => {
      const { source, ...rest } = a
      rest.meta = { ...rest.meta }
      return rest
    }

    expect(stripMeta(fromL0.actions[0])).toEqual(stripMeta(fromL3.actions[0]))
    expect(stripMeta(fromL0.actions[0])).toEqual(stripMeta(fromMem.actions[0]))

    // Source è diverso
    expect(fromL0.actions[0].source).toBe('L0')
    expect(fromL3.actions[0].source).toBe('L3')
    expect(fromMem.actions[0].source).toBe('memory')
  })
})
