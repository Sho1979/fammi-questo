/**
 * NeuralCore — coordinates 8 probes, aggregates scores,
 * compares with previous loop, produces recommendations.
 */

import { runParserProbe } from './probes/parserProbe.js'
import { runNotificationProbe } from './probes/notificationProbe.js'
import { runSynapseProbe } from './probes/synapseProbe.js'
import { runMemoryProbe } from './probes/memoryProbe.js'
import { runDbQualityProbe } from './probes/dbQualityProbe.js'
import { runLogisticsProbe } from './probes/logisticsProbe.js'
import { runFlowProbe } from './probes/flowProbe.js'
import { runDestinationProbe } from './probes/destinationProbe.js'
import { gradeFromScore } from './probes/probeBase.js'

/**
 * Run all 8 probes and produce aggregated analysis.
 *
 * @param {Object[]} trajectories - from orchestrator
 * @param {Object} context - { families, members, loopIndex, previousScores }
 * @returns {Object} NeuralCore report
 */
export function analyze(trajectories, context = {}) {
  const { families = [], members = [], loopIndex = 0, previousScores = null } = context

  // Run all probes
  const probeResults = {
    parser: runParserProbe(trajectories, { families }),
    notifications: runNotificationProbe(trajectories, members),
    synapses: runSynapseProbe(trajectories, { families }),
    memory: runMemoryProbe(trajectories),
    dbQuality: runDbQualityProbe(trajectories),
    logistics: runLogisticsProbe(trajectories, members),
    flow: runFlowProbe(trajectories),
    destination: runDestinationProbe(trajectories),
  }

  // Extract scores
  const probeScores = {}
  for (const [name, result] of Object.entries(probeResults)) {
    probeScores[name] = result.score
  }

  // Overall score (unweighted mean)
  const scoreValues = Object.values(probeScores)
  const overallScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length

  // Delta vs previous loop
  const delta = {}
  if (previousScores) {
    for (const [name, score] of Object.entries(probeScores)) {
      delta[name] = Math.round((score - (previousScores[name] || 0)) * 10) / 10
    }
    delta.overall = Math.round((overallScore - (previousScores.overall || 0)) * 10) / 10
  }

  // Collect all findings, sorted by severity then occurrences
  const severityOrder = { bug: 0, warning: 1, suggestion: 2 }
  const allFindings = []
  for (const [probeName, result] of Object.entries(probeResults)) {
    for (const finding of result.findings) {
      allFindings.push({ ...finding, probe: probeName })
    }
  }
  allFindings.sort((a, b) => {
    const sevDiff = (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
    if (sevDiff !== 0) return sevDiff
    return (b.occurrences || 0) - (a.occurrences || 0)
  })

  // Extract recommendations (only from findings that have them)
  const recommendations = allFindings
    .filter(f => f.recommendation)
    .map((f, i) => ({
      ...f.recommendation,
      priority: i + 1,
      sourceFinding: f.title,
      sourceProbe: f.probe,
    }))

  return {
    loopId: loopIndex,
    overallScore: Math.round(overallScore * 10) / 10,
    overallGrade: gradeFromScore(overallScore),
    probeScores,
    probeGrades: Object.fromEntries(
      Object.entries(probeScores).map(([k, v]) => [k, gradeFromScore(v)])
    ),
    delta,
    probeResults,
    topFindings: allFindings.slice(0, 20),
    recommendations: recommendations.slice(0, 10),
    summary: {
      totalPhrases: trajectories.length,
      bugs: allFindings.filter(f => f.severity === 'bug').length,
      warnings: allFindings.filter(f => f.severity === 'warning').length,
      suggestions: allFindings.filter(f => f.severity === 'suggestion').length,
    },
  }
}
