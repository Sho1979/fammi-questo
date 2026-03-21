# Fammi Questo — Stato Completo del Sistema

> **Data**: 21 Marzo 2026
> **Versione**: 1.0.5 (build 6)
> **Branch**: main (37 commit ahead of origin)

---

## 1. Panoramica Progetto

**Fammi Questo** è un'app italiana di gestione familiare con intelligenza artificiale. L'utente parla o scrive in linguaggio naturale italiano ("Porto Viola a danza domani alle 16") e il sistema capisce, estrae entità, e scrive nel database locale.

### Tech Stack

| Layer | Tecnologia | Versione |
|-------|-----------|----------|
| Frontend | React | 19 |
| Build | Vite | 7 |
| Mobile | Capacitor | 8 |
| DB Locale | Dexie (IndexedDB) | 4 |
| DB Cloud | Supabase | 2 |
| NLP | @nlpjs/nlp | 5 alpha |
| AI Fallback | Claude Haiku API | - |
| CSS | Tailwind CSS | 4 |
| State | Zustand | 5 |
| Charts | Recharts | 3 |
| Test | Vitest | - |

### Architettura Core

```
Utente → Input vocale/testo
    ↓
[L0: Pattern Matching]    — Pattern strutturali (€, assente, portare/prendere)
    ↓ (se confidence < 0.80)
[L1: NLP.js]              — Classificatore neurale italiano (149 docs base)
    ↓ (combina con)
[L2: Sinapsi pesate]      — Pattern appresi dal feedback utente
    ↓ (se confidence < 0.55)
[L3: Claude Haiku]        — Fallback AI online
    ↓
Action[] → Normalize → Validate → CommitEvaluator → DB Write
```

---

## 2. Database Schema (Dexie v9)

### Tabelle Sincronizzate (Dexie ↔ Supabase)

| Tabella | Chiave | Indici | Scopo | Campi Principali |
|---------|--------|--------|-------|-----------------|
| `family` | id | - | Record radice famiglia | name, pin_hash, invite_code |
| `members` | id | family_id, role | Membri famiglia | name, role, gender, birth_date, aliases[], access_level |
| `events` | id | family_id, date, person_id | Eventi calendario | title, date, timeStart, timeEnd, category, location, assignedToId |
| `tasks` | id | family_id, due_date, assigned_to, status | Task/compiti | title, due_date, assigned_to, status, priority, category |
| `taskTemplates` | id | family_id | Template task ricorrenti | title, category, frequency |
| `expenses` | id | family_id, date, category | Spese | amount, category, date, person_id, description |
| `budgets` | id | family_id, [category+month] | Budget mensili | category, month, limit_amount |
| `meals` | id | family_id | Pasti singoli | date, name, category, assigned_to |
| `mealPlans` | id | family_id, date | Pianificazione settimanale | week_start, meals[] |
| `shoppingItems` | id | family_id, checked | Lista spesa | name, category, quantity, unit, checked |
| `inventory` | id | family_id, expiry_date | Inventario dispensa | name, quantity, unit, expiry_date, location |
| `notifications` | id | family_id, member_id, read | Notifiche | type, title, preview, read |
| `recurrences` | id | family_id, type | Regole ricorrenza | parent_event_id, frequency, end_date |
| `rewards` | id | family_id, member_id | Punti/premi bambini | week_start, points_earned, points_redeemed |
| `messageContexts` | id | family_id, created_by_member_id | Raggruppamento azioni NLP | intent, status |
| `entityRelations` | id | family_id | Grafo relazioni entità | from/to entity type+id, relation_type |

### Tabelle Solo Locali (no sync)

| Tabella | Scopo |
|---------|-------|
| `patterns` | Sinapsi apprese (keyword → actionType → score) |
| `nlpDocuments` | Training samples per NLP.js famiglia-specifico |
| `nlpLogs` | Log di parsing per debug/learning |
| `conversationDrafts` | Draft multi-turn (TTL 15min) |
| `conflictLog` | Conflitti sync |
| `settings` | Config + modello NLP salvato |

### Convenzioni Campi
- **ID**: UUID string
- **Date**: YYYY-MM-DD string
- **Timestamp**: ISO 8601 string
- **Sync metadata**: `_version` (int), `_device_id` (UUID), `_deleted` (bool), `updated_at`

---

## 3. Navigazione UI — Tabs e Sub-Tabs

### Schema Routing

```
/
├─ /setup                     SetupPage (wizard 7 step)
├─ /login                     LoginPage (selezione membro + PIN)
└─ <ProtectedRoute>
   ├─ /dashboard              DashboardPage
   ├─ /calendar               CalendarPage
   ├─ /tasks                  TasksPage
   ├─ /rewards                RewardsPage
   ├─ /expenses               SpesePage (3 sub-tab)
   ├─ /dispensa               DispensaPage (2 sub-tab)
   ├─ /meals                  MealsPage
   ├─ /settings               SettingsPage
   └─ /brain-debug            BrainDebugPage (solo genitori)
```

### Bottom Navigation (5 tab principali)

| Tab | Colore | Visibile per |
|-----|--------|-------------|
| Home (Dashboard) | Viola | Tutti |
| Calendario | Blu | full, calendar_tasks |
| Task | Verde | full, calendar_tasks, basic |
| Dispensa | Arancione | full, calendar_tasks, basic |
| Spese | Giallo | full, calendar_tasks |

### Livelli Accesso per Ruolo

| Ruolo | Livello | Capacità |
|-------|---------|----------|
| Genitore | `full` | Tutto |
| Nonno/a | `full` | Tutto |
| Figlio 13+ | `calendar_tasks` | Calendario, task, spese, dispensa |
| Figlio 6-12 | `basic` | Task, dispensa, impostazioni |
| Figlio <6 | `view_only` | Solo home e impostazioni |

---

## 4. Stato Dettagliato di Ogni Tab

### 4.1 Dashboard `/dashboard`
**File**: `src/pages/DashboardPage.jsx`
**Stato**: ✅ FUNZIONANTE

| Sezione | Contenuto | Stato |
|---------|-----------|-------|
| Greeting | Saluto + data odierna | ✅ |
| Brain Input | Input testo/vocale per AI | ✅ |
| Alert | Eventi incompleti, reminder pendenti, scadenze | ✅ |
| Eventi Oggi | Lista eventi del giorno | ✅ |
| Task Oggi | Conteggio pendenti/completati | ✅ |
| Spese Mese | Riepilogo per genitore | ✅ |
| Pasti | Suggerimenti/piani giornalieri | ✅ |
| Activity Feed | Ultime 5 azioni famiglia | ✅ |

### 4.2 Calendario `/calendar`
**File**: `src/pages/CalendarPage.jsx`
**Stato**: ✅ FUNZIONANTE (con ricorrenze)

| Sub-vista | Descrizione | Stato |
|-----------|-------------|-------|
| Vista Mese | Griglia mensile, click giorno → dettaglio | ✅ |
| Vista Settimana | 7 giorni orizzontali | ✅ |
| Vista Giorno | Dettaglio singolo giorno | ✅ |
| Form Evento | Crea/modifica evento | ✅ |
| Ricorrenze | Giornaliero, settimanale, mensile, custom | ✅ |
| Logistica | Chi porta/riprende, task collegati | ✅ |
| Elimina ricorrenza | "Solo questo" vs "tutti i futuri" | ✅ |

**Componenti**: ViewToggle, MonthGrid, DayDetail, DayView, WeekView, EventForm, EventCard

### 4.3 Task `/tasks`
**File**: `src/pages/TasksPage.jsx`
**Stato**: ✅ FUNZIONANTE (con proposte e template)

| Sezione | Descrizione | Stato |
|---------|-------------|-------|
| Classifica settimanale | Top 3 con medaglie, premio €20 | ✅ |
| Tracking adulti | Completati/assegnati senza gamification | ✅ |
| Filtro membro | Chip per filtrare per persona | ✅ |
| Filtro priorità | Alta/Media/Bassa + ordinamento | ✅ |
| Proposte | Bambini propongono → genitore approva/rifiuta | ✅ |
| Task Board | Lista per status: todo/in_progress/done | ✅ |
| Template Manager | Template ricorrenti CRUD | ✅ |
| Confetti | Animazione su completamento task | ✅ |

**Componenti**: TaskBoard, TaskCard, TaskForm, ProposalList, TemplateManager

### 4.4 Rewards `/rewards`
**File**: `src/pages/RewardsPage.jsx`
**Stato**: ✅ FUNZIONANTE

| Sezione | Descrizione | Stato |
|---------|-------------|-------|
| Premio settimanale | Banner con importo (€20) | ✅ |
| Classifica | Per membro: completati/assegnati, barra progresso | ✅ |
| Bonus/penalità | Solo genitore: ±punti con motivo | ✅ |
| Parimerito | Split equo in caso di parità | ✅ |
| Come funziona | Modal esplicativa | ✅ |

### 4.5 Spese `/expenses`
**File**: `src/pages/SpesePage.jsx`
**Stato**: ✅ FUNZIONANTE (3 sub-tab)

| Sub-Tab | Descrizione | Stato |
|---------|-------------|-------|
| **Lista** | Spese del mese, navigazione mese, CRUD (solo genitore), undo delete | ✅ |
| **Statistiche** | Totale mese, media giornaliera, delta vs mese precedente, grafico torta per categoria, trend 6 mesi barre | ✅ |
| **Budget** | Budget impostato/speso/rimanente, barra progresso con colori warning, setup budget per genitore | ✅ |

**Componenti**: ExpenseList, ExpenseCard, ExpenseForm, CategoryPicker, BudgetOverview, BudgetSetup

### 4.6 Dispensa `/dispensa`
**File**: `src/pages/DispensaPage.jsx`
**Stato**: ✅ FUNZIONANTE (2 sub-tab)

| Sub-Tab | Descrizione | Stato |
|---------|-------------|-------|
| **Lista Spesa** | Quick add + bottoni categoria, checkbox per spuntare, contatore progresso, sposta in inventario quando completato | ✅ |
| **Inventario** | Totale prodotti per posizione, scansione scontrino OCR, ricerca, alert scadenze (3 giorni), scaffali per posizione (Dispensa/Frigo/Freezer/Altro) | ✅ |

**OCR Scontrino**:
- Cattura foto → estrazione prodotti via API
- Modal revisione: toggle selezione per prodotto
- Merge con inventario esistente (aggiunto/aggiornato)

### 4.7 Pasti `/meals`
**File**: `src/pages/MealsPage.jsx`
**Stato**: ✅ FUNZIONANTE

| Sezione | Descrizione | Stato |
|---------|-------------|-------|
| Navigazione settimana | Prev/next settimana | ✅ |
| 7 giorni | Lun-Dom con 3 slot per giorno | ✅ |
| Slot pasto | Colazione 🥐 / Pranzo 🍽️ / Cena 🍝 | ✅ |
| Aggiungi pasto | Modal con nome + note + slot | ✅ |
| Highlight oggi | Giorno corrente evidenziato in viola | ✅ |

### 4.8 Impostazioni `/settings`
**File**: `src/pages/SettingsPage.jsx`
**Stato**: ✅ FUNZIONANTE

| Sezione | Descrizione | Stato |
|---------|-------------|-------|
| Famiglia | Nome famiglia, badge membri, conteggio per ruolo | ✅ |
| Privacy e Dati | Storage locale, status online/offline, conteggio record per tabella, stima spazio | ✅ |
| Backup Crittografato | Export/Import con PIN, AES-256, file .fmbackup | ✅ |
| Sync Cloud | Sincronizza ora, status push/pull, ultimo sync, invita/unisciti dispositivo | ✅ |
| Azioni | Cambia utente, Brain Debug (solo dev), Reset app (doppia conferma) | ✅ |

### 4.9 Brain Debug `/brain-debug`
**File**: `src/pages/BrainDebugPage.jsx`
**Stato**: ✅ FUNZIONANTE (solo genitori/dev)

| Pannello | Descrizione | Stato |
|----------|-------------|-------|
| KPI Cards | Input parsati, bassa confidence, fallback AI, azioni incomplete | ✅ |
| Confidence per Intent | Distribuzione confidence per tipo | ✅ |
| Warning Frequenti | Pattern warning più comuni | ✅ |
| Sinapsi Problematiche | Sinapsi con basso punteggio | ✅ |
| Forme Linguistiche → Fallback | Frasi che cadono su AI | ✅ |
| Filtri | Per confidence, intent, tipo errore | ✅ |
| Memory Panel | Heap memory, document count, tempi parse | ✅ |
| Log List | Dettaglio per frase: input, intent, confidence, azioni, warning | ✅ |

---

## 5. Sistema Brain/NLP (Cervellone)

### 5.1 Pipeline Completa: Testo → Record DB

```
1. INPUT
   brainParse(text, {members, currentMember, familyId})

2. PRE-PROCESSING (textUtils.js)
   splitMergedWords("hodanza" → "ho danza")
   splitSentences("porta Viola e compra latte" → 2 frasi)
   stripContextPrefix("comunque, domani..." → "domani...")
   stripConversationalSuffix("...ok?" → "...")
   isActionable() / isPastTenseReport() / isNegatedAction()

3. ENTITY EXTRACTION (entityExtractor.js) — dal testo ORIGINALE
   parseLocalDate("domani") → "2026-03-22"
   parseLocalTime("alle 16") → "16:00"
   parseAmount("45€") → 45
   extractPersons("Asia") → [{id, name, role}]
   extractLogistics("porta Chiara") → {driver, subject, actionVerb}
   extractLocation("alla stazione") → "stazione"
   extractActivity("danza") → "Danza"

4. L0: PATTERN MATCHING (intentClassifier.js)
   4a. Amount → expense (conf 0.70-0.90)
   4b. "assente/malato" → absence (conf 0.70)
   4c. Logistics driver+subject → calendar+task dual (conf 0.85-0.90)
   4d. Social/personal ("vado al...", "ho danza", "a prendere [nome]") → calendar
   4e. Task verbs ("pulire", "stirare", "innaffiare") → task (conf 0.80)
   4f. "ricordami/avvisami" → reminder
   4g. Direct task ("bisogna", "devo", "serve") → task
   4h. Visitor ("arriva il tecnico") → calendar
   4i. Shopping restrictive (lista spesa, grocery items) → shopping
   Se match → buildAction() → continue

5. L1: NLP.JS (brainNlp.js)
   classify(cleanSentence) → {intent, score, action}
   149 docs base + user learned docs
   Confidence cap su input corti (≤3 parole)
   Shopping guard: comprare + no grocery → override a task

6. L2: SINAPSI (synapseEngine.js)
   computeSynapseActivations(tokens, stems, allSynapses)
   Bootstrap (patterns.js) + learned (patterns table)
   Boost strutturale: persona + orario = calendario
   Boost meal: contesto sera/cena
   De-boost shopping: se guard fired

7. COMBINAZIONE L1+L2 (intentClassifier.js)
   structural + L2 calendar → calendar (conf ≥ 0.80)
   NLP high (≥ 0.75) → usa NLP
   NLP + L2 concordano → combina (conf boost +0.10)
   L2 forte (≥ 0.60) → usa sinapsi
   Altrimenti: miglior score vince

8. ACTION BUILDING (actionBuilder.js)
   Costruisce oggetto azione tipizzato
   {type, date, time, title, assignedTo, category, incomplete, ...}

9. NORMALIZATION (actionNormalizer.js)
   Risolve nomi → ID membri
   Flatten logistics
   Genera utteranceRef + actionRef
   Valida schema

10. COMMIT EVALUATION (commitEvaluator.js)
    strong: tutti i campi, alta confidence → scrivi
    light: campi core presenti → scrivi con alert
    draft: incompleto → chiedi utente
    none: non sicuro → blocca
    Guard: incomplete + strong → downgrade a light

11. CONVERSATION MEMORY (conversationMemory.js)
    Se draft attivo compatibile → merge entità
    Se tutti campi presenti → auto-commit
    TTL 15min, max 30min

12. L3: AI FALLBACK (voice.js)
    Se confidence < 0.55 + online → Claude Haiku
    Invia testo + contesto + parse locale
    Riceve intent + entità strutturati

13. DB WRITE
    db.events.add() / db.tasks.add() / db.expenses.add() / ...
    Con metadata: family_id, _version, _device_id, timestamps
```

### 5.2 Soglie di Configurazione (config.js)

| Parametro | Valore | Significato |
|-----------|--------|-------------|
| `NLP_CONFIDENCE_HIGH` | 0.75 | NLP sicuro → no sinapsi |
| `NLP_CONFIDENCE_LOW` | 0.40 | NLP debole → combina con sinapsi |
| `SYNAPSE_CONFIDENCE_THRESHOLD` | 0.60 | Sinapsi sufficienti da sole |
| `FINAL_THRESHOLD` | 0.55 | Minimo per parse locale senza AI |
| `SHADOW_CONFIRM_THRESHOLD` | 3 | Conferme necessarie per nuova sinapsi |
| `FUZZY_MAX_DISTANCE` | 2 | Tolleranza Levenshtein |
| `LEARNING_RATE` | 0.15 | Velocità apprendimento sinapsi |
| `DECAY_RATE` | 0.02 | Decadimento sinapsi inattive |
| `MAX_SYNAPSES` | 800 | Limite per pruning |

### 5.3 Intent Supportati

| Intent | Layer Primario | Esempio |
|--------|---------------|---------|
| `expense` | L0 (marker €) | "speso 15€ per la pasta" |
| `calendar` | L0/L1/L2 | "martedì calcio alle 17" |
| `task` | L1/L2 | "devo pulire la camera" |
| `meal` | L1/L2 | "stasera pasta al pomodoro" |
| `shopping` | L0/L1 | "compra latte e pane" |
| `absence` | L0 | "Viola assente lunedì" |
| `reminder` | L0/L1 | "ricordami di chiamare il dentista" |
| `edit_action` | L0 | "sposta la danza a venerdì" |
| `compound` | Split | "porta Viola e compra latte" (2 azioni) |

### 5.4 Entità Estratte

| Entità | Estrattore | Esempio |
|--------|-----------|---------|
| Persona | `extractPersons()` | "Cristian", "mamma", "papà", alias |
| Data | `parseLocalDate()` | "domani", "martedì", "15 marzo" |
| Orario | `parseLocalTime()` | "alle 17:30", "dalle 9 alle 12" |
| Importo | `parseAmount()` | "15€", "20 euro", "quarantacinque" |
| Luogo | `extractLocation()` | "al parco", "in stazione", "a scuola" |
| Attività | `extractActivity()` | "calcio", "danza", "lezione di piano" |
| Logistica | `extractLogistics()` | driver/subject/pickup per trasporti |

---

## 6. Sistema Simulatore (NeuroLoop)

### 6.1 Struttura

```
simulator/
├── neuroloop.js              ← Entry point iterativo
├── setup.js                  ← Polyfill + crea famiglia + initNlp
├── orchestrator.js           ← Esecuzione frasi per famiglia
├── report.js                 ← Report 5 sezioni
├── utils.js                  ← Helper
├── agents/                   ← 6 profili agente
│   ├── index.js
│   ├── cristian.js, chiara.js, viola.js, asia.js, mariangela.js, roberto.js
├── engine/
│   ├── worldState.js         ← Stato famiglia + agenti
│   ├── weekLoop.js           ← Itera settimane
│   ├── dayLoop.js            ← Genera frasi per giorno
│   ├── phraseGenerator.js    ← Template → frase con mutazioni
│   ├── phraseExecutor.js     ← Parse → DB write → evaluate
├── neuroloop/
│   ├── familyFactory.js      ← Genera famiglie random
│   ├── templateMutator.js    ← Muta template (light/medium/heavy)
│   ├── neuralCore.js         ← Coordina 8 probe
│   ├── patchEngine.js        ← Suggerisce fix nel codice
│   ├── loopMemory.js         ← Memoria persistente tra loop
│   └── probes/
│       ├── probeBase.js      ← Classe base
│       ├── parserProbe.js    ← Accuratezza intent/entità
│       ├── notificationProbe.js ← Delivery notifiche, visibilità ruolo
│       ├── synapseProbe.js   ← Efficacia apprendimento pattern
│       ├── memoryProbe.js    ← Lifecycle draft multi-turn
│       ├── dbQualityProbe.js ← Completezza record, validazione campi
│       ├── logisticsProbe.js ← Risoluzione pickup/dropoff
│       ├── flowProbe.js      ← Coerenza temporale, recovery errori
│       └── destinationProbe.js ← Routing tabelle, compound landing
```

### 6.2 Workflow NeuroLoop

```
node simulator/neuroloop.js --iterations=3 --families=2 --weeks=4

Per ogni iterazione:
  1. GENERA    → familyFactory (famiglie random) + templateMutator (frasi mutate)
  2. ESEGUI    → orchestrator (day/week loop) → trajectories[]
  3. ANALIZZA  → neuralCore (8 probe) → ProbeReport con score
  4. PATCHA    → patchEngine (suggerimenti di fix)
  5. SALVA     → loopMemory.json (confronto con iterazioni precedenti)
```

### 6.3 Livelli di Mutazione

| Livello | Applicato a | Effetto |
|---------|------------|---------|
| `light` | Loop 0 | Typo singoli, omissioni minori |
| `medium` | Loop 1 | Typo multipli, inversioni parole |
| `heavy` | Loop 2+ | Typo pesanti, parole fuse, ordine scrambled |

### 6.4 Le 8 Probe

| Probe | Peso | Cosa misura |
|-------|------|-------------|
| `parser` | Intent correctness | % frasi con intent corretto |
| `notifications` | Alert delivery | Notifiche inviate ai ruoli giusti |
| `synapses` | Learning quality | Pattern appresi vs attesi |
| `memory` | Draft lifecycle | Merge/commit/abandon corretti |
| `dbQuality` | Record validity | Campi richiesti presenti, valori validi |
| `logistics` | Carpooling | Driver/subject risolti correttamente |
| `flow` | End-to-end | Coerenza temporale, gamification |
| `destination` | Routing | Record nella tabella giusta, compound atterrati |

---

## 7. Progressi NeuroLoop — Evoluzione Accuratezza

### Tabella Riassuntiva (loop 1 = light mutation)

| Metrica | Baseline | Ciclo 1 | Ciclo 2 | Ciclo 3 |
|---------|----------|---------|---------|---------|
| **Parser** | 82.8% | 86.7% | 95.0% | ~92-95% |
| **Overall** | 87.6% | 86.1% | 88.5% | ~87-89% |
| **Bug** | 8 | 4 | 2 | 3 |
| **Commit** | af58179 | af58179 | c38d465 | a12993b |

### Fix Applicati per Ciclo

**Ciclo 1** (af58179):
- Implementazione completo sistema NeuroLoop
- Fix commit evaluator (incomplete → no "strong")
- Fix notification probe (role visibility → suggestion)
- Fix dbQuality/destination probe (commit coherence → warning)

**Ciclo 2** (c38d465):
- Strip suffissi conversazionali ("ok?", "che dici?", "va bene?")
- Pattern sleepover invertito ("a dormire da X sabato vado")
- Esclusione question tag conversazionali da `_isOriginalQuestion`

**Ciclo 3** (a12993b):
- `splitMergedWords()` per parole fuse ("hodanza"→"ho danza", "adormire"→"a dormire")
- Pattern "a prendere [nome]" senza articolo → calendar (pickup persona)
- NLP shopping guard: "comprare" + no grocery items → task (commissione, non spesa)
- `isActionable`/`isPastTense`/`isNegated` spostati su cleanSentence (post-stripping)
- Pattern invertito "al [luogo] ... vado" → calendar
- Pattern "passo a prendere" → calendar logistics
- Variante "che dico?" nel suffix stripper

### Errori Residui al Ceiling

| Tipo | Esempio | Causa | Fixabile? |
|------|---------|-------|-----------|
| Typo pesanti (3+ char) | "Sabaro vadoo adormre" | Troppo corrotto per pattern | ❌ Serve spell-check |
| Pronomi liberi compound | "la devi riprendere" | Coreference limitata | ⚠️ Complesso |
| Meal vs Task | "stasera preparo cotolette" | Ambiguità genuina | ⚠️ Regole contesto |
| Inversioni estreme | "Al tabaccgino per la sesa" | Ordine + typo combinati | ❌ Limite rule-based |

---

## 8. Struttura File Completa

### 8.1 Pagine (`src/pages/`)

| File | Route | Stato |
|------|-------|-------|
| `DashboardPage.jsx` | `/dashboard` | ✅ Attivo |
| `CalendarPage.jsx` | `/calendar` | ✅ Attivo |
| `TasksPage.jsx` | `/tasks` | ✅ Attivo |
| `RewardsPage.jsx` | `/rewards` | ✅ Attivo |
| `SpesePage.jsx` | `/expenses` | ✅ Attivo (3 sub-tab) |
| `DispensaPage.jsx` | `/dispensa` | ✅ Attivo (2 sub-tab) |
| `MealsPage.jsx` | `/meals` | ✅ Attivo |
| `SettingsPage.jsx` | `/settings` | ✅ Attivo |
| `BrainDebugPage.jsx` | `/brain-debug` | ✅ Attivo (solo dev) |
| `SetupPage.jsx` | `/setup` | ✅ Attivo |
| `LoginPage.jsx` | `/login` | ✅ Attivo |
| `BudgetPage.jsx` | `/budget` | ⏩ Redirect → `/expenses?tab=budget` |
| `StatsPage.jsx` | `/stats` | ⏩ Redirect → `/expenses?tab=stats` |
| `ShoppingPage.jsx` | `/shopping` | ⏩ Redirect → `/dispensa?tab=shopping` |
| `InventoryPage.jsx` | `/inventory` | ⏩ Redirect → `/dispensa?tab=inventory` |
| `ExpensesPage.jsx` | `/expenses` | ⏩ Redirect (legacy) |

### 8.2 Componenti (`src/components/`)

| Directory | Componenti | Scopo |
|-----------|-----------|-------|
| `layout/` | AppShell, BottomNav, Header, ProtectedRoute | Struttura app |
| `shared/` | Modal, ConfirmDialog, DatePicker, EmptyState, ErrorBoundary, LoadingSpinner, PersonBadge, PersonPicker, Skeleton, Toast, ActivityFeed | UI riusabili |
| `auth/` | SetupWizard, WizardStep1-7, PinLogin, MemberSelect | Autenticazione |
| `brain/` | BrainInput, BrainSheet | Input/output NLP |
| `calendar/` | MonthGrid, WeekView, DayView, DayDetail, EventCard, EventForm, ViewToggle | Calendario |
| `tasks/` | TaskBoard, TaskCard, TaskForm, ProposalList, TemplateManager | Task management |
| `expenses/` | ExpenseList, ExpenseCard, ExpenseForm, CategoryPicker | Spese |
| `budget/` | BudgetOverview, BudgetSetup | Budget |
| `notifications/` | NotifBanner, NotifList | Notifiche |
| `voice/` | VoiceButton | Input vocale |
| `sync/` | JoinFamily | Unirsi a famiglia |

### 8.3 Hook (`src/hooks/`)

| Hook | Tipo | Scopo |
|------|------|-------|
| `useAuth` | Data | Login/logout, sessione |
| `useCalendar` | Data | CRUD eventi + ricorrenze |
| `useTasks` | Data | CRUD task + proposte + leaderboard |
| `useExpenses` | Data | CRUD spese + filtri |
| `useBudget` | Data | Budget tracking |
| `useRewards` | Data | Punti/premi |
| `useMeals` | Data | Pianificazione pasti |
| `useInventory` | Data | Inventario + OCR |
| `useShopping` | Data | Lista spesa |
| `useNotifications` | Data | Notifiche + role visibility |
| `useBrain` | NLP | Parse testo/voce, confidence, draft |
| `useDebugAnalytics` | NLP | Metriche debug brain |
| `useSync` | Sync | Cloud sync status |
| `useOnline` | Utility | Online/offline |
| `useBadgeCounts` | UI | Contatori badge nav |
| `useKeyboard` | UI | Tastiera aperta/chiusa |
| `useBackButton` | UI | Tasto indietro Android |
| `useStatusBar` | UI | Colore status bar |
| `useInactivityTimeout` | Utility | Auto-logout |
| `useOptimisticList` | Utility | Update ottimistici |
| `useFormAction` | Utility | Submit form async |

### 8.4 Librerie (`src/lib/`)

| File | Scopo |
|------|-------|
| `localDb.js` | Schema Dexie v9, 20+ tabelle |
| `crud.js` | CRUD centralizzato |
| `sync.js` | Sync bidirezionale Dexie ↔ Supabase |
| `syncCrypto.js` | Crittografia AES-256-GCM |
| `brainNlp.js` | Gestione NLP.js (train/classify/persist) |
| `voice.js` | Web Speech API + Claude Haiku fallback |
| `constants.js` | Categorie, ruoli, tab, ricette |
| `dates.js` | Parsing/formatting date |
| `format.js` | Formattazione numeri/valuta |
| `validate.js` | Validazione input |
| `platform.js` | Detect OS, native context |
| `supabase.js` | Client Supabase |
| `haptics.js` | Feedback aptico |
| `nativeNotifications.js` | Push notifications native |
| `backup.js` | Export/import dati |
| `receiptOcr.js` | OCR scontrini |

### 8.5 Brain (`src/lib/brain/`)

| File | Scopo | Export Principali |
|------|-------|-------------------|
| `index.js` | Orchestratore 4-layer | `brainParse()`, memory ops |
| `intentClassifier.js` | L0+L1+L2 parsing | `parseLocally()` |
| `entityExtractor.js` | Estrazione entità | parseLocalDate/Time, extractPersons/Logistics |
| `actionBuilder.js` | Costruzione azioni | `buildAction()` |
| `actionNormalizer.js` | Normalizzazione | `normalizeAndValidateActions()` |
| `commitEvaluator.js` | Decisione commit | `evaluateCommitPolicy()` |
| `conversationMemory.js` | Draft multi-turn | create/merge/commit/abandon |
| `synapseEngine.js` | Attivazione sinapsi | `computeSynapseActivations()` |
| `patterns.js` | Bootstrap sinapsi | `BOOTSTRAP_SYNAPSES` |
| `textUtils.js` | NLP utilities | stemIT, tokenize, splitSentences, splitMergedWords |
| `config.js` | Costanti | soglie, pesi, learning rates |
| `learningEngine.js` | Apprendimento da feedback | learnFromConfirmed/Rejected |
| `debugLogger.js` | Trace per debug | createDebugTrace, persistDebugTrace |

### 8.6 Test (`src/lib/brain/__tests__/`)

| File | Test | Stato |
|------|------|-------|
| `canonicalPipeline.test.js` | Pipeline azione E2E | ✅ Pass |
| `commitEvaluator.test.js` | Logica commit/draft | ✅ Pass |
| `dbResolver.test.js` | Risoluzione persona → ID | ✅ Pass |
| `editActionIntegration.test.js` | Flusso edit_action | ✅ Pass |
| `goldenE2E.test.js` | Scenari golden path | ✅ Pass |
| `humanRegression.test.js` | Regressione input reali (27 test) | ✅ Pass |
| `multiIntent.test.js` | Parsing multi-intent | ✅ Pass |
| `resolverScenarios.test.js` | Edge case risoluzione | ✅ Pass |
| `sprint2Integration.test.js` | Test integrazione | ✅ Pass |
| **TOTALE** | **202 test** | **✅ Tutti pass** |

---

## 9. Sync e Sicurezza

### 9.1 Strategia Sync
- **Local-first**: Dexie è source of truth
- **Push**: Modifiche locali → encrypt campi sensibili → Supabase
- **Pull**: Supabase → decrypt → merge last-write-wins
- **Conflitti**: Field-level merge per shoppingItems, record overwrite per altri

### 9.2 Crittografia
- **AES-256-GCM** per campi sensibili (importi, descrizioni)
- **PIN-derived key** per backup
- Campi strutturali in chiaro per RLS Supabase

### 9.3 Autenticazione
1. Setup Wizard → creazione famiglia + owner
2. Aggiunta membri con ruolo + età
3. Login: selezione membro + PIN
4. Sessione: Zustand store + sessionPin in-memory

---

## 10. Script e Comandi

```bash
# Sviluppo
npm run dev                    # Vite dev server (localhost:5173)
npm run build                  # Build produzione
npm run preview                # Preview build

# Test
npm run test                   # Vitest run (202 test)
npm run test:watch             # Vitest watch mode
npx vitest run src/lib/brain/__tests__/  # Solo test brain

# NeuroLoop (simulatore)
node simulator/neuroloop.js --iterations=3 --families=2 --weeks=4
node simulator/neuroloop.js --iterations=1 --verbose  # Con dettagli errori

# Mobile
npm run cap:sync:android       # Build + sync Android
npm run cap:open               # Apri Android Studio/Xcode

# Lint
npm run lint                   # ESLint
```

---

## 11. Dipendenze Principali

| Package | Versione | Uso |
|---------|----------|-----|
| `react` | 19 | Framework UI |
| `react-router-dom` | 7 | Routing |
| `dexie` | 4 | Database locale IndexedDB |
| `@supabase/supabase-js` | 2 | Sync cloud |
| `@nlpjs/core` + `@nlpjs/nlp` | 5 alpha | NLP italiano |
| `recharts` | 3 | Grafici statistiche/budget |
| `tailwindcss` | 4 | CSS utility-first |
| `zustand` | 5 | State management |
| `lucide-react` | 0.5 | Icone |
| `sonner` | 2 | Toast notification |
| `@capacitor/*` | 8 | Bridge nativo iOS/Android |
| `vitest` | - | Test runner |
| `fake-indexeddb` | - | IndexedDB per test/simulatore |

---

## 12. Riepilogo Stato Finale

### Cosa Funziona ✅
- Tutte le 9 pagine principali attive e funzionanti
- Brain NLP a 3 livelli con ~93% accuratezza parser
- 202 test unitari tutti pass
- Sistema NeuroLoop completo con 8 probe
- 3 cicli di miglioramento iterativo completati
- Sync cloud bidirezionale con crittografia
- Backup/restore con PIN
- OCR scontrini
- Gamification task per bambini
- Ricorrenze calendario
- Draft multi-turn con memory

### Limiti Noti ⚠️
- Parser rule-based al ceiling (~93-95% light, ~70% heavy typo)
- Compound detection limitata per pronomi liberi
- Meal vs Task ambiguità su verbi cucina
- Nessun spell-checker integrato (Levenshtein solo per fuzzy match entità)
- NLP.js model retraining sincrono (2-4s cold start)

### Prossimi Passi Possibili
1. **Corpus statico gold standard** (50-100 frasi) per benchmark stabile
2. **Spell-checker pre-processing** per recuperare typo pesanti
3. **ML locale fine-tuned** per saltare oltre il 95%
4. **52 settimane simulazione** (attualmente 4-8)
5. **Test E2E con Playwright** per UI
