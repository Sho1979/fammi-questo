/**
 * NeuroLoop entry point.
 * Runs N iterations of: Generate → Execute → Analyze → Patch
 * with persistent memory and live console output.
 *
 * Usage: node simulator/neuroloop.js [--iterations=5] [--families=2] [--weeks=4]
 *        [--mutation=progressive] [--target=90] [--no-patch] [--verbose]
 */

import { loadMemory, saveMemory, saveLoopLog, updateBestScores, updateEvolution } from './neuroloop/loopMemory.js'
import { generateFamilies } from './neuroloop/familyFactory.js'
import { mutateAgentTemplates, mutationLevelForLoop } from './neuroloop/templateMutator.js'
import { analyze } from './neuroloop/neuralCore.js'
import { runPatchPipeline } from './neuroloop/patchEngine.js'
import { AGENTS } from './agents/index.js'
import { setupSimulator } from './setup.js'
import { runOrchestrated } from './orchestrator.js'

// ── CLI PARSING ─────────────────────────────────────────

function parseCLI() {
  const args = process.argv.slice(2)
  const config = {
    iterations: 5,
    families: 2,
    weeks: 4,
    mutation: 'progressive',
    target: null,
    noPatch: false,
    verbose: false,
  }

  for (const arg of args) {
    if (arg.startsWith('--iterations=')) config.iterations = parseInt(arg.split('=')[1]) || 5
    else if (arg.startsWith('--families=')) config.families = parseInt(arg.split('=')[1]) || 2
    else if (arg.startsWith('--weeks=')) config.weeks = parseInt(arg.split('=')[1]) || 4
    else if (arg.startsWith('--mutation=')) config.mutation = arg.split('=')[1]
    else if (arg.startsWith('--target=')) config.target = parseFloat(arg.split('=')[1])
    else if (arg === '--no-patch') config.noPatch = true
    else if (arg === '--verbose') config.verbose = true
  }

  return config
}

// ── CONSOLE OUTPUT ──────────────────────────────────────

function printHeader(config) {
  const line = '='.repeat(56)
  console.log(`+${line}+`)
  console.log(`|  NEUROLOOP -- Centro Neurale Iterativo                  |`)
  console.log(`|  Iterations: ${String(config.iterations).padEnd(3)} | Families: ${String(config.families).padEnd(3)} | Weeks: ${String(config.weeks).padEnd(3)}    |`)
  console.log(`+${line}+`)
  console.log()
}

function printLoopResult(loopIndex, totalLoops, report) {
  const line = '-'.repeat(56)
  console.log(`+${line}+`)
  console.log(`|  Loop ${loopIndex + 1}/${totalLoops}    Overall: ${report.overallScore.toFixed(1)}% ${report.overallGrade}`.padEnd(57) + '|')
  console.log(`+${line}+`)

  // Probe scores
  for (const [probe, score] of Object.entries(report.probeScores)) {
    const delta = report.delta[probe]
    const deltaStr = delta !== undefined ? (delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)) : '    '
    const grade = report.probeGrades[probe]
    console.log(`|  ${probe.padEnd(16)} ${score.toFixed(1).padStart(6)}%  ${grade}   ${deltaStr.padStart(6)}`.padEnd(57) + '|')
  }

  console.log(`+${line}+`)
  console.log(`|  BUG: ${report.summary.bugs}  |  WARN: ${report.summary.warnings}  |  SUGGEST: ${report.summary.suggestions}`.padEnd(57) + '|')
  console.log(`+${line}+`)
  console.log()
}

function printFinalSummary(memory, config) {
  const loops = memory.loops
  if (loops.length < 2) return

  const first = loops[0]
  const last = loops[loops.length - 1]
  const line = '='.repeat(56)

  console.log(`+${line}+`)
  console.log(`|  NEUROLOOP -- RIEPILOGO FINALE (${loops.length} iterazioni)`.padEnd(57) + '|')
  console.log(`+${line}+`)

  const probes = ['parser', 'notifications', 'synapses', 'memory', 'dbQuality', 'logistics', 'flow', 'destination']
  for (const probe of probes) {
    const firstScore = first.scores?.[probe] ?? 0
    const lastScore = last.scores?.[probe] ?? 0
    const delta = lastScore - firstScore
    const arrow = delta > 0 ? '^' : delta < 0 ? 'v' : '='
    console.log(`|  ${probe.padEnd(16)} ${firstScore.toFixed(1).padStart(6)}% -> ${lastScore.toFixed(1).padStart(6)}%  ${(delta >= 0 ? '+' : '') + delta.toFixed(1).padStart(5)} ${arrow}`.padEnd(57) + '|')
  }

  const firstOverall = first.scores?.overall ?? 0
  const lastOverall = last.scores?.overall ?? 0
  console.log(`+${line}+`)
  console.log(`|  OVERALL          ${firstOverall.toFixed(1).padStart(6)}% -> ${lastOverall.toFixed(1).padStart(6)}%  ${((lastOverall - firstOverall) >= 0 ? '+' : '') + (lastOverall - firstOverall).toFixed(1).padStart(5)}`.padEnd(57) + '|')

  if (memory.evolution.estimatedCeiling) {
    console.log(`|  Ceiling stimato: ~${memory.evolution.estimatedCeiling}%`.padEnd(57) + '|')
  }
  console.log(`|  Status: ${memory.evolution.improving ? 'IMPROVING ^' : memory.evolution.plateauReached ? 'PLATEAU =' : 'MIXED'}`.padEnd(57) + '|')
  console.log(`+${line}+`)
}

// ── MAIN LOOP ───────────────────────────────────────────

async function main() {
  const config = parseCLI()
  const t0 = Date.now()

  printHeader(config)

  // Load persistent memory
  const memory = loadMemory()
  memory.runConfig = config

  // Setup base simulator (for DB + NLP)
  console.log('[NeuroLoop] Setting up base simulator...')
  const { familyId: baseFamilyId, members: baseMembers, db } = await setupSimulator()

  let previousScores = null
  if (memory.loops.length > 0) {
    previousScores = memory.loops[memory.loops.length - 1].scores
  }

  for (let i = 0; i < config.iterations; i++) {
    const loopStart = Date.now()
    const loopIndex = memory.loops.length

    console.log(`\n[NeuroLoop] === Loop ${i + 1}/${config.iterations} ===`)

    // ── 1. GENERATE ──────────────────────────────────
    const mutLevel = mutationLevelForLoop(i, config.mutation)
    console.log(`[NeuroLoop] Generating ${config.families} families (mutation: ${mutLevel})...`)

    const families = generateFamilies(config.families, AGENTS)
    const allTrajectories = []

    // ── 2. EXECUTE (per family) ─────────────────────
    for (const family of families) {
      console.log(`[NeuroLoop] Running family ${family.surname} (${family.members.length} members)...`)

      // Write family members to DB
      for (const member of family.members) {
        try {
          await db.members.put({
            ...member,
            family_id: family.familyId,
            birth_date: `${2025 - member.age}-01-01`,
            icon: '\u{1F464}',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        } catch { /* member may already exist */ }
      }

      // Mutate agent templates
      const mutatedAgents = family.agents.map(agent => ({
        ...agent,
        phraseTemplates: mutateAgentTemplates(agent, mutLevel),
      }))

      // Run orchestrator
      try {
        const { trajectories } = await runOrchestrated(
          family.familyId,
          family.members,
          mutatedAgents,
          db,
          { weeks: config.weeks, startDate: '2025-09-01' },
        )

        // Tag trajectories with family info
        for (const t of trajectories) {
          t.familyId = family.familyId
          t.familySurname = family.surname
        }

        allTrajectories.push(...trajectories)
      } catch (err) {
        console.error(`[NeuroLoop] Family ${family.surname} failed: ${err.message}`)
      }

      // Clean up family records
      try {
        await db.members.where('family_id').equals(family.familyId).delete()
      } catch { /* ignore */ }
    }

    console.log(`[NeuroLoop] ${allTrajectories.length} trajectories captured`)

    // ── 3. ANALYZE ──────────────────────────────────
    console.log('[NeuroLoop] Analyzing with NeuralCore...')
    const allMembers = families.flatMap(f => f.members)
    const report = analyze(allTrajectories, {
      families,
      members: allMembers,
      loopIndex,
      previousScores,
    })

    // ── 4. PATCH ────────────────────────────────────
    let patchResults = []
    if (!config.noPatch) {
      console.log('[NeuroLoop] Running PatchEngine...')
      patchResults = runPatchPipeline(report.topFindings, memory, loopIndex)
      for (const p of patchResults) {
        console.log(`  ${p.status === 'suggestion_validated' ? 'V' : 'X'} ${p.description || p.target}: ${p.status} ${p.reason ? '(' + p.reason + ')' : ''}`)
      }
    }

    // ── SAVE ────────────────────────────────────────
    const loopData = {
      id: loopIndex,
      loopIndex: i,
      timestamp: new Date().toISOString(),
      duration: `${((Date.now() - loopStart) / 1000).toFixed(1)}s`,
      families: families.map(f => ({ name: f.surname, composition: 'dynamic', members: f.members.length })),
      phrases: {
        generated: allTrajectories.length,
        executed: allTrajectories.filter(t => t.actualIntent !== null).length,
        errors: allTrajectories.filter(t => t.errorType !== null).length,
      },
      scores: { overall: report.overallScore, ...report.probeScores },
      delta: report.delta,
      findings: {
        bugs: report.summary.bugs,
        warnings: report.summary.warnings,
        suggestions: report.summary.suggestions,
        top: report.topFindings.slice(0, 10),
      },
      patches: patchResults,
    }

    memory.loops.push(loopData)
    updateBestScores(memory, loopIndex, loopData.scores)
    updateEvolution(memory)
    saveMemory(memory)
    saveLoopLog(loopIndex, { ...loopData, allFindings: report.topFindings, trajectoryCount: allTrajectories.length })

    // Print loop result
    printLoopResult(i, config.iterations, report)

    previousScores = loopData.scores

    // Check target
    if (config.target && report.overallScore >= config.target) {
      console.log(`\n[NeuroLoop] Target ${config.target}% reached! Stopping.`)
      break
    }
  }

  // Final summary
  printFinalSummary(memory, config)

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n[NeuroLoop] Complete in ${elapsed}s. Memory saved to neuroloop/logs/memory.json`)
}

main().catch(err => {
  console.error('[NeuroLoop] Fatal error:', err)
  process.exit(1)
})
