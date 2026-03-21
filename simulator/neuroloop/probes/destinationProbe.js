/**
 * Probe 8: Destination routing + compound landing + incomplete alerts.
 * Checks: records land in correct tab, compound pieces all arrive,
 * incomplete records have proper alerts, commit level matches completeness.
 */

import { createProbeReport, createFinding, createRecommendation, accuracy } from './probeBase.js'

export function runDestinationProbe(trajectories) {
  const findings = []
  const written = trajectories.filter(t => t.recordWritten)

  // ── A. Routing accuracy ──────────────────────────────
  const withExpectedTable = trajectories.filter(t => t.expectedTable && t.actualTable)
  const routingCorrect = withExpectedTable.filter(t => t.tableCorrect).length
  const routingAcc = accuracy(routingCorrect, withExpectedTable.length)

  if (withExpectedTable.length > 5 && routingAcc < 80) {
    findings.push(createFinding(
      'bug', 'routing',
      `Tab routing accuracy ${routingAcc.toFixed(1)}%`,
      `${withExpectedTable.length - routingCorrect} records landed in wrong table`,
      withExpectedTable.length - routingCorrect,
      'high',
      createRecommendation('REPAIR', 'Check intent-to-table mapping', 'src/lib/brain/intentClassifier.js', 'parseLocally'),
    ))
  }

  // ── B. Compound landing ──────────────────────────────
  const compounds = trajectories.filter(t => t.isCompound)
  let compoundFullLanding = 0
  let compoundPiecesLost = 0
  let compoundTotal = 0

  for (const c of compounds) {
    compoundTotal++
    if (c.expectedActionCount === c.actualActionCount) {
      compoundFullLanding++
    } else {
      compoundPiecesLost += Math.abs(c.expectedActionCount - c.actualActionCount)
    }
  }

  if (compoundTotal > 0) {
    const landingRate = accuracy(compoundFullLanding, compoundTotal)
    if (landingRate < 80) {
      findings.push(createFinding(
        'bug', 'compound_landing',
        `Compound landing rate ${landingRate.toFixed(1)}% — pieces lost`,
        `${compoundPiecesLost} action pieces lost across ${compoundTotal} compound phrases`,
        compoundPiecesLost,
        'high',
        createRecommendation('REPAIR', 'Check sentence splitting and multi-action generation', 'src/lib/brain/textUtils.js', 'splitSentences'),
      ))
    }
  }

  // ── C. Incomplete alerts ─────────────────────────────
  let alertPresent = 0
  let alertMissing = 0

  for (const t of written) {
    const r = t.recordSnapshot
    if (!r) continue

    // Check if record SHOULD have an incomplete alert
    const needsAlert = (
      (t.actualTable === 'events' && !r.date) ||
      (t.actualTable === 'events' && !r.timeStart) ||
      (t.actualTable === 'expenses' && (!r.amount || r.amount <= 0)) ||
      (t.actualTable === 'tasks' && !r.assignedToId)
    )

    if (needsAlert) {
      if (r.incomplete || (r.warnings && r.warnings.length > 0)) {
        alertPresent++
      } else {
        alertMissing++
      }
    }
  }

  if (alertMissing > 0) {
    findings.push(createFinding(
      'bug', 'missing_alert',
      `${alertMissing} incomplete records have NO alert/warning`,
      `Records with missing critical fields should have incomplete message or warnings`,
      alertMissing,
      'high',
      createRecommendation('REPAIR', 'Ensure buildAction sets incomplete/warnings for missing fields', 'src/lib/brain/actionBuilder.js', 'buildAction'),
    ))
  }

  // ── D. Commit level coherence ────────────────────────
  let commitCoherent = 0
  let commitIncoherent = 0

  for (const t of written) {
    const r = t.recordSnapshot
    const hasIncomplete = r?.incomplete
    const commitLevel = t.commitLevel

    // commitEvaluator now downgrades strong→light for incomplete actions.
    // Check the record's own commit level if available (more accurate for compound phrases).
    const recordCommit = r?.commit?.level
    const effectiveLevel = recordCommit || commitLevel

    if (hasIncomplete && effectiveLevel === 'strong') {
      commitIncoherent++
    } else {
      commitCoherent++
    }
  }

  if (commitIncoherent > 0) {
    findings.push(createFinding(
      'warning', 'commit_coherence',
      `${commitIncoherent} records: incomplete but commit "strong"`,
      `Incomplete records should be "draft" or "light", not "strong" — may be simulation artifact`,
      commitIncoherent,
      'medium',
    ))
  }

  // ── Score ──────────────────────────────────────────
  const alertScore = (alertPresent + alertMissing) > 0 ? accuracy(alertPresent, alertPresent + alertMissing) : 100
  const compoundLandingScore = compoundTotal > 0 ? accuracy(compoundFullLanding, compoundTotal) : 100
  const commitScore = (commitCoherent + commitIncoherent) > 0 ? accuracy(commitCoherent, commitCoherent + commitIncoherent) : 100

  const score = routingAcc * 0.3 + compoundLandingScore * 0.25 + alertScore * 0.25 + commitScore * 0.2

  return createProbeReport('destination', score, findings, {
    routingAccuracy: routingAcc,
    compoundLandingRate: compoundTotal > 0 ? accuracy(compoundFullLanding, compoundTotal) : null,
    compoundPiecesLost,
    incompleteAlertRate: (alertPresent + alertMissing) > 0 ? accuracy(alertPresent, alertPresent + alertMissing) : null,
    missingAlerts: alertMissing,
    commitCoherence: commitScore,
  })
}
