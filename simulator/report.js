/**
 * report.js — Family Life Simulator report generator.
 *
 * Analyzes all ScenarioTruth results from the simulation and produces
 * a 5-section structured report + top-5 actionable fixes.
 *
 * @module simulator/report
 */

import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── HELPERS ────────────────────────────────────────────────────

/**
 * Round a number to N decimal places.
 * @param {number} n
 * @param {number} [decimals=4]
 * @returns {number}
 */
function round(n, decimals = 4) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Safe division — returns 0 when denominator is 0.
 * @param {number} num
 * @param {number} den
 * @returns {number}
 */
function safeDivide(num, den) {
  return den === 0 ? 0 : num / den;
}

/**
 * Format a ratio as a percentage string, e.g. "83.7%".
 * @param {number} ratio  0-1
 * @returns {string}
 */
function pct(ratio) {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * Left-pad a string to a fixed width.
 * @param {string} s
 * @param {number} width
 * @returns {string}
 */
function pad(s, width) {
  return s.padEnd(width);
}

// ─── SECTION BUILDERS ───────────────────────────────────────────

/**
 * Section 1: Parser Correctness.
 * @param {import('./engine/dayLoop.js').ScenarioTruth[]} results
 * @returns {Object}
 */
function buildParserCorrectness(results) {
  const executed = results.filter((r) => r.executed);
  const total = executed.length;
  const correct = executed.filter((r) => r.correct).length;

  // Per-agent breakdown
  /** @type {Record<string, { total: number, correct: number, accuracy: number }>} */
  const perAgent = {};
  for (const r of executed) {
    const name = r.agentName ?? r.agent ?? 'unknown';
    if (!perAgent[name]) perAgent[name] = { total: 0, correct: 0, accuracy: 0 };
    perAgent[name].total++;
    if (r.correct) perAgent[name].correct++;
  }
  for (const k of Object.keys(perAgent)) {
    perAgent[k].accuracy = round(safeDivide(perAgent[k].correct, perAgent[k].total));
  }

  // Per-intent breakdown
  /** @type {Record<string, { total: number, correct: number, accuracy: number }>} */
  const perIntent = {};
  for (const r of executed) {
    const intent = r.expected?.intent ?? 'unknown';
    if (!perIntent[intent]) perIntent[intent] = { total: 0, correct: 0, accuracy: 0 };
    perIntent[intent].total++;
    if (r.correct) perIntent[intent].correct++;
  }
  for (const k of Object.keys(perIntent)) {
    perIntent[k].accuracy = round(safeDivide(perIntent[k].correct, perIntent[k].total));
  }

  // Per truth-confidence breakdown
  const perTruthConfidence = { high: { total: 0, correct: 0, accuracy: 0 }, medium: { total: 0, correct: 0, accuracy: 0 }, low: { total: 0, correct: 0, accuracy: 0 } };
  for (const r of executed) {
    const lvl = r.truthConfidence ?? 'medium';
    if (perTruthConfidence[lvl]) {
      perTruthConfidence[lvl].total++;
      if (r.correct) perTruthConfidence[lvl].correct++;
    }
  }
  for (const k of Object.keys(perTruthConfidence)) {
    perTruthConfidence[k].accuracy = round(safeDivide(perTruthConfidence[k].correct, perTruthConfidence[k].total));
  }

  // False positive rate: shouldWrite=false but wrote / total shouldWrite=false
  const noWriteTotal = executed.filter((r) => r.expected?.shouldWrite === false).length;
  const falsePositives = executed.filter(
    (r) => r.expected?.shouldWrite === false && r.executionResult?.shouldWrite === true,
  ).length;
  const falsePositiveRate = round(safeDivide(falsePositives, noWriteTotal));

  // False negative rate: shouldWrite=true but didn't write / total shouldWrite=true
  const yesWriteTotal = executed.filter((r) => r.expected?.shouldWrite === true).length;
  const falseNegatives = executed.filter(
    (r) => r.expected?.shouldWrite === true && r.executionResult?.shouldWrite === false,
  ).length;
  const falseNegativeRate = round(safeDivide(falseNegatives, yesWriteTotal));

  return {
    totalPhrases: total,
    correctParse: correct,
    accuracy: round(safeDivide(correct, total)),
    perAgent,
    perIntent,
    perTruthConfidence,
    falsePositiveRate,
    falseNegativeRate,
  };
}

/**
 * Section 2: Resolver Outcomes.
 * Focuses on edit_action phrases and their resolver performance.
 * @param {import('./engine/dayLoop.js').ScenarioTruth[]} results
 * @returns {Object}
 */
function buildResolverOutcomes(results) {
  const editActions = results.filter(
    (r) => r.expected?.intent === 'edit_action' || r.executionResult?.intent === 'edit_action',
  );
  const total = editActions.length;

  let resolved = 0;
  let ambiguous = 0;
  let notFound = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;
  let correctlyResolved = 0;

  for (const r of editActions) {
    const status = r.actual?.resolverStatus ?? r.executionResult?.resolverStatus ?? null;
    if (status === 'resolved') {
      resolved++;
      if (r.correct) correctlyResolved++;
    } else if (status === 'ambiguous') {
      ambiguous++;
    } else if (status === 'not_found') {
      notFound++;
    }

    const conf = r.actual?.confidence ?? r.executionResult?.confidence;
    if (typeof conf === 'number') {
      confidenceSum += conf;
      confidenceCount++;
    }
  }

  return {
    totalEditActions: total,
    resolved,
    ambiguous,
    notFound,
    avgConfidence: round(safeDivide(confidenceSum, confidenceCount)),
    correctionSuccessRate: round(safeDivide(correctlyResolved, total)),
  };
}

/**
 * Section 3: Error Causes.
 * @param {import('./engine/dayLoop.js').ScenarioTruth[]} results
 * @returns {Object}
 */
function buildErrorCauses(results) {
  const executed = results.filter((r) => r.executed);
  const errors = executed.filter((r) => !r.correct);

  // Breakdown by errorType
  const breakdown = { parse_error: 0, false_positive: 0, false_negative: 0, resolve_error: 0 };
  for (const r of errors) {
    const et = r.errorType ?? classifyError(r);
    if (breakdown[et] !== undefined) {
      breakdown[et]++;
    } else {
      // Fallback: count as parse_error
      breakdown.parse_error++;
    }
  }

  // Top 30 errors with detail
  const topErrors = errors
    .map((r) => ({
      text: r.rawText ?? r.text ?? '',
      agent: r.agentName ?? r.agent ?? 'unknown',
      expected: r.expected?.intent ?? 'unknown',
      got: r.executionResult?.intent ?? r.actual?.intent ?? 'none',
      confidence: r.executionResult?.confidence ?? r.actual?.confidence ?? null,
      errorType: r.errorType ?? classifyError(r),
      truthConfidence: r.truthConfidence ?? 'unknown',
    }))
  // Keep all errors for deep analysis (not just top 30)
  return { breakdown, topErrors: topErrors.slice(0, 30), allErrors: topErrors };
}

/**
 * Classify an error when errorType is not set.
 * @param {Object} r
 * @returns {string}
 */
function classifyError(r) {
  if (r.expected?.shouldWrite === false && r.executionResult?.shouldWrite === true) {
    return 'false_positive';
  }
  if (r.expected?.shouldWrite === true && r.executionResult?.shouldWrite === false) {
    return 'false_negative';
  }
  if (r.expected?.intent === 'edit_action') {
    return 'resolve_error';
  }
  return 'parse_error';
}

/**
 * Section 4: Cross-Agent Coherence.
 * Cross-agent phrases typically have truthConfidence === 'medium'.
 * A pair is coherent when both agents' phrases on the same simulatedDate are correct.
 * @param {import('./engine/dayLoop.js').ScenarioTruth[]} results
 * @returns {Object}
 */
function buildCrossAgentCoherence(results) {
  // Group executed results by simulatedDate
  const executed = results.filter((r) => r.executed);
  /** @type {Map<string, Object[]>} */
  const byDate = new Map();
  for (const r of executed) {
    const d = r.simulatedDate ?? 'unknown';
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(r);
  }

  let totalCrossAgent = 0;
  let coherent = 0;
  let incoherent = 0;

  for (const [, dayResults] of byDate) {
    // Find cross-agent pairs: results with truthConfidence 'medium' on the same date
    // but different agents
    const crossAgentResults = dayResults.filter((r) => r.truthConfidence === 'medium');
    if (crossAgentResults.length < 2) continue;

    // Group by agent, then pair agents together
    /** @type {Map<string, Object[]>} */
    const byAgent = new Map();
    for (const r of crossAgentResults) {
      const agent = r.agentName ?? r.agent ?? 'unknown';
      if (!byAgent.has(agent)) byAgent.set(agent, []);
      byAgent.get(agent).push(r);
    }

    const agentKeys = [...byAgent.keys()];
    for (let i = 0; i < agentKeys.length; i++) {
      for (let j = i + 1; j < agentKeys.length; j++) {
        const aResults = byAgent.get(agentKeys[i]);
        const bResults = byAgent.get(agentKeys[j]);

        // Each combination of phrases across two agents forms a pair
        for (const a of aResults) {
          for (const b of bResults) {
            totalCrossAgent++;
            if (a.correct && b.correct) {
              coherent++;
            } else {
              incoherent++;
            }
          }
        }
      }
    }
  }

  return {
    totalCrossAgent,
    coherent,
    incoherent,
    coherenceRate: round(safeDivide(coherent, totalCrossAgent)),
  };
}

/**
 * Section 5: Learning Curve.
 * @param {import('./engine/weekLoop.js').WeeklyStat[]} weeklyStats
 * @param {Object} db  Dexie database instance
 * @returns {Promise<Object>}
 */
async function buildLearningCurve(weeklyStats, db) {
  const weeklyAccuracy = weeklyStats.map((s) => ({
    week: s.week,
    accuracy: round(safeDivide(s.correct, s.total)),
  }));

  const firstWeekAccuracy = weeklyAccuracy.length > 0 ? weeklyAccuracy[0].accuracy : 0;
  const lastWeekAccuracy = weeklyAccuracy.length > 0 ? weeklyAccuracy[weeklyAccuracy.length - 1].accuracy : 0;
  const improvement = round(lastWeekAccuracy - firstWeekAccuracy);

  // Count synapses from patterns table
  let synapsesLearned = 0;
  let synapsesConfirmed = 0;
  try {
    const patterns = await db.patterns.toArray();
    synapsesLearned = patterns.length;
    synapsesConfirmed = patterns.filter((p) => (p.confirmCount ?? 0) >= 3).length;
  } catch {
    // patterns table may not exist yet
  }

  return {
    weeklyAccuracy,
    firstWeekAccuracy,
    lastWeekAccuracy,
    improvement,
    synapsesLearned,
    synapsesConfirmed,
  };
}

/**
 * Operational Ending: Top 5 Fixes.
 * Groups errors by pattern (same expected->actual intent pair) and ranks by frequency.
 * @param {{ topErrors: Object[] }} errorCauses
 * @param {import('./engine/dayLoop.js').ScenarioTruth[]} results
 * @returns {Object}
 */
function buildTop5Fixes(errorCauses, results) {
  const executed = results.filter((r) => r.executed && !r.correct);

  // Group by pattern: "expectedIntent -> actualIntent"
  /** @type {Map<string, { count: number, examples: string[], errorType: string }>} */
  const patternMap = new Map();

  for (const r of executed) {
    const expectedIntent = r.expected?.intent ?? 'unknown';
    const gotIntent = r.executionResult?.intent ?? r.actual?.intent ?? 'none';
    const errorType = r.errorType ?? classifyError(r);
    const key = `${expectedIntent}->${gotIntent}|${errorType}`;

    if (!patternMap.has(key)) {
      patternMap.set(key, { count: 0, examples: [], errorType });
    }
    const entry = patternMap.get(key);
    entry.count++;
    if (entry.examples.length < 3) {
      entry.examples.push(r.rawText ?? r.text ?? '');
    }
  }

  // Sort by frequency descending
  const sorted = [...patternMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  /** @type {{ problem: string, frequency: number, impact: string, effort: string }[]} */
  const fixes = sorted.map(([key, val]) => {
    const [intentPair, errorType] = key.split('|');
    const [from, to] = intentPair.split('->');
    const frequency = val.count;

    // Impact: high if > 10 occurrences, medium if > 3, low otherwise
    const impact = frequency > 10 ? 'high' : frequency > 3 ? 'medium' : 'low';

    // Effort estimate based on error type
    const effort = errorType === 'parse_error' ? 'medium'
      : errorType === 'resolve_error' ? 'high'
      : 'low';

    const exampleSnippet = val.examples[0]
      ? ` (e.g. "${val.examples[0].slice(0, 50)}")`
      : '';

    return {
      problem: `${from}->${to} confusion [${errorType}]${exampleSnippet}`,
      frequency,
      impact,
      effort,
    };
  });

  return { fixes };
}

// ─── CONSOLE OUTPUT ─────────────────────────────────────────────

/**
 * Print a formatted console summary of the full report.
 * @param {Object} report
 */
function printConsoleReport(report) {
  const SEP = '='.repeat(43);
  const lines = [];

  lines.push('');
  lines.push(SEP);
  lines.push('  FAMILY SIMULATOR REPORT -- v1');
  lines.push(SEP);

  // Summary
  const s1 = report.parserCorrectness;
  lines.push(`Phrases: ${s1.totalPhrases} | Correct: ${s1.correctParse} | Accuracy: ${pct(s1.accuracy)}`);
  lines.push(`False+: ${pct(s1.falsePositiveRate)} | False-: ${pct(s1.falseNegativeRate)}`);
  lines.push('');

  // Per Agent
  lines.push('--- PER AGENT:');
  for (const [name, data] of Object.entries(s1.perAgent)) {
    const label = pad(`  ${name}:`, 18);
    lines.push(`${label}${String(data.correct).padStart(4)}/${String(data.total).padStart(4)}  (${pct(data.accuracy)})`);
  }
  lines.push('');

  // Per Intent
  lines.push('--- PER INTENT:');
  const intentsSorted = Object.entries(s1.perIntent).sort((a, b) => b[1].total - a[1].total);
  for (const [intent, data] of intentsSorted) {
    const label = pad(`  ${intent}:`, 18);
    lines.push(`${label}${String(data.correct).padStart(4)}/${String(data.total).padStart(4)}  (${pct(data.accuracy)})`);
  }
  lines.push('');

  // Resolver
  const s2 = report.resolverOutcomes;
  lines.push('--- RESOLVER (edit_action):');
  lines.push(`  Total: ${s2.totalEditActions} | Resolved: ${s2.resolved} | Ambiguous: ${s2.ambiguous} | Not Found: ${s2.notFound}`);
  lines.push(`  Avg Confidence: ${pct(s2.avgConfidence)} | Correction Success: ${pct(s2.correctionSuccessRate)}`);
  lines.push('');

  // Error Causes
  const s3 = report.errorCauses;
  lines.push('--- ERROR CAUSES:');
  for (const [type, count] of Object.entries(s3.breakdown)) {
    lines.push(`  ${pad(type + ':', 20)}${count}`);
  }
  lines.push('');

  // Cross-Agent Coherence
  const s4 = report.crossAgentCoherence;
  lines.push('--- CROSS-AGENT COHERENCE:');
  lines.push(`  Pairs: ${s4.totalCrossAgent} | Coherent: ${s4.coherent} | Rate: ${pct(s4.coherenceRate)}`);
  lines.push('');

  // Learning Curve
  const s5 = report.learningCurve;
  lines.push('--- LEARNING CURVE:');
  lines.push(`  Week 1: ${pct(s5.firstWeekAccuracy)} -> Week ${s5.weeklyAccuracy.length}: ${pct(s5.lastWeekAccuracy)} (delta: ${s5.improvement > 0 ? '+' : ''}${pct(s5.improvement)})`);
  lines.push(`  Synapses learned: ${s5.synapsesLearned} | Confirmed (>=3): ${s5.synapsesConfirmed}`);
  lines.push('');

  // Top 5 Fixes
  const fixes = report.top5Fixes.fixes;
  lines.push('--- TOP 5 FIXES:');
  fixes.forEach((fix, i) => {
    lines.push(`  ${i + 1}. [freq: ${fix.frequency}] ${fix.problem}`);
    lines.push(`     impact: ${fix.impact} | effort: ${fix.effort}`);
  });

  lines.push(SEP);
  lines.push('');

  console.log(lines.join('\n'));
}

// ─── MAIN EXPORT ────────────────────────────────────────────────

/**
 * Generate the full simulation report.
 *
 * Produces a structured report object with 5 sections + top-5 fixes,
 * prints a formatted console summary, and saves JSON to report-output.json.
 *
 * @param {import('./engine/dayLoop.js').ScenarioTruth[]} allResults
 * @param {import('./engine/weekLoop.js').WeeklyStat[]}   weeklyStats
 * @param {import('./engine/worldState.js').WorldState}    worldState
 * @param {Object}   db        - Dexie database instance
 * @param {string}   familyId  - family identifier
 * @returns {Promise<Object>}  The full report object
 */
export async function generateReport(allResults, weeklyStats, worldState, db, familyId) {
  console.log('[Report] Analyzing simulation results...');

  // Build all sections
  const parserCorrectness  = buildParserCorrectness(allResults);
  const resolverOutcomes   = buildResolverOutcomes(allResults);
  const errorCauses        = buildErrorCauses(allResults);
  const crossAgentCoherence = buildCrossAgentCoherence(allResults);
  const learningCurve      = await buildLearningCurve(weeklyStats, db);
  const top5Fixes          = buildTop5Fixes(errorCauses, allResults);

  /** @type {Object} */
  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    familyId,
    totalDaysSimulated: weeklyStats.length * 7,
    parserCorrectness,
    resolverOutcomes,
    errorCauses,
    crossAgentCoherence,
    learningCurve,
    top5Fixes,
  };

  // Print console summary
  printConsoleReport(report);

  // Save full JSON report
  const outputPath = resolve(__dirname, 'report-output.json');
  try {
    await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`[Report] Full report saved to ${outputPath}`);
  } catch (err) {
    console.error(`[Report] Failed to save report: ${err.message}`);
  }

  return report;
}
