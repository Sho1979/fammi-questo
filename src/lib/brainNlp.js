/**
 * brainNlp.js — L1 Classifier Adapter (attualmente NLP.js).
 *
 * ═══════════════════════════════════════════════════════════════
 * EXIT PLAN — Interfaccia stabile per sostituzione del provider
 * ═══════════════════════════════════════════════════════════════
 *
 * Questo modulo è l'UNICO punto di contatto con @nlpjs/*.
 * Nessun altro file del progetto importa @nlpjs direttamente.
 *
 * Per sostituire NLP.js con un altro provider (es. TensorFlow.js,
 * ONNX Runtime, Transformers.js, o un classificatore custom):
 *   1. Mantieni le stesse export con la stessa signature
 *   2. Sostituisci l'implementazione interna
 *   3. Nessun altro file va toccato
 *
 * INTERFACCIA PUBBLICA (contratto stabile):
 *
 *   initNlp(familyId: string): Promise<boolean>
 *     → Inizializza il classificatore. Carica modello se esiste,
 *       altrimenti traina da zero. Ritorna true se pronto.
 *
 *   classify(text: string): Promise<{
 *     intent: string,         — es. 'calendar.medico', 'task.cucina', 'None'
 *     score: number,          — 0..1 confidence
 *     action: {type, category} | null,
 *     classifications: Array  — top-5 intent+score per debug
 *   }>
 *
 *   addTrainingDocument(text: string, intent: string, familyId: string): Promise<void>
 *     → Aggiunge esempio di training. Re-train automatico dopo RETRAIN_THRESHOLD.
 *
 *   removeTrainingDocument(text: string, intent: string, familyId: string): Promise<void>
 *     → Marca documento come rimosso. Effettivo al prossimo fullRetrain.
 *
 *   retrain(familyId: string): Promise<void>
 *     → Re-training incrementale con documenti pendenti.
 *
 *   fullRetrain(familyId: string): Promise<void>
 *     → Re-training completo da zero (dopo rimozioni).
 *
 *   getNlpStats(familyId: string): Promise<{
 *     isReady, isTraining, baseDocuments, userDocuments,
 *     totalDocuments, pendingRetrain, intentsCount
 *   }>
 *
 *   isNlpReady(): boolean
 *     → Stato sincrono: classificatore pronto?
 *
 * ═══════════════════════════════════════════════════════════════
 * IMPLEMENTAZIONE CORRENTE: NLP.js (AXA Group)
 * ═══════════════════════════════════════════════════════════════
 *
 * NLP.js è una rete neurale client-side:
 *   - Tokenizzazione + stemming italiano built-in
 *   - Perceptron multi-layer per classificazione
 *   - Training incrementale (aggiunta nuovi documenti)
 *   - Modello serializzabile JSON (persist in IndexedDB)
 *
 * Architettura:
 *   1. Al boot, carica modello da IndexedDB (se esiste)
 *   2. Se non esiste, traina da zero con TRAINING_DOCUMENTS
 *   3. Ogni conferma utente aggiunge documenti di training
 *   4. Re-training periodico (batch, non per ogni input)
 *
 * NOTA: NLP.js gira interamente in browser — zero chiamate server.
 */
import { containerBootstrap } from '@nlpjs/core'
import { Nlp } from '@nlpjs/nlp'
import { LangIt } from '@nlpjs/lang-it'
import { db } from './localDb.js'
import { TRAINING_DOCUMENTS, INTENT_TO_ACTION } from './brainTrainingSet.js'

// ═══════════════════════════════════════════════════════════════
// SINGLETON & STATE
// ═══════════════════════════════════════════════════════════════
let nlpInstance = null
let isTraining = false
let isReady = false
let pendingDocs = []    // documenti in attesa di re-training
const RETRAIN_THRESHOLD = 5  // re-train dopo N nuovi documenti

// ═══════════════════════════════════════════════════════════════
// INIT — Bootstrap container + lingua italiana + carica modello
// ═══════════════════════════════════════════════════════════════
/**
 * Inizializza NLP.js. Chiamare una volta all'avvio dell'app.
 * Se esiste un modello salvato in IndexedDB, lo carica (istantaneo).
 * Altrimenti traina da zero (~2-4 secondi su mobile).
 *
 * @param {string} familyId - ID famiglia per namespace modello
 * @returns {Promise<boolean>} true se pronto
 */
export async function initNlp(familyId) {
  if (isReady && nlpInstance) return true
  if (isTraining) {
    // Aspetta che il training in corso finisca
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (isReady) { clearInterval(check); resolve(true) }
      }, 200)
    })
  }

  isTraining = true
  console.log('[NLP] Inizializzazione...')

  try {
    // 1. Bootstrap container con lingua italiana
    const container = await containerBootstrap()
    container.use(Nlp)
    container.use(LangIt)

    nlpInstance = container.get('nlp')
    nlpInstance.settings.autoSave = false
    nlpInstance.settings.autoLoad = false
    // Aggiunta lingua italiana
    nlpInstance.addLanguage('it')

    // Soglia minima NLU
    nlpInstance.settings.nlu = { log: false }

    // 2. Prova a caricare modello da IndexedDB
    const savedModel = await loadModelFromDb(familyId)

    if (savedModel) {
      console.log('[NLP] Modello trovato in DB, importo...')
      nlpInstance.import(savedModel)
      isReady = true
      isTraining = false
      console.log('[NLP] Modello caricato da DB — pronto!')
      return true
    }

    // 3. Nessun modello salvato → training da zero
    console.log('[NLP] Nessun modello salvato, training da zero...')
    await trainFromScratch(familyId)

    isReady = true
    isTraining = false
    console.log('[NLP] Training completato — pronto!')
    return true

  } catch (err) {
    console.error('[NLP] Inizializzazione fallita:', err)
    isTraining = false
    isReady = false
    return false
  }
}

// ═══════════════════════════════════════════════════════════════
// TRAINING — da training set base + documenti utente dal DB
// ═══════════════════════════════════════════════════════════════
async function trainFromScratch(familyId) {
  if (!nlpInstance) throw new Error('NLP non inizializzato')

  const t0 = performance.now()

  // A. Documenti base dal training set
  for (const doc of TRAINING_DOCUMENTS) {
    nlpInstance.addDocument('it', doc.text, doc.intent)
  }

  // B. Documenti utente dal DB (apprendimento pregresso)
  const userDocs = await loadUserDocuments(familyId)
  for (const doc of userDocs) {
    nlpInstance.addDocument('it', doc.text, doc.intent)
  }

  console.log(`[NLP] Training con ${TRAINING_DOCUMENTS.length} base + ${userDocs.length} utente...`)

  // C. Train!
  await nlpInstance.train()

  const elapsed = Math.round(performance.now() - t0)
  console.log(`[NLP] Training completato in ${elapsed}ms`)

  // D. Salva modello in DB
  await saveModelToDb(familyId)
}

// ═══════════════════════════════════════════════════════════════
// CLASSIFY — classifica un testo e ritorna intent + confidence
// ═══════════════════════════════════════════════════════════════
/**
 * Classifica un testo in italiano.
 *
 * @param {string} text - Frase da classificare
 * @returns {Promise<{intent: string, score: number, action: {type, category}|null, classifications: Array}>}
 */
export async function classify(text) {
  if (!nlpInstance || !isReady) {
    console.warn('[NLP] Non pronto, ritorno None')
    return { intent: 'None', score: 0, action: null, classifications: [] }
  }

  const response = await nlpInstance.process('it', text)

  const intent = response.intent || 'None'
  const score = response.score || 0
  const action = INTENT_TO_ACTION[intent] || null

  // Top 3 classificazioni per debug
  const classifications = (response.classifications || [])
    .slice(0, 5)
    .map(c => ({
      intent: c.intent,
      score: Math.round(c.score * 100) / 100,
      action: INTENT_TO_ACTION[c.intent] || null,
    }))

  return { intent, score, action, classifications }
}

// ═══════════════════════════════════════════════════════════════
// LEARN — aggiungi documenti di training dall'uso reale
// ═══════════════════════════════════════════════════════════════
/**
 * Aggiunge un documento di training (frase → intent) dall'uso reale.
 * Non ritraina subito: accumula e ritraina in batch.
 *
 * @param {string} text - Frase originale dell'utente
 * @param {string} intent - Intent confermato (es. 'calendar.medico')
 * @param {string} familyId - ID famiglia
 */
export async function addTrainingDocument(text, intent, familyId) {
  if (!text || !intent || !familyId) return

  // Salva in DB per persistenza
  try {
    await db.nlpDocuments.add({
      id: crypto.randomUUID(),
      family_id: familyId,
      text: text.toLowerCase().trim(),
      intent,
      createdAt: new Date().toISOString(),
      _synced: 0,
      _deleted: false,
    })
  } catch (err) {
    console.warn('[NLP] Errore salvataggio documento:', err)
  }

  // Accumula per re-training
  pendingDocs.push({ text, intent })

  // Se abbiamo abbastanza documenti pendenti, ri-traina
  if (pendingDocs.length >= RETRAIN_THRESHOLD) {
    await retrain(familyId)
  }
}

/**
 * Forza re-training con tutti i documenti pendenti.
 * Chiamare quando serve (es. alla chiusura dell'app, ogni tanto).
 */
export async function retrain(familyId) {
  if (!nlpInstance || isTraining || pendingDocs.length === 0) return

  isTraining = true
  console.log(`[NLP] Re-training con ${pendingDocs.length} nuovi documenti...`)

  try {
    // Aggiungi i documenti pendenti
    for (const doc of pendingDocs) {
      nlpInstance.addDocument('it', doc.text, doc.intent)
    }

    pendingDocs = []

    // Re-train
    await nlpInstance.train()

    // Salva modello aggiornato
    await saveModelToDb(familyId)

    console.log('[NLP] Re-training completato')
  } catch (err) {
    console.error('[NLP] Re-training fallito:', err)
  } finally {
    isTraining = false
  }
}

// ═══════════════════════════════════════════════════════════════
// REMOVE DOCUMENT — rimuovi un documento (per punizione)
// ═══════════════════════════════════════════════════════════════
/**
 * Rimuove documenti di training per un intent specifico
 * quando l'utente rifiuta un'azione. Serve per disimparare.
 *
 * NLP.js non supporta rimozione diretta, quindi:
 * 1. Segna il documento come _deleted nel DB
 * 2. Al prossimo re-training completo, il documento non verrà incluso
 *
 * @param {string} text - Frase originale
 * @param {string} intent - Intent da disimparare
 * @param {string} familyId - ID famiglia
 */
export async function removeTrainingDocument(text, intent, familyId) {
  if (!text || !intent || !familyId) return

  try {
    const docs = await db.nlpDocuments
      .where('family_id').equals(familyId)
      .and(d => d.text === text.toLowerCase().trim() && d.intent === intent && !d._deleted)
      .toArray()

    for (const doc of docs) {
      await db.nlpDocuments.update(doc.id, { _deleted: true, _synced: 0 })
    }

    if (docs.length > 0) {
      console.log(`[NLP] Rimossi ${docs.length} documenti per intent "${intent}"`)
    }
  } catch (err) {
    console.warn('[NLP] Errore rimozione documento:', err)
  }
}

/**
 * Re-training completo da zero (utile dopo rimozioni).
 * Ricostruisce il modello usando solo documenti non-deleted.
 */
export async function fullRetrain(familyId) {
  if (!nlpInstance || isTraining) return

  isTraining = true
  console.log('[NLP] Full re-training da zero...')

  try {
    // Ricrea istanza pulita
    const container = await containerBootstrap()
    container.use(Nlp)
    container.use(LangIt)

    nlpInstance = container.get('nlp')
    nlpInstance.settings.autoSave = false
    nlpInstance.settings.autoLoad = false
    nlpInstance.addLanguage('it')

    await trainFromScratch(familyId)
    pendingDocs = []

    console.log('[NLP] Full re-training completato')
  } catch (err) {
    console.error('[NLP] Full re-training fallito:', err)
  } finally {
    isTraining = false
  }
}

// ═══════════════════════════════════════════════════════════════
// PERSISTENCE — salva/carica modello in IndexedDB
// ═══════════════════════════════════════════════════════════════
const MODEL_STORE_KEY = 'nlp-model'

async function saveModelToDb(familyId) {
  if (!nlpInstance) return

  try {
    const modelJson = nlpInstance.export(true) // true = minified
    const key = `${MODEL_STORE_KEY}-${familyId}`

    // Usa la tabella settings di Dexie per salvare il modello
    await db.settings.put({
      id: key,
      family_id: familyId,
      key: 'nlpModel',
      value: JSON.stringify(modelJson),
      updatedAt: new Date().toISOString(),
      _synced: 0,
      _deleted: false,
    })

    console.log('[NLP] Modello salvato in DB')
  } catch (err) {
    console.warn('[NLP] Errore salvataggio modello:', err)
  }
}

async function loadModelFromDb(familyId) {
  try {
    const key = `${MODEL_STORE_KEY}-${familyId}`
    const record = await db.settings.get(key)

    if (record?.value) {
      return JSON.parse(record.value)
    }
  } catch (err) {
    console.warn('[NLP] Errore caricamento modello:', err)
  }
  return null
}

async function loadUserDocuments(familyId) {
  try {
    const docs = await db.nlpDocuments
      .where('family_id').equals(familyId)
      .and(d => !d._deleted)
      .toArray()
    return docs.map(d => ({ text: d.text, intent: d.intent }))
  } catch (err) {
    console.warn('[NLP] Errore caricamento documenti utente:', err)
    return []
  }
}

// ═══════════════════════════════════════════════════════════════
// STATS — informazioni sul modello
// ═══════════════════════════════════════════════════════════════
/**
 * Ritorna statistiche del modello NLP.
 */
export async function getNlpStats(familyId) {
  const userDocsCount = familyId
    ? await db.nlpDocuments
        .where('family_id').equals(familyId)
        .and(d => !d._deleted)
        .count()
        .catch(() => 0)
    : 0

  return {
    isReady,
    isTraining,
    baseDocuments: TRAINING_DOCUMENTS.length,
    userDocuments: userDocsCount,
    totalDocuments: TRAINING_DOCUMENTS.length + userDocsCount,
    pendingRetrain: pendingDocs.length,
    intentsCount: Object.keys(INTENT_TO_ACTION).length,
  }
}

/**
 * Stato rapido: il modello è pronto per classificare?
 */
export function isNlpReady() {
  return isReady && nlpInstance !== null
}
