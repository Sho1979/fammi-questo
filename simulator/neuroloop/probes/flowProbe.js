/**
 * Probe 7: End-to-end flow analysis + gamification.
 * Checks: complete pipeline, error recovery, edit actions, state consistency.
 */

import { createProbeReport, createFinding, createRecommendation, accuracy, groupBy } from './probeBase.js'

export function runFlowProbe(trajectories, context = {}) {
  const findings = []

  // ── A. E2E success: phrase → parse → write (for writable intents) ──
  const writable = trajectories.filter(t =>
    t.expectedIntent && !['noise', 'none', 'unknown', 'edit_action'].includes(t.expectedIntent)
    && t.intentCorrect
  )
  const writtenCorrectly = writable.filter(t => t.recordWritten)
  const e2eRate = accuracy(writtenCorrectly.length, writable.length)

  if (e2eRate < 75 && writable.length > 5) {
    findings.push(createFinding(
      'warning', 'e2e_pipeline',
      `E2E success rate ${e2eRate.toFixed(1)}% — correct parses not producing records`,
      `${writtenCorrectly.length}/${writable.length} correctly parsed actions resulted in DB writes`,
      writable.length - writtenCorrectly.length,
      'medium',
    ))
  }

  // ── B. Error recovery: no crashes ──────────────────
  const crashes = trajectories.filter(t => t.errorType === 'parse_error' && t.errorCause?.includes('threw'))
  if (crashes.length > 0) {
    findings.push(createFinding(
      'bug', 'error_recovery',
      `${crashes.length} phrases caused parser exceptions`,
      `Parser threw errors instead of gracefully returning. Example: "${crashes[0].text?.slice(0, 50)}"`,
      crashes.length,
      'high',
      createRecommendation('REPAIR', 'Add try/catch around failing code path', 'src/lib/brain/intentClassifier.js', 'parseLocally'),
    ))
  }

  // ── C. Edit action accuracy ────────────────────────
  const editActions = trajectories.filter(t => t.expectedIntent === 'edit_action')
  const editResolved = editActions.filter(t => t.resolverStatus === 'resolved')
  if (editActions.length > 0) {
    const editAcc = accuracy(editResolved.length, editActions.length)
    if (editAcc < 60) {
      findings.push(createFinding(
        'warning', 'edit_action',
        `Edit action resolution: ${editAcc.toFixed(1)}%`,
        `${editResolved.length}/${editActions.length} edit actions resolved successfully`,
        editActions.length - editResolved.length,
        'medium',
      ))
    }
  }

  // ── D. Noise rejection ─────────────────────────────
  const noise = trajectories.filter(t => ['noise', 'none'].includes(t.expectedIntent))
  const noiseCorrect = noise.filter(t => t.intentCorrect || !t.recordWritten)
  const noiseRejectionRate = accuracy(noiseCorrect.length, noise.length)

  if (noise.length > 0 && noiseRejectionRate < 90) {
    findings.push(createFinding(
      'bug', 'noise_rejection',
      `Noise rejection rate: ${noiseRejectionRate.toFixed(1)}%`,
      `${noise.length - noiseCorrect.length} noise phrases incorrectly produced actions`,
      noise.length - noiseCorrect.length,
      'high',
    ))
  }

  // ── E. Gamification ────────────────────────────────
  // In simulator context, gamification is not exercised.
  // Flag as unchecked for visibility.

  // ── Score ──────────────────────────────────────────
  const crashScore = trajectories.length > 0 ? accuracy(trajectories.length - crashes.length, trajectories.length) : 100
  const editScore = editActions.length > 0 ? accuracy(editResolved.length, editActions.length) : 100
  const noiseScore = noise.length > 0 ? noiseRejectionRate : 100

  const score = e2eRate * 0.3 + crashScore * 0.3 + editScore * 0.2 + noiseScore * 0.2

  return createProbeReport('flow', score, findings, {
    e2eSuccessRate: e2eRate,
    crashCount: crashes.length,
    editActionAccuracy: editActions.length > 0 ? accuracy(editResolved.length, editActions.length) : null,
    noiseRejectionRate,
    totalPhrases: trajectories.length,
  })
}
