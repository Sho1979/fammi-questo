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
import { AI_MODEL, AI_API_URL } from './constants.js'

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

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

  // ─── Strategy: Edge Function first, direct API fallback ─────
  // Edge Function keeps ANTHROPIC_API_KEY server-side (no browser exposure)
  let rawResult
  if (isSyncEnabled()) {
    try {
      rawResult = await callEdgeFunction(text, context, localAttempt, today, todayDayName)
    } catch (edgeErr) {
      console.warn('[Voice/L3] Edge Function failed, falling back to direct API:', edgeErr.message)
    }
  }

  // Fallback: call Anthropic API directly (requires VITE_ANTHROPIC_API_KEY in .env)
  if (!rawResult) {
    rawResult = await callAnthropicDirect(text, context, localAttempt, today, todayDayName, members)
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

/**
 * Fallback: call Anthropic API directly from browser.
 * Used when Edge Function is unavailable (Supabase not configured, or function error).
 * Returns { actions, summary } (raw, pre-normalization).
 */
async function callAnthropicDirect(text, context, localAttempt, today, todayDayName, members) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('AI non disponibile: la funzione cloud non risponde e nessuna API key è configurata. Il cervellone locale funziona comunque per la maggior parte dei comandi.')
  }

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const personsStr = members.map((m) => `${m.name} (${m.role})`).join(', ')
  const parentNames = members.filter((m) => m.role === 'genitore' || m.role === 'parent').map((m) => m.name)
  const currentUser = context.currentMember?.name || 'Utente'

  const systemPrompt = `Sei il cervello di un'app famiglia italiana. Parsi messaggi vocali/testo in azioni strutturate.

OGGI: ${today} (${todayDayName})
DOMANI: ${tomorrow}
UTENTE CORRENTE: ${currentUser}
PERSONE FAMIGLIA: ${personsStr}
GENITORI: ${parentNames.join(', ')}
CATEGORIE SPESA: spesa, trasporti, salute, casa, abbigliamento, istruzione, svago, ristorante, bollette, sport, altro

REGOLE DI PARSING:
1. Un messaggio può contenere MULTIPLE azioni — estraile TUTTE
2. Tipi azione: "task", "calendar", "expense", "meal", "shopping", "note"
3. Se una persona è nominata prima di un'azione, quell'azione è per lei
4. "stasera prepara X" → task cucina + meal
5. "domani alle 16 dentista" → calendar
6. "45 euro alimentari" → expense
7. Se non capisci → "note"
8. Date: "domani"=${tomorrow}, "oggi"=${today}, "stasera"=${today}
9. Giorni settimana → calcola la data corretta
10. "porta [persona]" → accompaniedBy (genitori: ${parentNames.join(', ')})
11. Ogni azione con data DEVE avere "date" in YYYY-MM-DD
12. "compra X" → shopping

RISPONDI SOLO con JSON valido:
{
  "actions": [
    { "type": "task", "title": "...", "assignedTo": "Nome", "date": "YYYY-MM-DD" },
    { "type": "calendar", "title": "...", "date": "YYYY-MM-DD", "time": "HH:mm" },
    { "type": "expense", "amount": 45.00, "category": "...", "note": "...", "date": "YYYY-MM-DD" },
    { "type": "meal", "name": "...", "date": "YYYY-MM-DD" },
    { "type": "shopping", "name": "...", "quantity": 1, "unit": "pz" },
    { "type": "note", "text": "..." }
  ],
  "summary": "2 task, 1 evento, 1 spesa"
}`

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: buildL3UserMessage(text, localAttempt) }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`API error: ${response.status} — ${err}`)
  }

  const result = await response.json()
  let aiText = result.content?.[0]?.text || '{}'
  aiText = aiText.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    const parsed = JSON.parse(aiText)
    if (!parsed.actions || !Array.isArray(parsed.actions)) {
      return { actions: [{ type: 'note', text }], summary: 'Non ho capito — salvato come nota' }
    }

    // Basic validation
    const validTypes = ['task', 'calendar', 'expense', 'meal', 'shopping', 'note']
    const cleaned = parsed.actions.filter(a => a.type && validTypes.includes(a.type))

    return { actions: cleaned.length > 0 ? cleaned : [{ type: 'note', text }], summary: parsed.summary }
  } catch {
    return { actions: [{ type: 'note', text }], summary: 'Non ho capito — salvato come nota' }
  }
}
