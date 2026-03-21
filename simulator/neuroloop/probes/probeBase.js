/**
 * Shared utilities for all NeuroLoop probes.
 * Provides grade calculation, finding builders, and score normalization.
 */

export function gradeFromScore(score) {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

export function createFinding(severity, area, title, detail, occurrences, impact, recommendation = null) {
  return {
    severity,  // 'bug' | 'warning' | 'suggestion'
    area,
    title,
    detail,
    occurrences,
    impact,    // 'high' | 'medium' | 'low'
    recommendation,
  }
}

export function createRecommendation(type, description, targetFile, targetFunction) {
  return {
    type,  // 'REPAIR' | 'IMPROVE'
    description,
    targetFile,
    targetFunction,
  }
}

export function createProbeReport(system, score, findings, metrics) {
  return {
    system,
    score: Math.round(score * 10) / 10,
    grade: gradeFromScore(score),
    findings,
    metrics,
  }
}

/**
 * Calculate accuracy as percentage from correct/total.
 * Returns 100 if total is 0 (no data = no errors).
 */
export function accuracy(correct, total) {
  if (total === 0) return 100
  return (correct / total) * 100
}

/**
 * Group items by a key function. Returns Map<key, items[]>.
 */
export function groupBy(items, keyFn) {
  const map = new Map()
  for (const item of items) {
    const key = keyFn(item)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }
  return map
}
