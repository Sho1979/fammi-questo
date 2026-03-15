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

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

/**
 * Check if speech recognition is available.
 */
export function isSpeechAvailable() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

/**
 * Record speech and return transcribed text.
 */
export function recordSpeech({ lang = 'it-IT', timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!isSpeechAvailable()) {
      return reject(new Error('Speech recognition non supportato'))
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    const timer = setTimeout(() => {
      recognition.stop()
      reject(new Error('Timeout — nessun audio rilevato'))
    }, timeout)

    recognition.onresult = (event) => {
      clearTimeout(timer)
      resolve(event.results[0][0].transcript)
    }

    recognition.onerror = (event) => {
      clearTimeout(timer)
      reject(new Error(`Errore riconoscimento: ${event.error}`))
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
  if (!ANTHROPIC_API_KEY) {
    throw new Error('API key Anthropic non configurata')
  }

  const today = new Date().toISOString().slice(0, 10)
  const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
  const todayDayName = dayNames[new Date().getDay()]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const members = context.members || []
  const personsStr = members.map((m) => `${m.name} (${m.role})`).join(', ')
  const parentNames = members.filter((m) => m.role === 'genitore' || m.role === 'parent').map((m) => m.name)
  const currentUser = context.currentMember?.name || 'Utente'

  const categories = 'spesa, trasporti, salute, casa, abbigliamento, istruzione, svago, ristorante, bollette, sport, altro'
  const eventCategories = 'sport, scuola, medico, lavoro, famiglia, compleanno, hobby, viaggio, altro'

  const systemPrompt = `Sei il cervello di un'app famiglia italiana. Parsi messaggi vocali/testo in azioni strutturate.

OGGI: ${today} (${todayDayName})
DOMANI: ${tomorrow}
UTENTE CORRENTE: ${currentUser}
PERSONE FAMIGLIA: ${personsStr}
GENITORI (possono portare/riprendere): ${parentNames.join(', ')}
CATEGORIE SPESA: ${categories}
CATEGORIE EVENTO: ${eventCategories}

REGOLE DI PARSING:
1. Un messaggio può contenere MULTIPLE azioni — estraile TUTTE
2. Ogni azione ha un TIPO: "task", "calendar", "expense", "meal", "shopping", "note"
3. Se una persona è nominata prima di un'azione, quell'azione è per lei
4. "stasera prepara X" → task di cucina + meal (il piatto)
5. "vai a prendere X" → task
6. "domani alle 16 dentista" → calendar
7. "45 euro alimentari" o "ho speso 30 euro benzina" → expense
8. Se non capisci qualcosa, mettilo come "note" con il testo originale
9. Per le date: "domani"=${tomorrow}, "oggi"=${today}
10. "stasera", "per cena" → task per oggi
11. Se il messaggio è solo un piatto/cibo senza contesto → meal per stasera
12. "dì a [persona] di fare X" → task assegnato a quella persona
13. Se c'è un orario (verso le 11, alle 16) → aggiungilo nel campo time
14. "giovedì", "venerdì" ecc. → calcola la data corretta dal giorno della settimana
15. "porta [persona]" o "vai a prendere [persona]" → task + evento calendario per chi viene portato
16. "la porta X" o "accompagnato da X" → accompaniedBy nel calendar
17. "la riprende Y" o "lo va a prendere Y" → pickupBy nel calendar
18. accompaniedBy e pickupBy devono essere genitori: ${parentNames.join(', ')}
19. Ogni azione deve avere SEMPRE il campo "date" in formato YYYY-MM-DD
20. "compra X" o "prendi X al supermercato" → shopping (lista della spesa)
21. "aggiungi X alla lista" → shopping

RISPONDI SOLO con JSON valido, nessun altro testo. Formato:
{
  "actions": [
    {
      "type": "task",
      "title": "Prepara la frittata",
      "assignedTo": "Viola",
      "date": "${today}"
    },
    {
      "type": "calendar",
      "title": "Dentista Asia",
      "assignedTo": "Asia",
      "date": "${tomorrow}",
      "time": "16:00",
      "category": "medico",
      "accompaniedBy": "Chiara",
      "pickupBy": "Cristian"
    },
    {
      "type": "expense",
      "amount": 45.00,
      "category": "spesa",
      "note": "spesa al Conad",
      "person": "${currentUser}"
    },
    {
      "type": "meal",
      "name": "Frittata e insalata",
      "date": "${today}"
    },
    {
      "type": "shopping",
      "name": "Latte",
      "quantity": 2,
      "unit": "L"
    },
    {
      "type": "note",
      "text": "testo non riconosciuto"
    }
  ],
  "summary": "2 task, 1 evento, 1 spesa, 1 piatto"
}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
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

  // Clean markdown wrapper
  aiText = aiText.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim()

  try {
    const parsed = JSON.parse(aiText)
    if (!parsed.actions || !Array.isArray(parsed.actions)) {
      return { ok: true, actions: [{ type: 'note', text }], summary: 'Non ho capito — salvato come nota' }
    }

    // Validate and clean actions
    const validTypes = ['task', 'calendar', 'expense', 'meal', 'shopping', 'note']
    const memberNames = members.map((m) => m.name.toLowerCase())
    const cleaned = []

    for (const action of parsed.actions) {
      if (!action.type || !validTypes.includes(action.type)) continue

      // Validate person references
      if (action.assignedTo) {
        const found = members.find((m) => m.name.toLowerCase() === action.assignedTo.toLowerCase())
        if (!found) action.assignedTo = null
      }
      if (action.person) {
        const found = members.find((m) => m.name.toLowerCase() === action.person.toLowerCase())
        if (!found) action.person = null
      }

      // Validate expense
      if (action.type === 'expense') {
        action.amount = parseFloat(action.amount) || 0
        if (action.amount <= 0) continue
      }

      // Default date = today
      if (['task', 'calendar', 'meal'].includes(action.type) && !action.date) {
        action.date = today
      }

      cleaned.push(action)
    }

    // ─── Normalizzazione canonica L3 ─────────────────────────
    // Il JSON Haiku è input sporco: shape variabili, nomi non risolti.
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

    const { actions: canonical, invalid, warnings } = normalizeAndValidateActions(cleaned, normContext)

    if (invalid.length > 0) {
      console.warn(`[Voice/L3] ${invalid.length} azioni Haiku scartate:`, invalid.map(i => i.errors))
    }

    return {
      ok: true,
      actions: canonical.length > 0 ? canonical : [{ type: 'note', text }],
      summary: parsed.summary || `${canonical.length} azioni trovate`,
    }
  } catch {
    return { ok: true, actions: [{ type: 'note', text }], summary: 'Non ho capito — salvato come nota' }
  }
}
