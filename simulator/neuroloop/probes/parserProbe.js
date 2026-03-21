/**
 * Probe 1: Parser accuracy analysis.
 * Analyzes intent classification, entity extraction, compound phrases,
 * confidence calibration, and cross-family variance.
 */

import { createProbeReport, createFinding, createRecommendation, accuracy, groupBy } from './probeBase.js'

/**
 * Run parser probe on trajectory data.
 *
 * @param {Object[]} trajectories - PhraseTrajectory[] from orchestrator
 * @param {Object} context - { families: [{familyId, surname}], loopIndex }
 * @returns {Object} ProbeReport
 */
export function runParserProbe(trajectories, context = {}) {
  const findings = []
  const executed = trajectories.filter(t => t.actualIntent !== null)

  // ── Intent accuracy ──────────────────────────────────
  const intentCorrect = executed.filter(t => t.intentCorrect).length
  const intentAcc = accuracy(intentCorrect, executed.length)

  // Per-intent breakdown
  const byIntent = groupBy(executed, t => t.expectedIntent)
  const intentBreakdown = {}
  for (const [intent, items] of byIntent) {
    const correct = items.filter(t => t.intentCorrect).length
    intentBreakdown[intent] = {
      total: items.length,
      correct,
      accuracy: accuracy(correct, items.length),
    }
  }

  // Find intents with < 70% accuracy
  for (const [intent, data] of Object.entries(intentBreakdown)) {
    if (data.total >= 3 && data.accuracy < 70) {
      findings.push(createFinding(
        'bug', 'intent_classification',
        `Intent "${intent}" accuracy below 70%`,
        `${data.correct}/${data.total} correct (${data.accuracy.toFixed(1)}%)`,
        data.total - data.correct,
        data.accuracy < 50 ? 'high' : 'medium',
        createRecommendation('REPAIR', `Investigate misclassification of "${intent}" phrases`, 'src/lib/brain/intentClassifier.js', 'parseLocally'),
      ))
    }
  }

  // ── Per-agent breakdown ──────────────────────────────
  const byAgent = groupBy(executed, t => t.agent)
  const agentBreakdown = {}
  for (const [agent, items] of byAgent) {
    const correct = items.filter(t => t.intentCorrect).length
    agentBreakdown[agent] = {
      total: items.length,
      correct,
      accuracy: accuracy(correct, items.length),
    }
  }

  // ── Compound phrase accuracy ─────────────────────────
  const compounds = executed.filter(t => t.isCompound)
  const compoundCountMatch = compounds.filter(t => t.expectedActionCount === t.actualActionCount).length
  const compoundTypesMatch = compounds.filter(t => {
    const exp = [...(t.expectedActionTypes || [])].sort().join(',')
    const act = [...(t.actualActionTypes || [])].sort().join(',')
    return exp === act
  }).length

  if (compounds.length > 0) {
    const compoundAcc = accuracy(compoundCountMatch, compounds.length)
    if (compoundAcc < 80) {
      findings.push(createFinding(
        'warning', 'compound_parsing',
        `Compound count match only ${compoundAcc.toFixed(1)}%`,
        `${compoundCountMatch}/${compounds.length} phrases produced the expected number of actions`,
        compounds.length - compoundCountMatch,
        'medium',
      ))
    }
  }

  // ── Confidence calibration ──────────────────────────
  // High confidence (>0.8) should be mostly correct
  const highConf = executed.filter(t => (t.confidence ?? 0) > 0.8)
  if (highConf.length > 0) {
    const highConfCorrect = highConf.filter(t => t.intentCorrect).length
    const highConfAcc = accuracy(highConfCorrect, highConf.length)
    if (highConfAcc < 85) {
      findings.push(createFinding(
        'warning', 'confidence_calibration',
        `High-confidence phrases only ${highConfAcc.toFixed(1)}% correct`,
        `${highConfCorrect}/${highConf.length} phrases with confidence > 0.8 were correct`,
        highConf.length - highConfCorrect,
        'medium',
        createRecommendation('IMPROVE', 'Confidence scores are not well calibrated', 'src/lib/brain/intentClassifier.js', 'parseLocally'),
      ))
    }
  }

  // ── Cross-family variance ───────────────────────────
  if (context.families?.length > 1) {
    const byFamily = groupBy(executed, t => t.familyId || 'unknown')
    const familyAccuracies = []
    for (const [fId, items] of byFamily) {
      const correct = items.filter(t => t.intentCorrect).length
      familyAccuracies.push(accuracy(correct, items.length))
    }
    if (familyAccuracies.length >= 2) {
      const maxAcc = Math.max(...familyAccuracies)
      const minAcc = Math.min(...familyAccuracies)
      const variance = maxAcc - minAcc
      if (variance > 15) {
        findings.push(createFinding(
          'bug', 'cross_family_variance',
          `Cross-family accuracy variance: ${variance.toFixed(1)}%`,
          `Best family: ${maxAcc.toFixed(1)}%, Worst: ${minAcc.toFixed(1)}%. Parser may depend on specific names.`,
          1,
          'high',
          createRecommendation('REPAIR', 'Check for name-dependent logic in parser', 'src/lib/brain/entityExtractor.js', 'extractPersons'),
        ))
      }
    }
  }

  // ── Confusion matrix: top misclassifications ────────
  const errors = executed.filter(t => !t.intentCorrect)
  const confusionPairs = groupBy(errors, t => `${t.expectedIntent}→${t.actualIntent}`)
  const sortedPairs = [...confusionPairs.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)

  for (const [pair, items] of sortedPairs) {
    if (items.length >= 2) {
      const [expected, actual] = pair.split('→')
      findings.push(createFinding(
        items.length >= 5 ? 'bug' : 'warning',
        'confusion_pattern',
        `${expected} → ${actual} confusion (${items.length}x)`,
        `Example: "${items[0].text?.slice(0, 60)}..."`,
        items.length,
        items.length >= 5 ? 'high' : 'medium',
        createRecommendation('REPAIR', `Add rules to distinguish "${expected}" from "${actual}"`, 'src/lib/brain/intentClassifier.js', 'parseLocally'),
      ))
    }
  }

  // ── Score calculation ───────────────────────────────
  // Weighted: intent accuracy 60%, compound 20%, confidence calibration 10%, cross-family 10%
  const compoundScore = compounds.length > 0 ? accuracy(compoundTypesMatch, compounds.length) : 100
  const confCalibScore = highConf.length > 0 ? accuracy(highConf.filter(t => t.intentCorrect).length, highConf.length) : 100
  const score = intentAcc * 0.6 + compoundScore * 0.2 + confCalibScore * 0.1 + (100 - (context._crossFamilyVariance || 0)) * 0.1

  return createProbeReport('parser', Math.min(100, score), findings, {
    intentAccuracy: intentAcc,
    intentBreakdown,
    agentBreakdown,
    compoundSplitRate: compounds.length > 0 ? accuracy(compoundCountMatch, compounds.length) : null,
    compoundTypesMatchRate: compounds.length > 0 ? accuracy(compoundTypesMatch, compounds.length) : null,
    confusionTopPairs: sortedPairs.map(([pair, items]) => ({ pair, count: items.length })),
  })
}
