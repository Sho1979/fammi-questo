/**
 * goldenE2E.test.js — Sprint 3: Golden End-to-End tests.
 *
 * 7 scenari reali che tracciano il percorso completo:
 *   raw input → normalizer → validator → executor mapping → DB shape
 *
 * Ogni scenario verifica:
 *   - Normalizzazione completa (legacy → canonical)
 *   - Validazione (0 errori)
 *   - Assenza campi legacy (forbidden fields)
 *   - Executor mapping corretto (canonical → DB)
 *   - Linked entity resolution (dove applicabile)
 *   - Shape identica indipendentemente dal source
 *
 * Famiglia test:
 *   Cristian (genitore), Chiara (genitore, alias: mamma),
 *   Viola (child), Asia (child),
 *   Mariangela (nonno, alias: nonna), Albino (nonno)
 */

import { describe, it, expect } from 'vitest'
import { normalizeAndValidateActions } from '../actionNormalizer.js'
import { validateAction } from '../actionValidator.js'

// ─── Famiglia test completa ───
const MEMBERS = [
  { id: 'mem_cristian', name: 'Cristian', role: 'genitore', aliases: ['papà', 'papa'], gender: 'M' },
  { id: 'mem_chiara', name: 'Chiara', role: 'genitore', aliases: ['mamma'], gender: 'F' },
  { id: 'mem_viola', name: 'Viola', role: 'child', aliases: [], gender: 'F' },
  { id: 'mem_asia', name: 'Asia', role: 'child', aliases: [], gender: 'F' },
  { id: 'mem_mariangela', name: 'Mariangela', role: 'nonno', aliases: ['nonna'], gender: 'F' },
  { id: 'mem_albino', name: 'Albino', role: 'nonno', aliases: ['nonno'], gender: 'M' },
]

const TODAY = new Date().toISOString().slice(0, 10)
const TOMORROW = (() => {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
})()

// ─── Executor helpers (replicano useBrain.js) ───
const SLOT_TO_DB = { dinner: 'cena', lunch: 'pranzo', breakfast: 'colazione' }

function simulateExecutor(action, currentMemberId = 'mem_cristian') {
  switch (action.type) {
    case 'calendar': {
      const logistics = []
      if (action.logistics?.accompaniedById) {
        logistics.push({ role: 'porta', member_id: action.logistics.accompaniedById })
      }
      if (action.logistics?.pickupById) {
        logistics.push({ role: 'riprende', member_id: action.logistics.pickupById })
      }
      const needsPickup = action.logistics
        ? (action.logistics.actionVerb === 'portare' && !action.logistics.pickupById)
        : false
      return {
        title: action.title || 'Evento',
        date: action.date || TODAY,
        time_start: action.timeStart || null,
        time_end: action.timeEnd || null,
        category: action.category || 'altro',
        person_id: action.personIds?.[0] || currentMemberId,
        logistics,
        incomplete: action.incomplete || null,
        needsPickup,
        isAbsence: action.isAbsence || false,
      }
    }
    case 'task': {
      const isSelfAssigned = !action.assignedToId || action.assignedToId === currentMemberId
      const taskData = {
        title: action.title || 'Task',
        assigned_to: action.assignedToId || currentMemberId,
        due_date: action.dueDate || TODAY,
        status: 'todo',
        priority: 'media',
        category: action.category || 'altro',
        points: 5,
        accepted: isSelfAssigned,
        created_by: currentMemberId,
      }
      if (action.linkedEntity?.realId) {
        taskData.linked_event_id = action.linkedEntity.realId
      }
      return taskData
    }
    case 'expense':
      return {
        amount: action.amount || 0,
        category: action.category || 'altro',
        note: action.title || '',
        person_id: action.personId || currentMemberId,
        date: action.date || TODAY,
      }
    case 'meal': {
      const dbSlot = SLOT_TO_DB[action.slot] || action.slot || 'cena'
      return {
        date: action.date || TODAY,
        slot: dbSlot,
        name: action.title || 'Piatto',
        note: '',
      }
    }
    case 'shopping':
      return {
        name: action.title || 'Articolo',
        quantity: action.quantity || 1,
        unit: action.unit || 'pz',
        category: action.category || 'altro',
      }
    case 'reminder':
      return {
        title: `🔔 ${action.title}`,
        assigned_to: action.assignedToId || null,
        due_date: action.date || TODAY,
        status: 'todo',
        category: 'promemoria',
        accepted: false,
        needsConfirm: action.needsConfirm || false,
        fromPerson: action.fromPersonName || null,
      }
    default:
      return null
  }
}

/** Simula il persist orchestrator di useBrain.confirmActions */
function simulatePersistOrchestrator(actions) {
  const refToIdMap = new Map()
  const log = []
  let dbIdCounter = 0

  // Fase 1: independent
  const independent = actions.filter(a => !a.linkedEntity)
  const dependent = actions.filter(a => a.linkedEntity)

  for (const action of independent) {
    const dbRecord = simulateExecutor(action)
    const fakeId = `db_${action.type}_${++dbIdCounter}`
    dbRecord._id = fakeId
    if (action.meta?.actionRef) {
      refToIdMap.set(action.meta.actionRef, fakeId)
    }
    log.push({ ok: true, type: action.type, id: fakeId, record: dbRecord })
  }

  // Fase 2: dependent — resolve tempRef → realId
  for (const action of dependent) {
    if (action.linkedEntity?.tempRef) {
      const realId = refToIdMap.get(action.linkedEntity.tempRef)
      if (realId) action.linkedEntity.realId = realId
    }
    const dbRecord = simulateExecutor(action)
    const fakeId = `db_${action.type}_${++dbIdCounter}`
    dbRecord._id = fakeId
    log.push({ ok: true, type: action.type, id: fakeId, record: dbRecord })
  }

  return { log, refToIdMap }
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 1: Logistica completa
// "Domani Chiara porta Asia a danza alle 16, Cristian la riprende alle 18"
// ═══════════════════════════════════════════════════════════════

describe('Golden E2E #1: Logistica completa (porta + riprende)', () => {
  const rawActions = [
    {
      type: 'calendar',
      title: 'Danza Asia',
      assignedTo: 'Asia',
      date: TOMORROW,
      time: '16:00',
      category: 'sport',
      accompaniedBy: 'Chiara',
      pickupBy: 'Cristian',
    },
    {
      type: 'task',
      title: 'Portare Asia a danza',
      assignedTo: 'Chiara',
      date: TOMORROW,
    },
    {
      type: 'task',
      title: 'Riprendere Asia da danza',
      assignedTo: 'Cristian',
      date: TOMORROW,
    },
  ]

  const ctx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    source: 'L0',
    textOriginal: 'Domani Chiara porta Asia a danza alle 16, Cristian la riprende alle 18',
    confidence: 0.92,
  }

  let canonical
  let persistResult

  it('normalizza 3 azioni senza errori', () => {
    const result = normalizeAndValidateActions(rawActions, ctx)
    canonical = result.actions
    expect(result.invalid).toHaveLength(0)
    expect(canonical).toHaveLength(3)
  })

  it('calendar: persona = Asia, timeStart = 16:00, logistica completa', () => {
    const cal = canonical.find(a => a.type === 'calendar')
    expect(cal.personIds).toContain('mem_asia')
    expect(cal.personNames).toContain('Asia')
    expect(cal.timeStart).toBe('16:00')
    expect(cal.date).toBe(TOMORROW)
    expect(cal.logistics).not.toBeNull()
    expect(cal.logistics.accompaniedById).toBe('mem_chiara')
    expect(cal.logistics.pickupById).toBe('mem_cristian')
    expect(cal.logistics.actionVerb).toBe('portare')
  })

  it('task "Portare": assegnato a Chiara, linked al calendar', () => {
    const taskPortare = canonical.find(a => a.type === 'task' && a.title.toLowerCase().includes('portare'))
    expect(taskPortare.assignedToId).toBe('mem_chiara')
    expect(taskPortare.assignedToName).toBe('Chiara')
    expect(taskPortare.dueDate).toBe(TOMORROW)
    expect(taskPortare.linkedEntity).not.toBeNull()
    expect(taskPortare.linkedEntity.entityType).toBe('calendar')
  })

  it('task "Riprendere": assegnato a Cristian, linked al calendar', () => {
    const taskRiprendere = canonical.find(a => a.type === 'task' && a.title.toLowerCase().includes('riprendere'))
    expect(taskRiprendere.assignedToId).toBe('mem_cristian')
    expect(taskRiprendere.assignedToName).toBe('Cristian')
    expect(taskRiprendere.linkedEntity).not.toBeNull()
    expect(taskRiprendere.linkedEntity.entityType).toBe('calendar')
  })

  it('nessun campo legacy in nessuna azione', () => {
    const FORBIDDEN = ['assignedTo', 'person', 'time', 'name', 'accompaniedBy', 'pickupBy']
    for (const action of canonical) {
      for (const field of FORBIDDEN) {
        expect(action).not.toHaveProperty(field)
      }
    }
  })

  it('tutte le azioni passano validazione individuale', () => {
    for (const action of canonical) {
      const v = validateAction(action)
      expect(v.ok).toBe(true)
      expect(v.errors).toHaveLength(0)
    }
  })

  it('executor produce DB records corretti', () => {
    persistResult = simulatePersistOrchestrator(canonical)
    expect(persistResult.log).toHaveLength(3)
    expect(persistResult.log.every(l => l.ok)).toBe(true)

    const calRecord = persistResult.log.find(l => l.type === 'calendar')?.record
    expect(calRecord.person_id).toBe('mem_asia')
    expect(calRecord.time_start).toBe('16:00')
    expect(calRecord.logistics).toHaveLength(2)
    expect(calRecord.logistics[0]).toEqual({ role: 'porta', member_id: 'mem_chiara' })
    expect(calRecord.logistics[1]).toEqual({ role: 'riprende', member_id: 'mem_cristian' })
  })

  it('linked entity tempRef → realId risolto nel persist', () => {
    const tasks = canonical.filter(a => a.type === 'task')
    for (const task of tasks) {
      expect(task.linkedEntity.realId).toBeDefined()
      expect(task.linkedEntity.realId).toMatch(/^db_calendar_/)
    }

    const taskRecords = persistResult.log.filter(l => l.type === 'task')
    for (const tr of taskRecords) {
      expect(tr.record.linked_event_id).toBeDefined()
      expect(tr.record.linked_event_id).toMatch(/^db_calendar_/)
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// SCENARIO 2: Logistica con figlia + linked entity
// "Porta Viola a nuoto, la accompagna la nonna"
// ═══════════════════════════════════════════════════════════════

describe('Golden E2E #2: Logistica figlia + alias nonna', () => {
  const rawActions = [
    {
      type: 'calendar',
      title: 'Nuoto Viola',
      assignedTo: 'Viola',
      date: TOMORROW,
      time: '17:30',
      category: 'sport',
      accompaniedBy: 'nonna', // alias!
    },
    {
      type: 'task',
      title: 'Accompagnare Viola a nuoto',
      assignedTo: 'nonna', // alias!
      date: TOMORROW,
    },
  ]

  const ctx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    source: 'L0',
    textOriginal: 'Porta Viola a nuoto, la accompagna la nonna',
    confidence: 0.88,
  }

  let canonical

  it('normalizza con risoluzione alias nonna → Mariangela', () => {
    const result = normalizeAndValidateActions(rawActions, ctx)
    canonical = result.actions
    expect(result.invalid).toHaveLength(0)
    expect(canonical).toHaveLength(2)
  })

  it('calendar: logistics.accompaniedById = Mariangela', () => {
    const cal = canonical.find(a => a.type === 'calendar')
    expect(cal.personIds).toContain('mem_viola')
    expect(cal.logistics.accompaniedById).toBe('mem_mariangela')
    expect(cal.logistics.accompaniedByName).toBe('Mariangela')
    expect(cal.logistics.actionVerb).toBe('portare')
  })

  it('task: assegnato a Mariangela (da alias nonna)', () => {
    const task = canonical.find(a => a.type === 'task')
    expect(task.assignedToId).toBe('mem_mariangela')
    expect(task.assignedToName).toBe('Mariangela')
  })

  it('linked entity: task → calendar', () => {
    const cal = canonical.find(a => a.type === 'calendar')
    const task = canonical.find(a => a.type === 'task')
    expect(task.linkedEntity).not.toBeNull()
    expect(task.linkedEntity.tempRef).toBe(cal.meta.actionRef)
  })

  it('executor DB: linked_event_id risolto', () => {
    const { log } = simulatePersistOrchestrator(canonical)
    const taskRecord = log.find(l => l.type === 'task')?.record
    expect(taskRecord.linked_event_id).toBeDefined()
    expect(taskRecord.assigned_to).toBe('mem_mariangela')
  })
})

// ═══════════════════════════════════════════════════════════════
// SCENARIO 3: Multi-intent nella stessa utterance
// "Porta Asia a danza e compra il latte"
// ═══════════════════════════════════════════════════════════════

describe('Golden E2E #3: Multi-intent (calendar + shopping)', () => {
  const rawActions = [
    {
      type: 'calendar',
      title: 'Danza Asia',
      assignedTo: 'Asia',
      date: TOMORROW,
      time: '16:00',
      category: 'sport',
      accompaniedBy: 'Cristian',
    },
    {
      type: 'shopping',
      name: 'latte',
      quantity: 1,
      unit: 'pz',
    },
  ]

  const ctx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    source: 'L0',
    textOriginal: 'Porta Asia a danza e compra il latte',
    confidence: 0.85,
  }

  let canonical

  it('normalizza 2 azioni di tipo diverso senza errori', () => {
    const result = normalizeAndValidateActions(rawActions, ctx)
    canonical = result.actions
    expect(result.invalid).toHaveLength(0)
    expect(canonical).toHaveLength(2)
  })

  it('condividono stesso utteranceRef', () => {
    expect(canonical[0].meta.utteranceRef).toBe(canonical[1].meta.utteranceRef)
  })

  it('hanno actionRef sequenziali', () => {
    expect(canonical[0].meta.actionRef).toBe('a_0')
    expect(canonical[1].meta.actionRef).toBe('a_1')
  })

  it('calendar canonical', () => {
    const cal = canonical.find(a => a.type === 'calendar')
    expect(cal.personIds).toContain('mem_asia')
    expect(cal.timeStart).toBe('16:00')
    expect(cal.logistics).not.toBeNull()
    expect(cal.logistics.accompaniedById).toBe('mem_cristian')
  })

  it('shopping canonical: name → title', () => {
    const shop = canonical.find(a => a.type === 'shopping')
    expect(shop.title).toBe('latte')
    expect(shop.quantity).toBe(1)
    expect(shop).not.toHaveProperty('name')
  })

  it('executor produce 2 record DB indipendenti', () => {
    const { log } = simulatePersistOrchestrator(canonical)
    expect(log).toHaveLength(2)
    expect(log[0].type).toBe('calendar')
    expect(log[1].type).toBe('shopping')
    expect(log[0].record.person_id).toBe('mem_asia')
    expect(log[1].record.name).toBe('latte')
  })
})

// ═══════════════════════════════════════════════════════════════
// SCENARIO 4: Memory multi-turno (draft → merge → commit)
// Simula: turno1 = "Dentista Asia domani", turno2 = "alle 15"
// ═══════════════════════════════════════════════════════════════

describe('Golden E2E #4: Memory multi-turno (simulated)', () => {
  const memCtx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    source: 'memory',
    textOriginal: '',
    confidence: 0.85,
  }

  it('turno 1: calendar incompleto (senza orario)', () => {
    const rawTurn1 = [{
      type: 'calendar',
      title: 'Dentista Asia',
      assignedTo: 'Asia',
      date: TOMORROW,
      // nessun time!
      category: 'medico',
    }]

    const { actions, invalid } = normalizeAndValidateActions(rawTurn1, memCtx)
    expect(invalid).toHaveLength(0)
    expect(actions).toHaveLength(1)
    expect(actions[0].incomplete).toBe("Manca l'orario")
    expect(actions[0].timeStart).toBeNull()
  })

  it('turno 2: merge con orario → azione completa', () => {
    // Simula il draft dopo merge: entità combinate da 2 turni
    const rawMerged = [{
      type: 'calendar',
      title: 'Dentista Asia',
      assignedTo: 'Asia',
      date: TOMORROW,
      time: '15:00', // aggiunto dal turno 2
      category: 'medico',
      location: 'Studio Bianchi',
    }]

    const { actions, invalid } = normalizeAndValidateActions(rawMerged, memCtx)
    expect(invalid).toHaveLength(0)
    expect(actions).toHaveLength(1)

    const cal = actions[0]
    expect(cal.timeStart).toBe('15:00')
    expect(cal.incomplete).toBeNull()
    expect(cal.personIds).toContain('mem_asia')
    expect(cal.location).toBe('Studio Bianchi')
    expect(cal.source).toBe('memory')
  })

  it('executor DB: record completo dopo merge', () => {
    const rawMerged = [{
      type: 'calendar', title: 'Dentista Asia', assignedTo: 'Asia',
      date: TOMORROW, time: '15:00', category: 'medico', location: 'Studio Bianchi',
    }]
    const { actions } = normalizeAndValidateActions(rawMerged, memCtx)
    const db = simulateExecutor(actions[0])

    expect(db.title).toBe('Dentista Asia')
    expect(db.person_id).toBe('mem_asia')
    expect(db.time_start).toBe('15:00')
    expect(db.category).toBe('medico')
    expect(db.incomplete).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// SCENARIO 5: L3 ambiguity — Claude Haiku restituisce shape legacy
// Input ambiguo, L3 interpreta e restituisce JSON legacy
// ═══════════════════════════════════════════════════════════════

describe('Golden E2E #5: L3 ambiguity + normalizzazione', () => {
  const l3Ctx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    source: 'L3',
    textOriginal: 'domani la mamma porta viola dalla nonna e poi va al super',
    confidence: 1.0,
    usedAI: true,
  }

  // Shape legacy che Haiku potrebbe restituire
  const rawHaiku = [
    {
      type: 'calendar',
      title: 'Viola dalla nonna',
      assignedTo: 'Viola',
      date: TOMORROW,
      time: null,
      accompaniedBy: 'mamma', // alias!
      location: 'casa nonna',
    },
    {
      type: 'task',
      title: 'Portare Viola dalla nonna',
      assignedTo: 'mamma', // alias!
      date: TOMORROW,
    },
    {
      type: 'shopping',
      name: 'spesa al super',
      quantity: 1,
      person: 'mamma', // alias!
    },
  ]

  let canonical

  it('normalizza 3 azioni L3 con alias resolution', () => {
    const result = normalizeAndValidateActions(rawHaiku, l3Ctx)
    canonical = result.actions
    expect(result.invalid).toHaveLength(0)
    expect(canonical).toHaveLength(3)
  })

  it('alias "mamma" → Chiara (mem_chiara) in tutte le azioni', () => {
    const cal = canonical.find(a => a.type === 'calendar')
    expect(cal.logistics.accompaniedById).toBe('mem_chiara')
    expect(cal.logistics.accompaniedByName).toBe('Chiara')

    const task = canonical.find(a => a.type === 'task')
    expect(task.assignedToId).toBe('mem_chiara')
    expect(task.assignedToName).toBe('Chiara')
  })

  it('source = L3 e usedAI = true in tutte le azioni', () => {
    for (const a of canonical) {
      expect(a.source).toBe('L3')
      expect(a.meta.usedAI).toBe(true)
    }
  })

  it('shopping: person legacy → non presente, title da name', () => {
    const shop = canonical.find(a => a.type === 'shopping')
    expect(shop.title).toBe('spesa al super')
    expect(shop).not.toHaveProperty('name')
    expect(shop).not.toHaveProperty('person')
  })

  it('nessun campo legacy in nessuna azione', () => {
    const FORBIDDEN = ['assignedTo', 'person', 'time', 'name', 'accompaniedBy', 'pickupBy']
    for (const action of canonical) {
      for (const field of FORBIDDEN) {
        expect(action).not.toHaveProperty(field)
      }
    }
  })

  it('executor produce DB records corretti', () => {
    const { log } = simulatePersistOrchestrator(canonical)
    expect(log).toHaveLength(3)

    const calRecord = log.find(l => l.type === 'calendar')?.record
    expect(calRecord.logistics[0].member_id).toBe('mem_chiara')

    const taskRecord = log.find(l => l.type === 'task')?.record
    expect(taskRecord.assigned_to).toBe('mem_chiara')
    // task linked al calendar
    expect(taskRecord.linked_event_id).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════
// SCENARIO 6: Fallimento parziale persist
// 3 azioni, la seconda fallisce → le altre devono persistere
// ═══════════════════════════════════════════════════════════════

describe('Golden E2E #6: Fallimento parziale persist', () => {
  const ctx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    source: 'L0',
    textOriginal: 'Speso 12 al bar, allenamento Viola alle 17, compra il pane',
    confidence: 0.88,
  }

  const rawActions = [
    { type: 'expense', amount: 12, category: 'bar', note: 'Speso 12 al bar', date: TODAY },
    { type: 'calendar', title: 'Allenamento Viola', assignedTo: 'Viola', date: TODAY, time: '17:00', category: 'sport' },
    { type: 'shopping', name: 'pane', quantity: 1, unit: 'pz' },
  ]

  let canonical

  it('normalizza 3 azioni di tipi diversi', () => {
    const result = normalizeAndValidateActions(rawActions, ctx)
    canonical = result.actions
    expect(result.invalid).toHaveLength(0)
    expect(canonical).toHaveLength(3)
  })

  it('simula persist con fallimento del calendar (DB error)', () => {
    const log = []
    let dbIdCounter = 0

    for (const action of canonical) {
      try {
        if (action.type === 'calendar') {
          throw new Error('DB write failed: connection timeout')
        }
        const dbRecord = simulateExecutor(action)
        const fakeId = `db_${action.type}_${++dbIdCounter}`
        log.push({ ok: true, type: action.type, id: fakeId, msg: `${action.type} persistito` })
      } catch (err) {
        log.push({ ok: false, type: action.type, msg: `${action.type} fallito: ${err.message}` })
      }
    }

    // 2 ok, 1 fail
    expect(log.filter(l => l.ok)).toHaveLength(2)
    expect(log.filter(l => !l.ok)).toHaveLength(1)

    // Il fallito è il calendar
    const failed = log.find(l => !l.ok)
    expect(failed.type).toBe('calendar')

    // I successi sono expense e shopping
    const succeeded = log.filter(l => l.ok)
    expect(succeeded.map(s => s.type).sort()).toEqual(['expense', 'shopping'])
  })

  it('le azioni non fallite mantengono la shape canonica', () => {
    const expense = canonical.find(a => a.type === 'expense')
    const shopping = canonical.find(a => a.type === 'shopping')

    // Verifico che passano ancora la validazione
    expect(validateAction(expense).ok).toBe(true)
    expect(validateAction(shopping).ok).toBe(true)

    // Executor mapping corretto
    const expDb = simulateExecutor(expense)
    expect(expDb.amount).toBe(12)
    expect(expDb.category).toBe('bar')

    const shopDb = simulateExecutor(shopping)
    expect(shopDb.name).toBe('pane')
  })
})

// ═══════════════════════════════════════════════════════════════
// SCENARIO 7: Conflitto sync su entità linked
// Calendar + task linked. Calendar persist ok ma task ha conflitto.
// Il linked_event_id è stato risolto ma il task fallisce.
// Verifica che il sistema gestisce la divergenza.
// ═══════════════════════════════════════════════════════════════

describe('Golden E2E #7: Conflitto sync su entità linked', () => {
  const ctx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    source: 'L0',
    textOriginal: 'Domani mamma porta Asia a danza alle 16',
    confidence: 0.90,
  }

  const rawActions = [
    {
      type: 'calendar', title: 'Danza Asia', assignedTo: 'Asia',
      date: TOMORROW, time: '16:00', category: 'sport',
      accompaniedBy: 'mamma',
    },
    {
      type: 'task', title: 'Portare Asia a danza', assignedTo: 'mamma',
      date: TOMORROW,
    },
  ]

  let canonical

  it('normalizza con linked entity corretto', () => {
    const result = normalizeAndValidateActions(rawActions, ctx)
    canonical = result.actions
    expect(result.invalid).toHaveLength(0)
    expect(canonical).toHaveLength(2)

    const task = canonical.find(a => a.type === 'task')
    expect(task.linkedEntity).not.toBeNull()
    expect(task.linkedEntity.entityType).toBe('calendar')
  })

  it('persist: calendar ok → task conflitto → linked_event_id risolto ma task non persistito', () => {
    const log = []
    const refToIdMap = new Map()
    let dbIdCounter = 0

    // Fase 1: independent (calendar)
    const independent = canonical.filter(a => !a.linkedEntity)
    for (const action of independent) {
      const dbRecord = simulateExecutor(action)
      const fakeId = `db_${action.type}_${++dbIdCounter}`
      refToIdMap.set(action.meta.actionRef, fakeId)
      log.push({ ok: true, type: action.type, id: fakeId, record: dbRecord })
    }

    // Fase 2: dependent (task) — resolve tempRef, poi simula conflitto
    const dependent = canonical.filter(a => a.linkedEntity)
    for (const action of dependent) {
      if (action.linkedEntity?.tempRef) {
        const realId = refToIdMap.get(action.linkedEntity.tempRef)
        if (realId) action.linkedEntity.realId = realId
      }

      // Il tempRef → realId è risolto PRIMA del fallimento
      expect(action.linkedEntity.realId).toBeDefined()
      expect(action.linkedEntity.realId).toMatch(/^db_calendar_/)

      // Simula conflitto sync
      try {
        throw new Error('SYNC_CONFLICT: version mismatch')
      } catch (err) {
        log.push({ ok: false, type: action.type, msg: `${action.type} fallito: ${err.message}` })
      }
    }

    // Calendar ok, task failed
    expect(log[0].ok).toBe(true)
    expect(log[0].type).toBe('calendar')
    expect(log[0].record.person_id).toBe('mem_asia')
    expect(log[0].record.time_start).toBe('16:00')

    expect(log[1].ok).toBe(false)
    expect(log[1].type).toBe('task')
    expect(log[1].msg).toContain('SYNC_CONFLICT')
  })

  it('il calendar persistito è valido anche senza il task linked', () => {
    const cal = canonical.find(a => a.type === 'calendar')
    const v = validateAction(cal)
    expect(v.ok).toBe(true)

    const db = simulateExecutor(cal)
    expect(db.person_id).toBe('mem_asia')
    expect(db.logistics[0]).toEqual({ role: 'porta', member_id: 'mem_chiara' })
    expect(db.needsPickup).toBe(true) // nessun pickup definito → flag
  })
})

// ═══════════════════════════════════════════════════════════════
// BONUS: Convergenza cross-source per tutti i tipi
// La stessa raw action, da L0/L3/memory, produce shape identica
// ═══════════════════════════════════════════════════════════════

describe('Golden E2E: Convergenza cross-source per ogni tipo', () => {
  const baseCtx = {
    familyId: 'fam_test',
    currentMemberId: 'mem_cristian',
    members: MEMBERS,
    textOriginal: 'test convergenza',
    confidence: 0.88,
    utteranceRef: 'u_conv_test',
  }

  const stripSourceAndMeta = (a) => {
    const { source, meta, ...rest } = a
    return rest
  }

  const testCases = [
    { name: 'calendar', raw: { type: 'calendar', title: 'Danza Asia', assignedTo: 'Asia', date: TODAY, time: '16:00' } },
    { name: 'task', raw: { type: 'task', title: 'Compra latte', assignedTo: 'Chiara', date: TODAY } },
    { name: 'expense', raw: { type: 'expense', amount: 15, note: 'Spesa', date: TODAY } },
    { name: 'meal', raw: { type: 'meal', name: 'Pasta', slot: 'cena', date: TODAY } },
    { name: 'shopping', raw: { type: 'shopping', name: 'Pane', quantity: 2, unit: 'pz' } },
    { name: 'reminder', raw: { type: 'reminder', title: 'Ricordati', assignedTo: 'Asia', date: TODAY } },
  ]

  for (const { name, raw } of testCases) {
    it(`${name}: L0, L3, memory → shape identica (eccetto source/meta)`, () => {
      const fromL0 = normalizeAndValidateActions([raw], { ...baseCtx, source: 'L0' })
      const fromL3 = normalizeAndValidateActions([raw], { ...baseCtx, source: 'L3', usedAI: true })
      const fromMem = normalizeAndValidateActions([raw], { ...baseCtx, source: 'memory' })

      expect(fromL0.invalid).toHaveLength(0)
      expect(fromL3.invalid).toHaveLength(0)
      expect(fromMem.invalid).toHaveLength(0)

      expect(stripSourceAndMeta(fromL0.actions[0])).toEqual(stripSourceAndMeta(fromL3.actions[0]))
      expect(stripSourceAndMeta(fromL0.actions[0])).toEqual(stripSourceAndMeta(fromMem.actions[0]))

      // Source diverso
      expect(fromL0.actions[0].source).toBe('L0')
      expect(fromL3.actions[0].source).toBe('L3')
      expect(fromMem.actions[0].source).toBe('memory')
    })
  }
})
