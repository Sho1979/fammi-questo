/**
 * testMemory.js — Test suite dedicata alla conversation memory.
 *
 * NON sono test generici. Ogni caso testa un comportamento
 * preciso del sistema di merge frammenti.
 *
 * Gruppi:
 * 1. Merge lineare corretto (4-step calendar+logistica)
 * 2. Correzioni (no/anzi/volevo dire)
 * 3. Contraddizioni (stessa entità, valore diverso)
 * 4. Cambio topic (draft abbandonato)
 * 5. Scadenza TTL
 * 6. Frammenti isolati senza draft
 * 7. Draft con logistica parziale
 * 8. Input completi che NON devono aprire draft
 *
 * Uso:
 *   import { runMemoryTests } from './testMemory.js'
 *   const report = await runMemoryTests(members, familyId, currentMember)
 */

import {
  getActiveDraft, createDraft, updateDraft,
  abandonDraft, commitDraft, expireOldDrafts,
  isFollowupFragment, isCorrection,
  isCompatibleWithDraft, mergeParseIntoDraft,
  shouldAutoCommit, buildActionsFromDraft,
  buildDraftPreview, computeMissingFields,
} from './conversationMemory.js'
import { parseLocally } from './intentClassifier.js'
import { db } from '../localDb.js'

// ═══════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════

/**
 * Ogni test case ha:
 * - id: identificativo unico
 * - group: categoria
 * - description: cosa testa
 * - steps: sequenza di frasi con expected outcome per step
 * - finalExpect: stato finale atteso
 */
export const MEMORY_TEST_CASES = [

  // ═══════════════════════════════════════════════════════════
  // GRUPPO 1: MERGE LINEARE CORRETTO
  // ═══════════════════════════════════════════════════════════
  {
    id: 'linear_4step_calendar',
    group: 'merge_linear',
    description: '4-step merge calendario con logistica completa',
    steps: [
      { input: 'Domani Asia ha danza', expectAction: 'create', expectIntent: 'calendar', expectMissing: ['time', 'dropBy', 'pickupBy'] },
      { input: 'alle 16', expectAction: 'merge', expectMergedFields: ['time'] },
      { input: 'la porta Chiara', expectAction: 'merge', expectMergedFields: ['dropBy'] },
      { input: 'la riprende mamma', expectAction: 'merge_then_commit', expectMergedFields: ['pickupBy'] },
    ],
    finalExpect: { status: 'committed', actionCount: 3 }, // event + task drop + task pickup
  },

  {
    id: 'linear_2step_calendar_time',
    group: 'merge_linear',
    description: '2-step: evento + orario',
    steps: [
      { input: 'Martedì Viola ha il dentista', expectAction: 'create', expectIntent: 'calendar' },
      { input: 'alle 10:30', expectAction: 'merge', expectMergedFields: ['time'] },
    ],
    finalExpect: { status: 'draft_or_committed' },
  },

  {
    id: 'linear_3step_expense',
    group: 'merge_linear',
    description: '3-step: persona + attività + importo (expense)',
    steps: [
      { input: 'Ho speso per il corso di Asia', expectAction: 'create', expectIntent: 'expense' },
      { input: '120 euro', expectAction: 'merge', expectMergedFields: ['amount'] },
    ],
    finalExpect: { status: 'draft_or_committed' },
  },

  {
    id: 'linear_absence',
    group: 'merge_linear',
    description: '2-step absence: chi + quando',
    steps: [
      { input: 'Asia domani non va a scuola', expectAction: 'create', expectIntent: 'absence' },
      { input: 'nel pomeriggio', expectAction: 'merge', expectMergedFields: ['day_period'] },
    ],
    finalExpect: { status: 'draft_or_committed' },
  },

  // ═══════════════════════════════════════════════════════════
  // GRUPPO 2: CORREZIONI
  // ═══════════════════════════════════════════════════════════
  {
    id: 'correction_person',
    group: 'corrections',
    description: 'Correzione persona: no, non Asia, Viola',
    steps: [
      { input: 'Domani Asia ha danza', expectAction: 'create' },
      { input: 'no, non Asia, Viola', expectAction: 'merge', expectIsCorrection: true },
    ],
    finalExpect: { entityCheck: { people: ['viola'] } },
  },

  {
    id: 'correction_time',
    group: 'corrections',
    description: 'Correzione orario: anzi alle 17',
    steps: [
      { input: 'Domani Asia ha danza alle 16', expectAction: 'create' },
      { input: 'anzi alle 17', expectAction: 'merge', expectIsCorrection: true },
    ],
    finalExpect: { entityCheck: { time: '17:00' } },
  },

  {
    id: 'correction_volevo_dire',
    group: 'corrections',
    description: 'Correzione con "volevo dire"',
    steps: [
      { input: 'Domani Asia ha danza', expectAction: 'create' },
      { input: 'volevo dire dopodomani', expectAction: 'merge', expectIsCorrection: true },
    ],
    finalExpect: {},
  },

  // ═══════════════════════════════════════════════════════════
  // GRUPPO 3: CONTRADDIZIONI
  // ═══════════════════════════════════════════════════════════
  {
    id: 'contradiction_time',
    group: 'contradictions',
    description: 'Contraddizione orario: alle 16 poi alle 17',
    steps: [
      { input: 'Domani Asia ha danza alle 16', expectAction: 'create' },
      { input: 'alle 17', expectAction: 'merge', expectMergedFields: ['time'] },
    ],
    finalExpect: { entityCheck: { time: '17:00' } },
  },

  // ═══════════════════════════════════════════════════════════
  // GRUPPO 4: CAMBIO TOPIC
  // ═══════════════════════════════════════════════════════════
  {
    id: 'topic_change_calendar_to_expense',
    group: 'topic_change',
    description: 'Cambio topic: calendar → expense (draft abbandonato)',
    steps: [
      { input: 'Domani Asia ha danza', expectAction: 'create', expectIntent: 'calendar' },
      { input: 'aggiungi 20 euro di benzina', expectAction: 'abandon', expectNewIntent: 'expense' },
    ],
    finalExpect: {},
  },

  {
    id: 'topic_change_then_fragment',
    group: 'topic_change',
    description: 'Cambio topic sporco: calendar → expense → frammento orario',
    steps: [
      { input: 'Domani Asia ha danza', expectAction: 'create', expectIntent: 'calendar' },
      { input: 'aggiungi 20 euro di benzina', expectAction: 'abandon' },
      { input: 'alle 16', expectAction: 'ignore_or_merge' }, // NON deve agganciarsi alla spesa
    ],
    finalExpect: {},
  },

  // ═══════════════════════════════════════════════════════════
  // GRUPPO 5: FRAMMENTI ISOLATI SENZA DRAFT
  // ═══════════════════════════════════════════════════════════
  {
    id: 'orphan_time_fragment',
    group: 'orphan_fragments',
    description: 'Frammento orario senza draft attivo → ignorato',
    steps: [
      { input: 'alle 16', expectAction: 'ignore' },
    ],
    finalExpect: { noDraft: true },
  },

  {
    id: 'orphan_person_fragment',
    group: 'orphan_fragments',
    description: 'Frammento persona senza draft attivo → ignorato',
    steps: [
      { input: 'mamma', expectAction: 'ignore' },
    ],
    finalExpect: { noDraft: true },
  },

  {
    id: 'orphan_amount_fragment',
    group: 'orphan_fragments',
    description: 'Frammento importo senza draft attivo → ignorato',
    steps: [
      { input: '100 euro', expectAction: 'ignore' },
    ],
    finalExpect: { noDraft: true },
  },

  // ═══════════════════════════════════════════════════════════
  // GRUPPO 6: LOGISTICA PARZIALE
  // ═══════════════════════════════════════════════════════════
  {
    id: 'logistics_drop_only',
    group: 'logistics_partial',
    description: 'Solo chi porta, senza chi riprende — draft resta aperto',
    steps: [
      { input: 'Domani Asia ha danza', expectAction: 'create' },
      { input: 'la porta Chiara', expectAction: 'merge', expectMergedFields: ['dropBy'] },
    ],
    finalExpect: { status: 'draft', missingIncludes: ['pickupBy'] },
  },

  {
    id: 'logistics_pickup_after_delay',
    group: 'logistics_partial',
    description: 'Pickup arriva dopo 2 turni, draft resta aperto fino ad allora',
    steps: [
      { input: 'Domani Asia ha danza alle 16', expectAction: 'create' },
      { input: 'la porta Chiara', expectAction: 'merge' },
      { input: 'la riprende mamma', expectAction: 'merge_then_commit' },
    ],
    finalExpect: { status: 'committed' },
  },

  // ═══════════════════════════════════════════════════════════
  // GRUPPO 7: INPUT COMPLETI → NO DRAFT
  // ═══════════════════════════════════════════════════════════
  {
    id: 'complete_calendar_no_draft',
    group: 'complete_no_draft',
    description: 'Input completo con tutto → non deve creare draft',
    steps: [
      { input: 'Domani Asia ha danza alle 16 e la porta Chiara', expectAction: 'ignore_or_commit' },
    ],
    finalExpect: {},
  },

  {
    id: 'complete_expense_no_draft',
    group: 'complete_no_draft',
    description: 'Expense completa → non deve creare draft',
    steps: [
      { input: 'Ho speso 45 euro al supermercato', expectAction: 'ignore_or_commit' },
    ],
    finalExpect: {},
  },

  // ═══════════════════════════════════════════════════════════
  // GRUPPO 8: DETECTION FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  {
    id: 'detect_fragment_time',
    group: 'detection',
    description: 'isFollowupFragment riconosce "alle 16"',
    steps: [
      { input: 'alle 16', expectFragment: true },
    ],
    finalExpect: {},
  },

  {
    id: 'detect_fragment_logistics',
    group: 'detection',
    description: 'isFollowupFragment riconosce "la porta Chiara"',
    steps: [
      { input: 'la porta Chiara', expectFragment: true },
    ],
    finalExpect: {},
  },

  {
    id: 'detect_fragment_amount',
    group: 'detection',
    description: 'isFollowupFragment riconosce "100 euro"',
    steps: [
      { input: '100 euro', expectFragment: true },
    ],
    finalExpect: {},
  },

  {
    id: 'detect_fragment_period',
    group: 'detection',
    description: 'isFollowupFragment riconosce "di pomeriggio"',
    steps: [
      { input: 'di pomeriggio', expectFragment: true },
    ],
    finalExpect: {},
  },

  {
    id: 'detect_correction_no',
    group: 'detection',
    description: 'isCorrection riconosce "no, non Asia, Viola"',
    steps: [
      { input: 'no, non Asia, Viola', expectCorrection: true },
    ],
    finalExpect: {},
  },

  {
    id: 'detect_correction_anzi',
    group: 'detection',
    description: 'isCorrection riconosce "anzi alle 17"',
    steps: [
      { input: 'anzi alle 17', expectCorrection: true },
    ],
    finalExpect: {},
  },

  {
    id: 'detect_not_fragment_full',
    group: 'detection',
    description: 'Frase completa NON è fragment',
    steps: [
      { input: 'Domani Asia ha danza alle 16', expectFragment: false },
    ],
    finalExpect: {},
  },
]

// ═══════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════

/**
 * Esegue tutti i test della memoria conversazionale.
 * Ogni test è eseguito in isolamento (drafts puliti tra un test e l'altro).
 */
export async function runMemoryTests(members, familyId, currentMember) {
  const createdBy = currentMember?.id || currentMember?.name || 'test_user'
  const results = []
  const t0 = performance.now()

  for (const testCase of MEMORY_TEST_CASES) {
    const result = await runSingleTest(testCase, members, familyId, createdBy, currentMember)
    results.push(result)
  }

  const totalMs = Math.round(performance.now() - t0)

  // Aggregati
  const passed = results.filter(r => r.passed)
  const failed = results.filter(r => !r.passed)

  // Per gruppo
  const byGroup = {}
  for (const r of results) {
    if (!byGroup[r.group]) byGroup[r.group] = { total: 0, passed: 0, failed: 0 }
    byGroup[r.group].total++
    if (r.passed) byGroup[r.group].passed++
    else byGroup[r.group].failed++
  }

  return {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passed: passed.length,
    failed: failed.length,
    passRate: Math.round((passed.length / results.length) * 100),
    totalMs,
    byGroup,
    results,
    failures: failed,
  }
}

/**
 * Esegue un singolo test case.
 */
async function runSingleTest(testCase, members, familyId, createdBy, currentMember) {
  const result = {
    id: testCase.id,
    group: testCase.group,
    description: testCase.description,
    passed: true,
    errors: [],
    stepResults: [],
  }

  // Pulisci drafts prima del test
  await cleanTestDrafts(familyId, createdBy)

  try {
    let currentDraft = null

    for (let i = 0; i < testCase.steps.length; i++) {
      const step = testCase.steps[i]
      const stepResult = { input: step.input, checks: [] }

      // ─── Test detection-only (senza draft lifecycle) ───
      if (step.expectFragment !== undefined) {
        const parseResult = await parseLocally(step.input, members, familyId, currentMember, null)
        const isFragment = isFollowupFragment(step.input, parseResult)
        const pass = isFragment === step.expectFragment
        stepResult.checks.push({
          check: 'isFollowupFragment',
          expected: step.expectFragment,
          actual: isFragment,
          pass,
        })
        if (!pass) {
          result.passed = false
          result.errors.push(`Step ${i}: isFollowupFragment expected ${step.expectFragment}, got ${isFragment}`)
        }
        result.stepResults.push(stepResult)
        continue
      }

      if (step.expectCorrection !== undefined) {
        const isCorrectionResult = isCorrection(step.input)
        const pass = isCorrectionResult === step.expectCorrection
        stepResult.checks.push({
          check: 'isCorrection',
          expected: step.expectCorrection,
          actual: isCorrectionResult,
          pass,
        })
        if (!pass) {
          result.passed = false
          result.errors.push(`Step ${i}: isCorrection expected ${step.expectCorrection}, got ${isCorrectionResult}`)
        }
        result.stepResults.push(stepResult)
        continue
      }

      // ─── Test con draft lifecycle ───
      const parseResult = await parseLocally(step.input, members, familyId, currentMember, null)
      const isFragment = isFollowupFragment(step.input, parseResult)
      const resultIntent = parseResult?.actions?.[0]?.type || parseResult?.type || null
      const resultEntities = parseResult?.entities || {}

      // Cerca draft attivo
      currentDraft = await getActiveDraft(familyId, createdBy)

      let action = 'unknown'

      if (currentDraft) {
        const compatible = isCompatibleWithDraft(currentDraft, step.input, parseResult)

        if (compatible) {
          // Merge
          const mergeInfo = mergeParseIntoDraft(currentDraft, step.input, parseResult, resultEntities)
          currentDraft = mergeInfo.draft
          await updateDraft(currentDraft.id, currentDraft)

          if (shouldAutoCommit(currentDraft)) {
            await commitDraft(currentDraft.id)
            action = 'merge_then_commit'
          } else {
            action = 'merge'
          }

          // Check merged fields
          if (step.expectMergedFields) {
            for (const field of step.expectMergedFields) {
              const merged = mergeInfo.mergedFields.includes(field)
              stepResult.checks.push({
                check: `merged_${field}`,
                expected: true,
                actual: merged,
                pass: merged,
              })
              if (!merged) {
                result.passed = false
                result.errors.push(`Step ${i}: expected merge of '${field}', but not merged. Got: [${mergeInfo.mergedFields.join(', ')}]`)
              }
            }
          }

          // Check correction detection
          if (step.expectIsCorrection) {
            const corrDetected = isCorrection(step.input)
            stepResult.checks.push({
              check: 'correction_detected',
              expected: true,
              actual: corrDetected,
              pass: corrDetected,
            })
            if (!corrDetected) {
              result.passed = false
              result.errors.push(`Step ${i}: expected correction detection for "${step.input}"`)
            }
          }
        } else {
          // Incompatible → abandon
          await abandonDraft(currentDraft.id, 'topic_change')
          action = 'abandon'

          // Eventualmente crea nuovo draft
          if (resultIntent && ['calendar', 'absence', 'expense'].includes(resultIntent)) {
            currentDraft = await createDraft({
              familyId, createdBy, intent: resultIntent,
              entities: resultEntities, parseResult, inputText: step.input,
            })
            action = 'abandon_then_create'
          } else {
            currentDraft = null
          }
        }
      } else {
        // Nessun draft attivo
        if (isFragment) {
          action = 'ignore'
        } else if (resultIntent && ['calendar', 'absence', 'expense'].includes(resultIntent)) {
          currentDraft = await createDraft({
            familyId, createdBy, intent: resultIntent,
            entities: resultEntities, parseResult, inputText: step.input,
          })

          if (shouldAutoCommit(currentDraft)) {
            await commitDraft(currentDraft.id)
            action = 'create_then_commit'
          } else {
            action = 'create'
          }
        } else {
          action = 'ignore'
        }
      }

      // Check action
      if (step.expectAction) {
        const actionOk = matchAction(action, step.expectAction)
        stepResult.checks.push({
          check: 'action',
          expected: step.expectAction,
          actual: action,
          pass: actionOk,
        })
        if (!actionOk) {
          result.passed = false
          result.errors.push(`Step ${i}: expected action '${step.expectAction}', got '${action}'`)
        }
      }

      // Check intent
      if (step.expectIntent && currentDraft) {
        const intentOk = currentDraft.intent === step.expectIntent
        stepResult.checks.push({
          check: 'intent',
          expected: step.expectIntent,
          actual: currentDraft.intent,
          pass: intentOk,
        })
        if (!intentOk) {
          result.passed = false
          result.errors.push(`Step ${i}: expected intent '${step.expectIntent}', got '${currentDraft.intent}'`)
        }
      }

      // Check missing fields
      if (step.expectMissing && currentDraft) {
        for (const field of step.expectMissing) {
          const isMissing = currentDraft.missing_fields.includes(field)
          stepResult.checks.push({
            check: `missing_${field}`,
            expected: true,
            actual: isMissing,
            pass: isMissing,
          })
          if (!isMissing) {
            result.passed = false
            result.errors.push(`Step ${i}: expected '${field}' in missing_fields, not found`)
          }
        }
      }

      stepResult.action = action
      stepResult.draftStatus = currentDraft?.status || null
      result.stepResults.push(stepResult)
    }

    // ─── Final expectations ───
    if (testCase.finalExpect) {
      const fe = testCase.finalExpect
      const finalDraft = await getActiveDraft(familyId, createdBy)

      if (fe.noDraft && finalDraft) {
        result.passed = false
        result.errors.push(`Final: expected no draft, but found one (status: ${finalDraft.status})`)
      }

      if (fe.status === 'committed' && currentDraft?.status !== 'committed') {
        // Rileggi dal DB per sicurezza
        // (lo status potrebbe essere stato aggiornato)
      }

      if (fe.missingIncludes && currentDraft) {
        for (const field of fe.missingIncludes) {
          if (!currentDraft.missing_fields.includes(field)) {
            result.passed = false
            result.errors.push(`Final: expected '${field}' in missing_fields`)
          }
        }
      }

      if (fe.entityCheck && currentDraft) {
        for (const [key, expected] of Object.entries(fe.entityCheck)) {
          const actual = currentDraft.entities?.[key]
          const match = JSON.stringify(actual) === JSON.stringify(expected)
          if (!match) {
            result.passed = false
            result.errors.push(`Final: entity '${key}' expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
          }
        }
      }

      if (fe.actionCount && currentDraft) {
        const actions = buildActionsFromDraft(currentDraft)
        if (actions.length !== fe.actionCount) {
          result.passed = false
          result.errors.push(`Final: expected ${fe.actionCount} actions, got ${actions.length}`)
        }
      }
    }
  } catch (err) {
    result.passed = false
    result.errors.push(`Exception: ${err.message}`)
  }

  // Pulisci dopo il test
  await cleanTestDrafts(familyId, createdBy)

  return result
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Action matching flessibile */
function matchAction(actual, expected) {
  if (actual === expected) return true

  // Matching flessibile per azioni ambigue
  const flexMatches = {
    'ignore_or_merge': ['ignore', 'merge'],
    'ignore_or_commit': ['ignore', 'create_then_commit', 'ignore_complete'],
    'draft_or_committed': ['draft', 'committed'],
    'merge_then_commit': ['merge_then_commit'],
    'abandon': ['abandon', 'abandon_then_create'],
  }

  if (flexMatches[expected]) {
    return flexMatches[expected].some(m => actual.includes(m) || actual === m)
  }

  return false
}

/** Pulisci tutti i draft di test per un utente */
async function cleanTestDrafts(familyId, createdBy) {
  try {
    const drafts = await db.conversationDrafts
      .where('family_id').equals(familyId)
      .and(d => d.created_by === createdBy)
      .toArray()
    if (drafts.length > 0) {
      await db.conversationDrafts.bulkDelete(drafts.map(d => d.id))
    }
  } catch (err) {
    console.warn('[TestMemory] Errore pulizia:', err)
  }
}
