/**
 * Persistent memory for NeuroLoop.
 * Stores loop history, best scores, blacklisted patches, and regressions.
 * Saved as JSON to simulator/neuroloop/logs/memory.json.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MEMORY_PATH = resolve(__dirname, 'logs', 'memory.json')
const LOGS_DIR = resolve(__dirname, 'logs')

function createEmptyMemory() {
  return {
    version: 1,
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    runConfig: null,
    loops: [],
    bestScores: {},
    blacklist: [],
    regressions: [],
    evolution: {
      overallTrend: [],
      improving: false,
      plateauReached: false,
      estimatedCeiling: null,
    },
  }
}

export function loadMemory() {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true })
  }
  if (!existsSync(MEMORY_PATH)) {
    const empty = createEmptyMemory()
    writeFileSync(MEMORY_PATH, JSON.stringify(empty, null, 2))
    return empty
  }
  try {
    return JSON.parse(readFileSync(MEMORY_PATH, 'utf-8'))
  } catch {
    return createEmptyMemory()
  }
}

export function saveMemory(memory) {
  memory.lastUpdated = new Date().toISOString()
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true })
  }
  writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2))
}

export function saveLoopLog(loopId, loopData) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const logPath = resolve(LOGS_DIR, `loop-${loopId}-${ts}.json`)
  writeFileSync(logPath, JSON.stringify(loopData, null, 2))
  return logPath
}

export function updateBestScores(memory, loopId, scores) {
  for (const [probe, score] of Object.entries(scores)) {
    if (!memory.bestScores[probe] || score > memory.bestScores[probe].value) {
      memory.bestScores[probe] = {
        value: score,
        loopId,
        date: new Date().toISOString(),
      }
    }
  }
}

export function isBlacklisted(memory, patchType, target) {
  return memory.blacklist.some(
    b => b.type === patchType && b.target === target
  )
}

export function addToBlacklist(memory, patch, reason, loopId) {
  memory.blacklist.push({
    patchId: patch.id,
    type: patch.type,
    target: patch.target,
    reason,
    loopId,
    date: new Date().toISOString(),
  })
}

export function hasRegressionHistory(memory, targetArea) {
  return memory.regressions.some(r => r.probeAffected === targetArea)
}

export function recordRegression(memory, patch, loopApplied, loopDetected, scoreBefore, scoreAfter, probe) {
  memory.regressions.push({
    patchId: patch.id,
    loopApplied,
    loopDetected,
    scoreBefore,
    scoreAfter,
    probeAffected: probe,
    autoRolledBack: true,
  })
  // If same area regresses 2+ times, blacklist
  const areaRegressions = memory.regressions.filter(r => r.probeAffected === probe)
  if (areaRegressions.length >= 2) {
    addToBlacklist(memory, patch, `Area "${probe}" regressed ${areaRegressions.length} times`, loopDetected)
  }
}

export function updateEvolution(memory) {
  const trends = memory.loops.map(l => l.scores?.overall ?? 0)
  memory.evolution.overallTrend = trends

  // Per-probe trends
  const probeNames = ['parser', 'notifications', 'synapses', 'memory', 'dbQuality', 'logistics', 'flow', 'destination']
  for (const probe of probeNames) {
    memory.evolution[probe + 'Trend'] = memory.loops.map(l => l.scores?.[probe] ?? 0)
  }

  // Is improving? Compare last 2 loops
  if (trends.length >= 2) {
    memory.evolution.improving = trends[trends.length - 1] > trends[trends.length - 2]
  }

  // Plateau? Last 3 loops within 1% of each other
  if (trends.length >= 3) {
    const last3 = trends.slice(-3)
    const range = Math.max(...last3) - Math.min(...last3)
    memory.evolution.plateauReached = range < 1.0
  }

  // Estimated ceiling: simple linear projection
  if (trends.length >= 2) {
    const deltas = []
    for (let i = 1; i < trends.length; i++) {
      deltas.push(trends[i] - trends[i - 1])
    }
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length
    const current = trends[trends.length - 1]
    // Project 5 more loops, cap at 100
    memory.evolution.estimatedCeiling = Math.min(100, Math.round((current + avgDelta * 5) * 10) / 10)
  }
}
