// src/lib/brain/__tests__/editActionIntegration.test.js
import { describe, it, expect } from 'vitest'
import { normalizeAndValidateActions } from '../actionNormalizer.js'

const CTX = {
  familyId: 'fam_test',
  currentMemberId: 'mem_cristian',
  members: [
    { id: 'mem_asia', name: 'Asia', role: 'child', aliases: [] },
    { id: 'mem_viola', name: 'Viola', role: 'child', aliases: [] },
    { id: 'mem_chiara', name: 'Chiara', role: 'genitore', gender: 'F', aliases: ['mamma'] },
    { id: 'mem_cristian', name: 'Cristian', role: 'genitore', gender: 'M', aliases: ['papà'] },
  ],
  source: 'L0',
}

describe('edit_action normalization pipeline', () => {
  it('passes through delete edit_action with correct shape', () => {
    const raw = [{
      type: 'edit_action',
      verb: 'delete',
      targetType: 'calendar',
      search: {
        titleHintRaw: 'dentista',
        titleHintNorm: 'dentista',
        dateHintRaw: 'giovedì',
        dateNorm: '2026-03-26',
        personNameRaw: null,
        personId: null,
        activityHint: 'Dentista',
      },
      patch: null,
      resolved: null,
      _confidence: 0.80,
      _pipelinePath: 'l0_edit',
      _textOriginal: 'cancella il dentista di giovedì',
    }]

    const { actions, invalid } = normalizeAndValidateActions(raw, CTX)
    expect(invalid.length).toBe(0)
    expect(actions.length).toBe(1)

    const a = actions[0]
    expect(a.type).toBe('edit_action')
    expect(a.verb).toBe('delete')
    expect(a.targetType).toBe('calendar')
    expect(a.search.titleHintNorm).toBe('dentista')
    expect(a.search.dateNorm).toBe('2026-03-26')
    expect(a.patch).toBeNull()
    expect(a.resolved).toBeNull()
    expect(a.confidence).toBe(0.80)
    expect(a.familyId).toBe('fam_test')
    expect(a.meta.utteranceRef).toBeTruthy()
    expect(a.meta.actionRef).toBe('a_0')
    expect(a.meta.pipelinePath).toBe('l0_edit')
  })

  it('passes through move edit_action with patch', () => {
    const raw = [{
      type: 'edit_action',
      verb: 'move',
      targetType: 'calendar',
      search: {
        titleHintRaw: 'dentista',
        titleHintNorm: 'dentista',
        dateHintRaw: 'giovedì',
        dateNorm: '2026-03-26',
        personNameRaw: 'Viola',
        personId: null,
        activityHint: 'Dentista',
      },
      patch: {
        dateHintRaw: 'venerdì',
        dateNorm: '2026-03-27',
        timeHint: null,
      },
      resolved: null,
      _confidence: 0.80,
      _pipelinePath: 'l0_edit',
      _textOriginal: 'sposta il dentista di Viola a venerdì',
    }]

    const { actions, invalid } = normalizeAndValidateActions(raw, CTX)
    expect(invalid.length).toBe(0)
    expect(actions[0].verb).toBe('move')
    expect(actions[0].patch.dateNorm).toBe('2026-03-27')
    expect(actions[0].search.personNameRaw).toBe('Viola')
  })

  it('legacy edit_request falls back to edit_action normalization', () => {
    const raw = [{
      type: 'edit_request',
      verb: 'delete',
      targetType: 'task',
      search: { titleHintNorm: 'compito', dateNorm: '2026-03-26', personNameRaw: null, personId: null, activityHint: null },
      patch: null,
      resolved: null,
      _confidence: 0.80,
      _pipelinePath: 'l0_edit',
      _textOriginal: 'cancella il compito',
    }]

    const { actions, invalid } = normalizeAndValidateActions(raw, CTX)
    expect(invalid.length).toBe(0)
    expect(actions[0].type).toBe('edit_action')
    expect(actions[0].verb).toBe('delete')
  })

  it('rejects edit_action with invalid verb', () => {
    const raw = [{
      type: 'edit_action',
      verb: 'explode',
      targetType: 'calendar',
      search: { titleHintNorm: 'test' },
      patch: null,
      resolved: null,
      _confidence: 0.80,
      _pipelinePath: 'l0_edit',
      _textOriginal: 'test',
    }]

    const { actions, invalid } = normalizeAndValidateActions(raw, CTX)
    expect(invalid.length).toBe(1)
    expect(invalid[0].errors.some(e => e.includes('verb'))).toBe(true)
  })

  it('multiple actions: edit_action + calendar in same utterance', () => {
    const raw = [
      {
        type: 'edit_action',
        verb: 'delete',
        targetType: 'calendar',
        search: { titleHintNorm: 'dentista', dateNorm: '2026-03-26', personNameRaw: null, personId: null, activityHint: null },
        patch: null,
        resolved: null,
        _confidence: 0.80,
        _pipelinePath: 'l0_edit',
        _textOriginal: 'cancella il dentista',
      },
      {
        type: 'calendar',
        title: 'Nuoto Asia',
        date: '2026-03-26',
        time: '16:00',
        assignedTo: 'Asia',
        _confidence: 0.90,
        _pipelinePath: 'l0_calendar',
        _textOriginal: 'Asia nuoto alle 16',
      },
    ]

    const { actions, invalid } = normalizeAndValidateActions(raw, CTX)
    // Both should normalize
    expect(actions.length).toBe(2)
    expect(actions[0].type).toBe('edit_action')
    expect(actions[1].type).toBe('calendar')
    // They share the same utteranceRef
    expect(actions[0].meta.utteranceRef).toBe(actions[1].meta.utteranceRef)
  })
})
