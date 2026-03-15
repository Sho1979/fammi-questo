/**
 * useBrain.js — Hook orchestratore del cervellone.
 *
 * Flusso:
 *   1. Init NLP.js all'avvio (una volta per sessione)
 *   2. Input (voce o testo)
 *   3. brainParse: L0 pattern → L1 NLP.js → L2 sinapsi → L3 AI
 *   4. BrainSheet: anteprima azioni per conferma utente
 *   5. executeActions: distribuisce in task/calendar/expenses/meals/shopping
 *   6. learnFromConfirmed / learnFromRejected: rinforzo / punizione
 *   7. applyDecay: dimenticanza naturale all'avvio
 *
 * Stato esposto:
 *   - phase: 'idle' | 'listening' | 'parsing' | 'preview' | 'executing' | 'done' | 'error'
 *   - result: { actions[], summary, usedAI, confidence }
 *   - transcript: testo trascritto dalla voce
 *   - nlpReady: booleano, NLP.js è inizializzato
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import useAuthStore from '../store/authStore.js'
import { isSpeechAvailable, recordSpeech } from '../lib/voice.js'
import { brainParse, learnFromConfirmed, learnFromRejected, applyDecay } from '../lib/brain/index.js'
import { initNlp, retrain, isNlpReady } from '../lib/brainNlp.js'
import { expireOldDrafts } from '../lib/brain/conversationMemory.js'
import { addExpense } from './useExpenses.js'
import { addEvent } from './useCalendar.js'
import { addTask } from './useTasks.js'
import { addShoppingItem } from './useShopping.js'
import { scheduleShoppingReminders, scheduleDailyTaskReminders } from '../lib/notificationScheduler.js'
import { notifyAll, notify } from './useNotifications.js'
import { addMealPlan } from './useMeals.js'
import { AI_MAX_DAILY_CALLS } from '../lib/constants.js'

// Rate limit: max AI_MAX_DAILY_CALLS calls/day (local parse is unlimited)
// Persistito in Dexie settings con lastResetDate per sopravvivere al reload
const MAX_DAILY_AI_CALLS = AI_MAX_DAILY_CALLS
const AI_RATE_LIMIT_KEY = 'ai-rate-limit'

async function loadAICallCount() {
  try {
    const record = await db.settings.get(AI_RATE_LIMIT_KEY)
    if (!record) return 0
    const today = new Date().toISOString().slice(0, 10)
    // Reset se il giorno è cambiato
    if (record.lastResetDate !== today) {
      await db.settings.put({ ...record, count: 0, lastResetDate: today })
      return 0
    }
    return record.count || 0
  } catch { return 0 }
}

async function incrementAICallCount() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const record = await db.settings.get(AI_RATE_LIMIT_KEY)
    if (record && record.lastResetDate === today) {
      await db.settings.update(AI_RATE_LIMIT_KEY, { count: (record.count || 0) + 1 })
      return (record.count || 0) + 1
    }
    await db.settings.put({
      id: AI_RATE_LIMIT_KEY,
      key: 'aiRateLimit',
      count: 1,
      lastResetDate: today,
      _deleted: false,
    })
    return 1
  } catch { return 0 }
}

// Init flags — Promise-based singleton per evitare race condition
let decayApplied = false
let nlpInitPromise = null // Promise singleton (non booleano)

export default function useBrain() {
  const { familyId, currentMember } = useAuthStore()

  const [phase, setPhase] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [result, setResult] = useState(null)
  const [executionLog, setExecutionLog] = useState([])
  const [error, setError] = useState(null)
  const [nlpReady, setNlpReady] = useState(false)
  const originalTextRef = useRef('')
  const originalActionsRef = useRef([])
  const aiCallCountRef = useRef(0)

  // Live members list
  const members = useLiveQuery(
    () => familyId
      ? db.members.where('family_id').equals(familyId).and(m => !m._deleted).toArray()
      : [],
    [familyId],
    []
  )

  // ─── INIT NLP.js + DECAY ALL'AVVIO ─────────────────────────
  useEffect(() => {
    if (!familyId) return

    // Decay (una volta per sessione)
    if (!decayApplied) {
      decayApplied = true
      applyDecay(familyId).then(() => {
        console.log('[Brain] Decay applicato')
      }).catch(err => {
        console.warn('[Brain] Decay failed:', err)
      })
    }

    // Cleanup expired conversation drafts (fire-and-forget)
    expireOldDrafts(familyId).catch(err =>
      console.warn('[Brain] Draft cleanup failed:', err)
    )

    // Init NLP.js — Promise singleton: se già in corso, riusa la stessa Promise
    // Evita race condition con mount simultanei (React Strict Mode, ecc.)
    let cancelled = false
    if (!nlpInitPromise) {
      console.log('[Brain] Avvio inizializzazione NLP.js...')
      nlpInitPromise = initNlp(familyId)
    }
    nlpInitPromise.then((ready) => {
      if (!cancelled) {
        setNlpReady(ready)
        console.log(`[Brain] NLP.js ${ready ? 'pronto!' : 'fallito'}`)
      }
    }).catch(err => {
      if (!cancelled) {
        console.warn('[Brain] NLP init failed:', err)
        setNlpReady(false)
      }
    })

    // Carica contatore AI rate limit dal DB
    loadAICallCount().then(count => {
      if (!cancelled) aiCallCountRef.current = count
    })

    return () => { cancelled = true }
  }, [familyId])

  // ─── 1. VOICE INPUT ────────────────────────────────────────
  const startVoice = useCallback(async () => {
    if (!isSpeechAvailable()) {
      setError('Riconoscimento vocale non supportato')
      setPhase('error')
      return
    }

    setPhase('listening')
    setTranscript('')
    setResult(null)
    setError(null)
    setExecutionLog([])

    try {
      const text = await recordSpeech({ lang: 'it-IT', timeout: 12000 })
      setTranscript(text)
      originalTextRef.current = text
      await doParse(text)
    } catch (err) {
      setError(err.message || 'Errore registrazione')
      setPhase('error')
      setTimeout(() => setPhase('idle'), 3000)
    }
  }, [members, familyId, currentMember])

  // ─── 2. TEXT INPUT ─────────────────────────────────────────
  const parseText = useCallback(async (text) => {
    if (!text?.trim()) return

    setTranscript(text)
    setResult(null)
    setError(null)
    setExecutionLog([])
    originalTextRef.current = text
    await doParse(text)
  }, [members, familyId, currentMember])

  // ─── 3. PARSE (L0 + L1 NLP.js + L2 Sinapsi + L3 AI) ─────
  const doParse = async (text) => {
    setPhase('parsing')

    try {
      // Carica i membri: usa quelli live, ma se vuoti fai un fetch diretto da Dexie
      let membersList = members
      if ((!membersList || membersList.length === 0) && familyId) {
        console.warn('[Brain] members vuoti nella closure, carico da DB direttamente...')
        try {
          membersList = await db.members.where('family_id').equals(familyId).toArray()
          // Filtra soft-deleted
          membersList = membersList.filter(m => !m._deleted)
        } catch (err) {
          console.warn('[Brain] Fallback DB members fallito:', err)
          membersList = []
        }
      }
      console.log('[Brain] doParse members:', membersList.map(m => m.name), '(count:', membersList.length, ')')

      // Auto-genera alias familiari italiani se non presenti nel DB
      const autoAliases = (m) => {
        if (m.aliases && m.aliases.length > 0) return m.aliases
        const aliases = []
        const nameEndsA = /a$/i.test(m.name)
        const isFemale = m.gender === 'F' || nameEndsA
        if (m.role === 'parent' || m.role === 'genitore') {
          if (isFemale) aliases.push('mamma')
          else aliases.push('papà', 'papa')
        } else if (m.role === 'nonno') {
          if (isFemale) aliases.push('nonna')
          else aliases.push('nonno')
        }
        return aliases
      }

      const context = {
        members: membersList.map(m => ({ name: m.name, role: m.role, id: m.id, aliases: autoAliases(m) })),
        currentMember,
        familyId,
      }

      const parsed = await brainParse(text, context)

      if (parsed.usedAI) {
        incrementAICallCount().then(count => { aiCallCountRef.current = count })
      }

      if (parsed.ok && parsed.actions?.length > 0) {
        setResult(parsed)
        originalActionsRef.current = [...parsed.actions]
        setPhase('preview')
      } else {
        setError('Non ho trovato azioni nel testo')
        setPhase('error')
        setTimeout(() => setPhase('idle'), 3000)
      }
    } catch (err) {
      setError(err.message || 'Errore di parsing')
      setPhase('error')
      setTimeout(() => setPhase('idle'), 3000)
    }
  }

  // ─── 4. CONFIRM & EXECUTE (con linked entity resolution) ──
  //
  // ══ FAILURE POLICY (Sprint 3) ═══════════════════════════════
  //
  // 1. Se un'azione padre (independent) fallisce, le figlie
  //    (dependent) NON possono risolvere il link via tempRef.
  //    La figlia viene comunque persistita SENZA linked_event_id.
  //
  // 2. Se una figlia (dependent) fallisce, il padre resta
  //    persistito e valido. Nessun rollback.
  //
  // 3. Se tempRef non si risolve (padre non in refToIdMap),
  //    la figlia viene persistita senza link. Log warning.
  //
  // 4. Ogni fallimento (padre o figlia) genera:
  //    - console.error con azione e errore
  //    - entry in executionLog { ok: false, msg, type, linked }
  //
  // 5. Nessun rollback automatico. Le azioni ok restano ok.
  //    L'utente vede il riepilogo nel log e può intervenire.
  //
  // ═══════════════════════════════════════════════════════════════
  const confirmActions = useCallback(async (confirmedActions) => {
    setPhase('executing')
    const log = []
    const refToIdMap = new Map() // actionRef → realDbId

    // Fase 1: azioni indipendenti (senza linkedEntity)
    const independent = confirmedActions.filter(a => !a.linkedEntity)
    const dependent = confirmedActions.filter(a => a.linkedEntity)

    for (const action of independent) {
      try {
        console.log('[Brain] Executing independent action:', action.type, action.title || action.text || '')
        const result = await executeAction(action)
        if (result) {
          log.push({ ok: true, msg: result.msg, type: action.type })
          // Cattura realId per risolvere tempRef nelle azioni dipendenti
          if (result.record?.id && action.meta?.actionRef) {
            refToIdMap.set(action.meta.actionRef, result.record.id)
          }
        } else {
          // executeAction returned null — tipo non gestito o azione vuota
          console.warn('[Brain] executeAction returned null for:', action.type, action)
          log.push({ ok: false, msg: `${action.type}: tipo non riconosciuto`, type: action.type })
        }
      } catch (err) {
        console.error('[Brain] Action failed:', action.type, action.title, err)
        log.push({ ok: false, msg: `${action.type} fallito: ${err.message}`, type: action.type })
      }
    }

    // Fase 2: azioni dipendenti — risolvi tempRef → realId, poi persisti
    for (const action of dependent) {
      if (action.linkedEntity?.tempRef) {
        const realId = refToIdMap.get(action.linkedEntity.tempRef)
        if (realId) {
          action.linkedEntity.realId = realId
        } else {
          // Policy #3: padre non trovato → persisti senza link, log warning
          console.warn(`[Brain] tempRef "${action.linkedEntity.tempRef}" non risolto — padre non persistito o non trovato`)
        }
      }
      try {
        console.log('[Brain] Executing dependent action:', action.type, action.title || action.text || '')
        const result = await executeAction(action)
        if (result) {
          const linked = !!action.linkedEntity?.realId
          log.push({ ok: true, msg: result.msg, type: action.type, linked })
          if (!linked && action.linkedEntity) {
            log.push({ ok: true, msg: `⚠ ${action.type}: collegamento non risolto`, type: action.type, linked: false })
          }
        } else {
          console.warn('[Brain] executeAction (linked) returned null for:', action.type, action)
          log.push({ ok: false, msg: `${action.type}: tipo non riconosciuto`, type: action.type, linked: false })
        }
      } catch (err) {
        console.error('[Brain] Action (linked) failed:', action.type, action.title, err)
        log.push({ ok: false, msg: `${action.type} fallito: ${err.message}`, type: action.type, linked: false })
      }
    }

    setExecutionLog(log)

    // 5. APPRENDIMENTO
    try {
      await learnFromConfirmed(confirmedActions, originalTextRef.current, familyId)

      const confirmedSet = new Set(confirmedActions.map(a => JSON.stringify(a)))
      const rejected = originalActionsRef.current.filter(a => !confirmedSet.has(JSON.stringify(a)))
      if (rejected.length > 0) {
        await learnFromRejected(rejected, originalTextRef.current, familyId)
        console.log(`[Brain] Punite ${rejected.length} sinapsi per azioni rimosse`)
      }

      await retrain(familyId).catch(err => console.warn('[Brain] Retrain failed:', err))
    } catch (err) {
      console.warn('[Brain] Learning failed:', err)
    }

    // Riepilogo esecuzione in console per debug
    const okCount = log.filter(l => l.ok).length
    const failCount = log.filter(l => !l.ok).length
    console.log(`[Brain] Esecuzione completata: ${okCount} ok, ${failCount} fallite`, log)

    setPhase('done')
    // 5 secondi per permettere la lettura del risultato (era 3s)
    setTimeout(() => {
      setPhase('idle')
      setResult(null)
      setTranscript('')
      setExecutionLog([])
    }, 5000)
  }, [familyId, currentMember])

  // ─── CANCEL ────────────────────────────────────────────────
  const cancel = useCallback(() => {
    if (phase === 'preview' && originalActionsRef.current.length > 0) {
      learnFromRejected(originalActionsRef.current, originalTextRef.current, familyId)
        .catch(err => console.warn('[Brain] Reject learning failed:', err))
    }

    setPhase('idle')
    setResult(null)
    setTranscript('')
    setError(null)
    setExecutionLog([])
  }, [phase, familyId])

  // ─── EXECUTE SINGLE ACTION (legge solo campi canonici) ────
  // Niente findMember: il normalizzatore ha già risolto nomi → ID.
  // Slot canonico → DB italiano.
  const SLOT_TO_DB = { dinner: 'cena', lunch: 'pranzo', breakfast: 'colazione' }
  const today = new Date().toISOString().slice(0, 10)

  const executeAction = async (action) => {
    switch (action.type) {
      case 'expense': {
        const record = await addExpense({
          amount: action.amount || 0,
          category: action.category || 'altro',
          note: action.title || '',
          person_id: action.personId || currentMember?.id,
          date: action.date || today,
        })
        return { msg: `Spesa €${action.amount} (${action.category})`, record }
      }

      case 'calendar': {
        // Logistics già risolte dal normalizer con ID
        const logistics = []
        if (action.logistics?.accompaniedById) {
          logistics.push({ role: 'porta', member_id: action.logistics.accompaniedById })
        }
        if (action.logistics?.pickupById) {
          logistics.push({ role: 'riprende', member_id: action.logistics.pickupById })
        }

        const needsPickup = action.logistics
          ? (action.logistics.actionVerb === 'portare' && !action.logistics.pickupById)
          : false

        const eventNote = [
          action.incomplete ? `⚠️ ${action.incomplete}` : '',
          needsPickup ? '⚠️ Chi va a riprendere? Da definire' : '',
        ].filter(Boolean).join(' | ')

        const record = await addEvent({
          title: action.title || 'Evento',
          date: action.date || today,
          time_start: action.timeStart || null,
          time_end: action.timeEnd || null,
          category: action.category || 'altro',
          person_id: action.isFamily ? null : (action.personIds?.[0] || currentMember?.id),
          isFamily: action.isFamily || false,
          note: eventNote,
          logistics,
          incomplete: action.incomplete || null,
          needsPickup,
          isAbsence: action.isAbsence || false,
        })
        return { msg: `Evento "${action.title}"`, record }
      }

      case 'task': {
        const assigneeId = action.assignedToId || currentMember?.id
        const isSelfAssigned = !action.assignedToId || action.assignedToId === currentMember?.id
        const taskData = {
          title: action.title || 'Task',
          assigned_to: assigneeId,
          due_date: action.dueDate || today,
          status: 'todo',
          priority: 'media',
          category: action.category || 'altro',
          points: 5,
          accepted: isSelfAssigned,
          created_by: currentMember?.id,
        }

        // Linked entity: se il task è collegato a un calendar, salva il riferimento
        if (action.linkedEntity?.realId) {
          taskData.linked_event_id = action.linkedEntity.realId
        }

        const record = await addTask(taskData)
        // Se il task ha una scadenza futura, schedula promemoria giornaliero
        if (record?.id && action.dueDate && action.dueDate !== today) {
          try { scheduleDailyTaskReminders({ id: record.id, title: action.title, due_date: action.dueDate }) } catch (e) { /* ignore */ }
        }
        return { msg: `Task "${action.title}" → ${action.assignedToName || 'te'}`, record }
      }

      case 'meal': {
        const dbSlot = SLOT_TO_DB[action.slot] || action.slot || 'cena'
        const record = await addMealPlan({
          date: action.date || today,
          slot: dbSlot,
          name: action.title || 'Piatto',
          note: '',
        })
        return { msg: `Pasto: ${action.title}`, record }
      }

      case 'shopping': {
        const _scope = action.notifyScope || 'personal'
        const record = await addShoppingItem({
          name: action.title || 'Articolo',
          quantity: action.quantity || 1,
          unit: action.unit || 'pz',
          category: action.category || 'altro',
          notifyScope: _scope,
        })
        // Schedula notifiche 'Hai preso X?' alle 12:00 e 18:00
        if (record?.id) {
          try {
            scheduleShoppingReminders({ id: record.id, name: action.title, notifyScope: _scope })
            // Se scope family: notifica in-app a tutti i membri
            if (_scope === 'family') {
              await notifyAll({
                type: 'shopping_reminder',
                title: 'Lista spesa',
                message: 'Da comprare: ' + (action.title || 'Articolo'),
                icon: '🛒',
                data: { itemId: record.id },
              })
            } else {
              // Scope personal: notifica solo a chi scrive
              const _myId = currentMember?.id
              if (_myId) {
                await notify(_myId, {
                  type: 'shopping_reminder',
                  title: 'Promemoria spesa',
                  message: 'Da comprare: ' + (action.title || 'Articolo'),
                  icon: '🛒',
                  data: { itemId: record.id },
                })
              }
            }
          } catch (e) { /* ignore */ }
        }
        return { msg: `Lista: ${action.title}`, record }
      }

      case 'note':
        return { msg: `Nota: "${action.text}"`, record: null }

      case 'reminder': {
        const record = await addTask({
          family_id: familyId,
          title: `🔔 ${action.title}`,
          description: action.title,
          assigned_to: action.assignedToId || null,
          due_date: action.date || today,
          status: 'todo',
          category: 'promemoria',
          accepted: false,
          needsConfirm: action.needsConfirm || false,
          fromPerson: action.fromPersonName || null,
          confirmedAt: null,
        })
        return { msg: `Promemoria per ${action.assignedToName || '?'}: ${action.title}`, record }
      }

      default:
        return null
    }
  }

  return {
    // State
    phase,
    transcript,
    result,
    executionLog,
    error,
    members,
    nlpReady,

    // Actions
    startVoice,
    parseText,
    confirmActions,
    cancel,

    // Info
    aiCallsRemaining: MAX_DAILY_AI_CALLS - aiCallCountRef.current,
    speechAvailable: isSpeechAvailable(),
  }
}
