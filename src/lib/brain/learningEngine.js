/**
 * learningEngine.js — Rinforzo/punizione sinapsi + training NLP.js + decay temporale.
 */

import { db } from '../localDb.js'
import { addTrainingDocument, removeTrainingDocument } from '../brainNlp.js'
import { INTENT_TO_ACTION } from '../brainTrainingSet.js'
import { trackEvent, TELEMETRY_EVENTS } from '../telemetry.js'
import { LEARNING_RATE, DECAY_RATE, DECAY_GRACE_DAYS, MAX_SYNAPSES, SHADOW_CONFIRM_THRESHOLD } from './config.js'
import { stemIT, tokenizeForMatching } from './textUtils.js'

// ═══════════════════════════════════════════════════════════════
// RINFORZO — azioni confermate dall'utente
// ═══════════════════════════════════════════════════════════════

/**
 * RINFORZO: azioni confermate dall'utente.
 * 1. Rafforza sinapsi pesate
 * 2. Aggiunge documenti di training a NLP.js
 */
export async function learnFromConfirmed(confirmedActions, originalText, familyId) {
  if (!familyId || !confirmedActions?.length) return
  trackEvent(TELEMETRY_EVENTS.BRAIN_CONFIRMED)

  const tokens = tokenizeForMatching(originalText)
  const stems = tokens.map(stemIT)

  for (const action of confirmedActions) {
    // A. Sinapsi pesate
    const actionKeywords = extractKeywordsFromAction(action)
    const allKeywords = [...new Set([...stems, ...actionKeywords])]
    for (const keyword of allKeywords) {
      if (keyword.length < 3 || /^\d+$/.test(keyword)) continue
      await reinforceSynapse(familyId, keyword, action.type, action.category, +1)
    }

    // B. Training NLP.js — converti tipo azione in intent NLP
    const nlpIntent = actionToNlpIntent(action)
    if (nlpIntent) {
      await addTrainingDocument(originalText, nlpIntent, familyId)
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// PUNIZIONE — azioni rimosse/cancellate dall'utente
// ═══════════════════════════════════════════════════════════════

/**
 * PUNIZIONE: azioni rimosse/cancellate dall'utente.
 */
export async function learnFromRejected(rejectedActions, originalText, familyId) {
  if (!familyId || !rejectedActions?.length) return
  trackEvent(TELEMETRY_EVENTS.BRAIN_REJECTED)

  const tokens = tokenizeForMatching(originalText)
  const stems = tokens.map(stemIT)

  for (const action of rejectedActions) {
    // A. Punisci sinapsi
    for (const stem of stems) {
      if (stem.length < 3) continue
      await reinforceSynapse(familyId, stem, action.type, action.category, -1)
    }

    // B. Rimuovi documento NLP.js
    const nlpIntent = actionToNlpIntent(action)
    if (nlpIntent) {
      await removeTrainingDocument(originalText, nlpIntent, familyId)
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// DECAY — dimenticanza naturale
// ═══════════════════════════════════════════════════════════════
export async function applyDecay(familyId) {
  if (!familyId) return

  const patterns = await db.patterns
    .where('family_id').equals(familyId)
    .and(p => !p._deleted)
    .toArray()

  const now = Date.now()
  for (const p of patterns) {
    const lastUsed = p.lastUsed ? new Date(p.lastUsed).getTime() : new Date(p.createdAt).getTime()
    const daysIdle = (now - lastUsed) / 86400000
    if (daysIdle <= DECAY_GRACE_DAYS) continue

    const decayDays = daysIdle - DECAY_GRACE_DAYS
    const decayFactor = Math.pow(1 - DECAY_RATE, decayDays)
    const newScore = (p.score || 0) * decayFactor

    if (newScore < 0.1) {
      await db.patterns.update(p.id, { _deleted: true, _synced: 0 })
    } else if (Math.abs(newScore - (p.score || 0)) > 0.05) {
      await db.patterns.update(p.id, {
        score: Math.round(newScore * 100) / 100,
        _synced: 0,
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER INTERNI
// ═══════════════════════════════════════════════════════════════

/** Mappa tipo azione → intent NLP.js */
function actionToNlpIntent(action) {
  if (action.type === 'calendar') {
    const cat = action.category || 'altro'
    for (const [intent, mapping] of Object.entries(INTENT_TO_ACTION)) {
      if (mapping.type === 'calendar' && mapping.category === cat) return intent
    }
    return 'calendar.generico'
  }
  if (action.type === 'task') {
    const cat = action.category || 'altro'
    for (const [intent, mapping] of Object.entries(INTENT_TO_ACTION)) {
      if (mapping.type === 'task' && mapping.category === cat) return intent
    }
    return 'task.generico'
  }
  if (action.type === 'expense') return 'expense.generico'
  if (action.type === 'meal') return 'meal.generico'
  if (action.type === 'shopping') return 'shopping.generico'
  if (action.type === 'note') return 'note.generico'
  return null
}

/**
 * Rafforza/punisci sinapsi nel DB.
 *
 * SHADOW LEARNING: nuove sinapsi partono con confirmCount=1.
 * Solo quando confirmCount >= SHADOW_CONFIRM_THRESHOLD (default 3)
 * la sinapsi diventa "attiva" e influenza il parsing.
 * Sinapsi bootstrap (da patterns.js) non hanno confirmCount e sono sempre attive.
 */
async function reinforceSynapse(familyId, keyword, actionType, category, direction) {
  try {
    const existing = await db.patterns
      .where('family_id').equals(familyId)
      .and(p => p.keyword === keyword && p.actionType === actionType && !p._deleted)
      .first()

    if (existing) {
      const currentWeight = existing.score || 0
      let newScore
      if (direction > 0) {
        newScore = currentWeight + LEARNING_RATE * (20 - currentWeight)
      } else {
        newScore = Math.max(0, currentWeight - LEARNING_RATE * currentWeight)
      }

      // Shadow learning: incrementa confirmCount ad ogni conferma
      const prevConfirm = existing.confirmCount ?? SHADOW_CONFIRM_THRESHOLD // bootstrap = già attive
      const newConfirmCount = direction > 0
        ? Math.min(prevConfirm + 1, SHADOW_CONFIRM_THRESHOLD + 10)  // cap per evitare overflow
        : Math.max(0, prevConfirm - 1)  // punizione riduce anche confirmCount

      await db.patterns.update(existing.id, {
        score: Math.round(newScore * 100) / 100,
        category: direction > 0 ? (category || existing.category) : existing.category,
        confirmCount: newConfirmCount,
        lastUsed: new Date().toISOString(),
        _synced: 0,
      })
    } else if (direction > 0) {
      await pruneIfNeeded(familyId)
      // Nuova sinapsi: parte in shadow (confirmCount=1), non attiva finché < threshold
      await db.patterns.add({
        id: crypto.randomUUID(),
        family_id: familyId,
        keyword,
        actionType,
        category: category || null,
        score: 1,
        confirmCount: 1,  // shadow — non ancora attiva
        source: 'user',   // distingue da bootstrap
        lastUsed: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        _synced: 0,
        _deleted: false,
      })
    }
  } catch (err) {
    console.warn('[Brain] Synapse update error:', err)
  }
}

async function pruneIfNeeded(familyId) {
  const count = await db.patterns.where('family_id').equals(familyId).and(p => !p._deleted).count()
  if (count < MAX_SYNAPSES) return
  const weakest = await db.patterns
    .where('family_id').equals(familyId)
    .and(p => !p._deleted)
    .sortBy('score')
  if (weakest.length > 0) {
    await db.patterns.update(weakest[0].id, { _deleted: true })
  }
}

function extractKeywordsFromAction(action) {
  const source = action.title || action.name || action.note || ''
  return tokenizeForMatching(source).map(stemIT).filter(s => s.length >= 3).slice(0, 5)
}
