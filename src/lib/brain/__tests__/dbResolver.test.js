import { describe, it, expect } from 'vitest'
import { scoreCandidate, resolvePerson } from '../dbResolver.js'

// ═══════════════════════════════════════════════════════════════
// Mock data
// ═══════════════════════════════════════════════════════════════
const mockEvents = [
  { id: 'ev1', title: 'Dentista Asia', date: '2026-03-26', person_id: 'mem_asia', category: 'medico', _deleted: false },
  { id: 'ev2', title: 'Danza Asia', date: '2026-03-26', person_id: 'mem_asia', category: 'sport', _deleted: false },
  { id: 'ev3', title: 'Dentista Viola', date: '2026-03-27', person_id: 'mem_viola', category: 'medico', _deleted: false },
]

const mockMembers = [
  { id: 'mem_asia', name: 'Asia', role: 'child', gender: 'F', aliases: [] },
  { id: 'mem_viola', name: 'Viola', role: 'child', gender: 'F', aliases: [] },
  { id: 'mem_chiara', name: 'Chiara', role: 'genitore', gender: 'F', aliases: ['mamma'] },
  { id: 'mem_cristian', name: 'Cristian', role: 'genitore', gender: 'M', aliases: ['papà', 'papa'] },
  { id: 'mem_mariangela', name: 'Mariangela', role: 'nonno', gender: 'F', aliases: ['nonna'] },
]

// ═══════════════════════════════════════════════════════════════
// scoreCandidate
// ═══════════════════════════════════════════════════════════════
describe('scoreCandidate', () => {
  it('scores higher for exact date + title match', () => {
    const score1 = scoreCandidate(mockEvents[0], {
      titleHintNorm: 'dentista',
      dateNorm: '2026-03-26',
      personId: null,
      activityHint: null,
    })
    const score2 = scoreCandidate(mockEvents[1], {
      titleHintNorm: 'dentista',
      dateNorm: '2026-03-26',
      personId: null,
      activityHint: null,
    })
    expect(score1).toBeGreaterThan(score2) // ev1 title matches 'dentista', ev2 does not
    expect(score1).toBe(60) // date(40) + title(20)
    expect(score2).toBe(40) // date(40) only
  })

  it('includes person match in score', () => {
    const withPerson = scoreCandidate(mockEvents[0], {
      titleHintNorm: 'dentista',
      dateNorm: '2026-03-26',
      personId: 'mem_asia',
      activityHint: null,
    })
    const withoutPerson = scoreCandidate(mockEvents[0], {
      titleHintNorm: 'dentista',
      dateNorm: '2026-03-26',
      personId: null,
      activityHint: null,
    })
    expect(withPerson).toBe(90) // date(40) + person(30) + title(20)
    expect(withoutPerson).toBe(60) // date(40) + title(20)
  })

  it('includes activity match in score', () => {
    const withActivity = scoreCandidate(mockEvents[0], {
      titleHintNorm: 'dentista',
      dateNorm: '2026-03-26',
      personId: null,
      activityHint: 'medico',
    })
    expect(withActivity).toBe(70) // date(40) + title(20) + activity(10)
  })

  it('handles partial word overlap in title', () => {
    const score = scoreCandidate(
      { title: 'Lezione di piano Asia', date: '2026-03-26' },
      { titleHintNorm: 'piano', dateNorm: '2026-03-26', personId: null, activityHint: null }
    )
    expect(score).toBe(60) // date(40) + title(20)
  })

  it('returns 0 for no match at all', () => {
    const score = scoreCandidate(mockEvents[0], {
      titleHintNorm: 'nuoto',
      dateNorm: '2026-04-01',
      personId: 'mem_other',
      activityHint: 'sport',
    })
    expect(score).toBe(0)
  })

  it('scores tasks via due_date and assigned_to', () => {
    const task = { id: 't1', title: 'Comprare quaderno', due_date: '2026-03-26', assigned_to: 'mem_chiara', status: 'todo' }
    const score = scoreCandidate(task, {
      titleHintNorm: 'quaderno',
      dateNorm: '2026-03-26',
      personId: 'mem_chiara',
      activityHint: null,
    })
    expect(score).toBe(90) // date(40) + person(30) + title(20)
  })
})

// ═══════════════════════════════════════════════════════════════
// resolvePerson
// ═══════════════════════════════════════════════════════════════
describe('resolvePerson', () => {
  it('resolves exact name', () => {
    const result = resolvePerson('fam1', 'Asia', mockMembers)
    expect(result.best.id).toBe('mem_asia')
    expect(result.confidence).toBe(1.0)
    expect(result.ambiguous).toBe(false)
  })

  it('resolves alias "mamma" to parent female', () => {
    const result = resolvePerson('fam1', 'mamma', mockMembers)
    expect(result.best.id).toBe('mem_chiara')
    expect(result.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('resolves alias "papà" to parent male', () => {
    const result = resolvePerson('fam1', 'papà', mockMembers)
    expect(result.best.id).toBe('mem_cristian')
  })

  it('resolves "papa" (no accent) to parent male', () => {
    const result = resolvePerson('fam1', 'papa', mockMembers)
    expect(result.best.id).toBe('mem_cristian')
  })

  it('resolves "nonna" to elder female', () => {
    const result = resolvePerson('fam1', 'nonna', mockMembers)
    expect(result.best.id).toBe('mem_mariangela')
    expect(result.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('resolves explicit alias from member data', () => {
    const result = resolvePerson('fam1', 'nonna', mockMembers)
    expect(result.best.name).toBe('Mariangela')
  })

  it('returns not found for unknown name', () => {
    const result = resolvePerson('fam1', 'Sconosciuto', mockMembers)
    expect(result.best).toBeNull()
    expect(result.confidence).toBe(0)
  })

  it('handles null/empty input gracefully', () => {
    expect(resolvePerson('fam1', null, mockMembers).best).toBeNull()
    expect(resolvePerson('fam1', '', mockMembers).best).toBeNull()
    expect(resolvePerson('fam1', 'Asia', []).best).toBeNull()
  })

  it('handles partial name match', () => {
    const result = resolvePerson('fam1', 'Asi', mockMembers)
    expect(result.best.id).toBe('mem_asia')
    expect(result.confidence).toBe(0.7) // partial match
  })
})
