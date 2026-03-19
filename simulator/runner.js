/**
 * runner.js — Family Life Simulator entry point.
 *
 * Orchestrates the full simulation pipeline:
 *   1. Parse CLI args
 *   2. Setup family + DB + NLP
 *   3. Run multi-week simulation
 *   4. Generate and save report
 *
 * Usage: node runner.js [--weeks=8] [--dry] [--start=2025-09-01]
 *
 * @module simulator/runner
 */

// ─── CLI ARG PARSING ────────────────────────────────────────────

/**
 * Parse command-line arguments from process.argv.
 * @returns {{ weeks: number, dryRun: boolean, startDate: string }}
 */
function parseCLIArgs() {
  const args = process.argv.slice(2);
  let weeks = 8;
  let dryRun = false;
  let startDate = '2025-09-01';

  for (const arg of args) {
    if (arg.startsWith('--weeks=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(val) && val > 0) weeks = val;
    } else if (arg === '--dry') {
      dryRun = true;
    } else if (arg.startsWith('--start=')) {
      const val = arg.split('=')[1];
      // Basic ISO date validation
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) startDate = val;
    }
  }

  return { weeks, dryRun, startDate };
}

// ─── MAIN ───────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  const { weeks, dryRun, startDate } = parseCLIArgs();

  // ── 1. Banner ─────────────────────────────────────────────────

  const SEP = '='.repeat(43);
  console.log('');
  console.log(SEP);
  console.log('  FAMMI QUESTO -- Family Life Simulator');
  console.log(`  Weeks: ${weeks} | Start: ${startDate}`);

  // ── 2. Setup (imports polyfills first) ────────────────────────

  const { setupSimulator } = await import('./setup.js');
  const { familyId, members, db } = await setupSimulator();

  // ── 3. Import agents ──────────────────────────────────────────

  const { AGENTS } = await import('./agents/index.js');

  console.log(`  Agents: ${AGENTS.length} | Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(SEP);
  console.log('');

  // ── 4. Import engine ──────────────────────────────────────────

  const { runSimulation } = await import('./engine/weekLoop.js');

  // ── 5. Run simulation ─────────────────────────────────────────

  console.log(`[Runner] Starting simulation: ${weeks} weeks from ${startDate}...`);

  const { allResults, weeklyStats, worldState } = await runSimulation(
    familyId,
    members,
    AGENTS,
    db,
    { weeks, startDate, dryRun },
  );

  console.log(`[Runner] Simulation finished. ${allResults.length} total phrases generated.`);

  // ── 6. Generate report ────────────────────────────────────────

  const { generateReport } = await import('./report.js');

  const report = await generateReport(allResults, weeklyStats, worldState, db, familyId);

  // ── 7. Done ───────────────────────────────────────────────────

  const elapsed = Date.now() - t0;
  console.log(`Simulation complete in ${elapsed}ms. Report saved to report-output.json`);

  process.exit(0);
}

// ─── ENTRY ──────────────────────────────────────────────────────

main().catch((err) => {
  console.error('[Runner] Fatal error:', err);
  process.exit(1);
});
