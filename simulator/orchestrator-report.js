/**
 * orchestrator-report.js — Trajectory analysis & per-role views.
 *
 * Takes the raw trajectories from orchestrator.js and produces:
 *   1. Pipeline Accuracy (intent + table correctness)
 *   2. Record Quality Audit (missing fields, warnings per table)
 *   3. Per-Role Views (what each role sees, with counts)
 *   4. Per-Agent Trajectory Summary
 *   5. Problem Phrases (worst trajectories with full detail)
 *
 * @module simulator/orchestrator-report
 */

import { writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── HELPERS ───────────────────────────────────────────────────

function round(n, d = 4) { return Math.round(n * 10 ** d) / 10 ** d }
function safeDivide(a, b) { return b === 0 ? 0 : a / b }
function pct(r) { return `${(r * 100).toFixed(1)}%` }
function pad(s, w) { return s.padEnd(w) }

// ─── SECTION 1: PIPELINE ACCURACY ──────────────────────────────

function buildPipelineAccuracy(trajectories) {
  const total = trajectories.length
  const intentCorrect = trajectories.filter(t => t.intentCorrect).length
  const tableCorrect = trajectories.filter(t => t.tableCorrect).length
  const recordWritten = trajectories.filter(t => t.recordWritten).length
  const qualityValid = trajectories.filter(t => t.recordQuality?.valid).length

  // Phrases that should have been written (expected writable intent)
  const shouldWrite = trajectories.filter(t =>
    t.expectedTable !== null
  )
  const shouldWriteCount = shouldWrite.length
  const actuallyWritten = shouldWrite.filter(t => t.recordWritten).length
  const writeRate = round(safeDivide(actuallyWritten, shouldWriteCount))

  // Per-table breakdown
  const perTable = {}
  for (const t of trajectories) {
    const table = t.expectedTable || t.actualTable || 'none'
    if (!perTable[table]) {
      perTable[table] = { total: 0, intentCorrect: 0, written: 0, qualityValid: 0 }
    }
    perTable[table].total++
    if (t.intentCorrect) perTable[table].intentCorrect++
    if (t.recordWritten) perTable[table].written++
    if (t.recordQuality?.valid) perTable[table].qualityValid++
  }

  return {
    total,
    intentAccuracy: round(safeDivide(intentCorrect, total)),
    tableAccuracy: round(safeDivide(tableCorrect, total)),
    writeRate,
    qualityRate: round(safeDivide(qualityValid, recordWritten || 1)),
    perTable,
  }
}

// ─── SECTION 2: RECORD QUALITY AUDIT ───────────────────────────

function buildRecordQualityAudit(trajectories) {
  const written = trajectories.filter(t => t.recordWritten && t.recordSnapshot)

  // Aggregate quality issues per table
  const perTable = {}
  const allWarnings = []

  for (const t of written) {
    const table = t.actualTable || t.expectedTable || 'unknown'
    if (!perTable[table]) {
      perTable[table] = {
        total: 0,
        valid: 0,
        invalid: 0,
        missingRequiredCounts: {},
        missingRecommendedCounts: {},
        warningCounts: {},
      }
    }
    const pt = perTable[table]
    pt.total++

    const q = t.recordQuality
    if (q.valid) {
      pt.valid++
    } else {
      pt.invalid++
    }

    // Aggregate missing required fields
    for (const field of (q.missingRequired || [])) {
      pt.missingRequiredCounts[field] = (pt.missingRequiredCounts[field] || 0) + 1
    }

    // Aggregate missing recommended fields
    for (const field of (q.missingRecommended || [])) {
      pt.missingRecommendedCounts[field] = (pt.missingRecommendedCounts[field] || 0) + 1
    }

    // Aggregate warnings
    for (const w of (q.warnings || [])) {
      // Normalize warning for counting (strip variable parts)
      const normalized = w.replace(/"[^"]+"/g, '"..."').replace(/\d+ chars/g, 'N chars')
      pt.warningCounts[normalized] = (pt.warningCounts[normalized] || 0) + 1

      allWarnings.push({
        table,
        text: t.text.slice(0, 60),
        agent: t.agent,
        warning: w,
      })
    }
  }

  return {
    totalRecordsWritten: written.length,
    perTable,
    topWarnings: allWarnings.slice(0, 30),
  }
}

// ─── SECTION 3: PER-ROLE VIEWS ─────────────────────────────────

function buildRoleViews(trajectories) {
  const roles = {
    genitore: { label: 'Genitore (full access)', visible: [], hidden: [] },
    figlio: { label: 'Figlio (limited)', visible: [], hidden: [] },
    nonno: { label: 'Nonno (shared)', visible: [], hidden: [] },
  }

  const written = trajectories.filter(t => t.recordWritten)

  for (const t of written) {
    for (const role of ['genitore', 'figlio', 'nonno']) {
      if (t.roleVisibility?.[role]) {
        roles[role].visible.push({
          text: t.text.slice(0, 60),
          table: t.actualTable,
          agent: t.agent,
        })
      } else {
        roles[role].hidden.push({
          text: t.text.slice(0, 60),
          table: t.actualTable,
          agent: t.agent,
        })
      }
    }
  }

  // Summarize counts per table per role
  const summary = {}
  for (const role of ['genitore', 'figlio', 'nonno']) {
    const tableCounts = {}
    for (const item of roles[role].visible) {
      tableCounts[item.table] = (tableCounts[item.table] || 0) + 1
    }
    summary[role] = {
      label: roles[role].label,
      totalVisible: roles[role].visible.length,
      totalHidden: roles[role].hidden.length,
      perTable: tableCounts,
    }
  }

  return summary
}

// ─── SECTION 4: PER-AGENT TRAJECTORIES ─────────────────────────

function buildPerAgentSummary(trajectories) {
  const agents = {}

  for (const t of trajectories) {
    const name = t.agent
    if (!agents[name]) {
      agents[name] = {
        role: t.agentRole,
        total: 0,
        correct: 0,
        written: 0,
        qualityValid: 0,
        intents: {},
        tables: {},
        errors: [],
      }
    }
    const a = agents[name]
    a.total++
    if (t.intentCorrect) a.correct++
    if (t.recordWritten) a.written++
    if (t.recordQuality?.valid) a.qualityValid++

    // Track intent distribution
    const intent = t.expectedIntent
    a.intents[intent] = (a.intents[intent] || 0) + 1

    // Track table distribution
    if (t.recordWritten) {
      const table = t.actualTable || 'unknown'
      a.tables[table] = (a.tables[table] || 0) + 1
    }

    // Collect errors
    if (!t.intentCorrect && a.errors.length < 5) {
      a.errors.push({
        text: t.text.slice(0, 60),
        expected: t.expectedIntent,
        got: t.actualIntent,
        errorType: t.errorType,
      })
    }
  }

  // Add accuracy
  for (const a of Object.values(agents)) {
    a.accuracy = round(safeDivide(a.correct, a.total))
  }

  return agents
}

// ─── SECTION 5: PROBLEM PHRASES ────────────────────────────────

function buildProblemPhrases(trajectories) {
  const problems = []

  for (const t of trajectories) {
    const issues = []

    if (!t.intentCorrect) issues.push(`intent: expected ${t.expectedIntent}, got ${t.actualIntent}`)
    if (!t.tableCorrect && t.expectedTable) issues.push(`table: expected ${t.expectedTable}, got ${t.actualTable || 'none'}`)
    if (t.expectedTable && !t.recordWritten) issues.push('record not written')
    if (t.recordQuality?.missingRequired?.length > 0) {
      issues.push(`missing required: ${t.recordQuality.missingRequired.join(', ')}`)
    }
    if (t.recordQuality?.warnings?.length > 0) {
      issues.push(`quality warnings: ${t.recordQuality.warnings.length}`)
    }

    if (issues.length > 0) {
      problems.push({
        text: t.text,
        agent: t.agent,
        agentRole: t.agentRole,
        date: t.simulatedDate,
        expectedIntent: t.expectedIntent,
        actualIntent: t.actualIntent,
        confidence: t.confidence,
        expectedTable: t.expectedTable,
        actualTable: t.actualTable,
        recordWritten: t.recordWritten,
        issues,
        recordSnapshot: t.recordSnapshot,
        qualityWarnings: t.recordQuality?.warnings || [],
      })
    }
  }

  // Sort by number of issues (worst first)
  problems.sort((a, b) => b.issues.length - a.issues.length)

  return {
    totalProblems: problems.length,
    top30: problems.slice(0, 30),
  }
}

// ─── CONSOLE OUTPUT ────────────────────────────────────────────

function printOrchestratorReport(report) {
  const SEP = '═'.repeat(55)
  const sep = '─'.repeat(55)
  const lines = []

  lines.push('')
  lines.push(SEP)
  lines.push('  ORCHESTRATOR REPORT — Full Trajectory Analysis')
  lines.push(SEP)

  // Section 1: Pipeline Accuracy
  const s1 = report.pipelineAccuracy
  lines.push('')
  lines.push('▸ PIPELINE ACCURACY')
  lines.push(sep)
  lines.push(`  Total phrases:    ${s1.total}`)
  lines.push(`  Intent accuracy:  ${pct(s1.intentAccuracy)}`)
  lines.push(`  Table accuracy:   ${pct(s1.tableAccuracy)}`)
  lines.push(`  Write rate:       ${pct(s1.writeRate)} (of expected writable)`)
  lines.push(`  Quality rate:     ${pct(s1.qualityRate)} (valid records / written)`)
  lines.push('')
  lines.push('  Per table:')
  for (const [table, data] of Object.entries(s1.perTable)) {
    if (table === 'none') continue
    lines.push(`    ${pad(table + ':', 18)} ${data.written} written, ${data.qualityValid} valid, ${pct(safeDivide(data.intentCorrect, data.total))} intent accuracy`)
  }

  // Section 2: Record Quality
  const s2 = report.recordQualityAudit
  lines.push('')
  lines.push('▸ RECORD QUALITY AUDIT')
  lines.push(sep)
  lines.push(`  Total records written: ${s2.totalRecordsWritten}`)
  for (const [table, data] of Object.entries(s2.perTable)) {
    lines.push(`  ${pad(table + ':', 18)} ${data.valid}/${data.total} valid`)
    if (Object.keys(data.missingRequiredCounts).length > 0) {
      lines.push(`    Missing required:    ${Object.entries(data.missingRequiredCounts).map(([f, c]) => `${f}(${c})`).join(', ')}`)
    }
    if (Object.keys(data.missingRecommendedCounts).length > 0) {
      lines.push(`    Missing recommended: ${Object.entries(data.missingRecommendedCounts).map(([f, c]) => `${f}(${c})`).join(', ')}`)
    }
    const topWarnings = Object.entries(data.warningCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
    if (topWarnings.length > 0) {
      lines.push(`    Top warnings:        ${topWarnings.map(([w, c]) => `${w} (${c}x)`).join('; ')}`)
    }
  }

  // Section 3: Role Views
  const s3 = report.roleViews
  lines.push('')
  lines.push('▸ PER-ROLE VIEWS')
  lines.push(sep)
  for (const [role, data] of Object.entries(s3)) {
    lines.push(`  ${data.label}:`)
    lines.push(`    Visible: ${data.totalVisible} | Hidden: ${data.totalHidden}`)
    if (Object.keys(data.perTable).length > 0) {
      lines.push(`    Breakdown: ${Object.entries(data.perTable).map(([t, c]) => `${t}(${c})`).join(', ')}`)
    }
  }

  // Section 4: Per-Agent
  const s4 = report.perAgentSummary
  lines.push('')
  lines.push('▸ PER-AGENT SUMMARY')
  lines.push(sep)
  for (const [name, data] of Object.entries(s4)) {
    const acc = pct(data.accuracy)
    lines.push(`  ${pad(name, 14)} [${data.role}]: ${data.correct}/${data.total} (${acc}) | ${data.written} records | ${data.qualityValid} valid`)
    if (data.errors.length > 0) {
      lines.push(`    Errors: ${data.errors.map(e => `"${e.text.slice(0, 30)}..." ${e.expected}→${e.got}`).join(' | ')}`)
    }
  }

  // Section 5: Problem Phrases (top 10)
  const s5 = report.problemPhrases
  lines.push('')
  lines.push(`▸ PROBLEM PHRASES (${s5.totalProblems} total, showing top 10)`)
  lines.push(sep)
  for (const p of s5.top30.slice(0, 10)) {
    lines.push(`  "${p.text.slice(0, 55)}"`)
    lines.push(`    agent: ${p.agent} (${p.agentRole}) | ${p.expectedIntent}→${p.actualIntent} | conf: ${(p.confidence * 100).toFixed(0)}%`)
    lines.push(`    issues: ${p.issues.join('; ')}`)
    if (p.qualityWarnings.length > 0) {
      lines.push(`    quality: ${p.qualityWarnings.slice(0, 2).join('; ')}`)
    }
  }

  lines.push('')
  lines.push(SEP)
  lines.push('')

  console.log(lines.join('\n'))
}

// ─── MAIN EXPORT ───────────────────────────────────────────────

/**
 * Generate the full orchestrator report.
 *
 * @param {import('./orchestrator.js').PhraseTrajectory[]} trajectories
 * @param {Object[]} weeklyStats
 * @returns {Promise<Object>}
 */
export async function generateOrchestratorReport(trajectories, weeklyStats) {
  console.log(`[Orchestrator Report] Analyzing ${trajectories.length} trajectories...`)

  const pipelineAccuracy = buildPipelineAccuracy(trajectories)
  const recordQualityAudit = buildRecordQualityAudit(trajectories)
  const roleViews = buildRoleViews(trajectories)
  const perAgentSummary = buildPerAgentSummary(trajectories)
  const problemPhrases = buildProblemPhrases(trajectories)

  const report = {
    version: 1,
    type: 'orchestrator',
    generatedAt: new Date().toISOString(),
    totalTrajectories: trajectories.length,
    pipelineAccuracy,
    recordQualityAudit,
    roleViews,
    perAgentSummary,
    problemPhrases,
    weeklyStats,
  }

  // Print console summary
  printOrchestratorReport(report)

  // Save full JSON
  const outputPath = resolve(__dirname, 'orchestrator-output.json')
  try {
    await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8')
    console.log(`[Orchestrator Report] Full report saved to ${outputPath}`)
  } catch (err) {
    console.error(`[Orchestrator Report] Failed to save: ${err.message}`)
  }

  // Save trajectories separately (can be large)
  const trajPath = resolve(__dirname, 'trajectories.json')
  try {
    await writeFile(trajPath, JSON.stringify(trajectories, null, 2), 'utf-8')
    console.log(`[Orchestrator Report] Trajectories saved to ${trajPath}`)
  } catch (err) {
    console.error(`[Orchestrator Report] Failed to save trajectories: ${err.message}`)
  }

  return report
}
