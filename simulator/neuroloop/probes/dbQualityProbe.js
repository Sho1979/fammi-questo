/**
 * Probe 5: DB record quality analysis.
 * Validates required/recommended fields, value correctness,
 * title quality, and cross-record coherence.
 * Extends the validateRecordQuality logic already in orchestrator.js.
 */

import { createProbeReport, createFinding, createRecommendation, accuracy, groupBy } from './probeBase.js'

const REQUIRED_FIELDS = {
  events: ['id', 'family_id', 'type', 'date'],
  tasks: ['id', 'family_id', 'type'],
  expenses: ['id', 'family_id', 'type', 'amount'],
  shoppingItems: ['id', 'family_id', 'type'],
  mealPlans: ['id', 'family_id', 'type'],
}

export function runDbQualityProbe(trajectories) {
  const findings = []
  const written = trajectories.filter(t => t.recordWritten && t.recordSnapshot)

  let validRecords = 0
  let invalidRecords = 0
  const missingFieldCounts = {}
  const warningCounts = {}

  for (const t of written) {
    const record = t.recordSnapshot
    const table = t.actualTable
    const required = REQUIRED_FIELDS[table] || []

    let isValid = true
    for (const field of required) {
      const val = record[field] ?? record[field.replace('family_id', 'familyId')]
      if (val === undefined || val === null || val === '') {
        isValid = false
        const key = `${table}.${field}`
        missingFieldCounts[key] = (missingFieldCounts[key] || 0) + 1
      }
    }

    // Check for string "undefined"/"null" in person fields
    for (const field of ['assignedToId', 'assignedToName', 'personId']) {
      if (record[field] === 'undefined' || record[field] === 'null') {
        const key = `string_${field}`
        warningCounts[key] = (warningCounts[key] || 0) + 1
      }
    }

    // Title quality
    if (record.title) {
      if (record.title.length > 80) {
        warningCounts['title_too_long'] = (warningCounts['title_too_long'] || 0) + 1
      } else if (record.title.length < 2) {
        warningCounts['title_too_short'] = (warningCounts['title_too_short'] || 0) + 1
      }
    }

    // Amount validation for expenses
    if (table === 'expenses') {
      if (typeof record.amount !== 'number' || record.amount <= 0) {
        warningCounts['invalid_amount'] = (warningCounts['invalid_amount'] || 0) + 1
      }
    }

    if (isValid) validRecords++
    else invalidRecords++
  }

  // Generate findings for missing required fields
  for (const [key, count] of Object.entries(missingFieldCounts)) {
    if (count >= 2) {
      findings.push(createFinding(
        'bug', 'missing_required_field',
        `${key} missing in ${count} records`,
        `Required field not populated — records are structurally invalid`,
        count,
        'high',
        createRecommendation('REPAIR', `Ensure ${key} is always set`, 'src/lib/brain/actionBuilder.js', 'buildAction'),
      ))
    }
  }

  // Generate findings for warnings
  for (const [key, count] of Object.entries(warningCounts)) {
    if (count >= 2) {
      findings.push(createFinding(
        'warning', 'record_quality',
        `${key}: ${count} occurrences`,
        `Quality issue detected in DB records`,
        count,
        'medium',
      ))
    }
  }

  // Commit level coherence
  // Note: commitEvaluator now downgrades strong→light when action.incomplete is set.
  // Residual mismatches may occur in simulation when trajectory commitLevel (from actions[0])
  // doesn't correspond to the actual recordSnapshot (e.g. compound phrases where the record
  // comes from a different action than actions[0]).
  const commitMismatch = written.filter(t => {
    const hasIncomplete = t.recordSnapshot?.incomplete
    const commitLevel = t.commitLevel
    // Only flag as mismatch if the record's own commit level is strong
    // (actions[0].commit may not match the record for compound phrases)
    const recordCommit = t.recordSnapshot?.commit?.level
    if (recordCommit && recordCommit !== 'strong') return false
    return hasIncomplete && commitLevel === 'strong'
  })

  if (commitMismatch.length > 0) {
    findings.push(createFinding(
      'warning', 'commit_coherence',
      `${commitMismatch.length} incomplete records with commit level "strong"`,
      `Records with missing fields should not be committed as "strong" — may be simulation artifact for compound phrases`,
      commitMismatch.length,
      'medium',
    ))
  }

  const score = written.length > 0 ? accuracy(validRecords, written.length) : 100

  return createProbeReport('dbQuality', score, findings, {
    totalWritten: written.length,
    validRecords,
    invalidRecords,
    missingFieldCounts,
    warningCounts,
    commitMismatches: commitMismatch.length,
  })
}
