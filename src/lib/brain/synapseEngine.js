/**
 * synapseEngine.js — Attivazione sinapsi (Livello 2) + contesto temporale.
 */

import { FUZZY_MIN_LENGTH } from './config.js'
import { fuzzyMatch } from './textUtils.js'

// ═══════════════════════════════════════════════════════════════
// TIME CONTEXT
// ═══════════════════════════════════════════════════════════════
export function getTimeContext() {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 10) return { mealBias: 'colazione', period: 'mattina' }
  if (hour >= 10 && hour < 14) return { mealBias: 'pranzo', period: 'mattina' }
  if (hour >= 14 && hour < 17) return { mealBias: 'merenda', period: 'pomeriggio' }
  if (hour >= 17 && hour < 21) return { mealBias: 'cena', period: 'sera' }
  return { mealBias: 'cena', period: 'notte' }
}

// ═══════════════════════════════════════════════════════════════
// ATTIVAZIONE SINAPSI (Livello 2 — nostro sistema pesato)
// ═══════════════════════════════════════════════════════════════
export function computeSynapseActivations(tokens, stems, allSynapses) {
  const activations = new Map()

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const stem = stems[i]

    const stemSynapses = allSynapses.get(stem) || []
    const tokenSynapses = (token !== stem ? allSynapses.get(token) : null) || []
    let fuzzySynapses = []
    if (token.length >= FUZZY_MIN_LENGTH) {
      const allStems = Array.from(allSynapses.keys())
      const match = fuzzyMatch(stem, allStems)
      if (match && match.distance > 0) {
        fuzzySynapses = (allSynapses.get(match.target) || []).map(s => ({
          ...s, weight: s.weight * match.score * 0.8, fuzzy: true,
        }))
      }
    }

    const allMatches = [...stemSynapses, ...tokenSynapses, ...fuzzySynapses]
    for (const synapse of allMatches) {
      const { actionType, category, weight } = synapse
      if (!activations.has(actionType)) {
        activations.set(actionType, { score: 0, keywords: [], categories: new Map() })
      }
      const act = activations.get(actionType)
      act.score += weight
      act.keywords.push({ word: token, weight, fuzzy: synapse.fuzzy })
      if (category) {
        act.categories.set(category, (act.categories.get(category) || 0) + weight)
      }
    }
  }
  return activations
}
