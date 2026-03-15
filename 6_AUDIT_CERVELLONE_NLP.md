# APP Family — Documentazione Tecnica Completa
**Data:** 13 Marzo 2026 | **Versione:** 4.0 | **Audit:** ✅ 10/10 + 6/6 NLP + Sprint 1-3 Contratto Canonico + Sprint 4 (Dual Action, Notifiche, Calendario 3 Viste)

> Questo documento è progettato per permettere a un'altra AI di comprendere completamente ogni flusso, modulo e decisione architetturale dell'app. Include il codice rilevante, le convenzioni, i flussi dati e le interazioni tra moduli.

---

## INDICE

1. [Overview e Stack Tecnologico](#1-overview-e-stack-tecnologico)
2. [Architettura Generale](#2-architettura-generale)
3. [Data Model (Dexie.js v8)](#3-data-model-dexiejs-v8)
4. [CRUD Centralizzato e Pattern di Persistenza](#4-crud-centralizzato-e-pattern-di-persistenza)
5. [Il Cervellone — Pipeline NLP 3+1 Livelli](#5-il-cervellone--pipeline-nlp-31-livelli)
6. [Contratto Canonico delle Azioni (Sprint 1-3)](#6-contratto-canonico-delle-azioni)
7. [Entity Extraction (entityExtractor.js)](#7-entity-extraction)
8. [Conversation Memory (conversationMemory.js)](#8-conversation-memory)
9. [Learning Engine — Rinforzo e Decay](#9-learning-engine--rinforzo-e-decay)
10. [useBrain.js — Hook React Orchestratore](#10-usebrainjs--hook-react-orchestratore)
11. [Navigazione, Routing e UX](#11-navigazione-routing-e-ux)
12. [Sync Cloud (Supabase)](#12-sync-cloud-supabase)
13. [Notifiche Native (Capacitor)](#13-notifiche-native-capacitor)
14. [Telemetria Locale](#14-telemetria-locale)
15. [Performance e Ottimizzazioni](#15-performance-e-ottimizzazioni)
16. [Sicurezza e Backup](#16-sicurezza-e-backup)
17. [Test e Debug](#17-test-e-debug)
18. [Audit Completati](#18-audit-completati)
19. [Note Operative e Gotcha]
20. [Sprint 4 — Dual Action, Notifiche Avanzate, Calendario 3 Viste](#20-sprint-4--dual-action-notifiche-avanzate-calendario-3-viste)
21. [Test Frasi End-to-End (Frase 1-20)](#21-test-frasi-end-to-end-frase-1-20)(#19-note-operative-e-gotcha)

---

## 1. OVERVIEW E STACK TECNOLOGICO

APP Family è un'app di gestione familiare con input vocale/testuale in italiano, costruita per Android via Capacitor. Il cuore è "Il Cervellone", un sistema NLP locale a 3+1 livelli che interpreta frasi in linguaggio naturale italiano e le converte in azioni strutturate (eventi, task, spese, pasti, shopping, note).

### Stack

| Layer | Tecnologia | Versione |
|-------|-----------|----------|
| UI Framework | React | 19.2.0 |
| Build Tool | Vite | 7.x |
| CSS | Tailwind CSS | 4.x |
| Native Bridge | Capacitor | 8.2.0 |
| DB Locale | Dexie.js (IndexedDB) | latest |
| Cloud Sync | Supabase | 2.49.0 |
| NLP Engine | @nlpjs/core + @nlpjs/lang-it | latest |
| AI Fallback | Claude Haiku 4.5 (API) | claude-haiku-4-5-20251001 |
| State Management | Zustand | 5.0.11 |
| Grafici | Recharts | 3.8.0 |
| Icone | Lucide React | 0.577.0 |
| Hash PIN | bcryptjs | 3.0.3 |

### Metriche codebase

- ~27.456 linee (src/)
- ~5.603 linee test (82 test unitari/integrazione/E2E)
- 18 file NLP in `src/lib/brain/` (inclusi actionContract, actionNormalizer, actionValidator)
- 17 pagine, 16 hooks, ~40 componenti
- App ID: `com.fammiquesto.app`
- Theme primario: `#6C5CE7` (viola)

### Famiglia di test

| Nome | Ruolo | Alias | Genere |
|------|-------|-------|--------|
| Cristian | parent | — | M |
| Chiara | parent | mamma | F |
| Viola | child | — | F |
| Asia | child | — | F |
| Mariangela | nonno | nonna | F |
| Albino | nonno | nonno | M |

---

## 2. ARCHITETTURA GENERALE

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│  App.jsx (BrowserRouter) → AppShell.jsx (layout + bottom nav)   │
│  17 Pages (lazy-loaded) → ~40 Components                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                         HOOK LAYER                               │
│  useBrain (NLP orchestrator)  useCalendar  useTasks  useExpenses│
│  useShopping  useMeals  useBudget  useInventory  useRewards     │
│  useAuth  useNotifications  useOnline  useDebugAnalytics        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                        LIB / BRAIN LAYER                         │
│  brain/index.js (orchestratore)                                  │
│  brain/intentClassifier.js (L0+L1+L2 parser)                    │
│  brain/actionContract.js (shape canoniche + factory)    [NEW S1] │
│  brain/actionNormalizer.js (legacy→canonical + name→ID) [NEW S1] │
│  brain/actionValidator.js (validazione runtime)         [NEW S1] │
│  brain/entityExtractor.js (date, time, persons, logistics...)   │
│  brain/conversationMemory.js (draft multi-turno)                │
│  brain/learningEngine.js (rinforzo/punizione/decay)             │
│  brain/synapseEngine.js (attivazione L2)                        │
│  brain/actionBuilder.js (costruzione azioni legacy)             │
│  brain/textUtils.js (stemmer, tokenizer, Levenshtein)           │
│  brain/patterns.js (sinapsi bootstrap innate)                   │
│  brainNlp.js (adapter NLP.js — interfaccia isolata)            │
│  voice.js (speech-to-text + Claude Haiku L3)                    │
│  crud.js (CRUD centralizzato)                                   │
│  sync.js (Supabase bidirezionale)                               │
│  telemetry.js (contatori locali)                                │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                        DATA LAYER                                │
│  localDb.js → Dexie.js (IndexedDB) — 20 tabelle, v8 schema     │
│  authStore.js → Zustand (session state: familyId, currentMember)│
│  supabase.js → Client singleton per sync cloud                  │
└─────────────────────────────────────────────────────────────────┘
```

### Principi architetturali

1. **Local-first**: tutto funziona offline. IndexedDB è la single source of truth.
2. **Soft-delete (tombstone)**: `_deleted: true` — nessun record viene mai cancellato fisicamente.
3. **Version tracking**: `_version` incrementale su ogni update, `_device_id` per identificare il dispositivo.
4. **Field-level merge**: il sync non fa last-write-wins ma merge intelligente campo per campo.
5. **NLP a cascata**: L0→L1→L2→L3, ogni livello entra solo se il precedente non è sufficientemente sicuro.

---

## 3. DATA MODEL (Dexie.js v8)

File: `src/lib/localDb.js`

### Tabelle sincronizzate (14 tabelle)

| Tabella | Indici | Scopo |
|---------|--------|-------|
| `family` | id | Famiglia (una per DB) |
| `members` | id, family_id, role | Membri con ruolo (parent/child/nonno) e alias |
| `expenses` | id, family_id, date, category, person_id | Spese con importo, categoria, persona |
| `budgets` | id, family_id, &[category+month] | Budget mensile per categoria (unique compound) |
| `events` | id, family_id, date, person_id | Eventi calendario con logistica |
| `tasks` | id, family_id, due_date, assigned_to, status | Task con gamification (punti, accepted, proposte) |
| `taskTemplates` | id, family_id | Template riutilizzabili per task ricorrenti |
| `meals` | id, family_id | Database piatti salvati |
| `mealPlans` | id, family_id, date | Piano pasti settimanale per slot (colazione/pranzo/cena) |
| `shoppingItems` | id, family_id, checked | Lista della spesa |
| `inventory` | id, family_id, expiry_date | Inventario dispensa con scadenze |
| `rewards` | id, family_id, member_id, week_start | Punti gamification settimanali |
| `notifications` | id, family_id, member_id, read | Notifiche in-app per membro |
| `recurrences` | id, family_id, type | Ricorrenze (task settimanali, spese mensili, eventi) |

### Tabelle solo locali (6 tabelle)

| Tabella | Indici | Scopo |
|---------|--------|-------|
| `patterns` | id, family_id, keyword, actionType, score | Sinapsi apprese (L2 learning) — contiene anche bootstrap |
| `nlpDocuments` | id, family_id, intent | Documenti training NLP.js aggiunti dall'utente |
| `nlpLogs` | id, family_id, created_at, result_intent, confidence, used_ai | Log parse per debug |
| `conversationDrafts` | id, [family_id+created_by+status], ... | Draft conversation memory multi-turno |
| `conflictLog` | ++id, family_id, table_name, record_id, resolved_at | Log conflitti sync |
| `syncLog` | ++id, table_name, record_id, synced | Coda operazioni da sincronizzare |

### Tabella condivisa

| Tabella | Indici | Scopo |
|---------|--------|-------|
| `settings` | id, family_id, key | Configurazioni + telemetria |

### Tabelle inutilizzate (candidate per rimozione in v9)

- `priceHistory` — zero writer, zero reader. Esiste solo nello schema Dexie. Non in ENTITY_TABLES, non in sync. [verificato grep v3.0]
- `brainNotes` — zero writer, zero reader. Stessa situazione. [verificato grep v3.0]

Entrambe possono essere rimosse in una migrazione v9 senza impatto. Lo schema Dexie le dichiara ma nessun codice le tocca.

### Convenzioni naming

- **Persona**: `person_id` (owner), `assigned_to` (task), `added_by` (item creator), `created_by` (plan), `member_id` (rewards/notifications), `updated_by` (last modifier)
- **Date**: `YYYY-MM-DD` string → date, due_date, expiry_date, birth_date, week_start
- **Timestamp**: ISO string → created_at, updated_at, completed_at, expires_at, resolved_at
- **Sync**: `_version` (incrementale), `_device_id` (UUID), `_deleted` (tombstone), `_synced` (0=pending)

### Migrazioni (v1→v8)

| Versione | Cambiamento |
|----------|-------------|
| v1 | Schema iniziale 20 tabelle |
| v2 | Fix indici: tasks.due_date, inventory.expiry_date, shoppingItems.checked |
| v3 | Aggiunto member_id su notifications |
| v4 | patterns: indici keyword, actionType, score per lookup veloce |
| v5 | Aggiunta nlpDocuments + settings con id index |
| v6 | Aggiunta nlpLogs per tracciamento debug |
| v7 | Aggiunta conversationDrafts con compound index |
| v8 | Aggiunta conflictLog per sync conflict tracking |

---

## 4. CRUD CENTRALIZZATO E PATTERN DI PERSISTENZA

File: `src/lib/crud.js`

Tutte le scritture passano da 4 funzioni centralizzate. Nessun hook scrive direttamente su Dexie.

### createRecord(table, data)

```
1. Genera id = crypto.randomUUID()
2. Aggiunge created_at, updated_at (ISO now)
3. Imposta _deleted: false, _version: 1
4. Imposta _device_id (localStorage, persistente per dispositivo)
5. Imposta updated_by (da authStore.currentMember.id)
6. Inserisce nella tabella Dexie
7. Se tabella è entity table → scrive syncLog { action: 'upsert', synced: 0 }
```

### updateRecord(table, id, changes)

```
1. Legge record esistente (throw se non trovato)
2. Merge changes nel record
3. Incrementa _version
4. Aggiorna updated_at, _device_id, updated_by
5. Put nella tabella Dexie
6. Scrive syncLog
```

### deleteRecord(table, id)

**È solo un `updateRecord(table, id, { _deleted: true })`** — tombstone pattern, nessuna cancellazione fisica.

### getRecord(table, id)

Lettura diretta da Dexie senza filtro su `_deleted` (il chiamante decide).

### Entity tables (sync-eligible)

```javascript
const ENTITY_TABLES = new Set([
  'family', 'members', 'expenses', 'budgets', 'events', 'tasks', 'taskTemplates',
  'meals', 'mealPlans', 'shoppingItems', 'inventory', 'rewards', 'notifications', 'recurrences',
])
```

Solo queste 14 tabelle generano entry in syncLog. **Escluse intenzionalmente** [fix v3.0]:
- `patterns` — locale, scritta direttamente da learningEngine.js (bypassa crud.js, non genera mai syncLog)
- `priceHistory` — tabella fantasma, zero writer, candidata rimozione schema
- `brainNotes` — tabella fantasma, zero writer, candidata rimozione schema

---

## 5. IL CERVELLONE — PIPELINE NLP 3+1 LIVELLI

### Flusso completo (brain/index.js → brainParse)

```
Input testo
    │
    ▼
┌─ brainParse(text, context) ──────────────────────────────────────┐
│                                                                    │
│  1. parseLocally(text, members, familyId, currentMember, trace)   │
│     ├─ splitSentences(text) — divide su . ; ! ? + connettivi     │
│     │                         parlato italiano                     │
│     ├─ Per ogni frase:                                             │
│     │   ├─ Entity extraction (date, time, amount, persons,        │
│     │   │   logistics, location, activity)                         │
│     │   ├─ Coreference resolution (pronomi → contesto precedente)│
│     │   ├─ L0: Pattern strutturali regex                          │
│     │   │   ├─ L0a: expense (amount > 0) → conf 0.90             │
│     │   │   ├─ L0b: absence patterns → conf 0.92                  │
│     │   │   ├─ L0b1: logistics (driver+subject) → conf 0.85-0.88 │
│     │   │   ├─ L0b2: social dining (cena fuori) → conf 0.85      │
│     │   │   ├─ L0b3: meal direct (facciamo pasta) → conf 0.88    │
│     │   │   ├─ L0c: reminder (ricordami) → conf 0.88             │
│     │   │   ├─ L0d: task (deve studiare) → conf 0.82             │
│     │   │   └─ L0e: visitor (arriva tecnico) → conf 0.85         │
│     │   ├─ L1: NLP.js classify(sentence)                          │
│     │   ├─ L2: computeSynapseActivations(tokens, stems, synapses)│
│     │   └─ Combinazione L1+L2 con regole di priorità             │
│     └─ normalizeAndValidateActions(rawActions, ctx) [Sprint 1]    │
│        ├─ Per-type normalizer: legacy→canonical                   │
│        ├─ Name/alias→memberId resolution                          │
│        ├─ Linked entity resolution (tempRef cross-action)         │
│        ├─ Runtime validation (forbidden fields, type checks)      │
│        └─ Ritorna { actions: canonical[], invalid, warnings }     │
│                                                                    │
│  2. handleConversationMemory(text, localResult, ...)              │
│     ├─ Se c'è draft attivo e input compatibile → merge           │
│     ├─ Se draft completo → auto-commit → ritorna azioni          │
│     ├─ Se incompatibile → abbandona draft                         │
│     └─ Se no draft e input parziale → crea draft                 │
│                                                                    │
│  3. Se memoryResult → ritorna (gestito dalla memoria)             │
│                                                                    │
│  4. Se localResult.confidence >= 0.55 → ritorna (locale OK)      │
│                                                                    │
│  5. L3: parseVoiceWithAI(text, context, localResult)              │
│     ├─ Se localResult esiste → disambiguation mode                │
│     │   (passa tentativo locale a Haiku)                          │
│     ├─ Claude Haiku genera azioni JSON                            │
│     └─ Se L3 fallisce → usa localResult come fallback offline    │
└────────────────────────────────────────────────────────────────────┘
```

### L0: Pattern strutturali (intentClassifier.js)

**POLICY**: L0 cattura SOLO pattern strutturalmente inequivocabili. Nuovi intent vanno SEMPRE in L1 training + L2 bootstrap, MAI in L0, a meno che non abbiano un marker strutturale chiaro.

| Sub-livello | Trigger | Confidence | Intent prodotto |
|-------------|---------|------------|-----------------|
| L0a | `amount > 0` (parseAmount trova €) | 0.90 | expense |
| L0b | Regex assenza (12 pattern: "non va a scuola", "febbre", "niente sport"...) | 0.92 | calendar (isAbsence:true) |
| L0b1 | logistics.subject + logistics.actionVerb | 0.85-0.88 | calendar + task (dual action) |
| L0b2 | "cena fuori", "pranzo dai nonni", "grigliata con..." | 0.85 | calendar |
| L0b3 | "facciamo pasta", "cuciniamo...", "grigliatina in..." | 0.88 | meal |
| L0c | "ricordami", "avvisami" (inizio frase) | 0.88 | reminder |
| L0c+ | "ricordami di comprare X" (reminder + buying verb) | 0.88 | reminder + shopping (DUAL ACTION) |
| L0c+ | "ricordami di comprare X" (reminder + buying verb) | 0.88 | reminder + shopping (DUAL ACTION) |
| L0d | "deve studiare", "da ritirare", "non dimenticare", "bisogna"... | 0.82 | task |
| L0e | "arriva il tecnico", "viene l'idraulico" | 0.85 | calendar |

**Ordine L0 è critico**: expense → absence → logistics → social dining → meal → reminder → task → visitor. Se un pattern matcha, `continue` salta al prossimo sentence.

### L0b — Assenze: generazione automatica reminder

Se l'utente dice "vi ricordate che non sono disponibile domani", oltre all'evento assenza il sistema genera un reminder/task per ogni altro membro della famiglia (genitori e figli) con `needsConfirm: true`.

### L0b1 — Dual Action (logistica)

Quando il sistema identifica un `driver` (chi porta/prende) e un `subject` (chi viene portato/preso) distinti, genera:

1. **Calendar event** per il subject (es. "Danza Asia - Falcone")
2. **Task** per il driver (es. "Portare Asia - Falcone")
3. **Note/reminder** se è drop-off: "Chi va a riprendere Asia da Falcone?"

Se solo il subject è identificato (logistica collettiva), genera un calendar con `needsDriver: true` e `incomplete: 'Manca chi accompagna/riprende'`.

### L1: NLP.js (brainNlp.js)

File `brainNlp.js` è l'UNICO file che importa `@nlpjs/*`. Espone 8 funzioni con interfaccia stabile:

| Funzione | Signature | Scopo |
|----------|-----------|-------|
| `initNlp(familyId)` | → Promise<boolean> | Inizializza NLP.js con training set + documenti utente |
| `classify(text)` | → Promise<{intent, score, action}>  | Classifica una frase |
| `addTrainingDocument(text, intent, familyId)` | → Promise | Aggiunge doc training utente |
| `removeTrainingDocument(text, intent, familyId)` | → Promise | Rimuove doc training |
| `retrain(familyId)` | → Promise | Re-training con nuovi documenti |
| `fullRetrain(familyId)` | → Promise | Training completo da zero |
| `getNlpStats()` | → object | Statistiche NLP.js |
| `isNlpReady()` | → boolean | NLP.js pronto? |

Consumatori: `intentClassifier.js`, `learningEngine.js`, `useBrain.js`, `brain/index.js`.

Soglie NLP.js (config.js):
- `NLP_CONFIDENCE_HIGH = 0.75` — NLP.js sicuro, non servono sinapsi
- `NLP_CONFIDENCE_LOW = 0.40` — NLP.js incerto, combina con sinapsi

Training set: 217 frasi base in `brainTrainingSet.js` + documenti utente in tabella `nlpDocuments`.

### L2: Sinapsi pesate (synapseEngine.js + patterns.js)

Le sinapsi sono associazioni `keyword → actionType` con peso numerico.

**Sinapsi bootstrap** (patterns.js): ~85 associazioni innate. Esempio:
- "dentista" → calendar/medico (peso 0.35)
- "euro" → expense (peso 0.70)
- "prepara" → task (peso 0.35)

**Sinapsi apprese** (tabella `patterns`): create dall'utente tramite rinforzo/punizione. Partono con `confirmCount=1` (shadow) e diventano attive a `confirmCount >= 3`.

**Attivazione** (`computeSynapseActivations`):
1. Per ogni token dell'input, cerca sinapsi per stem e token originale
2. Se token.length ≥ 4, prova fuzzy match (Levenshtein ≤ 2)
3. Accumula score per actionType
4. Applica boost temporali (meal boost la sera) e strutturali (persona+data → calendar)

**Confidenza sinapsi**: sigmoid `1 / (1 + exp(-3 * (synScore - 0.4)))`

Soglia: `SYNAPSE_CONFIDENCE_THRESHOLD = 0.60`

### Combinazione L1+L2 (intentClassifier.js)

Dopo aver calcolato NLP score + synapse confidence, il sistema decide con questa cascata:

1. **Structural + L2**: persona + (time o date esplicita) + no importo + sinapsi calendar > 0.3 → calendar (conf ≥ 0.80)
2. **Structural + L1**: stessi segnali strutturali + NLP dice calendar → calendar (conf ≥ 0.85)
3. **Structural override**: segnali strutturali ma NLP non dice calendar/expense → calendar (conf ≥ 0.70)
4. **L1 high**: NLP ≥ 0.75 → usa NLP
5. **L1+L2 combined**: NLP ≥ 0.40 e concorda con sinapsi → combina (0.6·NLP + 0.4·syn + 0.1)
6. **L1 medium**: NLP ≥ 0.40 e sinapsi < 0.3 → usa NLP
7. **L2 only**: sinapsi ≥ 0.60 → usa sinapsi
8. **L1 best**: NLP > sinapsi → usa NLP
9. **L2 fallback**: usa sinapsi

Soglia finale: `FINAL_THRESHOLD = 0.55` — sotto questa soglia si va a L3.

### L3: Claude Haiku (voice.js)

Invocato quando la confidence locale è sotto 0.55. Max 20 chiamate/giorno (rate limit lato client).

**Disambiguation mode** (buildL3UserMessage): se il parser locale ha prodotto un risultato, lo passa a Haiku come contesto:

```
MESSAGGIO UTENTE: "frase originale"

IL SISTEMA LOCALE HA TENTATO DI PARSARE MA CON CONFIDENZA BASSA (42%):
  1. type="calendar" title="Danza Asia" conf=42%

Verifica e correggi il parsing locale, oppure fai un nuovo parsing se è completamente sbagliato.
```

Il system prompt include: data odierna, nomi familiari con ruoli, categorie spesa ed evento, 21 regole di parsing, formato JSON output atteso.

**Validazione output Haiku**: pulizia markdown wrapper, verifica JSON, validazione type in allowlist, verifica nomi persone contro members, validazione importi, default date=today.

**Normalizzazione L3 [Sprint 2]**: dopo la pulizia JSON, le azioni Haiku passano per `normalizeAndValidateActions()` con `source: 'L3'` e `usedAI: true`. Stessa pipeline di L0/L1/L2: legacy→canonical, name→ID, validazione. Le azioni invalide vengono scartate con warning in console.

**Fallback offline**: se L3 fallisce e esiste un risultato locale con almeno 1 azione → usa quello con " (offline)" aggiunto al summary.

### Contesto condiviso tra frasi (Coreference)

All'interno di `parseLocally`, un oggetto `lastContext` viene mantenuto tra le frasi della stessa utterance:

```javascript
let lastContext = {
  location: null,    // ultimo luogo estratto
  subject: null,     // ultimo soggetto logistico
  activity: null,    // ultima attività
  driver: null,      // ultimo driver logistico
  persons: []        // ultime persone estratte
}
```

**Risoluzione pronomi italiani**: se una frase non contiene persone ma ha pronomi cliticizzati:
- Femminile (prendila, portala, accompagnala, lei) → cerca F nel contesto precedente
- Maschile (prendilo, portalo, lui) → cerca M nel contesto precedente
- Plurale (prendiLi, portaLi, loro) → usa tutte le persone del contesto

Esempio: "Domani Asia ha danza; poi prendila alle 18" → "prendila" risolve ad Asia.

### Interruption handling (textUtils.js — splitSentences)

Il parlato italiano viene diviso su:
- Punteggiatura standard: `. ; ! ?`
- Connettivi sequenziali: "e poi", "e anche", "inoltre", "dopodiché", "poi anche"
- Interruzioni parlato: "ah e", "ah anche", "ah poi"
- Virgole tra frasi ≥3 parole ciascuna

---

## 6. CONTRATTO CANONICO DELLE AZIONI (Sprint 1-3)

### Problema risolto

Prima dello Sprint 1, ogni livello della pipeline (L0, L1+L2, L3, memory) produceva azioni con shape variabili: campi con nomi diversi per lo stesso concetto (`time`/`timeStart`/`startTime`/`time_start`), nomi stringa invece di ID risolti, campi opzionali assenti vs null, nessuna validazione formale. L'executor in useBrain.js compensava con `findMember()` e logica difensiva.

Dopo Sprint 1-3: tutti i 4 path convergono attraverso `normalizeAndValidateActions()` prima di raggiungere la preview. L'executor legge solo campi canonici. La risoluzione nomi→ID avviene nel normalizer, non nell'executor.

### Diagramma convergenza

```
L0 pattern    ─┐
L1 NLP.js     ─┤→ parseLocally → normalizeAndValidateActions ─┐
L2 sinapsi    ─┘                                               │
                                                                ├→ canonical → executor → DB
L3 Claude     ───→ parseVoiceWithAI → normalizeAndValidateActions ─┘
memory draft  ───→ buildActionsFromDraft → normalizeMemoryActions ─┘
```

### File

| File | Linee | Scopo |
|------|-------|-------|
| `brain/actionContract.js` | 357 | Enum, typedef JSDoc, factory con null espliciti |
| `brain/actionNormalizer.js` | 475 | Normalizzazione legacy→canonical, name→ID, logistica, linked entities |
| `brain/actionValidator.js` | 388 | Validazione runtime, forbidden fields, per-type checks |

### Shape canoniche

Ogni azione ha un envelope base comune + campi tipo-specifici:

**ActionBase** (comuni a tutti): `type`, `source` (L0/L1/L2/L3/memory), `confidence` (0-1), `textOriginal`, `familyId`, `createdBy` (member ID o null), `needsConfirm`, `incomplete` (string o null), `warnings[]`, `meta { utteranceRef, actionRef, pipelinePath, draftId, usedAI }`.

| Tipo | Campi specifici |
|------|----------------|
| calendar | title, date, timeStart, timeEnd, personIds[], personNames[], location, activity, category, isAbsence, logistics |
| task | title, dueDate, assignedToId, assignedToName, category, linkedEntity |
| expense | title, amount, category, date, personId, personName |
| meal | title, date, slot (breakfast/lunch/dinner) |
| shopping | title, quantity, unit, category |
| reminder | title, date, timeStart, assignedToId, assignedToName, fromPersonName |
| note | title, text |

**LogisticsShape**: `subjectId`, `subjectName`, `accompaniedById`, `accompaniedByName`, `pickupById`, `pickupByName`, `actionVerb` (portare/prendere/riprendere/ritirare), `needsDriver`.

**LinkedEntity**: `entityType` (calendar/expense/shopping/meal), `tempRef` (pre-persist, es. "a_0"), `realId` (post-persist, UUID dal DB).

### Normalizzazione (actionNormalizer.js)

Entry point unico: `normalizeAndValidateActions(rawActions, context)`.

Context richiesto: `{ familyId, currentMemberId, members[], source, textOriginal, confidence, usedAI }`.

Pipeline interna per ogni raw action:
1. Switch su `type` → normalizzatore specifico (es. `normalizeCalendar`)
2. `fillBase()` → campi envelope (source, confidence, meta, warnings)
3. Mapping legacy→canonical: `assignedTo`→`personIds/assignedToId`, `time`→`timeStart`, `name`→`title`, `note`→`title` (expense), `person`→`personId`
4. `resolveMember(nameOrAlias, members)`: exact match → alias match → partial match (startsWith)
5. `normalizeLogistics(raw, ctx)`: estrae/risolve subject, accompaniedBy, pickupBy, actionVerb
6. Post-normalizzazione: `resolveLinkedEntities(actions)` — task con titolo logistico linkati al calendar via `tempRef`
7. `validateActions(normalized)` — validazione runtime con forbidden fields check

### Campi legacy vietati (FORBIDDEN_FIELDS)

Dopo la normalizzazione, questi campi non devono MAI esistere sull'azione canonica: `person`, `persons`, `assignedTo`, `driver`, `accompaniedBy`, `pickupBy`, `dropBy`, `name`, `time`, `startTime`, `endTime`, `time_start`, `time_end`, `startDate`, `due_date`. Se il validatore li trova, l'azione viene scartata.

### Persist orchestrator (useBrain.js — Sprint 2)

`confirmActions` in useBrain.js implementa il persist ordinato per linked entities:

1. Separa `independent` (no linkedEntity) da `dependent` (con linkedEntity)
2. Persist independent → cattura `actionRef → realDbId` in `refToIdMap`
3. Per ogni dependent: resolve `tempRef → realId` dalla mappa
4. Persist dependent con `linked_event_id = realId`

### Failure policy (Sprint 3)

Cinque regole esplicite, scritte anche come commento in useBrain.js sopra `confirmActions`:

1. Se un'azione padre (independent) fallisce, le figlie (dependent) NON possono risolvere il link via tempRef. La figlia viene comunque persistita SENZA `linked_event_id`.
2. Se una figlia (dependent) fallisce, il padre resta persistito e valido. Nessun rollback.
3. Se `tempRef` non si risolve (padre non in `refToIdMap`), la figlia viene persistita senza link. Log warning in console + entry in executionLog.
4. Ogni fallimento (padre o figlia) genera: `console.error` + entry in `executionLog { ok: false, msg, type, linked }`.
5. Nessun rollback automatico. Le azioni ok restano ok. L'utente vede il riepilogo nel log e può intervenire manualmente.

### Mapping executor (canonical → DB)

| Canonical | DB |
|-----------|-----|
| `timeStart` | `time_start` |
| `timeEnd` | `time_end` |
| `personIds[0]` | `person_id` |
| `assignedToId` | `assigned_to` |
| `dueDate` | `due_date` |
| `title` (meal) | `name` |
| `title` (shopping) | `name` |
| `title` (expense) | `note` |
| `slot` dinner/lunch/breakfast | `cena`/`pranzo`/`colazione` |

### Convergenza verificata

La stessa raw action normalizzata da L0, L3, o memory produce shape identica (eccetto `source` e `meta.usedAI`). Verificato con test parametrici su tutti i 6 tipi azione.

### Sprint timeline

| Sprint | Cosa | File |
|--------|------|------|
| Sprint 1 | Creare contratto + normalizer + validator. Integrare in parseLocally (2 edit chirurgici). 25 test. | actionContract.js, actionNormalizer.js, actionValidator.js, intentClassifier.js |
| Sprint 2 | Executor canonico (no findMember), persist orchestrator linked entity, memory normalization, L3 normalization. 17 test. | useBrain.js, brain/index.js, voice.js |
| Sprint 3 | Golden E2E tests: 7 scenari reali + convergenza cross-source. 40 test. | goldenE2E.test.js |

---

## 7. ENTITY EXTRACTION

File: `src/lib/brain/entityExtractor.js`

### parseLocalDate(text)

Riconosce: oggi, domani, dopodomani, stasera, stamattina, stanotte, adesso, domattina, giorni della settimana (con e senza accento, fuzzy Levenshtein ≤1), "prossimo lunedì"/"lunedì prossimo", "settimana prossima", "mese prossimo", "tra X giorni", "il 15", "il 3 marzo".

Default: oggi.

### parseLocalTime(text)

Pattern: "alle 16", "alle 16:30", "verso le 19", "per le 8", "intorno alle 10", "ore 8", "h 14:30".

### parseTimeRange(text)

Range espliciti: "dalle 8 alle 14", "da le 9 a le 17".
Periodi: "mattina" (06-14), "pomeriggio" (13-18), "sera" (19-24), "notte" (00-06).

### parseAmount(text)

Pattern: "45 euro", "€ 12,50", "speso 30", "pagato 15", "costato 8", "3,90 per il giornale".

### extractPersons(text, members)

1. Match esatto nome
2. Match alias (nonna→Mariangela, mamma→Chiara, nonno→Albino)
3. Fuzzy Levenshtein ≤1 su nomi ≥3 caratteri
4. Ordine: per posizione nella frase

### extractLogistics(text, members)

Pattern gerarchici (dall'alto verso il basso, il primo che matcha vince):

1. **"X porta/accompagna Y"** — X=driver, Y=subject, verb=portare
2. **"X deve/va a prendere Y"** — X=driver, Y=subject, verb=prendere/riprendere/ritirare
3. **Alias gruppo**: "prendere le bambine/i ragazzi" → subject=primo figlio, cerca driver nella frase
4. **Collettivi**: "dobbiamo/devo/bisogna prendere Y" — subject=Y, driver=null
5. **Clitico semplice**: "la porta X", "lo riprende X" — driver=X
6. **Pickup clitico**: "la riprende X", "viene a prenderla X" — pickupBy=X

Output: `{ accompaniedBy, pickupBy, subject, driver, actionVerb }`

dove `actionVerb` è uno di: 'portare', 'prendere', 'riprendere', 'ritirare'.

### extractLocation(text, members)

Pattern (in ordine):
1. "alla stazione di Desenzano" → "stazione Desenzano"
2. "alla palestra/stazione/aeroporto" → nome struttura
3. "alla Fenice" (nome proprio maiuscolo dopo preposizione) → "Fenice" (esclude nomi familiari)
4. "allenamento Falcone" → "Falcone"
5. "in stazione a Brescia" → "stazione Brescia"
6. "in palestra" → "palestra"

### extractActivity(text)

Due fasi:

**Fase 1 — Regex diretti** (21 pattern): allenarsi, nuotare, giocare, danzare, lezione, allenamento, partita, gara, corso, visita, check-up, ripetizione, studiare, catechismo, scout + sport standalone (danza, nuoto, pallavolo, karate, calcio, calcetto, basket, tennis, ginnastica, palestra, piscina, piano, inglese, saggio, recita, torneo, dentista, pediatra, vaccino, minibasket).

**Fase 2 — Taxonomy fuzzy** (ACTIVITY_TAXONOMY): tassonomia gerarchica con 4 categorie:

| Categoria | Attività children |
|-----------|------------------|
| **sport** | calcio, calcetto, basket, pallavolo, nuoto, tennis, danza, karate, ginnastica, atletica, ciclismo, equitazione, scherma, arrampicata, pattinaggio, rugby |
| **musica** | piano, chitarra, violino, batteria, canto |
| **studio** | inglese, matematica, italiano |
| **salute** | dentista, pediatra, oculista, ortopedico, fisioterapia |

Ogni child ha un array `terms` con sinonimi (es. tennis→["tennis", "padel", "paddle"], danza→["danza", "ballo", "danza moderna", "danza classica", "hip hop"]).

Match: children first (più specifici), poi fallback al gruppo.

---

## 8. CONVERSATION MEMORY

File: `src/lib/brain/conversationMemory.js`

### Concetto

Gestisce il merge strutturato di frammenti di frase che completano la stessa intenzione nel giro di pochi minuti. Un solo draft attivo per autore alla volta.

### Esempio tipico

```
"Domani Asia ha danza"      → crea draft calendar { date: domani, person: Asia, activity: Danza }
"alle 16"                   → merge: completa time → { ..., time: "16:00" }
"la porta Chiara"           → merge: completa dropBy → { ..., logistics.dropBy: Chiara }
"la riprende mamma"         → merge: completa pickupBy → auto-commit
```

### Costanti

- `DRAFT_TTL_MS = 15 min` — scadenza base
- `DRAFT_EXTEND_MS = 10 min` — estensione a ogni merge
- `MAX_DRAFT_AGE_MS = 30 min` — età massima assoluta

### Intent supportati

Solo `calendar`, `absence`, `expense` supportano la memoria conversazionale.

### Campi minimi per auto-commit

| Intent | Campi minimi |
|--------|-------------|
| calendar | date + person |
| absence | absentPerson + date |
| expense | amount |

### Flusso dettagliato

1. **isFollowupFragment(inputText, parseResult)**: determina se l'input è un frammento (≤5 parole con solo tempo/importo/persona/logistica, o ≤8 parole con confidence < 0.35, o pattern di correzione).

2. **isCompatibleWithDraft(draft, inputText, parseResult)**: compatibile se non scaduto, stesso intent o frammento puro, non ha intent forte e diverso.

3. **mergeParseIntoDraft**: merge con regole:
   - Completa buchi (campo mancante → aggiungi)
   - Non sovrascrivere forte con debole
   - Sovrascrivi se più specifico (day_period → time_start)
   - Logistica incrementale (dropBy e pickupBy separati)
   - Correzioni esplicite ("no, non Asia, Viola") sovrascrivono

4. **shouldAutoCommit**: commit se campi minimi presenti, confidence ≥ 0.30, logistica non parziale (aspetta pickupBy se c'è dropBy e < 4 turni).

5. **buildActionsFromDraft**: genera azioni finali dal draft committato, inclusi task logistici (accompagna/riprendi).

### Persistenza

I draft sono serializzati con `*_json` perché Dexie non supporta nested objects come indici. Le funzioni `serializeDraft`/`deserializeDraft` gestiscono la conversione.

### Pattern di correzione

Riconosciuti con regex: "no, ...", "anzi ...", "volevo dire ...", "non X, Y", "intendevo ...", "correggo: ...".

---

## 9. LEARNING ENGINE — RINFORZO E DECAY

File: `src/lib/brain/learningEngine.js`

### Rinforzo (learnFromConfirmed)

Quando l'utente conferma azioni:
1. Estrae keywords da testo originale (stemmate) + keywords dall'azione (titolo)
2. Per ogni keyword: rafforza sinapsi nel DB
3. Aggiunge documento training a NLP.js

**Formula rinforzo**: `newScore = currentWeight + LEARNING_RATE × (20 - currentWeight)`
(convergenza asintotica verso 20)

### Punizione (learnFromRejected)

Quando l'utente cancella azioni:
1. Per ogni stem: punisci sinapsi
2. Rimuovi documento NLP.js

**Formula punizione**: `newScore = max(0, currentWeight - LEARNING_RATE × currentWeight)`

### Shadow Learning (A1)

Sinapsi apprese dall'utente NON si attivano subito:
- Nuova sinapsi → `confirmCount: 1, source: 'user'`
- Ogni conferma → `confirmCount += 1` (cap a SHADOW_CONFIRM_THRESHOLD + 10)
- Ogni punizione → `confirmCount -= 1`
- Solo quando `confirmCount >= SHADOW_CONFIRM_THRESHOLD (3)` la sinapsi influenza il parsing
- Sinapsi bootstrap (da patterns.js) → `confirmCount` non impostato → default a SHADOW_CONFIRM_THRESHOLD (sempre attive)

**Filtro in intentClassifier.js**:
```javascript
if (p.source === 'user' && (p.confirmCount || 0) < SHADOW_CONFIRM_THRESHOLD) continue
```

### Decay temporale (applyDecay)

Eseguito una volta per sessione all'avvio (via useBrain):
- Grace period: 14 giorni senza uso
- Dopo grace: `decayFactor = (1 - DECAY_RATE)^(daysIdle - graceDays)`
- `newScore = score × decayFactor`
- Se `newScore < 0.1` → soft-delete sinapsi
- Se differenza > 0.05 → aggiorna score

### Pruning

Max 800 sinapsi per famiglia. Se raggiunto, elimina la più debole.

### Costanti (config.js)

| Costante | Valore | Scopo |
|----------|--------|-------|
| LEARNING_RATE | 0.15 | Velocità apprendimento |
| DECAY_RATE | 0.02 | Velocità dimenticanza |
| DECAY_GRACE_DAYS | 14 | Giorni prima del decay |
| MAX_SYNAPSES | 800 | Limite per famiglia |
| BASE_WEIGHT | 0.35 | Peso iniziale bootstrap |
| SHADOW_CONFIRM_THRESHOLD | 3 | Conferme per attivare sinapsi utente |
| NLP_CONFIDENCE_HIGH | 0.75 | NLP.js sicuro |
| NLP_CONFIDENCE_LOW | 0.40 | NLP.js incerto |
| SYNAPSE_CONFIDENCE_THRESHOLD | 0.60 | Sinapsi da sole bastano |
| FINAL_THRESHOLD | 0.55 | Soglia per evitare L3 |
| FUZZY_MAX_DISTANCE | 2 | Max Levenshtein |
| FUZZY_MIN_LENGTH | 4 | Min lunghezza per fuzzy |

---

## 10. useBrain.js — HOOK REACT ORCHESTRATORE

File: `src/hooks/useBrain.js`

### Fase lifecycle

```
idle → listening → parsing → preview → executing → done → idle
                                                   ↓
                                                 error → idle (3s)
```

### Flusso completo

1. **Init** (useEffect su familyId):
   - `applyDecay(familyId)` — una volta per sessione
   - `initNlp(familyId)` — NLP.js initialization (una volta per sessione)

2. **Input** (startVoice o parseText):
   - Voice: `recordSpeech({ lang: 'it-IT', timeout: 12000 })` → testo
   - Text: stringa diretta

3. **Parse** (doParse):
   - Carica members (live o fallback da DB)
   - `brainParse(text, context)` → actions + confidence + usedAI
   - Se trovate azioni → phase 'preview'

4. **Preview** (BrainSheet component):
   - L'utente vede le azioni proposte
   - Può confermare, modificare o cancellare singole azioni

5. **Confirm** (confirmActions) — **[Sprint 2: rewrite canonico]**:
   - Separa azioni `independent` (no linkedEntity) da `dependent` (con linkedEntity)
   - Persist independent prima → cattura `actionRef → realDbId` in `refToIdMap`
   - Resolve `tempRef → realId` nei dependent
   - Persist dependent con linked_event_id risolto
   - Esegue ogni azione tramite hook leggendo SOLO campi canonici:
     - expense → `addExpense({ amount, category, note: title, person_id: personId, date })`
     - calendar → `addEvent({ title, date, time_start: timeStart, person_id: personIds[0], ... })` + logistics array
     - task → `addTask({ title, assigned_to: assignedToId, due_date: dueDate, linked_event_id: linkedEntity.realId })`
     - meal → `addMealPlan({ date, slot: SLOT_TO_DB[slot], name: title })`
     - shopping → `addShoppingItem({ name: title, quantity, unit, category })`
     - reminder → `addTask()` con `🔔` prefix, `assignedToId`, `fromPersonName`
     - note → solo log
   - **findMember eliminato** [Sprint 2]: nessuna risoluzione nomi nell'executor
   - **Apprendimento**: rinforzo azioni confermate, punizione azioni rimosse
   - Forza `retrain()` NLP.js

6. **Cancel**: punisce tutte le azioni proposte (reject learning)

### Rate limiting

`MAX_DAILY_AI_CALLS = 20` — contatore lato client, reset al refresh.

### Stato esposto

```javascript
return {
  phase,              // 'idle'|'listening'|'parsing'|'preview'|'executing'|'done'|'error'
  transcript,         // testo trascritto
  result,             // { actions[], summary, usedAI, confidence }
  executionLog,       // [{ ok, msg, type, linked }]
  error,              // messaggio errore
  members,            // lista familiari (live query)
  nlpReady,           // NLP.js inizializzato?
  startVoice,         // avvia registrazione
  parseText,          // parsa testo diretto
  confirmActions,     // conferma azioni selezionate
  cancel,             // annulla tutto
  aiCallsRemaining,   // chiamate AI rimanenti
  speechAvailable,    // SpeechRecognition supportato?
}
```

### UI Feedback per Persist Parziale (Sprint 3)

File: `src/components/brain/BrainSheet.jsx`

Il componente BrainSheet è stato aggiornato per mostrare feedback dettagliato dopo l'esecuzione.

**ActionCard — Migrazione Canonica**: ActionCard legge SOLO campi canonici. Non riceve più `members` come prop (i nomi sono pre-risolti dal normalizer). Campi letti:

| Tipo | Campi canonici letti |
|------|---------------------|
| calendar | `personNames[]`, `timeStart`, `timeEnd`, `location`, `logistics.accompaniedByName`, `logistics.pickupByName` |
| task | `assignedToName`, `dueDate` |
| expense | `personName`, `amount`, `date` |
| meal | `title`, `slot`, `date` |
| shopping | `title`, `quantity`, `unit` |
| reminder | `title`, `date`, `timeStart` |
| note | `text` |

Badge aggiuntivi: `linked` (collegamento risolto), `incomplete` (warning normalizer), `warnings[]` (array canonico).

**Fase "done" — Summary Banner**: La fase done calcola dal `executionLog`:

```
okCount    = entries con ok:true e msg senza "⚠"
failCount  = entries con ok:false
warnCount  = entries con ok:true e msg con "⚠" (collegamento non risolto)
```

Tre scenari visuali:

| Scenario | Icona | Titolo | Banner |
|----------|-------|--------|--------|
| Tutto ok | ✅ emerald | "Fatto!" | "N salvate" |
| Parziale | ⚠ amber | "Completato con avvisi" | "N salvate / N senza collegamento / N non salvate" |
| Tutto fallito | ❌ red | "Errore" | "N non salvate" |

Ogni riga del log mostra icona differenziata: ✅ ok, ⚠ link mancante (amber, `Link2Off`), ❌ errore.

---

## 11. NAVIGAZIONE, ROUTING E UX

File: `src/App.jsx`

### Root redirect

```
/ → se !isSetupComplete → /setup
  → se !currentMember → /login
  → altrimenti → /dashboard
```

### Route

| Path | Componente | Lazy | Note |
|------|-----------|------|------|
| /setup | SetupPage | No (eager) | Wizard 4 step |
| /login | LoginPage | No (eager) | PIN + join by code |
| /dashboard | DashboardPage | Sì | Brain input, alert, suggerimenti pasti |
| /calendar | CalendarPage | Sì | 3 viste: Giorno/Settimana/Mese + ricorrenze |
| /tasks | TasksPage | Sì | Gamification, proposte, leaderboard |
| /expenses | SpesePage | Sì | 3 sub-tab: lista, stats, budget |
| /meals | MealsPage | Sì | Planner settimanale |
| /dispensa | DispensaPage | Sì | 2 sub-tab: shopping, inventario |
| /rewards | RewardsPage | Sì | Classifica gamification |
| /settings | SettingsPage | Sì | Backup, sync, reset |
| /brain-debug | BrainDebugPage | Sì | Debug NLP (solo parent) |
| /stats | Redirect → /expenses | — | Route orfana eliminata |
| /budget | Redirect → /expenses | — | Route orfana eliminata |
| /shopping | Redirect → /dispensa | — | Route orfana eliminata |
| /inventory | Redirect → /dispensa | — | Route orfana eliminata |

### Bottom Navigation (5 tab)

Dashboard, Calendario, Tasks, Spese, Altro (menu)

### AppShell

Layout wrapper con header + bottom nav. Include:
- Page view tracking automatico (telemetria)
- BrainSheet (lazy-loaded, solo quando brain.phase !== 'idle')

---

## 12. SYNC CLOUD (Supabase)

File: `src/lib/sync.js`

### Modello

- **Push**: legge `syncLog` con `synced=0`, invia a Supabase (upsert), marca `synced=1`
- **Pull**: scarica record aggiornati dal cloud, merge in IndexedDB
- **Merge**: field-level (non last-write-wins) — confronta `_version` e `updated_at`
- **Conflitti**: loggati in `conflictLog` con table_name, record_id, dettaglio

### Tabelle sincronizzate

14 entity tables (vedi §3). Tabelle locali (patterns, nlpDocuments, conversationDrafts, syncLog, settings) NON vengono sincronizzate.

### Invito famiglia

Join via codice invito → associa nuovo dispositivo alla stessa famiglia su Supabase.

---

## 13. NOTIFICHE NATIVE (Capacitor)

File: `src/lib/nativeNotifications.js`, `src/lib/notificationScheduler.js`

### Bridge

`nativeNotifications.js` wrappa `@capacitor/local-notifications` con graceful web degradation (su web le notifiche sono silenziose).

### Schedule

`notificationScheduler.js`:
- **Eventi**: notifica 30 min prima dell'orario
- **Task**: notifica alle 8:00 del due_date
- **ID deterministico**: UUID→int32 hash per evitare duplicati

### Integrazione

- `useCalendar`: schedula/cancella notifiche su addEvent/updateEvent/deleteEvent
- `useTasks`: schedula/cancella notifiche su addTask/updateTask/deleteTask

### Android

- Channel: 'family-default'
- Permessi: POST_NOTIFICATIONS + SCHEDULE_EXACT_ALARM

### Notifiche Shopping (Sprint 4)
- `scheduleShoppingReminders(itemId, itemName, notifyScope)`: Schedula notifiche alle 12:00 e 18:00
- `cancelShoppingReminders(itemId)`: Cancella entrambe le notifiche
- `notifyScope`: 'personal' (ricordami) = solo autore, 'family' (ricordaci) = tutti i membri

### Notifiche Task Giornaliere (Sprint 4)
- `scheduleDailyTaskReminders(task)`: Notifica alle 10:00 ogni giorno da creazione a due_date (max 14 giorni)
- `cancelDailyTaskReminders(taskId)`: Cancella tutte le notifiche giornaliere
- **Escalation urgenza**: normali = "scade tra X giorni", giorno prima = "Scade domani", scadenza = "SCADENZA OGGI"
- **Integrazione**: useTasks.completeTask()/deleteTask() cancellano daily reminders
- **Integrazione**: useShopping.toggleItem() cancella shopping reminders quando item spuntato

---

## 14. TELEMETRIA LOCALE

File: `src/lib/telemetry.js`

Contatori IndexedDB (tabella `settings`), zero server, zero privacy. Accumula contatori incrementali per feature.

### API

```javascript
trackEvent('brain_parse', { level: 'L0' })  // incrementa contatore + dettaglio
const data = await getTelemetry()            // { counters, details, firstSeen, lastUpdated }
await resetTelemetry()                        // cancella tutto
```

### Eventi predefiniti (20+)

- **Navigazione**: page_dashboard, page_calendar, page_tasks, page_expenses, page_dispensa, page_meals, page_rewards, page_settings
- **CRUD**: task_created, task_completed, task_proposed, expense_added, event_created, shopping_added, meal_planned, inventory_added
- **Brain/NLP**: brain_parse (tags: level), brain_confirmed, brain_rejected
- **Sync**: sync_push, sync_pull, sync_conflict
- **Notifiche**: notification_sent, notification_read

### Integrazione

- `AppShell.jsx`: page view tracking automatico via useLocation
- `brain/index.js`: traccia livello NLP usato (memory/local/L3/L3_failed)
- `learningEngine.js`: traccia confirm/reject

---

## 15. PERFORMANCE E OTTIMIZZAZIONI

### Code splitting

- 13 pagine lazy-loaded con `React.lazy()` (SetupPage e LoginPage eager — servono subito)
- `BrainSheet` lazy in AppShell (solo quando brain.phase !== 'idle')

### Vite config

```javascript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-charts': ['recharts'],
  'vendor-nlp': ['@nlpjs/core', '@nlpjs/nlp', '@nlpjs/lang-it'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-dexie': ['dexie', 'dexie-react-hooks'],
}
target: 'es2022'  // WebView Capacitor è Chromium moderno
```

### React.memo

Applicato su componenti con render frequente: `TaskCard`, `ExpenseCard`, `MonthGrid`.

### NLP.js caching

Stemmer italiano con Map cache. Risultati NLP.js cached per sessione.

---

## 16. SICUREZZA E BACKUP

### Autenticazione

- PIN per membro (hash bcryptjs)
- Join family via codice invito

### Backup

File: `src/lib/backup.js`, `src/lib/crypto.js`
- Export: dump JSON di tutte le tabelle → crittografato AES-256-GCM con PBKDF2 (100k iterazioni) → file `.fmbackup`
- Import: decrittografa → ripristina tutte le tabelle

---

## 17. TEST E DEBUG

### Test batch NLP

File: `src/lib/brain/testBatch.js` — 253 frasi di test con intent/entity attesi.
- Runner: esegue nel browser (non Node.js) via `import()` dinamico
- Score attuale: 100% intent accuracy, 100% entity score, 85% confidence media, 659ms totale

### Test memory

File: `src/lib/brain/testMemory.js` — 30+ scenari per conversation memory (create, merge, correction, auto-commit, abandonment).

### Test contratto canonico (Sprint 1-3, Vitest)

82 test totali in 3 file, tutti passanti. Eseguiti con `npx vitest run src/lib/brain/__tests__/`.

**canonicalPipeline.test.js** (Sprint 1 — 25 test):
- 4 frasi target: danza Asia, danza con logistica, spesa, multi-intent
- Idempotency: stessa raw → JSON canonico identico
- Legacy field convergence: time/timeStart/startTime → timeStart
- Validation rejection: no-title calendar, zero-amount expense, unknown type

**sprint2Integration.test.js** (Sprint 2 — 17 test):
- Executor mapping: canonical→DB per tutti i 6 tipi (calendar, task, expense, meal, shopping, reminder)
- Linked entity resolution: independent→capture ID→resolve dependent
- Memory normalization: legacy draft→canonical
- L3 normalization: Haiku JSON legacy→canonical
- extractEntitiesFromParse: campi canonici
- Convergenza: L0/L3/memory→shape identica

**goldenE2E.test.js** (Sprint 3 — 40 test):
- Scenario 1: Logistica completa (porta+riprende, 3 azioni, linked entity, executor DB)
- Scenario 2: Logistica figlia + alias nonna→Mariangela
- Scenario 3: Multi-intent (calendar+shopping, utteranceRef condiviso)
- Scenario 4: Memory multi-turno (incompleto→merge→completo)
- Scenario 5: L3 ambiguity (Haiku legacy con alias "mamma", 3 tipi)
- Scenario 6: Partial persist failure (calendar fallisce, expense+shopping ok)
- Scenario 7: Sync conflict su entità linked (calendar ok, task conflitto)
- Bonus: Convergenza cross-source per tutti i 6 tipi

### Debug page

`BrainDebugPage.jsx` (339 righe orchestratore + 5 moduli in `pages/debug/`):
- Log parse in tempo reale (nlpLogs)
- Visualizzazione sinapsi attive
- Metriche KPI (debugAnalytics.js)
- Test batch runner
- Quick views per categorie

### Debug Logger

File: `src/lib/brain/debugLogger.js` — trace strutturato per ogni parse, persistito in `nlpLogs`. Abilitabile/disabilitabile. Raccoglie per ogni frase: intent, confidence, source (quale livello ha deciso), entities, sinapsi attivate, warnings.

---

## 18. AUDIT COMPLETATI

### Primo ciclo — 10 punti (12 Marzo 2026)

| # | Punto | File modificati |
|---|-------|-----------------|
| 1 | Sync conflict management | sync.js, crud.js, localDb.js |
| 2 | Dirty NLP test phrases | testBatch.js |
| 3 | BrainDebugPage refactor | BrainDebugPage.jsx + 5 moduli debug/ |
| 4 | Data model audit | localDb.js (v8), SQL migration |
| 5 | Push notifications | nativeNotifications.js, notificationScheduler.js |
| 6 | Mobile performance | App.jsx, AppShell.jsx, vite.config.ts |
| 7 | UX simplification | App.jsx (redirect route orfane), TasksPage |
| 8 | NLP.js exit plan | brainNlp.js (interfaccia documentata) |
| 9 | Local telemetry | telemetry.js (new), brain/index.js, AppShell.jsx |
| 10 | Focus dominant use case | AppShell.jsx page tracking |

### Secondo ciclo — 6 punti NLP (12 Marzo 2026)

| # | Punto | File modificati |
|---|-------|-----------------|
| A1 | Shadow learning sinapsi | config.js, learningEngine.js, intentClassifier.js |
| A2 | Coreference entity memory | intentClassifier.js |
| A3 | Activity taxonomy fuzzy | entityExtractor.js |
| A4 | Policy L0 regex | intentClassifier.js (documentazione) |
| A5 | Interruption handling | textUtils.js |
| A6 | L3 disambiguation mode | voice.js, brain/index.js |

### Terzo ciclo — Sprint 1-3 Contratto Canonico (12 Marzo 2026)

| Sprint | Punto | File modificati | Test |
|--------|-------|-----------------|------|
| S1 | Contratto canonico: shape tipizzate, factory, enum | actionContract.js (new) | 25 |
| S1 | Normalizer: legacy→canonical, name→ID, logistica | actionNormalizer.js (new) | — |
| S1 | Validator: runtime validation, forbidden fields | actionValidator.js (new) | — |
| S1 | Integrazione in parseLocally (2 edit chirurgici) | intentClassifier.js | — |
| S2 | Executor canonico: no findMember, solo campi canonici | useBrain.js | 17 |
| S2 | Persist orchestrator: linked entity tempRef→realId | useBrain.js | — |
| S2 | Memory normalization: buildActionsFromDraft→normalizer | brain/index.js | — |
| S2 | L3 normalization: Haiku JSON→normalizer | voice.js | — |
| S3 | Golden E2E: 7 scenari reali + convergenza | goldenE2E.test.js (new) | 40 |
| S3 | ENTITY_TABLES cleanup: rimossi priceHistory, brainNotes, patterns | crud.js | — |
| S3 | Failure policy: 5 regole esplicite nel codice e audit | useBrain.js | — |
| S3 | UI feedback persist parziale: ActionCard canonico + summary banner | BrainSheet.jsx | — |

**Totale: 82 test Vitest, 0 fail.**

### Quarto ciclo — Sprint 4: Dual Action, Notifiche, Calendario (13 Marzo 2026)

| # | Punto | File modificati |
|---|-------|-----------------|
| D1 | Dual Action reminder+shopping (L0c) | intentClassifier.js |
| D2 | notifyScope personal/family (ricordami/ricordaci) | intentClassifier.js, useBrain.js |
| D3 | Auto-categorizzazione shopping | intentClassifier.js |
| D4 | cleanTitle() pulizia verbi modali/promemoria/preposizioni | actionBuilder.js |
| D5 | Shopping product name extraction rewrite | actionBuilder.js |
| D6 | scheduleShoppingReminders + cancelShoppingReminders | notificationScheduler.js |
| D7 | scheduleDailyTaskReminders + urgency escalation | notificationScheduler.js |
| D8 | Task su MonthGrid (purple squares) | MonthGrid.jsx, CalendarPage.jsx |
| D9 | Task in DayDetail (sezione Scadenze) | DayDetail.jsx |
| D10 | Dashboard "Scadenze in arrivo" con countdown badges | DashboardPage.jsx |
| D11 | Calendario 3 viste con ViewToggle | CalendarPage.jsx (rewrite) |
| D12 | DayView — vista giornaliera con timeline oraria | DayView.jsx (nuovo) |
| D13 | WeekView — vista settimanale 7 colonne | WeekView.jsx (nuovo) |
| D14 | ViewToggle — segmented control | ViewToggle.jsx (nuovo) |
| D15 | Helper date: getWeekDays, formatDayShort, addDays | dates.js |

### Da completare

- [ ] Test frasi end-to-end 8-20 (completate 1-7)
- [ ] Verificare DayView/WeekView su Android (Capacitor)
- [ ] Ottimizzare WeekView per schermi piccoli (responsive)
- [ ] Build Android Studio (Capacitor 8 + Gradle)
- [ ] Installare @capacitor/local-notifications
- [ ] Eseguire supabase-migration-v2.sql
- [ ] Test su dispositivo fisico Android
- [ ] Rieseguire test batch 253 frasi dopo A1-A6
- [x] ~~Test E2E completi~~ → Sprint 3 (82 test, 7 scenari golden)
- [ ] Deploy Supabase production
- [ ] Migrazioni DB v1→v8 in produzione
- [x] ~~Sprint 3 hardening: failure handling orchestrator~~ → failure policy (5 regole), ENTITY_TABLES cleanup, UI feedback persist parziale
- [ ] Sprint 3 hardening: telemetria di fiducia (acceptance/modification/cancellation rate)
- [ ] Test Android reale (voice, app lifecycle, notifications, latency)

---

## 19. NOTE OPERATIVE E GOTCHA

### Ordine L0 è critico

I pattern L0 in intentClassifier.js usano `continue` dopo ogni match. L'ordine determina la priorità: expense prima di tutto (un importo è sempre una spesa), poi assenze, poi logistica, ecc.

### isAbsence flag

Il handler absence crea `type:'calendar'` con `isAbsence:true`, non `type:'absence'`. Il test runner mappa questo correttamente.

### Dual action

Logistica con driver+subject distinti genera sempre 3 azioni (calendar + task + reminder). Il codice è duplicato tra L0b1 e la sezione L1+L2 di intentClassifier.js per gestire entrambi i casi.

### extractActivity prima di regex, poi taxonomy

`extractActivity` prima prova 21 regex diretti, poi se nessuno matcha cerca nella ACTIVITY_TAXONOMY. I regex sono più precisi ma limitati; la taxonomy cattura varianti.

### NLP.js import isolato

`brainNlp.js` è l'UNICO file che importa `@nlpjs/*`. Per sostituire NLP.js con un altro engine, basta reimplementare le 8 funzioni con la stessa interfaccia.

### Shadow learning previene inquinamento

Le nuove sinapsi utente partono "spente". Servono 3 conferme per attivarsi. Sinapsi bootstrap sono sempre attive (il loro `confirmCount` non è settato, e il default `?? SHADOW_CONFIRM_THRESHOLD` le rende sempre attive).

### Browser DevTools su Windows

Ctrl+Shift+J (non F12 che apre calcolatrice su alcuni setup).

### Vite ESM caching

`import()` in ESM è cached. Per test, usare `?v=Date.now()` o restart Vite dev server.

### Test batch nel browser

Le 253 frasi di test vanno lanciate nel browser (non Node.js) perché usano Dexie (IndexedDB) e il runtime NLP.js browser.

### Alias members

I membri possono avere alias definiti nel record `members`. Esempio: Mariangela.aliases = ["nonna"], Chiara.aliases = ["mamma"]. L'entity extractor li usa per il match.

### actionVerb nella logistica

`actionVerb` ('portare'|'prendere'|'riprendere'|'ritirare') determina se l'azione è drop-off o pickup. "portare" = drop-off (genera `accompaniedBy`), tutti gli altri = pickup (genera `pickupBy`).

### Conversation memory TTL

I draft scadono dopo 15 minuti (estesi a ogni merge, max 30 min totale). I draft scaduti vengono marcati `status: 'expired'` al prossimo check.

### Telemetria non rompe mai l'app

Tutti i metodi telemetria hanno try/catch vuoto. Se IndexedDB fallisce, la telemetria viene silenziosamente ignorata.

### Rate limit L3

20 chiamate Claude Haiku al giorno. Contatore lato client, si resetta al refresh pagina. Non persistito.

### Contratto canonico — regole chiave (Sprint 1-3)

- **Mai campi legacy dopo il normalizer**: il validatore li blocca (FORBIDDEN_FIELDS). Se una raw action ha `time`, il normalizer lo converte in `timeStart`. Se dopo la normalizzazione c'è ancora `time`, l'azione viene scartata.
- **null esplicito, mai undefined**: le factory in actionContract.js creano oggetti con tutti i campi presenti. Campi opzionali sono `null`, non assenti.
- **Name→ID nel normalizer, mai nell'executor**: `resolveMember()` vive in actionNormalizer.js. L'executor in useBrain.js legge direttamente `personIds`, `assignedToId`, `personId`.
- **utteranceRef condiviso**: tutte le azioni dalla stessa utterance condividono `meta.utteranceRef`. actionRef è sequenziale (`a_0`, `a_1`, ...).
- **Slot meal in inglese nel canonical, italiano nel DB**: canonical usa `breakfast`/`lunch`/`dinner`, il DB usa `colazione`/`pranzo`/`cena`. L'executor ha `SLOT_TO_DB` per il reverse mapping.
- **Linked entity persist ordering**: independent prima, dependent dopo. Il `refToIdMap` collega `actionRef` a `realDbId`. Se il calendar fallisce, i task dependent non hanno `realId` ma possono comunque essere persistiti (senza link).
- **Per-action confidence non individuale (Sprint 1 trade-off)**: tutte le azioni della stessa utterance ereditano `avgConfidence` dal context. Accettabile per ora; tagging individuale rimandato.

### Test Vitest — come eseguire

```bash
# Tutti i test del contratto canonico (82 test)
npx vitest run src/lib/brain/__tests__/

# Solo golden E2E (40 test)
npx vitest run src/lib/brain/__tests__/goldenE2E.test.js

# Watch mode
npx vitest src/lib/brain/__tests__/
```

I test usano solo il normalizer+validator (no DB, no Dexie, no NLP.js). Possono girare in Node.js via Vitest senza browser.


---

## 20. SPRINT 4 — DUAL ACTION, NOTIFICHE AVANZATE, CALENDARIO 3 VISTE

### 20.1 Dual Action: Reminder + Shopping (L0c)

**Problema**: "Ricordami di comprare il latte" generava solo un promemoria. L'utente vuole sia il promemoria sia l'item nella lista spesa.

**Soluzione** (intentClassifier.js, L0c block):
- Se la frase di reminder contiene un verbo di acquisto (comprare, acquistare, prendere), genera **2 azioni**:
  1. `type: 'reminder'` — promemoria standard
  2. `type: 'shopping'` — item nella lista spesa

```javascript
// Buying verb detection in L0c
const _buyingRe = /\b(?:comprare|compra|acquistare|acquista|prendere|prendi)\s+/i
if (_buyingRe.test(lower)) {
  const shoppingAction = buildAction('shopping', sentence, { ... })
  shoppingAction.notifyScope = _notifyScope
  // Auto-categorization: latte→latticini, pane→pane_pasta, etc.
  actions.push(shoppingAction)
}
```

### 20.2 notifyScope: Personal vs Family

**Regola**:
- `ricordami`, `avvisami`, `segnalami` → `notifyScope: 'personal'` (notifica solo all'autore)
- `ricordaci`, `ricordatemi`, `ricordatevi`, `avvisaci`, `avvertici` → `notifyScope: 'family'` (notifica a tutti)

**Implementazione** (intentClassifier.js ~linea 524):
```javascript
const _isForAll = /\b(?:ricordaci|ricordatemi|ricordatevi|avvisaci|avvisateci|avvertici)\b/i.test(lower)
const _notifyScope = _isForAll ? 'family' : 'personal'
action.notifyScope = _notifyScope
```

**Integrazione** (useBrain.js):
- Se `notifyScope === 'family'` → chiama `notifyAll(familyId, ...)`
- Se `notifyScope === 'personal'` → chiama `notify(currentMemberId, ...)`

### 20.3 Auto-Categorizzazione Shopping

Quando un item shopping viene generato da dual action, viene auto-categorizzato:

| Pattern Regex | Categoria |
|---------------|-----------|
| latte, formaggio, yogurt, burro, panna, mozzarella | latticini |
| pane, pasta, farina, grissini | pane_pasta |
| detersivo, sapone, shampoo | igiene |
| carne, pollo, manzo, maiale, vitello | macelleria |
| pesce, tonno, salmone, merluzzo | pescheria |
| frutta, mele, banane, arance | frutta |
| verdura, insalata, pomodori, zucchine | verdura |

### 20.4 cleanTitle() — Pulizia Avanzata (actionBuilder.js)

**Aggiunte linea ~282**:
1. **Verbi promemoria**: ricordami, ricordaci, ricordatemi, avvisami, avvisaci, segnalami
2. **Verbi modali**: deve, devo, dobbiamo, devono
3. **Preposizioni temporali trailing**: "entro", "fino a", "prima di" a fine stringa

**Esempio**:
- Input: "Devo pagare la bolletta del gas entro venerdì"
- Output: "Pagare la bolletta del gas" (capitalize first letter)

### 20.5 Shopping Product Name Extraction (actionBuilder.js)

**Rewrite completo** del case 'shopping' (~linea 132):
```javascript
const prodotto = sentence
  .replace(/\b(?:ricordami|ricordaci|...)\b/gi, '')      // verbi promemoria
  .replace(/\b(?:comprare|compra|acquistare|...)\b/gi, '') // verbi acquisto
  .replace(/al\s+super(?:mercato)?|alla?\s+lista|da\s+comprare/gi, '') // contesti
  .replace(/^\s*(?:di|che|a|da|per)\s+/gi, '')            // preposizioni iniziali
  .replace(/^\s*(?:il|la|lo|le|i|gli|l['']\s*|un[oa]?\s+)/gi, '') // articoli
  .replace(/\s{2,}/g, ' ')
  .trim()
```

### 20.6 Notifiche Shopping (notificationScheduler.js)

```javascript
export function scheduleShoppingReminders(itemId, itemName, notifyScope) {
  // ID deterministici: hash(itemId + '_noon'), hash(itemId + '_evening')
  // 12:00 → "🛒 Non dimenticare: {itemName}"
  // 18:00 → "🛒 Hai comprato {itemName}?"
}

export function cancelShoppingReminders(itemId) {
  // Cancella entrambe le notifiche (noon + evening)
}
```

**Trigger cancellazione**: useShopping.toggleItem() quando `checked === true`

### 20.7 Notifiche Task Giornaliere (notificationScheduler.js)

```javascript
export function scheduleDailyTaskReminders(task) {
  // Loop da oggi a task.due_date (max 14 giorni)
  // Ogni giorno alle 10:00
  // Escalation:
  //   giorni normali  → "📌 {titolo} (scade tra X giorni)"
  //   giorno prima    → "⏰ Scade domani: {titolo}"
  //   giorno scadenza → "🔴 SCADENZA OGGI: {titolo}"
}

export function cancelDailyTaskReminders(taskId) {
  // Cancella tutte le notifiche giornaliere (indici 0-14) + reminder standard
}
```

**Trigger cancellazione**: useTasks.completeTask() e useTasks.deleteTask()

### 20.8 Calendario — 3 Viste

**Architettura nuova** (CalendarPage.jsx rewrite):
```
CalendarPage
├── ViewToggle (Giorno | Settimana | Mese)
├── Navigation header (adattivo al viewMode)
│   ├── day: < prev day | title "Giovedì 13 Marzo 2026" | next day >
│   ├── week: < prev week | title "Lun 9 – Dom 15" | next week >
│   └── month: < prev month | title "Marzo 2026" | next month >
├── [viewMode === 'month'] → MonthGrid + DayDetail (invariato)
├── [viewMode === 'week'] → WeekView (click giorno → day view)
└── [viewMode === 'day'] → DayView
```

**State Management**:
- `viewMode`: 'day' | 'week' | 'month'
- `selectedDate`: ISO string, shared tra tutte le viste
- Navigazione prev/next adattiva al viewMode (±1 giorno / ±7 giorni / ±1 mese)

### 20.8.1 DayView (src/components/calendar/DayView.jsx) — NUOVO

**Vista giornaliera con massimo dettaglio**:
- **Header card**: Nome giorno, data, conteggio eventi/scadenze, bottone "+ Evento"
- **Sezione "Tutto il giorno"**: Eventi senza orario (icona Sun)
- **Timeline oraria**: Slot dalle 7:00 alle 22:00 (HOUR_HEIGHT = 64px)
  - Etichetta ora a sinistra (12px)
  - Card evento posizionate nello slot orario corrispondente
  - **Indicatore ora corrente**: linea rossa con pallino (solo se è oggi)
- **Card evento dettagliate**: Icona categoria, titolo, orario + durata, proprietario, note, logistica (badge porta/riprende), warning badges (incomplete, needsPickup)
- **Sezione Scadenze**: Task viola con checkbox completamento, priorità, membro assegnato

**Componenti interni**:
- `EventBlock`: Card evento completa (usata anche da DayDetail)
- `TaskBlock`: Card task con checkbox, priorità, categoria

### 20.8.2 WeekView (src/components/calendar/WeekView.jsx) — NUOVO

**Vista settimanale con dettaglio medio**:
- **Header 7 colonne**: Lun–Dom con nome abbreviato + numero, giorno selezionato evidenziato (gradient blu), oggi con sfondo leggero
- **Dot indicators**: pallini (eventi) e quadratini (task) sotto ogni numero
- **Body 7 colonne**: Mini-card eventi/task impilate verticalmente
  - `MiniEventCard`: bordo sinistro colorato per categoria, icona + titolo + orario + proprietario + logistica compatta
  - `MiniTaskCard`: bordo sinistro viola, checkbox + titolo + membro
- **Interazione**: click su colonna giorno → `setViewMode('day')` + `setSelectedDate(day)`

**Filtraggio dati**: `weekEvents` e `weekTasks` filtrati per range settimana (Lun–Dom) da getWeekDays()

### 20.8.3 ViewToggle (src/components/calendar/ViewToggle.jsx) — NUOVO

**Segmented control** con 3 opzioni:
- Giorno (CalendarDays icon)
- Settimana (Columns3 icon)
- Mese (LayoutGrid icon)

Stile coerente con il tema blu calendario (#0984E3), transizioni smooth, active state con ombra.

### 20.8.4 MonthGrid — Task Indicators (aggiornato)

**Aggiunta** (MonthGrid.jsx):
- `taskDots` memo: mappa `date → [#A855F7]` (viola) per task con due_date
- **Quadratini viola** (borderRadius: 1.5px) renderizzati dopo i pallini evento
- Quando giorno selezionato: quadratini diventano bianchi semi-trasparenti

### 20.8.5 DayDetail — Sezione Scadenze (aggiornato)

**Aggiunta** (DayDetail.jsx):
- Props: `tasks = []`, `onCompleteTask`
- `dayTasks` filter: task con `due_date === date` e `status !== 'done'`
- Sezione "Scadenze" viola dopo lista eventi: icona Clock, badge conteggio, card task con CheckCircle2

### 20.8.6 DashboardPage — Scadenze in Arrivo (aggiornato)

**Aggiunta** (DashboardPage.jsx):
- Query `upcomingDeadlines`: task con `due_date >= today`, non done, non needsConfirm
- Sezione "Scadenze in arrivo" con countdown colorati:
  - Rosso: "OGGI"
  - Ambra: "Domani"
  - Viola: "tra X giorni"

### 20.9 Helper Date (dates.js)

Nuove funzioni esportate:
```javascript
export function getWeekDays(dateStr)      // → string[7] ISO dates (Lun–Dom)
export function formatDayShort(isoString) // → "Ven 13"
export function addDays(dateStr, offset)  // → ISO date string
```

### 20.10 File Creati/Modificati Sprint 4

| File | Stato | Righe | Descrizione |
|------|-------|-------|-------------|
| src/components/calendar/DayView.jsx | NUOVO | ~280 | Vista giornaliera timeline |
| src/components/calendar/WeekView.jsx | NUOVO | ~200 | Vista settimanale 7 colonne |
| src/components/calendar/ViewToggle.jsx | NUOVO | ~40 | Toggle Giorno/Settimana/Mese |
| src/pages/CalendarPage.jsx | REWRITE | ~300 | 3 viste + navigazione adattiva |
| src/components/calendar/MonthGrid.jsx | MOD | +20 | taskDots + purple squares |
| src/components/calendar/DayDetail.jsx | MOD | +40 | Sezione Scadenze |
| src/pages/DashboardPage.jsx | MOD | +30 | Scadenze in arrivo |
| src/lib/brain/intentClassifier.js | MOD | +30 | Dual action shopping, notifyScope |
| src/lib/brain/actionBuilder.js | MOD | +20 | cleanTitle, shopping extraction |
| src/lib/notificationScheduler.js | MOD | +80 | Shopping + daily task reminders |
| src/hooks/useBrain.js | MOD | +15 | notifyScope, shopping/task reminders |
| src/hooks/useShopping.js | MOD | +5 | cancelShoppingReminders on toggle |
| src/hooks/useTasks.js | MOD | +5 | cancelDailyTaskReminders on complete/delete |
| src/lib/dates.js | MOD | +45 | getWeekDays, formatDayShort, addDays |

---

## 21. TEST FRASI END-TO-END (Frase 1-20)

Pipeline completa: frase → brain parse → normalize → validate → persist → UI display.

| # | Frase | Stato | Intent | Note |
|---|-------|-------|--------|------|
| 1 | "Domani Asia ha danza alle 16" | ✅ | calendar | Testata sessioni precedenti |
| 2 | "Cristian porta Asia a danza" | ✅ | calendar + task | Dual action logistica |
| 3 | "Ho speso 30 euro al supermercato" | ✅ | expense | |
| 4 | "Stasera pasta al ragù" | ✅ | meal | |
| 5 | "Comprare il latte" | ✅ | shopping | |
| 6 | "Ricordami di comprare il latte" | ✅ | reminder + shopping | DUAL ACTION, notifyScope personal |
| 7 | "Devo pagare la bolletta del gas entro venerdì" | ✅ | task | cleanTitle, daily reminders, calendar+dashboard visibility |
| 8 | "Asia deve fare i compiti di matematica" | ⏳ | task | DA TESTARE |
| 9 | "Ho speso 45 euro al supermercato" | ⏳ | expense | DA TESTARE |
| 10 | "Asia domani non va a scuola" | ⏳ | calendar (absence) | DA TESTARE |
| 11 | "Pagato 120 euro per il corso di danza di Asia" | ⏳ | expense | DA TESTARE |
| 12 | "Bolletta luce 89 euro" | ⏳ | expense | DA TESTARE |
| 13 | "Stasera facciamo pasta al ragù" | ⏳ | meal | DA TESTARE |
| 14 | "A pranzo risotto ai funghi" | ⏳ | meal | DA TESTARE |
| 15 | "Comprare latte pane uova e detersivo" | ⏳ | shopping (multi) | DA TESTARE |
| 16 | "Viola ha lezione di piano dalle 15 alle 16 mercoledì" | ⏳ | calendar | DA TESTARE |
| 17 | "Ho pagato 12,50 euro per il parcheggio" | ⏳ | expense | DA TESTARE |
| 18 | "Ricordami alle 8 di chiamare il dottore" | ⏳ | reminder | DA TESTARE |
| 19 | "Viola domani" | ⏳ | ? (incomplete) | DA TESTARE — conversazione? |
| 20 | "Domani mattina Asia ha danza alle 10, poi pranzo dalla nonna, e devo comprare il regalo" | ⏳ | multi-intent | DA TESTARE — 3 azioni |

**Legenda**: ✅ = testata e funzionante, ⏳ = da testare


---

## 20. SPRINT 4 — DUAL ACTION, NOTIFICHE AVANZATE, CALENDARIO 3 VISTE (13 Marzo 2026)

### 20.1 Dual Action: Reminder + Shopping (L0c)

**Problema**: "Ricordami di comprare il latte" generava solo un promemoria. L'utente vuole sia il promemoria sia l'item nella lista spesa.

**Soluzione** (intentClassifier.js, blocco L0c ~linea 524):
Quando la frase di reminder contiene un verbo di acquisto, genera 2 azioni:
1. `type: 'reminder'` — promemoria standard
2. `type: 'shopping'` — item nella lista spesa

```javascript
// Buying verb detection in L0c
const _buyingRe = /\b(?:comprare|compra|acquistare|acquista|prendere|prendi)\s+/i
if (_buyingRe.test(lower)) {
  const shoppingAction = buildAction('shopping', sentence, {
    amount: null, date, time: null, persons, members, logistics, timeCtx,
    category: null, currentMember,
  })
  shoppingAction.notifyScope = _notifyScope
  // Auto-categorization
  actions.push(shoppingAction)
}
```

### 20.2 notifyScope: Personal vs Family

**Regola**:
- `ricordami`, `avvisami`, `segnalami` → `notifyScope: 'personal'` (notifica solo all'autore)
- `ricordaci`, `ricordatemi`, `ricordatevi`, `avvisaci`, `avvertici` → `notifyScope: 'family'` (notifica a tutti)

**Implementazione** (intentClassifier.js ~linea 524):
```javascript
const _isForAll = /\b(?:ricordaci|ricordatemi|ricordatevi|avvisaci|avvisateci|avvertici)\b/i.test(lower)
const _notifyScope = _isForAll ? 'family' : 'personal'
action.notifyScope = _notifyScope
```

**Integrazione** (useBrain.js):
- Se `notifyScope === 'family'` → chiama `notifyAll(familyId, ...)`
- Se `notifyScope === 'personal'` → chiama `notify(currentMemberId, ...)`

### 20.3 Auto-Categorizzazione Shopping

Quando un item shopping viene generato da dual action, viene auto-categorizzato:

| Pattern Regex | Categoria |
|---------------|-----------|
| latte, formaggio, yogurt, burro, panna, mozzarella | latticini |
| pane, pasta, farina, grissini | pane_pasta |
| detersivo, sapone, shampoo | igiene |
| carne, pollo, manzo, maiale, vitello | macelleria |
| pesce, tonno, salmone, merluzzo | pescheria |
| frutta, mele, banane, arance | frutta |
| verdura, insalata, pomodori, zucchine | verdura |

### 20.4 cleanTitle() — Pulizia Avanzata (actionBuilder.js)

**Aggiunte linea ~282**:
1. **Verbi promemoria**: ricordami, ricordaci, ricordatemi, avvisami, avvisaci, segnalami
2. **Verbi modali**: deve, devo, dobbiamo, devono
3. **Preposizioni temporali trailing**: "entro", "fino a", "prima di" a fine stringa

**Esempio**:
- Input: "Devo pagare la bolletta del gas entro venerdì"
- Output: "Pagare la bolletta del gas" (capitalize first letter)

### 20.5 Shopping Product Name Extraction (actionBuilder.js)

**Rewrite completo** del case 'shopping' (~linea 132):
```javascript
const prodotto = sentence
  .replace(/\b(?:ricordami|ricordaci|...)\b/gi, '')      // verbi promemoria
  .replace(/\b(?:comprare|compra|acquistare|...)\b/gi, '') // verbi acquisto
  .replace(/al\s+super(?:mercato)?|alla?\s+lista|da\s+comprare/gi, '') // contesti
  .replace(/^\s*(?:di|che|a|da|per)\s+/gi, '')            // preposizioni iniziali
  .replace(/^\s*(?:il|la|lo|le|i|gli|l['']\s*|un[oa]?\s+)/gi, '') // articoli
  .replace(/\s{2,}/g, ' ')
  .trim()
```

### 20.6 Notifiche Shopping (notificationScheduler.js)

```javascript
export function scheduleShoppingReminders(itemId, itemName, notifyScope) {
  // ID deterministici: hash(itemId + '_noon'), hash(itemId + '_evening')
  // 12:00 → "Non dimenticare: {itemName}"
  // 18:00 → "Hai comprato {itemName}?"
}

export function cancelShoppingReminders(itemId) {
  // Cancella entrambe le notifiche (noon + evening)
}
```

**Trigger cancellazione**: useShopping.toggleItem() quando `checked === true`

### 20.7 Notifiche Task Giornaliere (notificationScheduler.js)

```javascript
export function scheduleDailyTaskReminders(task) {
  // Loop da oggi a task.due_date (max 14 giorni)
  // Ogni giorno alle 10:00
  // Escalation:
  //   giorni normali  → "{titolo} (scade tra X giorni)"
  //   giorno prima    → "Scade domani: {titolo}"
  //   giorno scadenza → "SCADENZA OGGI: {titolo}"
}

export function cancelDailyTaskReminders(taskId) {
  // Cancella tutte le notifiche giornaliere (indici 0-14) + reminder standard
}
```

**Trigger cancellazione**: useTasks.completeTask() e useTasks.deleteTask()

### 20.8 Calendario — 3 Viste

**Architettura nuova** (CalendarPage.jsx rewrite):
```
CalendarPage
+-- ViewToggle (Giorno | Settimana | Mese)
+-- Navigation header (adattivo al viewMode)
|   +-- day:   < prev day  | "Giovedi 13 Marzo 2026"   | next day >
|   +-- week:  < prev week | "Lun 9 - Dom 15"          | next week >
|   +-- month: < prev month| "Marzo 2026"              | next month >
+-- [viewMode === 'month'] → MonthGrid + DayDetail (invariato)
+-- [viewMode === 'week']  → WeekView (click giorno → day view)
+-- [viewMode === 'day']   → DayView
```

**State Management**:
- `viewMode`: 'day' | 'week' | 'month'
- `selectedDate`: ISO string, shared tra tutte le viste
- Navigazione prev/next adattiva al viewMode (+/-1 giorno, +/-7 giorni, +/-1 mese)

### 20.8.1 DayView (src/components/calendar/DayView.jsx) — NUOVO

**Vista giornaliera con massimo dettaglio**:
- **Header card**: Nome giorno, data, conteggio eventi/scadenze, bottone "+ Evento"
- **Sezione "Tutto il giorno"**: Eventi senza orario (icona Sun)
- **Timeline oraria**: Slot dalle 7:00 alle 22:00 (HOUR_HEIGHT = 64px)
  - Etichetta ora a sinistra (12px)
  - Card evento posizionate nello slot orario corrispondente
  - **Indicatore ora corrente**: linea rossa con pallino (solo se oggi)
- **Card evento dettagliate**: Icona categoria, titolo, orario + durata, proprietario, note, logistica (badge porta/riprende), warning badges (incomplete, needsPickup)
- **Sezione Scadenze**: Task viola con checkbox completamento, priorita, membro assegnato

**Componenti interni**:
- `EventBlock`: Card evento completa
- `TaskBlock`: Card task con checkbox, priorita, categoria

### 20.8.2 WeekView (src/components/calendar/WeekView.jsx) — NUOVO

**Vista settimanale con dettaglio medio**:
- **Header 7 colonne**: Lun-Dom con nome abbreviato + numero, giorno selezionato evidenziato (gradient blu), oggi con sfondo leggero
- **Dot indicators**: pallini (eventi) e quadratini (task) sotto ogni numero
- **Body 7 colonne**: Mini-card eventi/task impilate verticalmente
  - `MiniEventCard`: bordo sinistro colorato per categoria, icona + titolo + orario + proprietario + logistica compatta
  - `MiniTaskCard`: bordo sinistro viola, checkbox + titolo + membro
- **Interazione**: click su colonna giorno → `setViewMode('day')` + `setSelectedDate(day)`

**Filtraggio dati**: `weekEvents` e `weekTasks` filtrati per range settimana (Lun-Dom) da getWeekDays()

### 20.8.3 ViewToggle (src/components/calendar/ViewToggle.jsx) — NUOVO

**Segmented control** con 3 opzioni:
- Giorno (CalendarDays icon)
- Settimana (Columns3 icon)
- Mese (LayoutGrid icon)

Stile coerente con il tema blu calendario (#0984E3), transizioni smooth, active state con ombra.

### 20.8.4 MonthGrid — Task Indicators (aggiornato)

**Aggiunta** (MonthGrid.jsx):
- `taskDots` memo: mappa `date → [#A855F7]` (viola) per task con due_date
- **Quadratini viola** (borderRadius: 1.5px) renderizzati dopo i pallini evento
- Quando giorno selezionato: quadratini diventano bianchi semi-trasparenti

### 20.8.5 DayDetail — Sezione Scadenze (aggiornato)

**Aggiunta** (DayDetail.jsx):
- Props: `tasks = []`, `onCompleteTask`
- `dayTasks` filter: task con `due_date === date` e `status !== 'done'`
- Sezione "Scadenze" viola dopo lista eventi: icona Clock, badge conteggio, card task con CheckCircle2

### 20.8.6 DashboardPage — Scadenze in Arrivo (aggiornato)

**Aggiunta** (DashboardPage.jsx):
- Query `upcomingDeadlines`: task con `due_date >= today`, non done, non needsConfirm
- Sezione "Scadenze in arrivo" con countdown colorati:
  - Rosso: "OGGI"
  - Ambra: "Domani"
  - Viola: "tra X giorni"

### 20.9 Helper Date (dates.js)

Nuove funzioni esportate:
```javascript
export function getWeekDays(dateStr)      // → string[7] ISO dates (Lun-Dom)
export function formatDayShort(isoString) // → "Ven 13"
export function addDays(dateStr, offset)  // → ISO date string
```

### 20.10 File Creati/Modificati Sprint 4

| File | Stato | Descrizione |
|------|-------|-------------|
| src/components/calendar/DayView.jsx | NUOVO | Vista giornaliera timeline |
| src/components/calendar/WeekView.jsx | NUOVO | Vista settimanale 7 colonne |
| src/components/calendar/ViewToggle.jsx | NUOVO | Toggle Giorno/Settimana/Mese |
| src/pages/CalendarPage.jsx | REWRITE | 3 viste + navigazione adattiva |
| src/components/calendar/MonthGrid.jsx | MOD | taskDots + purple squares |
| src/components/calendar/DayDetail.jsx | MOD | Sezione Scadenze |
| src/pages/DashboardPage.jsx | MOD | Scadenze in arrivo |
| src/lib/brain/intentClassifier.js | MOD | Dual action shopping, notifyScope |
| src/lib/brain/actionBuilder.js | MOD | cleanTitle, shopping extraction |
| src/lib/notificationScheduler.js | MOD | Shopping + daily task reminders |
| src/hooks/useBrain.js | MOD | notifyScope, shopping/task reminders |
| src/hooks/useShopping.js | MOD | cancelShoppingReminders on toggle |
| src/hooks/useTasks.js | MOD | cancelDailyTaskReminders on complete/delete |
| src/lib/dates.js | MOD | getWeekDays, formatDayShort, addDays |

---

## 21. TEST FRASI END-TO-END (Frase 1-20)

Pipeline completa: frase → brain parse → normalize → validate → persist → UI display.

| # | Frase | Stato | Intent | Note |
|---|-------|-------|--------|------|
| 1 | "Domani Asia ha danza alle 16" | PASS | calendar | Testata sessioni precedenti |
| 2 | "Cristian porta Asia a danza" | PASS | calendar + task | Dual action logistica |
| 3 | "Ho speso 30 euro al supermercato" | PASS | expense | |
| 4 | "Stasera pasta al ragu" | PASS | meal | |
| 5 | "Comprare il latte" | PASS | shopping | |
| 6 | "Ricordami di comprare il latte" | PASS | reminder + shopping | DUAL ACTION, notifyScope personal |
| 7 | "Devo pagare la bolletta del gas entro venerdi" | PASS | task | cleanTitle, daily reminders, calendario+dashboard |
| 8 | "Asia deve fare i compiti di matematica" | TODO | task | DA TESTARE |
| 9 | "Ho speso 45 euro al supermercato" | TODO | expense | DA TESTARE |
| 10 | "Asia domani non va a scuola" | TODO | calendar (absence) | DA TESTARE |
| 11 | "Pagato 120 euro per il corso di danza di Asia" | TODO | expense | DA TESTARE |
| 12 | "Bolletta luce 89 euro" | TODO | expense | DA TESTARE |
| 13 | "Stasera facciamo pasta al ragu" | TODO | meal | DA TESTARE |
| 14 | "A pranzo risotto ai funghi" | TODO | meal | DA TESTARE |
| 15 | "Comprare latte pane uova e detersivo" | TODO | shopping (multi) | DA TESTARE |
| 16 | "Viola ha lezione di piano dalle 15 alle 16 mercoledi" | TODO | calendar | DA TESTARE |
| 17 | "Ho pagato 12,50 euro per il parcheggio" | TODO | expense | DA TESTARE |
| 18 | "Ricordami alle 8 di chiamare il dottore" | TODO | reminder | DA TESTARE |
| 19 | "Viola domani" | TODO | ? (incomplete) | DA TESTARE — conversazione? |
| 20 | "Domani mattina Asia ha danza alle 10, poi pranzo dalla nonna, e devo comprare il regalo" | TODO | multi-intent | DA TESTARE — 3 azioni |
