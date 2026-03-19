/**
 * R3.5 — Voice input: speech-to-text + NLP with Claude Haiku.
 * Modeled after brain.php from cristianperani.com/spese/
 *
 * Flow:
 * 1. Browser SpeechRecognition → text
 * 2. Text → Claude Haiku API → MULTIPLE structured actions
 * 3. Execute each action via existing CRUD functions
 *
 * One message can generate multiple actions:
 *   "Viola stasera prepara la frittata, Asia svuota la lavastoviglie,
 *    domani dentista alle 16, ho speso 45 euro alimentari"
 *   → task + task + calendar + expense + meal
 */

import { normalizeAndValidateActions } from './brain/actionNormalizer.js'
import { supabase, isSyncEnabled } from './supabase.js'

/**
 * Check if speech recognition is available.
 */
export function isSpeechAvailable() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

/**
 * Request microphone permission (needed for Android WebView).
 * Returns true if granted, false otherwise.
 */
async function requestMicPermission() {
  try {
    // Try navigator.permissions first (not all browsers support this)
    if (navigator.permissions) {
      const result = await navigator.permissions.query({ name: 'microphone' })
      if (result.state === 'granted') return true
    }
    // Fallback: request via getUserMedia (triggers the system permission dialog)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // Stop the stream immediately — we only needed to trigger the permission
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

/**
 * Record speech and return transcribed text.
 */
export function recordSpeech({ lang = 'it-IT', timeout = 10000 } = {}) {
  return new Promise(async (resolve, reject) => {
    if (!isSpeechAvailable()) {
      return reject(new Error('Speech recognition non supportato'))
    }

    // Ensure microphone permission before starting (critical on Android)
    const hasPermission = await requestMicPermission()
    if (!hasPermission) {
      return reject(new Error('Permesso microfono negato. Vai nelle impostazioni dell\'app e abilita il microfono.'))
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    const timer = setTimeout(() => {
      recognition.stop()
      reject(new Error('Timeout — nessun parlato rilevato. Assicurati che il microfono funzioni.'))
    }, timeout)

    recognition.onresult = (event) => {
      clearTimeout(timer)
      resolve(event.results[0][0].transcript)
    }

    recognition.onerror = (event) => {
      clearTimeout(timer)
      // Messaggi specifici per tipo di errore
      const messages = {
        'no-speech': 'Nessun parlato rilevato. Prova a parlare più forte.',
        'audio-capture': 'Microfono non disponibile. Controlla i permessi.',
        'not-allowed': 'Permesso microfono negato. Abilitalo nelle impostazioni.',
        'network': 'Errore di rete. Controlla la connessione internet.',
        'aborted': 'Riconoscimento vocale annullato.',
      }
      reject(new Error(messages[event.error] || `Errore riconoscimento: ${event.error}`))
    }

    recognition.onend = () => clearTimeout(timer)
    recognition.start()
  })
}

/**
 * Parse voice text with Claude Haiku — MULTI-ACTION like brain.php.
 *
 * Returns: { ok, actions[], summary }
 * Action types: task, calendar, expense, meal, shopping, note
 */
/**
 * Costruisce il messaggio utente per L3.
 * Se c'è un tentativo locale (disambiguation mode), lo include come contesto
 * così che Haiku confermi/corregga anziché rifare il parsing da zero.
 */
function buildL3UserMessage(text, localAttempt) {
  if (!localAttempt || !localAttempt.actions?.length) return text

  const attemptSummary = localAttempt.actions.map((a, i) =>
    `  ${i + 1}. type="${a.type}" title="${a.title || a.name || ''}" conf=${((localAttempt.confidence || 0) * 100).toFixed(0)}%`
  ).join('\n')

  return `MESSAGGIO UTENTE: "${text}"

IL SISTEMA LOCALE HA TENTATO DI PARSARE MA CON CONFIDENZA BASSA (${((localAttempt.confidence || 0) * 100).toFixed(0)}%):
${attemptSummary}

Verifica e correggi il parsing locale, oppure fai un nuovo parsing se è completamente sbagliato.`
}

export async function parseVoiceWithAI(text, context = {}, localAttempt = null) {
  const today = new Date().toISOString().slice(0, 10)
  const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
  const todayDayName = dayNames[new Date().getDay()]
  const members = context.members || []

  // ─── Edge Function only (API key stays server-side) ─────
  if (!isSyncEnabled()) {
    throw new Error('AI non disponibile: sync non configurato. Il cervellone locale funziona comunque per la maggior parte dei comandi.')
  }

  let rawResult
  try {
    rawResult = await callEdgeFunction(text, context, localAttempt, today, todayDayName)
  } catch (edgeErr) {
    throw new Error(`AI non disponibile: ${edgeErr.message}. Il cervellone locale funziona comunque per la maggior parte dei comandi.`)
  }

  // ─── Normalizzazione canonica L3 ─────────────────────────
  // Il JSON da Edge Function o Haiku è input "sporco": shape variabili, nomi non risolti.
  // Passa sempre per normalizer + validator prima di entrare nel sistema.
  const normContext = {
    familyId: context.familyId || null,
    currentMemberId: context.currentMember?.id || null,
    members: members.map(m => ({ id: m.id, name: m.name, role: m.role })),
    source: 'L3',
    textOriginal: text,
    confidence: 1.0,
    usedAI: true,
  }

  const { actions: canonical, invalid } = normalizeAndValidateActions(rawResult.actions, normContext)

  if (invalid.length > 0) {
    console.warn(`[Voice/L3] ${invalid.length} azioni scartate:`, invalid.map(i => i.errors))
  }

  return {
    ok: true,
    actions: canonical.length > 0 ? canonical : [{ type: 'note', text }],
    summary: rawResult.summary || `${canonical.length} azioni trovate`,
  }
}

/**
 * Call the Supabase Edge Function brain-parse.
 * Returns { actions, summary } (raw, pre-normalization).
 */
async function callEdgeFunction(text, context, localAttempt, today, dayName) {
  const members = context.members || []
  const parentNames = members
    .filter((m) => m.role === 'genitore' || m.role === 'parent' || m.role === 'elder')
    .map((m) => m.name)

  const { data, error } = await supabase.functions.invoke('brain-parse', {
    body: {
      text: text.slice(0, 500),
      context: {
        members: members.map(m => ({ name: m.name, role: m.role })),
        today,
        day_name: dayName,
        categories: ['spesa', 'trasporti', 'salute', 'casa', 'abbigliamento', 'istruzione', 'svago', 'ristorante', 'bollette', 'sport', 'altro'],
      },
      localAttempt: localAttempt || undefined,
    },
  })

  if (error) throw error
  if (!data?.ok) throw new Error(data?.error || 'Edge Function returned not ok')
  if (!data.actions?.length) throw new Error('No actions from Edge Function')

  return { actions: data.actions, summary: data.summary }
}

