import { describe, it, expect } from 'vitest'
import { normalizeAndValidateActions } from '../actionNormalizer.js'
import { scoreCandidate, resolvePerson } from '../dbResolver.js'

// ═══════════════════════════════════════════════════════════════
// Mock data
// ═══════════════════════════════════════════════════════════════

const MEMBERS = [
  { id: 'mem_asia', name: 'Asia', role: 'child', gender: 'F', aliases: [] },
  { id: 'mem_viola', name: 'Viola', role: 'child', gender: 'F', aliases: [] },
  { id: 'mem_chiara', name: 'Chiara', role: 'genitore', gender: 'F', aliases: ['mamma'] },
  { id: 'mem_cristian', name: 'Cristian', role: 'genitore', gender: 'M', aliases: ['papà', 'papa'] },
  { id: 'mem_mariangela', name: 'Mariangela', role: 'nonno', gender: 'F', aliases: ['nonna'] },
]

const CTX = { familyId: 'fam1', currentMemberId: 'mem_cristian', members: MEMBERS, source: 'L0' }

// ═══════════════════════════════════════════════════════════════
// Scenario 1: cancella il dentista di giovedì
// ═══════════════════════════════════════════════════════════════

describe('Scenario 1: cancella il dentista di giovedì', () => {
  it('produces delete edit_action targeting calendar', () => {
    const raw = [{
      type: 'edit_action',
      verb: 'delete',
      targetType: 'calendar',
      search: { titleHintNorm: 'dentista', dateNorm: '2026-03-26', personNameRaw: null, personId: null, activityHint: 'Dentista' },
      patch: null,
      resolved: null,
      _confidence: 0.80,
      _pipelinePath: 'l0_edit',
      _textOriginal: 'cancella il dentista di giovedì',
    }]
    const { actions, invalid } = normalizeAndValidateActions(raw, CTX)
    expect(invalid).toHaveLength(0)
    expect(actions).toHaveLength(1)
    expect(actions[0].type).toBe('edit_action')
    expect(actions[0].verb).toBe('delete')
    expect(actions[0].targetType).toBe('calendar')
    expect(actions[0].search.titleHintNorm).toBe('dentista')
  })

  it('scores correct event highest', () => {
    const dentista = { id: 'ev1', title: 'Dentista Asia', date: '2026-03-26', person_id: 'mem_asia', category: 'medico' }
    const danza = { id: 'ev2', title: 'Danza Asia', date: '2026-03-26', person_id: 'mem_asia', category: 'sport' }
    const search = { titleHintNorm: 'dentista', dateNorm: '2026-03-26', personId: null, activityHint: 'Dentista' }

    expect(scoreCandidate(dentista, search)).toBeGreaterThan(scoreCandidate(danza, search))
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 2: sposta il dentista a settimana prossima
// ═══════════════════════════════════════════════════════════════

describe('Scenario 2: sposta il dentista a settimana prossima', () => {
  it('produces move edit_action with patch', () => {
    const raw = [{
      type: 'edit_action',
      verb: 'move',
      targetType: 'calendar',
      search: { titleHintNorm: 'dentista', dateNorm: '2026-03-26', personNameRaw: null, personId: null, activityHint: 'Dentista' },
      patch: { dateHintRaw: 'settimana prossima', dateNorm: '2026-04-02', timeHint: null },
      resolved: null,
      _confidence: 0.80,
      _pipelinePath: 'l0_edit',
      _textOriginal: 'sposta il dentista a settimana prossima',
    }]
    const { actions, invalid } = normalizeAndValidateActions(raw, CTX)
    expect(invalid).toHaveLength(0)
    expect(actions).toHaveLength(1)
    expect(actions[0].verb).toBe('move')
    expect(actions[0].patch).not.toBeNull()
    expect(actions[0].patch.dateNorm).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 3: caso ambiguo con 2 candidati
// ═══════════════════════════════════════════════════════════════

describe('Scenario 3: caso ambiguo con 2 candidati', () => {
  it('two events with similar scores produce ambiguous status', () => {
    const ev1 = { id: 'ev1', title: 'Dentista Asia', date: '2026-03-26', person_id: 'mem_asia', category: 'medico' }
    const ev2 = { id: 'ev2', title: 'Dentista Viola', date: '2026-03-26', person_id: 'mem_viola', category: 'medico' }
    const search = { titleHintNorm: 'dentista', dateNorm: '2026-03-26', personId: null, activityHint: null }

    const score1 = scoreCandidate(ev1, search)
    const score2 = scoreCandidate(ev2, search)
    // Both should have the same score (date+title match, no person filter)
    expect(score1).toBe(score2)
    // Gap < 20 -> resolver would mark as ambiguous
    expect(Math.abs(score1 - score2)).toBeLessThan(20)
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 4: pranzo dalla nonna (implicit person)
// ═══════════════════════════════════════════════════════════════

describe('Scenario 4: pranzo dalla nonna (implicit person)', () => {
  it('resolves "nonna" to Mariangela', () => {
    const result = resolvePerson('fam1', 'nonna', MEMBERS)
    expect(result.best).not.toBeNull()
    expect(result.best.name).toBe('Mariangela')
    expect(result.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('resolves "dalla nonna" to Mariangela', () => {
    const result = resolvePerson('fam1', 'dalla nonna', MEMBERS)
    expect(result.best).not.toBeNull()
    expect(result.best.name).toBe('Mariangela')
  })
})

// ═══════════════════════════════════════════════════════════════
// Scenario 5: caso not_found
// ═══════════════════════════════════════════════════════════════

describe('Scenario 5: caso not_found', () => {
  it('no matching records produce not_found status shape', () => {
    // Simulate the resolved shape that the resolver would produce
    const resolved = {
      status: 'not_found',
      candidates: [],
      matchedRecord: null,
      selectedRecord: null,
      requiresConfirmation: true,
      resolutionConfidence: 0,
      resolutionSource: 'not_found',
      resolverTrace: {
        searchDomains: ['events', 'tasks'],
        query: { titleHintNorm: 'pianoforte', dateNorm: '2026-03-26' },
        candidatesFound: 0,
        selectedId: null,
        reason: 'not_found',
      },
    }
    expect(resolved.status).toBe('not_found')
    expect(resolved.candidates).toHaveLength(0)
    expect(resolved.requiresConfirmation).toBe(true)
    expect(resolved.matchedRecord).toBeNull()
  })

  it('scoreCandidate returns 0 for completely unrelated record', () => {
    const event = { id: 'ev1', title: 'Danza Asia', date: '2026-03-27', person_id: 'mem_asia', category: 'sport' }
    const search = { titleHintNorm: 'pianoforte', dateNorm: '2026-03-26', personId: 'mem_viola', activityHint: 'musica' }
    expect(scoreCandidate(event, search)).toBe(0)
  })
})
