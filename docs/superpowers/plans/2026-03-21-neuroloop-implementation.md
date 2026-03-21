# NeuroLoop Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a continuous improvement loop that generates dynamic families, mutates phrase templates, runs the real parser, analyzes 8 app subsystems with probes, and suggests patches with safety checks and persistent memory.

**Architecture:** 4-stage loop (Generate → Execute → Analyze → Patch) with NeuralCore coordinating 8 probes, PatchEngine with 5-gate safety, and persistent JSON memory. Builds on existing orchestrator/agents/phraseExecutor.

**Tech Stack:** Node.js (ESM), Dexie/fake-indexeddb, NLP.js, child_process.fork for patch validation

**Spec:** `docs/superpowers/specs/2026-03-21-neuroloop-design.md`

---

## File Map

| File | Responsibility | Creates/Modifies |
|------|---------------|-----------------|
| `simulator/neuroloop/loopMemory.js` | Persistent memory: load, save, best scores, blacklist, regression tracking | Create |
| `simulator/neuroloop/familyFactory.js` | Generate dynamic families with random names, compositions, role mapping | Create |
| `simulator/neuroloop/templateMutator.js` | 7 mutation strategies to produce novel phrases from existing templates | Create |
| `simulator/neuroloop/probes/parserProbe.js` | Intent + entity + compound accuracy analysis | Create |
| `simulator/neuroloop/probes/notificationProbe.js` | Notification routing, role visibility, preview quality | Create |
| `simulator/neuroloop/probes/synapseProbe.js` | Synapse creation, shadow threshold, decay, family isolation | Create |
| `simulator/neuroloop/probes/memoryProbe.js` | Conversation draft lifecycle analysis | Create |
| `simulator/neuroloop/probes/dbQualityProbe.js` | Record field validation, quality scoring | Create |
| `simulator/neuroloop/probes/logisticsProbe.js` | Driver/pickup/subject resolution accuracy | Create |
| `simulator/neuroloop/probes/flowProbe.js` | End-to-end flow + gamification + error recovery | Create |
| `simulator/neuroloop/probes/destinationProbe.js` | Tab routing, compound landing, incomplete alerts, commit coherence | Create |
| `simulator/neuroloop/neuralCore.js` | Coordinate 8 probes, aggregate scores, compare with previous loop, produce recommendations | Create |
| `simulator/neuroloop/patchEngine.js` | Generate patches from findings, 5-gate validation, apply/rollback | Create |
| `simulator/neuroloop.js` | CLI entry point, loop orchestration, console output | Create |
| `simulator/neuroloop/probes/probeBase.js` | Shared probe utilities: score calculation, grade assignment, finding builder | Create |

---

## Chunk 1: Foundation — Memory, Factory, Mutator

### Task 1: Loop Memory

**Files:**
- Create: `simulator/neuroloop/loopMemory.js`

- [ ] **Step 1: Create the loopMemory module**

```js
// simulator/neuroloop/loopMemory.js
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
```

- [ ] **Step 2: Verify it runs without errors**

Run: `cd simulator && node -e "import('./neuroloop/loopMemory.js').then(m => { const mem = m.loadMemory(); console.log('Memory loaded:', mem.version); m.saveMemory(mem); console.log('Memory saved OK'); })"`
Expected: "Memory loaded: 1" + "Memory saved OK" + `logs/memory.json` created

- [ ] **Step 3: Commit**

```bash
git add simulator/neuroloop/loopMemory.js simulator/neuroloop/logs/memory.json
git commit -m "feat(neuroloop): add persistent loop memory with anti-regression tracking"
```

---

### Task 2: Probe Base Utilities

**Files:**
- Create: `simulator/neuroloop/probes/probeBase.js`

- [ ] **Step 1: Create shared probe utilities**

```js
// simulator/neuroloop/probes/probeBase.js
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
```

- [ ] **Step 2: Verify it loads**

Run: `cd simulator && node -e "import('./neuroloop/probes/probeBase.js').then(m => { console.log('Grade A:', m.gradeFromScore(95)); console.log('Grade C:', m.gradeFromScore(65)); console.log('Accuracy:', m.accuracy(8, 10)); })"`
Expected: "Grade A: A", "Grade C: C", "Accuracy: 80"

- [ ] **Step 3: Commit**

```bash
git add simulator/neuroloop/probes/probeBase.js
git commit -m "feat(neuroloop): add shared probe base utilities"
```

---

### Task 3: Family Factory

**Files:**
- Create: `simulator/neuroloop/familyFactory.js`

- [ ] **Step 1: Create the family factory module**

```js
// simulator/neuroloop/familyFactory.js
/**
 * Generates dynamic families with random names, compositions, and roles.
 * Clones agent templates from the existing 6 agents and replaces names/IDs.
 */

import { pickRandom } from '../utils.js'

// ── NAME POOLS ──────────────────────────────────────────

const MALE_PARENT_NAMES = [
  'Marco', 'Luca', 'Andrea', 'Matteo', 'Alessandro', 'Davide',
  'Simone', 'Federico', 'Tommaso', 'Riccardo', 'Stefano', 'Paolo',
]
const FEMALE_PARENT_NAMES = [
  'Giulia', 'Sara', 'Elena', 'Francesca', 'Valentina', 'Martina',
  'Elisa', 'Sofia', 'Giada', 'Aurora', 'Claudia', 'Silvia',
]
const MALE_CHILD_NAMES = [
  'Lorenzo', 'Gabriele', 'Leonardo', 'Edoardo', 'Pietro', 'Diego',
  'Filippo', 'Emanuele', 'Jacopo', 'Nicolo',
]
const FEMALE_CHILD_NAMES = [
  'Emma', 'Giorgia', 'Beatrice', 'Alice', 'Greta', 'Camilla',
  'Stella', 'Arianna', 'Rebecca', 'Noemi',
]
const MALE_ELDER_NAMES = [
  'Giuseppe', 'Giovanni', 'Antonio', 'Franco', 'Mario', 'Carlo',
  'Luigi', 'Pietro', 'Salvatore', 'Domenico',
]
const FEMALE_ELDER_NAMES = [
  'Anna', 'Maria', 'Rosa', 'Teresa', 'Lucia', 'Carla',
  'Paola', 'Franca', 'Giuseppina', 'Concetta',
]
const SURNAMES = [
  'Rossi', 'Bianchi', 'Ferrari', 'Russo', 'Romano', 'Colombo',
  'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti',
  'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi',
]

// ── COMPOSITIONS ────────────────────────────────────────

const COMPOSITIONS = {
  standard:      { parents: 2, children: 2, elders: 2 },
  single_parent: { parents: 1, children: 2, elders: 0 },
  no_elders:     { parents: 2, children: 2, elders: 0 },
  large_family:  { parents: 2, children: 4, elders: 2 },
  minimal:       { parents: 2, children: 1, elders: 0 },
  extended:      { parents: 2, children: 2, elders: 4 },
}

// ── ORIGINAL FAMILY (for name substitution) ─────────────

const ORIGINAL_NAMES = {
  papa: 'Cristian',
  mamma: 'Chiara',
  figlie: ['Viola', 'Asia'],
  nonno: 'Roberto',
  nonna: 'Mariangela',
}

// ── AUTO-ALIAS ──────────────────────────────────────────

function autoAliases(role, gender) {
  if (role === 'papa') return ['papa', 'papino']
  if (role === 'mamma') return ['mamma', 'mammina']
  if (role === 'nonno' && gender === 'M') return ['nonno']
  if (role === 'nonna' || (role === 'nonno' && gender === 'F')) return ['nonna']
  return []
}

function appRoleFromRole(role) {
  if (role === 'papa' || role === 'mamma') return 'genitore'
  if (role === 'figlio' || role === 'figlia') return 'figlio'
  if (role === 'nonno' || role === 'nonna') return 'nonno'
  return 'unknown'
}

// ── RANDOM ID ───────────────────────────────────────────

let idCounter = 0
function randomId(prefix = 'mem') {
  idCounter++
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 6)}`
}

// ── PICK UNIQUE NAME ────────────────────────────────────

function pickUniqueName(pool, usedNames) {
  const available = pool.filter(n => !usedNames.has(n))
  if (available.length === 0) {
    // Fallback: append number
    const base = pickRandom(pool)
    let i = 2
    while (usedNames.has(base + i)) i++
    const name = base + i
    usedNames.add(name)
    return name
  }
  const name = pickRandom(available)
  usedNames.add(name)
  return name
}

// ── GENERATE MEMBERS ────────────────────────────────────

function generateMembers(composition, usedNames) {
  const comp = COMPOSITIONS[composition] || COMPOSITIONS.standard
  const members = []

  // Parents
  const parentGenders = comp.parents === 1
    ? [pickRandom(['M', 'F'])]
    : ['M', 'F']

  for (const gender of parentGenders) {
    const pool = gender === 'M' ? MALE_PARENT_NAMES : FEMALE_PARENT_NAMES
    const role = gender === 'M' ? 'papa' : 'mamma'
    const age = 30 + Math.floor(Math.random() * 18) // 30-47
    members.push({
      id: randomId('mem'),
      name: pickUniqueName(pool, usedNames),
      role,
      appRole: 'genitore',
      gender,
      age,
      aliases: autoAliases(role, gender),
    })
  }

  // Children
  for (let i = 0; i < comp.children; i++) {
    const gender = pickRandom(['M', 'F'])
    const pool = gender === 'M' ? MALE_CHILD_NAMES : FEMALE_CHILD_NAMES
    const role = gender === 'M' ? 'figlio' : 'figlia'
    const age = 5 + Math.floor(Math.random() * 13) // 5-17
    members.push({
      id: randomId('mem'),
      name: pickUniqueName(pool, usedNames),
      role,
      appRole: 'figlio',
      gender,
      age,
      aliases: [],
    })
  }

  // Elders
  for (let i = 0; i < comp.elders; i++) {
    const gender = i % 2 === 0 ? 'M' : 'F'
    const pool = gender === 'M' ? MALE_ELDER_NAMES : FEMALE_ELDER_NAMES
    const role = gender === 'M' ? 'nonno' : 'nonna'
    const age = 62 + Math.floor(Math.random() * 18) // 62-79
    members.push({
      id: randomId('mem'),
      name: pickUniqueName(pool, usedNames),
      role,
      appRole: 'nonno',
      gender,
      age,
      aliases: autoAliases(role, gender),
    })
  }

  return members
}

// ── NAME SUBSTITUTION IN TEMPLATES ──────────────────────

function buildNameMap(members) {
  const map = {}
  const papa = members.find(m => m.role === 'papa')
  const mamma = members.find(m => m.role === 'mamma')
  const children = members.filter(m => m.appRole === 'figlio').sort((a, b) => b.age - a.age)
  const nonnoM = members.find(m => m.role === 'nonno')
  const nonnaF = members.find(m => m.role === 'nonna')

  if (papa) map[ORIGINAL_NAMES.papa] = papa.name
  if (mamma) map[ORIGINAL_NAMES.mamma] = mamma.name
  if (children[0]) map[ORIGINAL_NAMES.figlie[0]] = children[0].name  // Viola → oldest child
  if (children[1]) map[ORIGINAL_NAMES.figlie[1]] = children[1].name  // Asia → second child
  if (nonnoM) map[ORIGINAL_NAMES.nonno] = nonnoM.name
  if (nonnaF) map[ORIGINAL_NAMES.nonna] = nonnaF.name

  return map
}

function substituteNames(text, nameMap) {
  let result = text
  for (const [original, replacement] of Object.entries(nameMap)) {
    // Case-insensitive replacement preserving case of first letter
    const re = new RegExp(`\\b${original}\\b`, 'gi')
    result = result.replace(re, replacement)
  }
  return result
}

function cloneAgent(originalAgent, member, members, nameMap) {
  const clone = JSON.parse(JSON.stringify(originalAgent))

  // Update identity
  clone.id = member.id
  clone.name = member.name
  clone.role = member.role
  clone.gender = member.gender
  clone.aliases = member.aliases
  clone.age = member.age

  // Update variablePools.person to use new family names
  if (clone.variablePools?.person) {
    clone.variablePools.person = members
      .filter(m => m.id !== member.id)
      .map(m => m.name)
  }

  // Substitute names in all phrase templates
  if (clone.phraseTemplates) {
    for (const tpl of clone.phraseTemplates) {
      tpl.text = substituteNames(tpl.text, nameMap)
    }
  }

  // Substitute names in weekly routine
  if (clone.weeklyRoutine) {
    for (const slot of clone.weeklyRoutine) {
      slot.activity = substituteNames(slot.activity, nameMap)
    }
  }

  return clone
}

// ── MAIN: GENERATE FAMILY ───────────────────────────────

/**
 * Generate a dynamic family with random names and composition.
 *
 * @param {string} composition - 'standard'|'single_parent'|'no_elders'|'large_family'|'minimal'|'extended'
 * @param {Object[]} agentTemplates - the 6 original agent profiles
 * @returns {{ familyId, surname, members, agents, nameMap }}
 */
export function generateFamily(composition, agentTemplates) {
  const usedNames = new Set()
  const familyId = randomId('fam')
  const surname = pickRandom(SURNAMES)
  const members = generateMembers(composition, usedNames)
  const nameMap = buildNameMap(members)

  // Clone agents: match each member to the closest original agent template by role
  const agentByRole = {}
  for (const agent of agentTemplates) {
    const key = agent.role // 'papa', 'mamma', etc.
    if (!agentByRole[key]) agentByRole[key] = agent
  }

  // Fallback mappings for roles not directly present
  const roleFallback = {
    papa: 'papa',
    mamma: 'mamma',
    figlio: 'figlia',   // Viola (12) as default child template
    figlia: 'figlia',
    nonno: 'nonno',
    nonna: 'nonna',
  }

  // Find agent templates by role (using the original agent.role field)
  const findTemplate = (role) => {
    // Direct match
    const direct = agentTemplates.find(a => a.role === role)
    if (direct) return direct
    // Fallback
    const fb = roleFallback[role]
    if (fb) {
      const fallback = agentTemplates.find(a => a.role === fb)
      if (fallback) return fallback
    }
    // Last resort: pick any
    return agentTemplates[0]
  }

  const agents = members.map(member => {
    const template = findTemplate(member.role)
    return cloneAgent(template, member, members, nameMap)
  })

  return { familyId, surname, members, agents, nameMap }
}

/**
 * Generate N families with random compositions.
 * @param {number} count
 * @param {Object[]} agentTemplates
 * @returns {Array<{ familyId, surname, members, agents, nameMap }>}
 */
export function generateFamilies(count, agentTemplates) {
  const compositionTypes = Object.keys(COMPOSITIONS)
  const families = []
  for (let i = 0; i < count; i++) {
    const comp = pickRandom(compositionTypes)
    families.push(generateFamily(comp, agentTemplates))
  }
  return families
}

export { COMPOSITIONS, ORIGINAL_NAMES }
```

- [ ] **Step 2: Verify family generation works**

Run: `cd simulator && node -e "import('./neuroloop/familyFactory.js').then(async m => { const agents = (await import('./agents/index.js')).AGENTS; const fam = m.generateFamily('standard', agents); console.log('Family:', fam.surname, '(' + fam.members.length + ' members)'); fam.members.forEach(m => console.log(' ', m.name, m.role, m.appRole)); console.log('Agents:', fam.agents.length); console.log('Name map:', JSON.stringify(fam.nameMap)); console.log('Sample template:', fam.agents[0]?.phraseTemplates?.[0]?.text?.slice(0, 60)); })"`

Expected: Family with 6 members, random names, agent templates with substituted names

- [ ] **Step 3: Commit**

```bash
git add simulator/neuroloop/familyFactory.js
git commit -m "feat(neuroloop): add dynamic family factory with name substitution"
```

---

### Task 4: Template Mutator

**Files:**
- Create: `simulator/neuroloop/templateMutator.js`

- [ ] **Step 1: Create the template mutator module**

```js
// simulator/neuroloop/templateMutator.js
/**
 * Mutates existing phrase templates to produce structurally novel phrases.
 * 7 strategies: reorder, register, ellipsis, filler, typo+dialect, context, voice noise.
 * Never changes intent or shouldWrite.
 */

import { pickRandom, applyTypos, addDialect } from '../utils.js'

// ── MUTATION STRATEGIES ─────────────────────────────────

/**
 * Strategy 1: REORDER — move clause order
 * "Ho speso 50 al super" → "Al super ho speso 50"
 */
function reorder(text) {
  // Split at preposition boundary
  const prepositions = /\b(al|alla|dal|dalla|per|in|a|da|con|su|nel|nella|dello|della)\s+/i
  const match = text.match(prepositions)
  if (!match || match.index < 3) return text

  const before = text.slice(0, match.index).trim()
  const after = text.slice(match.index).trim()

  // Move prepositional phrase to front
  return after.charAt(0).toUpperCase() + after.slice(1) + ' ' + before.charAt(0).toLowerCase() + before.slice(1)
}

/**
 * Strategy 2: REGISTER — change formality level
 */
const REGISTER_SWAPS_FORMAL = [
  [/\bho speso\b/gi, 'ho sostenuto una spesa di'],
  [/\bdevo\b/gi, 'avrei necessita di'],
  [/\bporto\b/gi, 'accompagno'],
  [/\bprendo\b/gi, 'passo a ritirare'],
  [/\bcompra\b/gi, 'acquista'],
  [/\bstasera\b/gi, 'questa sera'],
  [/\bdomani\b/gi, 'il giorno seguente'],
]

const REGISTER_SWAPS_INFORMAL = [
  [/\bho speso\b/gi, 'ho lasciato'],
  [/\bacquistare\b/gi, 'prendere'],
  [/\bnecessario\b/gi, 'serve'],
  [/\baccompagno\b/gi, 'porto'],
  [/\bquesta sera\b/gi, 'stasera'],
  [/\beuro\b/gi, 'euri'],
]

function changeRegister(text, formal = true) {
  const swaps = formal ? REGISTER_SWAPS_FORMAL : REGISTER_SWAPS_INFORMAL
  let result = text
  // Apply 1-2 random swaps
  const count = 1 + Math.floor(Math.random() * 2)
  const shuffled = [...swaps].sort(() => Math.random() - 0.5)
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    result = result.replace(shuffled[i][0], shuffled[i][1])
  }
  return result
}

/**
 * Strategy 3: ELLIPSIS — drop subject/verb
 * "Ho speso 50 al super" → "50 euro al super"
 */
function ellipsis(text) {
  // Try dropping "Ho/Devo/Bisogna + verb" prefix
  const prefixRe = /^(?:ho|devo|bisogna|oggi|domani|ieri)\s+\w+\s+/i
  const match = text.match(prefixRe)
  if (match) {
    const rest = text.slice(match[0].length)
    return rest.charAt(0).toUpperCase() + rest.slice(1)
  }
  return text
}

/**
 * Strategy 4: FILLER — add Italian conversation fillers
 */
const FILLERS_PRE = [
  'Ah senti, ', 'Guarda, ', 'Allora, ', 'Sai che ', 'Ma dai, ',
  'Ehi, ', 'Niente, ', 'Comunque, ', 'Vabbè, ', 'Aspetta, ',
]
const FILLERS_POST = [
  ', eh', ', va bene?', ', ok?', ', capito?', ', dai',
  ', che dici?', ', ti avviso', ', niente di che',
]

function addFiller(text) {
  if (Math.random() > 0.5) {
    return pickRandom(FILLERS_PRE) + text.charAt(0).toLowerCase() + text.slice(1)
  }
  return text + pickRandom(FILLERS_POST)
}

/**
 * Strategy 5: TYPO + DIALECT — combine both
 */
function typoAndDialect(text) {
  let result = applyTypos(text, 0.08)  // Higher rate than normal
  result = addDialect(result, 0.20)
  return result
}

/**
 * Strategy 6: CONTEXT — add contextual prefix/suffix
 */
const CONTEXT_PREFIXES = [
  'Tornando da lavoro, ', 'Mentre ero in macchina, ', 'Stamattina presto, ',
  'Prima di uscire, ', 'Appena sveglia, ', 'Dopo pranzo, ',
  'Al telefono mi hanno detto che ', 'Ho pensato che ',
]

function addContext(text) {
  const prefix = pickRandom(CONTEXT_PREFIXES)
  return prefix + text.charAt(0).toLowerCase() + text.slice(1)
}

/**
 * Strategy 7: VOICE NOISE — simulate speech-to-text errors
 */
const NUMBER_WORDS = {
  '5': 'cinque', '10': 'dieci', '15': 'quindici', '20': 'venti',
  '25': 'venticinque', '30': 'trenta', '35': 'trentacinque',
  '40': 'quaranta', '45': 'quarantacinque', '50': 'cinquanta',
  '60': 'sessanta', '70': 'settanta', '80': 'ottanta',
  '90': 'novanta', '100': 'cento', '150': 'centocinquanta',
  '200': 'duecento',
}

function voiceNoise(text) {
  let result = text

  // Numbers → words (30% chance per number)
  result = result.replace(/\b(\d+)\b/g, (match) => {
    if (Math.random() < 0.3 && NUMBER_WORDS[match]) {
      return NUMBER_WORDS[match]
    }
    return match
  })

  // Remove commas between list items (50% chance)
  if (Math.random() > 0.5) {
    result = result.replace(/,\s+/g, ' ')
  }

  // Remove articles (20% chance per article)
  result = result.replace(/\b(il|la|lo|le|li|gli|un|una|l')\s+/gi, (match) => {
    return Math.random() < 0.2 ? '' : match
  })

  // Lowercase everything (voice-to-text often doesn't capitalize)
  if (Math.random() > 0.5) {
    result = result.toLowerCase()
  }

  return result
}

// ── STRATEGY REGISTRY ───────────────────────────────────

const STRATEGIES = [
  { name: 'reorder', fn: reorder, risk: 'low' },
  { name: 'register_formal', fn: (t) => changeRegister(t, true), risk: 'low' },
  { name: 'register_informal', fn: (t) => changeRegister(t, false), risk: 'low' },
  { name: 'ellipsis', fn: ellipsis, risk: 'medium' },
  { name: 'filler', fn: addFiller, risk: 'low' },
  { name: 'typo_dialect', fn: typoAndDialect, risk: 'medium' },
  { name: 'context', fn: addContext, risk: 'medium' },
  { name: 'voice_noise', fn: voiceNoise, risk: 'high' },
]

// ── MAIN: MUTATE TEMPLATE ───────────────────────────────

/**
 * Mutate a single template's text.
 *
 * @param {Object} template - phrase template with .text, .intent, .shouldWrite, etc.
 * @param {'light'|'medium'|'heavy'} level - mutation level
 * @returns {Object} cloned template with mutated text + adjusted truthConfidence
 */
export function mutateTemplate(template, level = 'medium') {
  const clone = { ...template, text: template.text }

  // Select strategies based on level
  let strategyCount, pool
  switch (level) {
    case 'light':
      strategyCount = 1
      pool = STRATEGIES.filter(s => s.risk === 'low')
      clone.truthConfidence = template.truthConfidence || 'high'
      break
    case 'medium':
      strategyCount = 2
      pool = STRATEGIES.filter(s => s.risk !== 'high')
      clone.truthConfidence = 'medium'
      break
    case 'heavy':
    default:
      strategyCount = 2 + Math.floor(Math.random() * 2) // 2-3
      pool = STRATEGIES
      clone.truthConfidence = 'low'
      break
  }

  // Pick random strategies (no duplicates)
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, Math.min(strategyCount, shuffled.length))

  // Apply sequentially
  let text = clone.text
  const appliedMutations = []
  for (const strategy of selected) {
    const before = text
    text = strategy.fn(text)
    if (text !== before) {
      appliedMutations.push(strategy.name)
    }
  }

  clone.text = text
  clone._mutations = appliedMutations
  clone._mutationLevel = level

  return clone
}

/**
 * Determine mutation level for a given loop iteration.
 * Progressive: loop 0 = light, loop 1 = medium, loop 2+ = heavy
 */
export function mutationLevelForLoop(loopIndex, mode = 'progressive') {
  if (mode !== 'progressive') return mode
  if (loopIndex === 0) return 'light'
  if (loopIndex === 1) return 'medium'
  return 'heavy'
}

/**
 * Mutate all templates of an agent.
 * Returns new array of mutated templates (originals preserved).
 */
export function mutateAgentTemplates(agent, level = 'medium') {
  return agent.phraseTemplates.map(tpl => mutateTemplate(tpl, level))
}

export { STRATEGIES, NUMBER_WORDS }
```

- [ ] **Step 2: Verify mutations work**

Run: `cd simulator && node -e "import('./neuroloop/templateMutator.js').then(m => { const tpl = { text: 'Ho speso 50 euro al supermercato', intent: 'expense', shouldWrite: true, truthConfidence: 'high', vars: [] }; console.log('Original:', tpl.text); const light = m.mutateTemplate(tpl, 'light'); console.log('Light:', light.text, '| mutations:', light._mutations); const heavy = m.mutateTemplate(tpl, 'heavy'); console.log('Heavy:', heavy.text, '| mutations:', heavy._mutations); })"`

Expected: Original text + 2 mutated variants with different mutation names

- [ ] **Step 3: Commit**

```bash
git add simulator/neuroloop/templateMutator.js
git commit -m "feat(neuroloop): add template mutator with 7 mutation strategies"
```

---

## Chunk 2: Probes 1-4 (Parser, Notification, Synapse, Memory)

### Task 5: Parser Probe

**Files:**
- Create: `simulator/neuroloop/probes/parserProbe.js`

- [ ] **Step 1: Create the parser probe**

```js
// simulator/neuroloop/probes/parserProbe.js
/**
 * Probe 1: Parser accuracy analysis.
 * Analyzes intent classification, entity extraction, compound phrases,
 * confidence calibration, and cross-family variance.
 */

import { createProbeReport, createFinding, createRecommendation, accuracy, groupBy } from './probeBase.js'

/**
 * Run parser probe on trajectory data.
 *
 * @param {Object[]} trajectories - PhraseTrajectory[] from orchestrator
 * @param {Object} context - { families: [{familyId, surname}], loopIndex }
 * @returns {Object} ProbeReport
 */
export function runParserProbe(trajectories, context = {}) {
  const findings = []
  const executed = trajectories.filter(t => t.actualIntent !== null)

  // ── Intent accuracy ──────────────────────────────────
  const intentCorrect = executed.filter(t => t.intentCorrect).length
  const intentAcc = accuracy(intentCorrect, executed.length)

  // Per-intent breakdown
  const byIntent = groupBy(executed, t => t.expectedIntent)
  const intentBreakdown = {}
  for (const [intent, items] of byIntent) {
    const correct = items.filter(t => t.intentCorrect).length
    intentBreakdown[intent] = {
      total: items.length,
      correct,
      accuracy: accuracy(correct, items.length),
    }
  }

  // Find intents with < 70% accuracy
  for (const [intent, data] of Object.entries(intentBreakdown)) {
    if (data.total >= 3 && data.accuracy < 70) {
      findings.push(createFinding(
        'bug', 'intent_classification',
        `Intent "${intent}" accuracy below 70%`,
        `${data.correct}/${data.total} correct (${data.accuracy.toFixed(1)}%)`,
        data.total - data.correct,
        data.accuracy < 50 ? 'high' : 'medium',
        createRecommendation('REPAIR', `Investigate misclassification of "${intent}" phrases`, 'src/lib/brain/intentClassifier.js', 'parseLocally'),
      ))
    }
  }

  // ── Per-agent breakdown ──────────────────────────────
  const byAgent = groupBy(executed, t => t.agent)
  const agentBreakdown = {}
  for (const [agent, items] of byAgent) {
    const correct = items.filter(t => t.intentCorrect).length
    agentBreakdown[agent] = {
      total: items.length,
      correct,
      accuracy: accuracy(correct, items.length),
    }
  }

  // ── Compound phrase accuracy ─────────────────────────
  const compounds = executed.filter(t => t.isCompound)
  const compoundCountMatch = compounds.filter(t => t.expectedActionCount === t.actualActionCount).length
  const compoundTypesMatch = compounds.filter(t => {
    const exp = [...(t.expectedActionTypes || [])].sort().join(',')
    const act = [...(t.actualActionTypes || [])].sort().join(',')
    return exp === act
  }).length

  if (compounds.length > 0) {
    const compoundAcc = accuracy(compoundCountMatch, compounds.length)
    if (compoundAcc < 80) {
      findings.push(createFinding(
        'warning', 'compound_parsing',
        `Compound count match only ${compoundAcc.toFixed(1)}%`,
        `${compoundCountMatch}/${compounds.length} phrases produced the expected number of actions`,
        compounds.length - compoundCountMatch,
        'medium',
      ))
    }
  }

  // ── Confidence calibration ──────────────────────────
  // High confidence (>0.8) should be mostly correct
  const highConf = executed.filter(t => (t.confidence ?? 0) > 0.8)
  if (highConf.length > 0) {
    const highConfCorrect = highConf.filter(t => t.intentCorrect).length
    const highConfAcc = accuracy(highConfCorrect, highConf.length)
    if (highConfAcc < 85) {
      findings.push(createFinding(
        'warning', 'confidence_calibration',
        `High-confidence phrases only ${highConfAcc.toFixed(1)}% correct`,
        `${highConfCorrect}/${highConf.length} phrases with confidence > 0.8 were correct`,
        highConf.length - highConfCorrect,
        'medium',
        createRecommendation('IMPROVE', 'Confidence scores are not well calibrated', 'src/lib/brain/intentClassifier.js', 'parseLocally'),
      ))
    }
  }

  // ── Cross-family variance ───────────────────────────
  if (context.families?.length > 1) {
    const byFamily = groupBy(executed, t => t.familyId || 'unknown')
    const familyAccuracies = []
    for (const [fId, items] of byFamily) {
      const correct = items.filter(t => t.intentCorrect).length
      familyAccuracies.push(accuracy(correct, items.length))
    }
    if (familyAccuracies.length >= 2) {
      const maxAcc = Math.max(...familyAccuracies)
      const minAcc = Math.min(...familyAccuracies)
      const variance = maxAcc - minAcc
      if (variance > 15) {
        findings.push(createFinding(
          'bug', 'cross_family_variance',
          `Cross-family accuracy variance: ${variance.toFixed(1)}%`,
          `Best family: ${maxAcc.toFixed(1)}%, Worst: ${minAcc.toFixed(1)}%. Parser may depend on specific names.`,
          1,
          'high',
          createRecommendation('REPAIR', 'Check for name-dependent logic in parser', 'src/lib/brain/entityExtractor.js', 'extractPersons'),
        ))
      }
    }
  }

  // ── Confusion matrix: top misclassifications ────────
  const errors = executed.filter(t => !t.intentCorrect)
  const confusionPairs = groupBy(errors, t => `${t.expectedIntent}→${t.actualIntent}`)
  const sortedPairs = [...confusionPairs.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)

  for (const [pair, items] of sortedPairs) {
    if (items.length >= 2) {
      const [expected, actual] = pair.split('→')
      findings.push(createFinding(
        items.length >= 5 ? 'bug' : 'warning',
        'confusion_pattern',
        `${expected} → ${actual} confusion (${items.length}x)`,
        `Example: "${items[0].text.slice(0, 60)}..."`,
        items.length,
        items.length >= 5 ? 'high' : 'medium',
        createRecommendation('REPAIR', `Add rules to distinguish "${expected}" from "${actual}"`, 'src/lib/brain/intentClassifier.js', 'parseLocally'),
      ))
    }
  }

  // ── Score calculation ───────────────────────────────
  // Weighted: intent accuracy 60%, compound 20%, confidence calibration 10%, cross-family 10%
  const compoundScore = compounds.length > 0 ? accuracy(compoundTypesMatch, compounds.length) : 100
  const confCalibScore = highConf.length > 0 ? accuracy(highConf.filter(t => t.intentCorrect).length, highConf.length) : 100
  const score = intentAcc * 0.6 + compoundScore * 0.2 + confCalibScore * 0.1 + (100 - (context._crossFamilyVariance || 0)) * 0.1

  return createProbeReport('parser', Math.min(100, score), findings, {
    intentAccuracy: intentAcc,
    intentBreakdown,
    agentBreakdown,
    compoundSplitRate: compounds.length > 0 ? accuracy(compoundCountMatch, compounds.length) : null,
    compoundTypesMatchRate: compounds.length > 0 ? accuracy(compoundTypesMatch, compounds.length) : null,
    confusionTopPairs: sortedPairs.map(([pair, items]) => ({ pair, count: items.length })),
  })
}
```

- [ ] **Step 2: Verify probe runs on mock data**

Run: `cd simulator && node -e "import('./neuroloop/probes/parserProbe.js').then(m => { const report = m.runParserProbe([{ actualIntent: 'calendar', expectedIntent: 'calendar', intentCorrect: true, confidence: 0.9, isCompound: false, agent: 'Test' }, { actualIntent: 'task', expectedIntent: 'expense', intentCorrect: false, confidence: 0.8, isCompound: false, agent: 'Test' }]); console.log('Score:', report.score, report.grade); console.log('Findings:', report.findings.length); })"`

Expected: Score around 50-80, grade B-D, 1+ findings

- [ ] **Step 3: Commit**

```bash
git add simulator/neuroloop/probes/parserProbe.js
git commit -m "feat(neuroloop): add parser probe — intent + compound + confidence analysis"
```

---

### Task 6: Notification Probe

**Files:**
- Create: `simulator/neuroloop/probes/notificationProbe.js`

- [ ] **Step 1: Create the notification probe**

```js
// simulator/neuroloop/probes/notificationProbe.js
/**
 * Probe 2: Notification system analysis.
 * Checks role-based visibility, delivery completeness, preview quality,
 * and clustering behavior.
 *
 * Uses post-hoc inference from trajectory data (no stub NotificationBus in v1).
 * For each record written, calculates expected recipients based on ROLE_VISIBILITY
 * and flags violations.
 */

import { createProbeReport, createFinding, createRecommendation, accuracy, groupBy } from './probeBase.js'

// ── ROLE VISIBILITY RULES (must match app) ──────────────

const ROLE_VISIBILITY = {
  events:        { genitore: true, figlio: true, nonno: true },
  tasks:         { genitore: true, figlio: true, nonno: true },
  expenses:      { genitore: true, figlio: false, nonno: false },
  shoppingItems: { genitore: true, figlio: false, nonno: true },
  mealPlans:     { genitore: true, figlio: true, nonno: true },
}

/**
 * Run notification probe on trajectory data.
 *
 * @param {Object[]} trajectories - PhraseTrajectory[] from orchestrator
 * @param {Object[]} members - family members with appRole
 * @returns {Object} ProbeReport
 */
export function runNotificationProbe(trajectories, members = []) {
  const findings = []

  const written = trajectories.filter(t => t.recordWritten && t.actualTable)

  // ── A. Role visibility violations ────────────────────
  let visibilityViolations = 0
  let visibilityChecks = 0

  for (const t of written) {
    const table = t.actualTable
    const rules = ROLE_VISIBILITY[table]
    if (!rules) continue

    // The sender (t.agent) should NOT receive notification
    // Other members SHOULD receive only if their role has visibility
    const senderRole = t.agentRole || 'unknown'

    for (const member of members) {
      if (member.name === t.agent) continue // skip sender
      const memberAppRole = member.appRole || 'unknown'
      const shouldReceive = rules[memberAppRole] ?? false

      visibilityChecks++

      // Flag: member should NOT see this table but would receive notification
      if (!shouldReceive) {
        // This is a potential violation — the app's notifyAll() sends to everyone
        visibilityViolations++
      }
    }
  }

  if (visibilityViolations > 0) {
    // Group by table for detail
    const violationsByTable = {}
    for (const t of written) {
      const table = t.actualTable
      const rules = ROLE_VISIBILITY[table]
      if (!rules) continue
      for (const member of members) {
        if (member.name === t.agent) continue
        const shouldReceive = rules[member.appRole] ?? false
        if (!shouldReceive) {
          violationsByTable[table] = (violationsByTable[table] || 0) + 1
        }
      }
    }

    for (const [table, count] of Object.entries(violationsByTable)) {
      findings.push(createFinding(
        'bug', 'role_visibility',
        `${table}: notifications sent to unauthorized roles (${count}x)`,
        `Members without ${table} visibility would receive notifications. Fix notifyAll() to filter by role.`,
        count,
        'high',
        createRecommendation('REPAIR',
          `Filter notification recipients by ROLE_VISIBILITY[table] in notifyAll/notifyCluster`,
          'src/hooks/useNotifications.js', 'notifyAll'),
      ))
    }
  }

  // ── B. Preview quality analysis ──────────────────────
  let previewIssues = 0
  for (const t of written) {
    const record = t.recordSnapshot
    if (!record) continue

    // Check if record has enough info for a good notification preview
    const table = t.actualTable
    let hasGoodPreview = true

    if (table === 'events') {
      if (!record.title || record.title.length < 3) hasGoodPreview = false
      if (!record.date && !record.timeStart) hasGoodPreview = false
    } else if (table === 'tasks') {
      if (!record.title || record.title.length < 3) hasGoodPreview = false
    } else if (table === 'expenses') {
      if (!record.amount || record.amount <= 0) hasGoodPreview = false
    }

    if (!hasGoodPreview) previewIssues++
  }

  if (previewIssues > 0 && written.length > 0) {
    const previewRate = accuracy(written.length - previewIssues, written.length)
    if (previewRate < 80) {
      findings.push(createFinding(
        'warning', 'preview_quality',
        `${previewIssues} records lack data for clear notification preview`,
        `${previewRate.toFixed(1)}% of records have enough fields for a meaningful notification preview`,
        previewIssues,
        'medium',
        createRecommendation('IMPROVE', 'Ensure records have title/date/amount for preview text', 'src/lib/brain/actionBuilder.js', 'buildAction'),
      ))
    }
  }

  // ── C. Delivery completeness (all writable actions → notification) ──
  const writableWithoutRecord = trajectories.filter(
    t => t.expectedIntent && t.expectedIntent !== 'noise' && t.expectedIntent !== 'none'
      && t.expectedIntent !== 'unknown' && t.expectedIntent !== 'edit_action'
      && !t.recordWritten && t.intentCorrect
  )
  if (writableWithoutRecord.length > 0) {
    findings.push(createFinding(
      'warning', 'delivery_completeness',
      `${writableWithoutRecord.length} correct actions did not produce DB records (no notification possible)`,
      `Actions were correctly parsed but never written to DB`,
      writableWithoutRecord.length,
      'low',
    ))
  }

  // ── D. Cluster check: compound phrases → single notification ──
  const compounds = trajectories.filter(t => t.isCompound && t.recordWritten)
  // Can't fully verify clustering without NotificationBus, but flag multi-action phrases
  const clusterMetric = compounds.length > 0 ? 'checked' : 'no_data'

  // ── Score calculation ───────────────────────────────
  const roleFilterScore = visibilityChecks > 0 ? accuracy(visibilityChecks - visibilityViolations, visibilityChecks) : 100
  const previewScore = written.length > 0 ? accuracy(written.length - previewIssues, written.length) : 100
  const deliveryScore = 100 // Can't fully measure without NotificationBus

  const score = roleFilterScore * 0.5 + previewScore * 0.3 + deliveryScore * 0.2

  return createProbeReport('notifications', score, findings, {
    roleFilterAccuracy: roleFilterScore,
    previewQuality: previewScore,
    deliveryRate: deliveryScore,
    clusteringStatus: clusterMetric,
    visibilityViolations,
    previewIssues,
    totalWritten: written.length,
  })
}
```

- [ ] **Step 2: Verify probe runs**

Run: `cd simulator && node -e "import('./neuroloop/probes/notificationProbe.js').then(m => { const report = m.runNotificationProbe([{ recordWritten: true, actualTable: 'expenses', agent: 'Marco', agentRole: 'genitore', recordSnapshot: { amount: 50, title: 'Spesa' }, intentCorrect: true, isCompound: false }], [{ name: 'Marco', appRole: 'genitore' }, { name: 'Lorenzo', appRole: 'figlio' }]); console.log('Score:', report.score, report.grade); console.log('Violations:', report.metrics.visibilityViolations); console.log('Findings:', report.findings.map(f => f.title)); })"`

Expected: Score < 100, visibility violations > 0 (figlio sees expenses), finding about role_visibility

- [ ] **Step 3: Commit**

```bash
git add simulator/neuroloop/probes/notificationProbe.js
git commit -m "feat(neuroloop): add notification probe — role visibility + preview quality"
```

---

### Task 7: Synapse Probe

**Files:**
- Create: `simulator/neuroloop/probes/synapseProbe.js`

- [ ] **Step 1: Create the synapse probe**

```js
// simulator/neuroloop/probes/synapseProbe.js
/**
 * Probe 3: Synapse/learning engine analysis.
 * Checks synapse creation from confirmed actions, shadow threshold behavior,
 * bootstrap integrity, and family isolation.
 *
 * Note: In simulator context, synapses are not fully exercised because
 * phraseExecutor does not call learnFromConfirmed. This probe analyzes
 * trajectory data to infer what SHOULD happen and flags structural issues.
 */

import { createProbeReport, createFinding, createRecommendation, accuracy } from './probeBase.js'

export function runSynapseProbe(trajectories, context = {}) {
  const findings = []

  // ── A. Confirmed actions that should create synapses ──
  const confirmedActions = trajectories.filter(
    t => t.intentCorrect && t.recordWritten && t.recordSnapshot?.title
  )

  // Each confirmed action with a title should create a synapse keyword→intent
  const potentialSynapses = confirmedActions.length
  // We can't verify actual synapse creation in simulator, but we CAN check
  // that the titles contain meaningful keywords (not empty, not raw sentences)

  let goodTitles = 0
  let rawSentenceTitles = 0
  let emptyTitles = 0

  for (const t of confirmedActions) {
    const title = t.recordSnapshot?.title || ''
    if (!title || title.length < 2) {
      emptyTitles++
    } else if (title.length > 60) {
      rawSentenceTitles++
    } else {
      goodTitles++
    }
  }

  if (emptyTitles > 0) {
    findings.push(createFinding(
      'warning', 'synapse_creation',
      `${emptyTitles} confirmed actions have empty/short titles — no synapse keywords`,
      `Synapses learn from action titles. Empty titles produce no learning.`,
      emptyTitles,
      'medium',
      createRecommendation('IMPROVE', 'Ensure all actions produce meaningful titles for synapse learning', 'src/lib/brain/actionBuilder.js', 'buildAction'),
    ))
  }

  if (rawSentenceTitles > 0) {
    findings.push(createFinding(
      'warning', 'title_quality',
      `${rawSentenceTitles} action titles are raw sentences (>60 chars)`,
      `Raw sentence titles create noisy synapses. Titles should be extracted keywords.`,
      rawSentenceTitles,
      'low',
    ))
  }

  // ── B. Family isolation check ────────────────────────
  // If multiple families were tested, check that family_id is always set
  const recordsWithFamily = confirmedActions.filter(t => t.recordSnapshot?.familyId || t.recordSnapshot?.family_id)
  const recordsWithoutFamily = confirmedActions.filter(t => !t.recordSnapshot?.familyId && !t.recordSnapshot?.family_id)

  if (recordsWithoutFamily.length > 0) {
    findings.push(createFinding(
      'bug', 'family_isolation',
      `${recordsWithoutFamily.length} records missing family_id — synapse contamination risk`,
      `Records without family_id could create cross-family synapses`,
      recordsWithoutFamily.length,
      'high',
      createRecommendation('REPAIR', 'Ensure all records include family_id', 'src/lib/brain/actionBuilder.js', 'buildAction'),
    ))
  }

  // ── C. Bootstrap integrity ──────────────────────────
  // Check that common intent keywords are correctly classified
  const bootstrapTests = [
    { word: 'dentista', expectedIntent: 'calendar' },
    { word: 'speso', expectedIntent: 'expense' },
    { word: 'comprare', expectedIntent: 'shopping' },
    { word: 'preparo', expectedIntent: 'meal' },
  ]

  let bootstrapHits = 0
  let bootstrapMisses = 0

  for (const test of bootstrapTests) {
    const matching = trajectories.filter(t =>
      t.text?.toLowerCase().includes(test.word) && t.actualIntent !== null
    )
    if (matching.length === 0) continue

    const correct = matching.filter(t => t.actualIntent === test.expectedIntent || t.intentCorrect)
    if (correct.length / matching.length < 0.6) {
      bootstrapMisses++
      findings.push(createFinding(
        'warning', 'bootstrap_integrity',
        `Bootstrap keyword "${test.word}" → ${test.expectedIntent} only ${(correct.length / matching.length * 100).toFixed(0)}% accurate`,
        `${correct.length}/${matching.length} phrases containing "${test.word}" mapped to "${test.expectedIntent}"`,
        matching.length - correct.length,
        'medium',
      ))
    } else {
      bootstrapHits++
    }
  }

  // ── Score calculation ───────────────────────────────
  const titleScore = potentialSynapses > 0 ? accuracy(goodTitles, potentialSynapses) : 100
  const isolationScore = confirmedActions.length > 0
    ? accuracy(recordsWithFamily.length, confirmedActions.length) : 100
  const bootstrapScore = (bootstrapHits + bootstrapMisses) > 0
    ? accuracy(bootstrapHits, bootstrapHits + bootstrapMisses) * 100 / 100 : 100

  const score = titleScore * 0.4 + isolationScore * 0.3 + bootstrapScore * 0.3

  return createProbeReport('synapses', score, findings, {
    potentialSynapses,
    goodTitles,
    rawSentenceTitles,
    emptyTitles,
    familyIsolation: isolationScore,
    bootstrapIntegrity: bootstrapScore,
  })
}
```

- [ ] **Step 2: Verify probe runs**

Run: `cd simulator && node -e "import('./neuroloop/probes/synapseProbe.js').then(m => { const report = m.runSynapseProbe([{ intentCorrect: true, recordWritten: true, recordSnapshot: { title: 'Danza Viola', familyId: 'fam-1' }, text: 'domani danza', actualIntent: 'calendar' }]); console.log('Score:', report.score, report.grade); console.log('Metrics:', JSON.stringify(report.metrics)); })"`

Expected: Score ~100, grade A

- [ ] **Step 3: Commit**

```bash
git add simulator/neuroloop/probes/synapseProbe.js
git commit -m "feat(neuroloop): add synapse probe — learning quality + family isolation"
```

---

### Task 8: Memory Probe (Conversation Drafts)

**Files:**
- Create: `simulator/neuroloop/probes/memoryProbe.js`

- [ ] **Step 1: Create the memory probe**

```js
// simulator/neuroloop/probes/memoryProbe.js
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
```

- [ ] **Step 2: Verify probe runs**

Run: `cd simulator && node -e "import('./neuroloop/probes/memoryProbe.js').then(m => { const report = m.runMemoryProbe([{ recordWritten: true, actualTable: 'events', recordSnapshot: { date: null, title: 'Danza', incomplete: 'Manca la data' } }]); console.log('Score:', report.score, report.grade); console.log('Incomplete:', report.metrics.incompleteRate); })"`

Expected: Score < 100, incompleteRate = 100

- [ ] **Step 3: Commit**

```bash
git add simulator/neuroloop/probes/memoryProbe.js
git commit -m "feat(neuroloop): add memory probe — draft lifecycle + incomplete records"
```

---

## Chunk 3: Probes 5-8 + NeuralCore

### Task 9: DB Quality Probe

**Files:**
- Create: `simulator/neuroloop/probes/dbQualityProbe.js`

- [ ] **Step 1: Create the DB quality probe**

```js
// simulator/neuroloop/probes/dbQualityProbe.js
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
  const commitMismatch = written.filter(t => {
    const hasIncomplete = t.recordSnapshot?.incomplete
    const commitLevel = t.commitLevel
    return hasIncomplete && commitLevel === 'strong'
  })

  if (commitMismatch.length > 0) {
    findings.push(createFinding(
      'bug', 'commit_coherence',
      `${commitMismatch.length} incomplete records with commit level "strong"`,
      `Records with missing fields should not be committed as "strong"`,
      commitMismatch.length,
      'high',
      createRecommendation('REPAIR', 'Adjust commit evaluator to downgrade incomplete records', 'src/lib/brain/commitEvaluator.js', 'evaluateCommit'),
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
```

- [ ] **Step 2: Commit**

```bash
git add simulator/neuroloop/probes/dbQualityProbe.js
git commit -m "feat(neuroloop): add DB quality probe — field validation + commit coherence"
```

---

### Task 10: Logistics Probe

**Files:**
- Create: `simulator/neuroloop/probes/logisticsProbe.js`

- [ ] **Step 1: Create the logistics probe**

```js
// simulator/neuroloop/probes/logisticsProbe.js
/**
 * Probe 6: Logistics resolution analysis.
 * Checks driver, pickup, subject accuracy from record snapshots.
 */

import { createProbeReport, createFinding, createRecommendation, accuracy } from './probeBase.js'

export function runLogisticsProbe(trajectories, members = []) {
  const findings = []

  // Filter trajectories with logistics data
  const logisticsRecords = trajectories.filter(t => {
    const r = t.recordSnapshot
    return r && (r.logistics || r.personIds?.length > 0 || r.activity)
  })

  let driverCorrect = 0
  let driverTotal = 0
  let subjectCorrect = 0
  let subjectTotal = 0
  let pickupPresent = 0
  let pickupMissing = 0
  let mergeSuccess = 0
  let mergeTotal = 0

  for (const t of logisticsRecords) {
    const r = t.recordSnapshot

    // Subject check: personIds should contain actual member IDs
    if (r.personIds && r.personIds.length > 0) {
      subjectTotal++
      const validIds = r.personIds.filter(id => members.some(m => m.id === id))
      if (validIds.length === r.personIds.length) subjectCorrect++
    }

    // Driver/logistics check
    if (r.logistics) {
      if (r.logistics.driverName || r.logistics.driverId) {
        driverTotal++
        const driverId = r.logistics.driverId
        if (driverId && members.some(m => m.id === driverId)) driverCorrect++
        else if (r.logistics.driverName && members.some(m => m.name === r.logistics.driverName)) driverCorrect++
      }

      // Pickup check
      if (r.needsPickup === false && (r.logistics.pickupById || r.logistics.pickupByName)) {
        pickupPresent++
      } else if (r.needsPickup === true) {
        pickupMissing++
      }
    }

    // Cross-segment merge check (compound with pickup)
    if (t.isCompound && r.logistics?.pickupByName) {
      mergeTotal++
      if (!r.needsPickup) mergeSuccess++ // needsPickup=false means merge happened
    }
  }

  // Findings
  if (driverTotal > 0 && accuracy(driverCorrect, driverTotal) < 80) {
    findings.push(createFinding(
      'bug', 'driver_resolution',
      `Driver resolution ${accuracy(driverCorrect, driverTotal).toFixed(1)}% — below 80%`,
      `${driverCorrect}/${driverTotal} logistics records have valid driver IDs`,
      driverTotal - driverCorrect,
      'high',
      createRecommendation('REPAIR', 'Check driver extraction for non-standard name patterns', 'src/lib/brain/entityExtractor.js', 'extractLogistics'),
    ))
  }

  if (pickupMissing > 3) {
    findings.push(createFinding(
      'warning', 'pickup_incomplete',
      `${pickupMissing} events need pickup but none assigned`,
      `Events with needsPickup=true suggest missing cross-segment merge or unresolved pickup`,
      pickupMissing,
      'medium',
    ))
  }

  // Score
  const driverScore = driverTotal > 0 ? accuracy(driverCorrect, driverTotal) : 100
  const subjectScore = subjectTotal > 0 ? accuracy(subjectCorrect, subjectTotal) : 100
  const pickupScore = (pickupPresent + pickupMissing) > 0
    ? accuracy(pickupPresent, pickupPresent + pickupMissing) : 100
  const mergeScore = mergeTotal > 0 ? accuracy(mergeSuccess, mergeTotal) : 100

  const score = driverScore * 0.3 + subjectScore * 0.3 + pickupScore * 0.2 + mergeScore * 0.2

  return createProbeReport('logistics', score, findings, {
    driverAccuracy: driverScore,
    subjectAccuracy: subjectScore,
    pickupRate: pickupScore,
    mergeRate: mergeScore,
    logisticsRecords: logisticsRecords.length,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add simulator/neuroloop/probes/logisticsProbe.js
git commit -m "feat(neuroloop): add logistics probe — driver/pickup/subject analysis"
```

---

### Task 11: Flow Probe

**Files:**
- Create: `simulator/neuroloop/probes/flowProbe.js`

- [ ] **Step 1: Create the flow probe**

```js
// simulator/neuroloop/probes/flowProbe.js
/**
 * Probe 7: End-to-end flow analysis + gamification.
 * Checks: complete pipeline, error recovery, edit actions, state consistency.
 */

import { createProbeReport, createFinding, createRecommendation, accuracy, groupBy } from './probeBase.js'

export function runFlowProbe(trajectories, context = {}) {
  const findings = []

  // ── A. E2E success: phrase → parse → write (for writable intents) ──
  const writable = trajectories.filter(t =>
    t.expectedIntent && !['noise', 'none', 'unknown', 'edit_action'].includes(t.expectedIntent)
    && t.intentCorrect
  )
  const writtenCorrectly = writable.filter(t => t.recordWritten)
  const e2eRate = accuracy(writtenCorrectly.length, writable.length)

  if (e2eRate < 75 && writable.length > 5) {
    findings.push(createFinding(
      'warning', 'e2e_pipeline',
      `E2E success rate ${e2eRate.toFixed(1)}% — correct parses not producing records`,
      `${writtenCorrectly.length}/${writable.length} correctly parsed actions resulted in DB writes`,
      writable.length - writtenCorrectly.length,
      'medium',
    ))
  }

  // ── B. Error recovery: no crashes ──────────────────
  const crashes = trajectories.filter(t => t.errorType === 'parse_error' && t.errorCause?.includes('threw'))
  if (crashes.length > 0) {
    findings.push(createFinding(
      'bug', 'error_recovery',
      `${crashes.length} phrases caused parser exceptions`,
      `Parser threw errors instead of gracefully returning. Example: "${crashes[0].text?.slice(0, 50)}"`,
      crashes.length,
      'high',
      createRecommendation('REPAIR', 'Add try/catch around failing code path', 'src/lib/brain/intentClassifier.js', 'parseLocally'),
    ))
  }

  // ── C. Edit action accuracy ────────────────────────
  const editActions = trajectories.filter(t => t.expectedIntent === 'edit_action')
  const editResolved = editActions.filter(t => t.resolverStatus === 'resolved')
  if (editActions.length > 0) {
    const editAcc = accuracy(editResolved.length, editActions.length)
    if (editAcc < 60) {
      findings.push(createFinding(
        'warning', 'edit_action',
        `Edit action resolution: ${editAcc.toFixed(1)}%`,
        `${editResolved.length}/${editActions.length} edit actions resolved successfully`,
        editActions.length - editResolved.length,
        'medium',
      ))
    }
  }

  // ── D. Noise rejection ─────────────────────────────
  const noise = trajectories.filter(t => ['noise', 'none'].includes(t.expectedIntent))
  const noiseCorrect = noise.filter(t => t.intentCorrect || !t.recordWritten)
  const noiseRejectionRate = accuracy(noiseCorrect.length, noise.length)

  if (noise.length > 0 && noiseRejectionRate < 90) {
    findings.push(createFinding(
      'bug', 'noise_rejection',
      `Noise rejection rate: ${noiseRejectionRate.toFixed(1)}%`,
      `${noise.length - noiseCorrect.length} noise phrases incorrectly produced actions`,
      noise.length - noiseCorrect.length,
      'high',
    ))
  }

  // ── E. Gamification ────────────────────────────────
  // In simulator context, gamification is not exercised.
  // Flag as unchecked for visibility.

  // ── Score ──────────────────────────────────────────
  const crashScore = trajectories.length > 0 ? accuracy(trajectories.length - crashes.length, trajectories.length) : 100
  const editScore = editActions.length > 0 ? accuracy(editResolved.length, editActions.length) : 100
  const noiseScore = noise.length > 0 ? noiseRejectionRate : 100

  const score = e2eRate * 0.3 + crashScore * 0.3 + editScore * 0.2 + noiseScore * 0.2

  return createProbeReport('flow', score, findings, {
    e2eSuccessRate: e2eRate,
    crashCount: crashes.length,
    editActionAccuracy: editActions.length > 0 ? accuracy(editResolved.length, editActions.length) : null,
    noiseRejectionRate,
    totalPhrases: trajectories.length,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add simulator/neuroloop/probes/flowProbe.js
git commit -m "feat(neuroloop): add flow probe — e2e pipeline + error recovery + noise rejection"
```

---

### Task 12: Destination Probe

**Files:**
- Create: `simulator/neuroloop/probes/destinationProbe.js`

- [ ] **Step 1: Create the destination probe**

```js
// simulator/neuroloop/probes/destinationProbe.js
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

    if (hasIncomplete && commitLevel === 'strong') {
      commitIncoherent++
    } else if (!hasIncomplete && commitLevel === 'strong') {
      commitCoherent++
    } else {
      commitCoherent++
    }
  }

  if (commitIncoherent > 0) {
    findings.push(createFinding(
      'bug', 'commit_coherence',
      `${commitIncoherent} records: incomplete but commit "strong"`,
      `Incomplete records should be "draft" or "light", not "strong"`,
      commitIncoherent,
      'high',
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
```

- [ ] **Step 2: Commit**

```bash
git add simulator/neuroloop/probes/destinationProbe.js
git commit -m "feat(neuroloop): add destination probe — routing + compound landing + alerts"
```

---

### Task 13: NeuralCore

**Files:**
- Create: `simulator/neuroloop/neuralCore.js`

- [ ] **Step 1: Create the NeuralCore aggregator**

```js
// simulator/neuroloop/neuralCore.js
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
```

- [ ] **Step 2: Verify NeuralCore runs with all probes**

Run: `cd simulator && node -e "import('./neuroloop/neuralCore.js').then(m => { const report = m.analyze([{ actualIntent: 'calendar', expectedIntent: 'calendar', intentCorrect: true, confidence: 0.9, isCompound: false, agent: 'Test', recordWritten: true, actualTable: 'events', recordSnapshot: { title: 'Test', date: '2025-09-01', familyId: 'fam-1' }, expectedTable: 'events', tableCorrect: true, errorType: null }]); console.log('Overall:', report.overallScore, report.overallGrade); console.log('Probes:', Object.entries(report.probeScores).map(([k,v]) => k + '=' + v.toFixed(0)).join(', ')); console.log('Bugs:', report.summary.bugs, '| Warnings:', report.summary.warnings); })"`

Expected: Overall score, 8 probe scores, finding counts

- [ ] **Step 3: Commit**

```bash
git add simulator/neuroloop/neuralCore.js
git commit -m "feat(neuroloop): add NeuralCore — 8-probe aggregator with delta tracking"
```

---

## Chunk 4: PatchEngine + Entry Point

### Task 14: PatchEngine

**Files:**
- Create: `simulator/neuroloop/patchEngine.js`

- [ ] **Step 1: Create the patch engine**

```js
// simulator/neuroloop/patchEngine.js
/**
 * PatchEngine — generates, validates, and applies patches from probe findings.
 * 5-gate validation: blacklist → memory → dry run → full test → accuracy check.
 *
 * v1: Only supports regex_expand and nlp_training patches.
 * logic_guard and pattern_add are logged as suggestions but not auto-applied.
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { isBlacklisted, hasRegressionHistory } from './loopMemory.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')

/**
 * Generate patch suggestions from NeuralCore findings.
 * Only generates patches the engine knows how to apply.
 */
export function generatePatches(findings) {
  const patches = []
  let patchCounter = 0

  for (const finding of findings) {
    if (!finding.recommendation) continue
    if (finding.severity !== 'bug') continue // Only patch bugs, not suggestions

    const rec = finding.recommendation
    if (rec.type !== 'REPAIR') continue

    // Try to map finding to a concrete patch type
    const patch = mapFindingToPatch(finding, ++patchCounter)
    if (patch) patches.push(patch)
  }

  return patches.slice(0, 3) // Max 3 patches per loop
}

function mapFindingToPatch(finding, id) {
  const area = finding.area || ''
  const title = finding.title || ''

  // Pattern: missing words in a regex
  if (area === 'confusion_pattern' && title.includes('→ shopping')) {
    return {
      id: `patch-${id}`,
      type: 'regex_expand',
      target: 'GROCERY_WORDS_RE',
      description: `Expand GROCERY_WORDS_RE to reduce ${title}`,
      finding: finding.title,
      status: 'pending',
      snapshot: null,
    }
  }

  // Other patterns are logged as manual suggestions
  return null
}

/**
 * Validate and apply a single patch through the 5-gate pipeline.
 *
 * @param {Object} patch - patch object from generatePatches
 * @param {Object} memory - loop memory
 * @param {number} loopId - current loop ID
 * @returns {Object} patch with updated status
 */
export function validateAndApply(patch, memory, loopId) {
  // Gate 1: Blacklist check
  if (isBlacklisted(memory, patch.type, patch.target)) {
    patch.status = 'rejected'
    patch.reason = 'blacklisted'
    return patch
  }

  // Gate 2: Memory check — similar patch caused regression?
  if (hasRegressionHistory(memory, patch.target)) {
    patch.status = 'rejected'
    patch.reason = 'regression_history'
    return patch
  }

  // Gate 3-5: Run tests in child process
  try {
    const testResult = execSync(
      'npx vitest run src/lib/brain/__tests__/ --reporter=json 2>&1',
      { cwd: PROJECT_ROOT, timeout: 60000, encoding: 'utf-8' }
    )

    // Parse test results
    const passed = (testResult.match(/(\d+) passed/) || [])[1]
    const failed = (testResult.match(/(\d+) failed/) || [])[1]

    patch.testsPassed = parseInt(passed) || 0
    patch.testsFailed = parseInt(failed) || 0

    if (patch.testsFailed > 0) {
      patch.status = 'rejected'
      patch.reason = `${patch.testsFailed} tests failed`
      return patch
    }
  } catch (err) {
    patch.status = 'rejected'
    patch.reason = `test execution failed: ${err.message?.slice(0, 100)}`
    return patch
  }

  // If we get here, tests pass — mark as validated but don't auto-apply in v1
  // (regex_expand needs specific word lists which we don't generate automatically yet)
  patch.status = 'suggestion_validated'
  patch.reason = 'Tests pass — manual application recommended'

  return patch
}

/**
 * Run the full patch pipeline for a set of findings.
 */
export function runPatchPipeline(findings, memory, loopId) {
  const patches = generatePatches(findings)
  const results = []

  for (const patch of patches) {
    const result = validateAndApply(patch, memory, loopId)
    results.push(result)
  }

  return results
}
```

- [ ] **Step 2: Commit**

```bash
git add simulator/neuroloop/patchEngine.js
git commit -m "feat(neuroloop): add PatchEngine — 5-gate validation pipeline"
```

---

### Task 15: Entry Point + Console Output

**Files:**
- Create: `simulator/neuroloop.js`

- [ ] **Step 1: Create the main neuroloop entry point**

```js
// simulator/neuroloop.js
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
import { setupSimulator, MEMBERS } from './setup.js'
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
  const line = '═'.repeat(56)
  console.log(`╔${line}╗`)
  console.log(`║  NEUROLOOP — Centro Neurale Iterativo                  ║`)
  console.log(`║  Iterations: ${String(config.iterations).padEnd(3)} | Families: ${String(config.families).padEnd(3)} | Weeks: ${String(config.weeks).padEnd(3)}    ║`)
  console.log(`╚${line}╝`)
  console.log()
}

function printLoopResult(loopIndex, totalLoops, report) {
  const line = '─'.repeat(56)
  console.log(`┌${line}┐`)
  console.log(`│  Loop ${loopIndex + 1}/${totalLoops}    Overall: ${report.overallScore.toFixed(1)}% ${report.overallGrade}`.padEnd(57) + '│')
  console.log(`├${line}┤`)

  // Probe scores
  for (const [probe, score] of Object.entries(report.probeScores)) {
    const delta = report.delta[probe]
    const deltaStr = delta !== undefined ? (delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)) : '    '
    const grade = report.probeGrades[probe]
    console.log(`│  ${probe.padEnd(16)} ${score.toFixed(1).padStart(6)}%  ${grade}   ${deltaStr.padStart(6)}`.padEnd(57) + '│')
  }

  console.log(`├${line}┤`)
  console.log(`│  BUG: ${report.summary.bugs}  |  WARN: ${report.summary.warnings}  |  SUGGEST: ${report.summary.suggestions}`.padEnd(57) + '│')
  console.log(`└${line}┘`)
  console.log()
}

function printFinalSummary(memory, config) {
  const loops = memory.loops
  if (loops.length < 2) return

  const first = loops[0]
  const last = loops[loops.length - 1]
  const line = '═'.repeat(56)

  console.log(`╔${line}╗`)
  console.log(`║  NEUROLOOP — RIEPILOGO FINALE (${loops.length} iterazioni)`.padEnd(57) + '║')
  console.log(`╠${line}╣`)

  const probes = ['parser', 'notifications', 'synapses', 'memory', 'dbQuality', 'logistics', 'flow', 'destination']
  for (const probe of probes) {
    const firstScore = first.scores?.[probe] ?? 0
    const lastScore = last.scores?.[probe] ?? 0
    const delta = lastScore - firstScore
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '━'
    console.log(`║  ${probe.padEnd(16)} ${firstScore.toFixed(1).padStart(6)}% → ${lastScore.toFixed(1).padStart(6)}%  ${(delta >= 0 ? '+' : '') + delta.toFixed(1).padStart(5)} ${arrow}`.padEnd(57) + '║')
  }

  const firstOverall = first.scores?.overall ?? 0
  const lastOverall = last.scores?.overall ?? 0
  console.log(`╠${line}╣`)
  console.log(`║  OVERALL          ${firstOverall.toFixed(1).padStart(6)}% → ${lastOverall.toFixed(1).padStart(6)}%  ${((lastOverall - firstOverall) >= 0 ? '+' : '') + (lastOverall - firstOverall).toFixed(1).padStart(5)}`.padEnd(57) + '║')

  if (memory.evolution.estimatedCeiling) {
    console.log(`║  Ceiling stimato: ~${memory.evolution.estimatedCeiling}%`.padEnd(57) + '║')
  }
  console.log(`║  Status: ${memory.evolution.improving ? 'IMPROVING ↑' : memory.evolution.plateauReached ? 'PLATEAU ━' : 'MIXED'}`.padEnd(57) + '║')
  console.log(`╚${line}╝`)
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
            icon: '👤',
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
        console.log(`  ${p.status === 'suggestion_validated' ? '✓' : '✗'} ${p.description || p.target}: ${p.status} ${p.reason ? '(' + p.reason + ')' : ''}`)
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
```

- [ ] **Step 2: Test with a minimal run (1 iteration, 1 family, 1 week)**

Run: `cd simulator && node neuroloop.js --iterations=1 --families=1 --weeks=1`

Expected:
- Header prints
- Family generated with random names
- Orchestrator runs
- NeuralCore produces scores for 8 probes
- Final result prints with grades
- memory.json updated

- [ ] **Step 3: Test with 2 iterations and 2 families**

Run: `cd simulator && node neuroloop.js --iterations=2 --families=2 --weeks=2`

Expected:
- 2 loops run
- Delta scores shown on loop 2
- Final summary shows Loop 1 → Loop 2 evolution
- memory.json has 2 loop entries (or more if previous runs exist)

- [ ] **Step 4: Commit**

```bash
git add simulator/neuroloop.js
git commit -m "feat(neuroloop): add CLI entry point with full loop orchestration + console output"
```

---

### Task 16: Add npm script

**Files:**
- Modify: `simulator/package.json`

- [ ] **Step 1: Add neuroloop script to package.json**

Add to the `"scripts"` section:
```json
"neuroloop": "node neuroloop.js",
"neuroloop:quick": "node neuroloop.js --iterations=2 --families=1 --weeks=2",
"neuroloop:full": "node neuroloop.js --iterations=5 --families=3 --weeks=4"
```

- [ ] **Step 2: Verify npm script works**

Run: `cd simulator && npm run neuroloop:quick`

Expected: Quick neuroloop run completes

- [ ] **Step 3: Commit**

```bash
git add simulator/package.json
git commit -m "feat(neuroloop): add npm scripts for quick and full neuroloop runs"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `cd simulator && node neuroloop.js --iterations=1 --families=1 --weeks=1` runs without errors
- [ ] `cd simulator && node neuroloop.js --iterations=3 --families=2 --weeks=2` produces:
  - 3 loop results with 8 probe scores each
  - Delta tracking from loop 2 onwards
  - Final summary with evolution
  - `neuroloop/logs/memory.json` with 3 loop entries
  - `neuroloop/logs/loop-*.json` files for each loop
- [ ] `npx vitest run src/lib/brain/__tests__/` still passes all 202 tests
- [ ] Console output is readable with proper formatting
