/**
 * Probe 4: Conversation memory (draft lifecycle) analysis.
 * In simulator context, drafts are not exercised because phrases are sent
 * as complete utterances. This probe analyzes:
 * - Incomplete records (proxy for "would need a draft")
 * - Records with missing fields that a followup could complete
 * - Correction patterns in the text
 */

import { createProbeReport, createFinding, createRecommendation, accuracy } from './probeBase.js'

export function runMemoryProbe(trajectories, context = {}) {
  const findings = []

  const written = trajectories.filter(t => t.recordWritten && t.recordSnapshot)

  // ── A. Incomplete records that could benefit from drafts ──
  const incompleteRecords = written.filter(t => {
    const r = t.recordSnapshot
    return r?.incomplete || (r?.warnings && r.warnings.length > 0)
  })

  const incompleteRate = written.length > 0
    ? (incompleteRecords.length / written.length) * 100 : 0

  if (incompleteRate > 30) {
    findings.push(createFinding(
      'warning', 'incomplete_records',
      `${incompleteRate.toFixed(1)}% of records are incomplete — conversation drafts could help`,
      `${incompleteRecords.length}/${written.length} records have missing fields. Multi-turn drafts would allow users to complete them.`,
      incompleteRecords.length,
      'medium',
      createRecommendation('IMPROVE', 'High incomplete rate suggests draft auto-prompt could help', 'src/lib/brain/conversationMemory.js', 'shouldAutoCommit'),
    ))
  }

  // ── B. Records missing specific fields ──────────────
  const missingDate = written.filter(t => t.actualTable === 'events' && !t.recordSnapshot?.date).length
  const missingTime = written.filter(t => t.actualTable === 'events' && !t.recordSnapshot?.timeStart).length
  const missingAmount = written.filter(t => t.actualTable === 'expenses' && (!t.recordSnapshot?.amount || t.recordSnapshot.amount <= 0)).length
  const missingAssignee = written.filter(t => t.actualTable === 'tasks' && !t.recordSnapshot?.assignedToId).length

  const fieldMissing = { date: missingDate, time: missingTime, amount: missingAmount, assignee: missingAssignee }
  for (const [field, count] of Object.entries(fieldMissing)) {
    if (count >= 3) {
      findings.push(createFinding(
        'warning', 'missing_field',
        `${count} records missing "${field}" — draft followup target`,
        `These records would be candidates for "what ${field}?" followup prompts`,
        count,
        'low',
      ))
    }
  }

  // ── C. Correction patterns in text ──────────────────
  const correctionPatterns = /\b(no[,.]?\s+(volevo|intendevo)\s+dire|anzi|cioe|scusa|correggo)\b/i
  const correctionsFound = trajectories.filter(t => correctionPatterns.test(t.text || ''))

  if (correctionsFound.length > 0) {
    findings.push(createFinding(
      'suggestion', 'correction_patterns',
      `${correctionsFound.length} phrases contain correction patterns`,
      `Phrases like "no, volevo dire..." test the draft correction mechanism`,
      correctionsFound.length,
      'low',
    ))
  }

  // ── Score calculation ───────────────────────────────
  // Lower incomplete rate = better (but some incompleteness is expected)
  const completenessScore = Math.max(0, 100 - incompleteRate * 0.8)
  // Fewer missing critical fields = better
  const totalMissing = missingDate + missingAmount
  const fieldScore = written.length > 0 ? accuracy(written.length - totalMissing, written.length) : 100

  const score = completenessScore * 0.6 + fieldScore * 0.4

  return createProbeReport('memory', score, findings, {
    totalWritten: written.length,
    incompleteRecords: incompleteRecords.length,
    incompleteRate,
    missingFields: fieldMissing,
    correctionPatternsFound: correctionsFound.length,
  })
}
