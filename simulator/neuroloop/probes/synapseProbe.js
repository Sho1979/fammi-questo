/**
 * Probe 3: Synapse/learning engine analysis.
 * Checks synapse creation from confirmed actions, shadow threshold behavior,
 * bootstrap integrity, and family isolation.
 *
 * Note: In simulator context, synapses are not fully exercised because
 * phraseExecutor does not call learnFromConfirmed. This probe analyzes
 * trajectory data to infer what SHOULD happen and flags structural issues.
 */

import { createProbeReport, createFinding, createRecommendation, accuracy } from './probeBase.js'

export function runSynapseProbe(trajectories, context = {}) {
  const findings = []

  // ── A. Confirmed actions that should create synapses ──
  const confirmedActions = trajectories.filter(
    t => t.intentCorrect && t.recordWritten && t.recordSnapshot?.title
  )

  // Each confirmed action with a title should create a synapse keyword→intent
  const potentialSynapses = confirmedActions.length
  // We can't verify actual synapse creation in simulator, but we CAN check
  // that the titles contain meaningful keywords (not empty, not raw sentences)

  let goodTitles = 0
  let rawSentenceTitles = 0
  let emptyTitles = 0

  for (const t of confirmedActions) {
    const title = t.recordSnapshot?.title || ''
    if (!title || title.length < 2) {
      emptyTitles++
    } else if (title.length > 60) {
      rawSentenceTitles++
    } else {
      goodTitles++
    }
  }

  if (emptyTitles > 0) {
    findings.push(createFinding(
      'warning', 'synapse_creation',
      `${emptyTitles} confirmed actions have empty/short titles — no synapse keywords`,
      `Synapses learn from action titles. Empty titles produce no learning.`,
      emptyTitles,
      'medium',
      createRecommendation('IMPROVE', 'Ensure all actions produce meaningful titles for synapse learning', 'src/lib/brain/actionBuilder.js', 'buildAction'),
    ))
  }

  if (rawSentenceTitles > 0) {
    findings.push(createFinding(
      'warning', 'title_quality',
      `${rawSentenceTitles} action titles are raw sentences (>60 chars)`,
      `Raw sentence titles create noisy synapses. Titles should be extracted keywords.`,
      rawSentenceTitles,
      'low',
    ))
  }

  // ── B. Family isolation check ────────────────────────
  // If multiple families were tested, check that family_id is always set
  const recordsWithFamily = confirmedActions.filter(t => t.recordSnapshot?.familyId || t.recordSnapshot?.family_id)
  const recordsWithoutFamily = confirmedActions.filter(t => !t.recordSnapshot?.familyId && !t.recordSnapshot?.family_id)

  if (recordsWithoutFamily.length > 0) {
    findings.push(createFinding(
      'bug', 'family_isolation',
      `${recordsWithoutFamily.length} records missing family_id — synapse contamination risk`,
      `Records without family_id could create cross-family synapses`,
      recordsWithoutFamily.length,
      'high',
      createRecommendation('REPAIR', 'Ensure all records include family_id', 'src/lib/brain/actionBuilder.js', 'buildAction'),
    ))
  }

  // ── C. Bootstrap integrity ──────────────────────────
  // Check that common intent keywords are correctly classified
  const bootstrapTests = [
    { word: 'dentista', expectedIntent: 'calendar' },
    { word: 'speso', expectedIntent: 'expense' },
    { word: 'comprare', expectedIntent: 'shopping' },
    { word: 'preparo', expectedIntent: 'meal' },
  ]

  let bootstrapHits = 0
  let bootstrapMisses = 0

  for (const test of bootstrapTests) {
    const matching = trajectories.filter(t =>
      t.text?.toLowerCase().includes(test.word) && t.actualIntent !== null
    )
    if (matching.length === 0) continue

    const correct = matching.filter(t => t.actualIntent === test.expectedIntent || t.intentCorrect)
    if (correct.length / matching.length < 0.6) {
      bootstrapMisses++
      findings.push(createFinding(
        'warning', 'bootstrap_integrity',
        `Bootstrap keyword "${test.word}" → ${test.expectedIntent} only ${(correct.length / matching.length * 100).toFixed(0)}% accurate`,
        `${correct.length}/${matching.length} phrases containing "${test.word}" mapped to "${test.expectedIntent}"`,
        matching.length - correct.length,
        'medium',
      ))
    } else {
      bootstrapHits++
    }
  }

  // ── Score calculation ───────────────────────────────
  const titleScore = potentialSynapses > 0 ? accuracy(goodTitles, potentialSynapses) : 100
  const isolationScore = confirmedActions.length > 0
    ? accuracy(recordsWithFamily.length, confirmedActions.length) : 100
  const bootstrapScore = (bootstrapHits + bootstrapMisses) > 0
    ? accuracy(bootstrapHits, bootstrapHits + bootstrapMisses) * 100 / 100 : 100

  const score = titleScore * 0.4 + isolationScore * 0.3 + bootstrapScore * 0.3

  return createProbeReport('synapses', score, findings, {
    potentialSynapses,
    goodTitles,
    rawSentenceTitles,
    emptyTitles,
    familyIsolation: isolationScore,
    bootstrapIntegrity: bootstrapScore,
  })
}
