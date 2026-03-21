# NeuroLoop — Centro Neurale Iterativo per Fammi Questo

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan.

**Goal:** Un sistema di test iterativo che genera frasi dinamiche con famiglie random, le esegue attraverso il parser reale, analizza ogni flusso dell'app con 8 sonde specializzate, suggerisce patch di riparazione/miglioramento con safety check, e mantiene memoria persistente tra i loop per prevenire regressioni.

**Architecture:** Loop a 4 stadi (Genera → Esegui → Analizza → Patch) con NeuralCore che coordina 8 probes, PatchEngine con safety gate a 5 livelli, e Loop Memory persistente in JSON. Si appoggia sull'orchestratore e sugli agenti esistenti.

**Tech Stack:** Node.js (ESM), Dexie/IndexedDB (fake-indexeddb), NLP.js, Vitest per safety check.

---

## 1. Panoramica

### Problema

Il simulator attuale genera frasi da template fissi con una sola famiglia (Cristian, Chiara, Viola, Asia, Roberto, Mariangela). Questo limita la copertura: non testa famiglie diverse, non verifica notifiche/sinapsi/conversation memory, non suggerisce fix, non ricorda cosa ha funzionato.

### Soluzione

NeuroLoop: un sistema a loop che per ogni iterazione:
1. **Genera** famiglie dinamiche + muta i template per frasi mai viste
2. **Esegue** attraverso il parser reale con trajectory tracking
3. **Analizza** 8 sistemi dell'app con probes specializzate
4. **Patcha** con safety check e memoria anti-regressione

### Principi

- **ID-based, mai name-based** — l'app è universale, i nomi cambiano
- **Semi-automatico** — le patch sono suggerite e validate, non applicate ciecamente
- **Memoria lunga** — ogni loop ricorda cosa ha funzionato e cosa ha rotto
- **Max 3 patch per loop** — limita il rischio di interazione tra fix
- **Safety first** — 202 test + accuracy comparison PRIMA di ogni patch

---

## 2. Architettura

### Ciclo principale

```
node neuroloop.js --iterations=5 --families=3

Per ogni iterazione:
  1. GENERA → familyFactory + templateMutator → ScenarioTruth[]
  1b. SETUP → scrivi membri in db.members + initNlp(familyId) per ogni famiglia
  2. ESEGUI → orchestratore esistente → trajectories[]
  3. ANALIZZA → NeuralCore (8 probes) → ProbeReport[]
  4. PATCH → patchEngine → apply/reject/rollback
  └── SALVA → loopMemory → memory.json
```

### Setup per famiglia (tra GENERA e ESEGUI)

Per ogni famiglia generata dalla factory, prima di eseguire le frasi:

1. **DB members:** scrivere i nuovi membri in `db.members` sotto il `familyId` generato. Si usa la stessa istanza fake-indexeddb ma con `family_id` diverso per isolamento.
2. **NLP init:** chiamare `initNlp(familyId)` — il modello NLP e family-agnostic (i nomi sono risolti via `members[]` passato a `parseLocally`, non dal training NLP). Non serve retraining per ogni famiglia.
3. **Pulizia:** dopo l'esecuzione di ogni famiglia, rimuovere i record dal DB per non inquinare la famiglia successiva.

### Modello ruoli a due livelli

L'app usa due vocabolari per i ruoli:

| `agentRole` (fine-grained) | `appRole` (coarse) | Uso |
|---|---|---|
| `papa`, `mamma` | `genitore` | DB visibility, notifiche |
| `figlio`, `figlia` | `figlio` | DB visibility, notifiche |
| `nonno`, `nonna` | `nonno` | DB visibility, notifiche |

`familyFactory` genera entrambi i campi per ogni membro:
```js
{ id, name, role: 'papa', appRole: 'genitore', gender: 'M', ... }
```
Le probes usano `appRole` per le verifiche di visibilita. I scenarios e il dayLoop usano `role` (agentRole) per filtrare agenti.

### File structure

```
simulator/
  neuroloop.js                  ← entry point
  neuroloop/
    familyFactory.js            ← genera famiglie dinamiche
    templateMutator.js          ← muta template per frasi nuove
    neuralCore.js               ← coordina 8 probes, aggrega risultati
    patchEngine.js              ← genera + valida + applica patch
    loopMemory.js               ← memoria persistente cross-loop
    probes/
      parserProbe.js            ← intent + entity accuracy
      notificationProbe.js      ← destinatari + visibilita ruolo + anteprima
      synapseProbe.js           ← learning + decay + isolation
      memoryProbe.js            ← conversation draft lifecycle
      dbQualityProbe.js         ← record quality + field validation
      logisticsProbe.js         ← driver/pickup/subject
      flowProbe.js              ← end-to-end + gamification + error recovery
      destinationProbe.js       ← routing tab + compound landing + alert
    logs/
      loop-{N}-{timestamp}.json ← log completo per iterazione
      memory.json               ← stato persistente cross-loop
```

---

## 3. Family Factory

### Scopo

Genera famiglie con nomi, composizioni e ruoli diversi ad ogni loop. Gli agenti esistenti (chiara.js, cristian.js...) diventano template di ruolo clonati con identita nuove.

### Composizioni

| Tipo | Membri | Descrizione |
|------|--------|-------------|
| `standard` | 2 genitori + 2 figli + 2 nonni | Come la famiglia attuale |
| `single_parent` | 1 genitore + 2-3 figli | Genitore solo |
| `no_elders` | 2 genitori + 1-3 figli | Senza nonni |
| `large_family` | 2 genitori + 4 figli + 2 nonni | Famiglia numerosa |
| `minimal` | 2 genitori + 1 figlio | Nucleo minimo |
| `extended` | 2 genitori + 2 figli + 4 nonni | Nonni materni + paterni |

### Pool nomi italiani

- **Padri:** Marco, Luca, Andrea, Matteo, Alessandro, Davide, Simone, Federico, Tommaso, Riccardo, Stefano, Paolo, Roberto, Giuseppe, Antonio
- **Madri:** Giulia, Sara, Elena, Francesca, Valentina, Martina, Elisa, Sofia, Giada, Aurora, Claudia, Silvia, Paola, Laura, Monica
- **Figli M:** Lorenzo, Gabriele, Leonardo, Edoardo, Pietro, Diego, Filippo, Emanuele, Jacopo, Nicolo
- **Figlie F:** Emma, Giorgia, Beatrice, Alice, Greta, Camilla, Stella, Arianna, Rebecca, Noemi
- **Nonni M:** Giuseppe, Giovanni, Antonio, Franco, Mario, Carlo, Luigi, Pietro, Salvatore, Domenico
- **Nonne F:** Anna, Maria, Rosa, Teresa, Lucia, Carla, Paola, Franca, Giuseppina, Concetta

### Logica di generazione

```js
generateFamily(compositionType) → {
  familyId: 'fam-{random}',
  surname: pickRandom(SURNAMES),
  members: [
    { id: 'mem-{random}', name, role, gender, age, aliases: autoAliases(role, gender) }
  ],
  agents: [
    // Clone dell'agent template piu vicino al ruolo
    // con name/id/variablePools.person aggiornati ai nuovi nomi
  ]
}
```

### Auto-alias (stessa logica dell'app)

- genitore M → ['papa', 'papino']
- genitore F → ['mamma', 'mammina']
- nonno M → ['nonno']
- nonno F → ['nonna']
- figli → [] (nessun alias automatico)

### Sostituzione nomi nei template

I template esistenti contengono nomi hardcoded ("porto Asia a scuola", "Viola ha danza"). La factory deve sostituirli:

1. Costruire una mappa `{ originalName → newName }` basata sul ruolo corrispondente:
   - Asia (figlia, 8 anni) → Emma (figlia, eta simile nella nuova famiglia)
   - Viola (figlia, 12 anni) → Beatrice
   - Cristian (papa) → Marco
   - Chiara (mamma) → Giulia
2. Per ogni template clonato, fare string replace di tutti i nomi originali con i nuovi
3. Anche nelle `weeklyRoutine` e nei `variablePools.person`

Esempio:
```js
// Template originale (cristian.js):
"Domani porto Asia a scuola alle {{time}}"
// Dopo sostituzione per famiglia Rossi:
"Domani porto Emma a scuola alle {{time}}"
```

### Pool cognomi italiani

```js
const SURNAMES = [
  'Rossi', 'Bianchi', 'Ferrari', 'Russo', 'Romano', 'Colombo',
  'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti',
  'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi',
]
```

### Cosa verifica

- Il parser funziona con nomi mai visti
- Le notifiche raggiungono gli ID corretti
- Le sinapsi si isolano per family_id
- I ruoli impliciti ("mamma" → la genitrice) funzionano con qualsiasi nome

---

## 4. Template Mutator

### Scopo

Prende i ~70 template degli agenti e li muta per generare frasi strutturalmente diverse che il parser non ha mai visto. NON cambia intent ne shouldWrite.

### 7 strategie di mutazione

| # | Strategia | Esempio | Rischio |
|---|-----------|---------|---------|
| 1 | **RIORDINO** | "Ho speso 50 al super" → "Al super ho speso 50" | Basso |
| 2 | **REGISTRO** | "Ho speso 50" → "Ho sostenuto una spesa di 50" | Basso |
| 3 | **ELLISSI** | "Ho speso 50 al super" → "50 euro al super" | Medio |
| 4 | **INTERCALARE** | → "Ah senti, ho speso 50 al super" | Basso |
| 5 | **TYPO+DIALECT** | → "Ho speso 50 euri ar super" | Medio |
| 6 | **CONTESTO** | → "Tornando dal super ho speso 50 euro" | Medio |
| 7 | **VOICE_NOISE** | → "ho speso cinquanta euro al supermercato" | Alto |

### Livelli di mutazione

- **light** → 1 mutazione (riordino O registro). `truthConfidence: 'high'`
- **medium** → 2 mutazioni combinate. `truthConfidence: 'medium'`
- **heavy** → 3+ mutazioni. `truthConfidence: 'low'`

### Progressione per loop

- Loop 1: tutti `light` → stabilisce baseline
- Loop 2: mix `light`/`medium` → stress moderato
- Loop 3+: mix `medium`/`heavy` → stress massimo

### VOICE_NOISE (strategia 7)

Simula errori da speech-to-text:
- Numeri come parole: "50" → "cinquanta"
- Parole attaccate: "porta Asia" → "portaasia"
- Punteggiatura assente: "compra latte, uova, pane" → "compra latte uova pane"
- Articoli mancanti: "porto la bambina" → "porto bambina"

### Regole di sicurezza

- La mutazione **non cambia mai** l'intent atteso
- Il `shouldWrite` resta invariato
- Le variabili `{{amount}}`, `{{where}}` restano intatte
- Il truthConfidence scala con il livello di mutazione

---

## 5. NeuralCore — Il Cervello Analitico

### Scopo

Coordina 8 probes specializzate, confronta con iterazioni precedenti, classifica findings per gravita, e produce raccomandazioni di tipo REPAIR (bug) o IMPROVE (enhancement).

### ProbeReport (output di ogni probe)

```js
{
  system: string,            // nome del sistema testato
  score: number,             // 0-100
  grade: string,             // A(>=90) B(>=75) C(>=60) D(>=40) F(<40)
  findings: [{
    severity: 'bug'|'warning'|'suggestion',
    area: string,
    title: string,
    detail: string,
    occurrences: number,
    impact: 'high'|'medium'|'low',
    recommendation: {
      type: 'REPAIR'|'IMPROVE',
      description: string,
      targetFile: string,
      targetFunction: string,
    }
  }],
  metrics: object,           // metriche specifiche della probe
}
```

### NeuralCore output aggregato

```js
{
  loopId: number,
  overallScore: number,
  overallGrade: string,
  probeScores: { [probeName]: number },
  delta: { [probeName]: number },      // vs loop precedente
  topFindings: Finding[],              // ordinati per gravita
  recommendations: Recommendation[],   // ordinati per priorita
}
```

---

## 6. Le 8 Probes

### Probe 1: parserProbe.js — Intent + Entity accuracy

**Testa:**
- Intent classification accuracy (per intent, per agent, per family)
- Entity extraction: persone risolte, date corrette, orari ok, importi
- Compound phrases: N azioni attese = N azioni prodotte
- Confidence calibration: alta confidence = davvero corretto?
- Cross-family variance: stessi template, nomi diversi → stesso risultato?

**Metriche:** intentAccuracy, entityRecall, entityPrecision, compoundSplitRate, confidenceCalibration, crossFamilyVariance

### Probe 2: notificationProbe.js — Destinatari + visibilita ruolo + anteprima

**Testa:**
- **Visibilita ruolo:** figlio NON riceve notifiche expenses/shopping. Nonno NON riceve expenses.
- **Completezza:** ogni azione persistita ha generato notifica
- **Destinatari:** notifica arriva a tutti tranne sender
- **Anteprima chiara:**
  - Evento: titolo + data + ora (non solo "Nuovo evento")
  - Task: cosa + assegnato a chi + scadenza
  - Spesa: importo + categoria + chi ha speso
  - Shopping: cosa + quantita
- **Cluster:** messaggi multi-azione → una sola notifica raggruppata
- **No duplicati:** stesso evento non genera 2 notifiche

**Meccanismo di osservazione notifiche:** Il simulator non ha una notification queue. La probe usa due strategie:
1. **Stub NotificationBus:** un oggetto iniettato che intercetta tutte le chiamate a `notify()`, `notifyAll()`, `notifyParents()`, `notifyCluster()` e registra: destinatario, tipo, messaggio, tabella sorgente. Iniettato durante il setup del loop (stessa tecnica del fake-indexeddb).
2. **Post-hoc inference:** per ogni record scritto, la probe calcola i destinatari attesi in base a `ROLE_VISIBILITY[table]` e verifica che il NotificationBus li abbia registrati.

**Metriche:** deliveryRate, roleFilterAccuracy, previewQuality, clusteringRate, duplicateRate

**Regole visibilita per ruolo:**

| Tab | Genitore | Figlio | Nonno |
|-----|----------|--------|-------|
| events | SI | SI | SI |
| tasks | SI | SI | SI |
| expenses | SI | NO | NO |
| shoppingItems | SI | NO | SI |
| mealPlans | SI | SI | SI |

### Probe 3: synapseProbe.js — Learning engine

**Testa:**
- Creazione: azioni confermate generano nuove sinapsi?
- Shadow threshold: sinapsi con confirmCount<3 NON influenzano il parser
- Reinforcement: confermare la stessa azione 3+ volte → peso aumenta
- Punishment: rimuovere azione dalla preview → peso cala
- Decay: sinapsi non usate da 14+ giorni → decadono
- Isolamento famiglia: sinapsi di fam-A non inquinano fam-B
- Bootstrap integrity: sinapsi innate restano stabili

**Nota: date simulate.** Tutte le verifiche di decay e lastUsed devono usare la data simulata (stessa mock Date iniettata da phraseExecutor), non `Date.now()` reale. La probe deve chiamare le API sinapsi passando `asOfDate` = la data simulata corrente del loop.

**Metriche:** creationRate, shadowCorrectness, reinforcementAccuracy, decayRate, familyIsolation, bootstrapStability

### Probe 4: memoryProbe.js — Conversation draft lifecycle

**Testa:**
- Creazione draft: frase incompleta → draft creato
- Fragment detection: "alle 16" dopo draft → riconosciuto come followup
- Merge: campi mancanti completati senza sovrascrivere
- Auto-commit: draft con tutti i campi → committed automaticamente
- Expiry: draft >15min → expired (non committed stale)
- Multi-turn: 3+ messaggi sullo stesso draft → merge coerente
- Correction: "no, volevo dire domani" → sovrascrive la data

**Metriche:** draftCreationRate, fragmentRecognition, mergeAccuracy, autoCommitRate, expiryCorrectness, correctionHandling

### Probe 5: dbQualityProbe.js — Record quality

**Testa:**
- Campi obbligatori presenti (id, family_id, type, date per events)
- Campi raccomandati (title, timeStart, category)
- Valori validi (amount>0, date formato ISO, niente "undefined" come stringa)
- Titolo qualita (non troppo corto, non frase intera grezza)
- Coerenza cross-record (evento + task dalla stessa frase → stessa data)
- Commit level appropriato (strong/light/draft per confidence)

**Metriche:** requiredFieldRate, recommendedFieldRate, titleQuality, crossRecordCoherence, commitLevelAccuracy

### Probe 6: logisticsProbe.js — Driver/pickup/subject

**Testa:**
- Driver corretto: "porto Asia" → speaker e il driver
- Pickup corretto: "Chiara la riprende" → Chiara e pickupBy
- Subject corretto: "porto Asia" → Asia e il subject
- Cross-segment merge: "poi X riprende" → merged nell'evento
- Implicit inference: prima persona → speaker come driver
- Group logistics: "le bambine" → tutti i figli femmina
- Con famiglie nuove: nomi mai visti → logistics funziona

**Metriche:** driverAccuracy, pickupAccuracy, subjectAccuracy, mergeRate, implicitInferenceRate, groupResolution

### Probe 7: flowProbe.js — End-to-end + gamification

**Testa:**
- Frase → parse → action → DB write → notifica: catena completa
- Tempo di risposta: parse < 100ms
- Error recovery: se parse fallisce, l'app non crasha
- Edit actions: cancella/sposta modifica il record giusto
- Idempotenza: stessa frase 2 volte → non duplica il record
- State consistency: worldState coerente dopo N frasi
- **Gamification:** figlio completa task → punti assegnati? taskProposed → genitore approva → taskApproved notifica + punti? Solo figli accumulano punti?

**Metriche:** e2eSuccessRate, avgParseTime, errorRecoveryRate, editActionAccuracy, idempotencyRate, stateConsistency, gamificationAccuracy

### Probe 8: destinationProbe.js — Routing + compound landing + alert

**Testa:**

**A. Routing corretto:**
- Ogni frase arriva nella tab giusta (expense→Expenses, calendar→Calendar, etc.)
- Cross-check: record.type corrisponde alla tab dove e visualizzato

**B. Compound multi-destinazione:**
- "Porto Asia dal dentista, ho speso 80 euro"
  - Pezzo 1: calendario → tab Calendar
  - Pezzo 2: spesa → tab Expenses
- Tracking per pezzo: expectedTab, actualTab, recordId, landed (true/false)
- Tasso di "pezzi persi": azioni attese che non hanno prodotto record

**C. Alert incompletezza:**
- Evento senza data → record.incomplete contiene "Manca la data"
- Evento senza orario fine → "Manca orario fine"
- Spesa senza importo → "Manca importo"
- Task senza assegnatario → "Manca assegnatario"
- Logistics senza orario pickup → "Manca orario ripresa (NAME)"
- Verifica che `incomplete` e `warnings[]` elenchino TUTTI i campi mancanti

**D. Commit level coerente:**
- Tutti i campi + alta confidence → commit "strong"
- Campi mancanti → commit "draft" o "light"
- Record incompleto ma commit "strong" → BUG

**Metriche:** routingAccuracy, compoundLandingRate, compoundPiecesLostRate, incompleteAlertRate, missingAlertRate, commitCoherence

---

## 7. PatchEngine

### Scopo

Riceve findings dalle probes, genera patch strutturate, le valida con safety check a 5 livelli, e le applica solo se sicure.

### Tipi di patch

| Tipo | Rischio | Esempio |
|------|---------|---------|
| `regex_expand` | Basso | Aggiungere parole a GROCERY_WORDS_RE |
| `nlp_training` | Basso | Aggiungere esempi training a NLP.js |
| `logic_guard` | Medio | Filtrare notifiche per visibilita ruolo |
| `pattern_add` | Alto | Aggiungere nuovo pattern regex |

### Pipeline di validazione (5 gate)

```
1. BLACKLIST CHECK → patch simile gia rifiutata? → skip
2. MEMORY CHECK   → patch simile ha causato regressione? → skip
3. DRY RUN        → applica in child process su corpus high-confidence, accuracy cala? → reject
4. FULL TEST      → run 202 test brain via child process, qualcuno fallisce? → reject
5. ACCURACY CHECK → accuracy complessiva cala >0.5%? → reject
```

### Dry run: corpus e isolamento

Il dry run (gate 3) usa come corpus tutte le trajectories del loop corrente con `truthConfidence: 'high'` (tipicamente 60-80% delle frasi). La patch viene applicata al file sorgente, e la validazione avviene in un **child process** (`child_process.fork`) per evitare problemi di cache ESM:

```js
// patchEngine.js — dry run flow
1. Salva snapshot del file originale (contenuto completo)
2. Applica la patch al file sorgente
3. Fork child process: carica il modulo modificato, esegue il corpus, ritorna accuracy JSON
4. Se accuracy cala → rollback (ripristina snapshot), reject
5. Se accuracy OK → procedi a gate 4 (full test, sempre via child process)
```

### Meccanismo di rollback

Ogni patch applicata salva uno snapshot del file originale:

```js
{
  id: 'patch-{N}',
  // ...altri campi...
  snapshot: {
    file: 'src/lib/brain/intentClassifier.js',
    originalContent: '...contenuto completo prima della patch...',
    patchedContent: '...contenuto dopo la patch...',
  }
}
```

Il rollback ripristina `originalContent` nel file. Se una patch del loop N causa regressione nel loop N+1:
1. Ripristina il file dallo snapshot
2. Registra in `regressions[]`
3. Se stessa area regredisce 2+ volte → aggiunge a `blacklist`

Gli snapshot sono salvati in `logs/loop-{N}-{timestamp}.json`, non in `memory.json` (per non gonfiarlo).

### Limiti

- Max 3 patch per loop
- Non riscrive funzioni intere
- Non modifica architettura (import/export/nuovi file)
- Non tocca DB schema ne UI
- Non applica se accuracy cala >0.5%

### Output per patch

```js
{
  id: 'patch-{N}',
  type: 'regex_expand'|'nlp_training'|'logic_guard'|'pattern_add',
  target: string,
  status: 'applied'|'rejected'|'rollback',
  reason: string|null,
  accuracyBefore: number,
  accuracyAfter: number,
  testsPassed: number,
  testsFailed: number,
  snapshot: { file, originalContent, patchedContent },
}
```

---

## 8. Loop Memory

### Scopo

Memoria persistente in JSON che traccia la storia completa di ogni loop: scores, patch, regressioni, best scores. Impedisce che il sistema ripeta errori passati.

### Struttura (memory.json)

```js
{
  version: 1,
  created: ISO_DATE,
  lastUpdated: ISO_DATE,

  // Configurazione dell'ultimo run
  runConfig: { iterations: 5, families: 2, weeks: 4, mutation: 'progressive' },

  loops: [{
    id: number,
    timestamp: ISO_DATE,
    duration: string,
    loopIndex: number,          // 0-based index within this run
    families: [{ name, composition, members }],
    phrases: { generated, executed, errors },
    scores: { overall, parser, notifications, synapses, memory, dbQuality, logistics, flow, destination },
    delta: { /* vs loop precedente */ },
    findings: { bugs, warnings, suggestions, top: Finding[] },
    patches: [{ id, type, target, status, reason, accuracyBefore, accuracyAfter, testsPassed, testsFailed }],
  }],

  bestScores: {
    [probeName]: { value, loopId, date }
  },

  blacklist: [{
    patchId, type, target, reason, loopId, date
  }],

  regressions: [{
    patchId, loopApplied, loopDetected, scoreBefore, scoreAfter, probeAffected, autoRolledBack
  }],

  evolution: {
    overallTrend: number[],
    [probeName + 'Trend']: number[],
    improving: boolean,
    plateauReached: boolean,
    estimatedCeiling: number,
  },
}
```

### Anti-regressione

Prima di applicare una patch, il PatchEngine consulta:
1. `blacklist` — patch identiche o simili gia rifiutate
2. `regressions` — patch su stesse aree che hanno causato peggioramento
3. `bestScores` — se lo score attuale e il best, massima cautela

Se una patch applicata causa regressione nel loop successivo:
1. Rollback automatico
2. Aggiunta a `regressions`
3. Se stessa area regredisce 2+ volte → aggiunta a `blacklist`

---

## 9. Console Output

### Live durante il loop

```
╔══════════════════════════════════════════════════════╗
║  NEUROLOOP — Iterazione 3/5                          ║
║  Famiglie: Rossi (6) + Bianchi (4)                   ║
║  Frasi: 347 generate, 342 eseguite                   ║
╠══════════════════════════════════════════════════════╣
║  PROBE SCORES                        Delta vs Loop 2 ║
║  ├── Parser         88.1%  A-         +1.5           ║
║  ├── Notifications  65.0%  C          -3.0           ║
║  ├── Synapses       85.2%  B+         +0.8           ║
║  ├── Memory         79.0%  B-          0.0           ║
║  ├── DB Quality     91.3%  A          +2.3           ║
║  ├── Logistics      76.8%  B-         +4.1           ║
║  ├── Flow E2E       88.5%  A-         +1.0           ║
║  └── Destination    83.7%  B          +2.7           ║
║  OVERALL            82.4%  B          +2.1           ║
║                                                      ║
║  BUG (2) | WARN (3) | IMPROVE (2)                    ║
║  PATCH: 2 suggerite, 1 applicata, 1 rifiutata        ║
╚══════════════════════════════════════════════════════╝
```

### Riepilogo finale (dopo N iterazioni)

```
╔══════════════════════════════════════════════════════════╗
║  NEUROLOOP — RIEPILOGO FINALE (5 iterazioni)            ║
╠══════════════════════════════════════════════════════════╣
║  EVOLUZIONE                  Loop 1 → Loop 5            ║
║  ├── Overall                 82.4%  → 89.8%   +7.4     ║
║  ├── Parser                  88.1%  → 91.0%   +2.9     ║
║  ├── Notifications           65.0%  → 78.0%   +13.0    ║
║  ├── Synapses                85.2%  → 87.1%   +1.9     ║
║  ├── Memory                  79.0%  → 82.3%   +3.3     ║
║  ├── DB Quality              91.3%  → 93.0%   +1.7     ║
║  ├── Logistics               76.8%  → 81.5%   +4.7     ║
║  ├── Flow E2E                88.5%  → 90.2%   +1.7     ║
║  └── Destination             83.7%  → 86.4%   +2.7     ║
║                                                          ║
║  PATCH: 8 applicate | 3 rifiutate | 1 rollback          ║
║  FAMIGLIE TESTATE: 10 | FRASI TOTALI: 1,720             ║
║                                                          ║
║  PROBLEMI APERTI:                                        ║
║  1. Notifiche: filtro visibilita ruolo mancante          ║
║  2. Draft meal: auto-commit troppo restrittivo           ║
║  3. Anteprima notifiche: aggiungere data+ora             ║
║                                                          ║
║  SISTEMA: IMPROVING | Ceiling stimato: ~92.5%            ║
╚══════════════════════════════════════════════════════════╝
```

---

## 10. Entry Point

### CLI

```
node simulator/neuroloop.js [options]

Options:
  --iterations=N       Numero di loop (default: 5)
  --families=N         Famiglie per loop (default: 2)
  --weeks=N            Settimane simulate per famiglia (default: 4)
  --mutation=LEVEL     light|medium|heavy|progressive (default: progressive)
  --target=N           Target overallScore % (media non pesata delle 8 probes). Si ferma se raggiunto.
  --no-patch           Solo analisi, nessuna patch applicata
  --verbose            Log dettagliato in console
```

### Dipendenze

- Riusa: orchestratore, agenti, phraseGenerator, phraseExecutor, worldState, tutti i scenarios
- Nuovo: familyFactory, templateMutator, neuralCore, 8 probes, patchEngine, loopMemory
- Test runner: Vitest (gia presente)

---

## 11. Non in scope v1

- Dashboard HTML/grafica (v2)
- Patch che modificano la UI
- Patch che modificano il DB schema
- Multi-lingua (solo italiano)
- AI-generated patch (solo pattern-based)
- Parallel loop execution (sequenziale per v1)
