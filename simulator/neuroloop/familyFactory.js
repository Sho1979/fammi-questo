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
