# Fammi Questo — API Contracts

> Contratti di interoperabilità. Definiscono il formato **esatto** dei payload scambiati tra i moduli dell'app.
> Se un modulo produce dati, il consumatore sa cosa aspettarsi. Se cambi un contratto, aggiorni entrambi i lati.
> Riferimento: `1_MASTER_ARCHITECTURE.md` per vincoli crypto, `4_DATA_MODEL.md` per schema entità.
> Ultimo aggiornamento: 14 marzo 2026.
>
> **Per il contratto canonico delle azioni NLP (7 tipi)**, vedere `6_AUDIT_CERVELLONE_NLP.md` §6.

---

## 1. Brain AI — Contratto Request/Response

### 1.1 Contesto

Brain AI ha due modalità operative:

**A. Pipeline NLP locale (L0+L1+L2)** — elabora tutto on-device senza chiamate cloud. È la modalità primaria. Vedere `6_AUDIT_CERVELLONE_NLP.md` §5 per la documentazione completa.

**B. Supabase Edge Function (L3 fallback)** — invocata solo quando la confidence locale è < 0.55. Max 20 chiamate/giorno. Edge function NON ancora deployata su Supabase (codice in `supabase/functions/brain-parse/index.ts`).

**Endpoint L3:** `POST /functions/v1/brain-parse`

### 1.2 Request

```ts
interface BrainRequest {
  text: string;             // Testo libero da parsare (max 500 caratteri)
  context: BrainContext;    // Contesto famiglia per migliorare il parsing
}

interface BrainContext {
  members: BrainMember[];   // Nomi e ruoli dei membri (NO pin_hash, NO dati sensibili)
  categories: string[];     // Categorie spesa attive
  meals: string[];          // Nomi dei piatti conosciuti
  today: string;            // "2026-03-06" — data corrente del device
  day_name: string;         // "Giovedì" — nome giorno italiano
}

interface BrainMember {
  name: string;             // "Cristian", "Viola" — solo il nome
  role: string;             // "parent", "child"
}
```

**Esempio request:**
```json
{
  "text": "Viola ha allenamento domani alle 16, la porta Chiara e la riprende Cristian. Ho speso 45 euro al Conad per alimentari",
  "context": {
    "members": [
      { "name": "Cristian", "role": "parent" },
      { "name": "Chiara", "role": "parent" },
      { "name": "Asia", "role": "child" },
      { "name": "Viola", "role": "child" }
    ],
    "categories": ["alimentari", "trasporto", "bollette", "affitto", "salute", "scuola", "abbigliamento", "svago", "telefono", "assicurazione", "animali", "casa", "regali", "viaggi", "sport", "altro"],
    "meals": ["Carbonara", "Pasta al pomodoro", "Cotoletta con patatine"],
    "today": "2026-03-06",
    "day_name": "Venerdì"
  }
}
```

**Vincoli request:**
- `text` non vuoto, max 500 caratteri (troncato lato client se necessario)
- `context.members` non vuoto (almeno 1 membro)
- `context.categories` non vuoto
- `context.meals` può essere vuoto (`[]`)
- Nessun dato sensibile nel context (no PIN, no pin_hash, no family_id, no device_secret)

### 1.3 Response (successo)

```ts
interface BrainResponse {
  ok: true;
  actions: BrainAction[];    // 1-N azioni estratte
  summary: string;           // "2 task, 1 spesa, 1 evento" — riepilogo human-readable
}

type BrainAction =
  | BrainTaskAction
  | BrainCalendarAction
  | BrainExpenseAction
  | BrainMealAction
  | BrainNoteAction;

interface BrainTaskAction {
  type: "task";
  title: string;            // "Prepara la cena"
  assignedTo: string;       // Nome membro ("Viola") — convertito in member.id lato client
  date: string;             // "2026-03-07" — YYYY-MM-DD
  time?: string;            // "16:00" — HH:mm (opzionale)
}

interface BrainCalendarAction {
  type: "calendar";
  title: string;            // "Allenamento pallavolo"
  assignedTo: string;       // Nome membro
  date: string;             // YYYY-MM-DD
  time?: string;            // HH:mm
  duration?: number;        // minuti
  accompaniedBy?: string;   // Nome membro che accompagna
  pickupBy?: string;        // Nome membro che va a prendere
}

interface BrainExpenseAction {
  type: "expense";
  amount: number;           // 45.00 — sempre numerico positivo
  category: string;         // "alimentari" — dalla lista context.categories
  note: string;             // "spesa al Conad"
  person: string;           // Nome membro che ha speso
  date?: string;            // YYYY-MM-DD (default: today)
}

interface BrainMealAction {
  type: "meal";
  name: string;             // "Carbonara"
  date: string;             // YYYY-MM-DD
}

interface BrainNoteAction {
  type: "note";
  text: string;             // Testo non riconosciuto
  originalFragment: string; // Porzione originale del messaggio
}
```

**Esempio response:**
```json
{
  "ok": true,
  "actions": [
    {
      "type": "calendar",
      "title": "Allenamento",
      "assignedTo": "Viola",
      "date": "2026-03-07",
      "time": "16:00",
      "accompaniedBy": "Chiara",
      "pickupBy": "Cristian"
    },
    {
      "type": "expense",
      "amount": 45.00,
      "category": "alimentari",
      "note": "spesa al Conad",
      "person": "Cristian",
      "date": "2026-03-06"
    }
  ],
  "summary": "1 evento calendario, 1 spesa"
}
```

### 1.4 Response (errore)

```ts
interface BrainErrorResponse {
  ok: false;
  error: string;   // "API key mancante", "Errore AI (HTTP 429)", "Risposta AI vuota"
}
```

### 1.5 Flusso client-side (OBBLIGATORIO)

```
1. Utente detta/scrive testo
2. Client chiama POST /functions/v1/brain-parse
3. Client riceve response con actions[]
4. Client mostra ANTEPRIMA a schermo: lista delle azioni parsate
5. Utente CONFERMA o MODIFICA ogni singola azione
6. Solo DOPO la conferma, il client scrive in Dexie.js via crud.js
```

**REGOLA FONDAMENTALE:** Brain AI non scrive MAI direttamente nel database. Ogni azione passa per anteprima + conferma utente. Nessuna eccezione.

### 1.6 Conversione nomi → UUID

La response di Brain AI usa **nomi stringa** (es. `"Viola"`), non UUID. Il client deve convertire:

```js
// Pseudocodice
function resolveActionMember(actionName, members) {
  const match = members.find(m =>
    m.name.toLowerCase() === actionName?.toLowerCase()
  );
  return match?.id ?? null; // null se non trovato → mostra warning in anteprima
}
```

Se un nome non matcha nessun membro, l'azione viene mostrata in anteprima con un warning e il campo persona vuoto da compilare manualmente.

---

## 2. Sync — Contratto di formato

Modello **ibrido crittografato** (Opzione B): 14 tabelle Supabase con campi sensibili AES-256-GCM encrypted, campi strutturali in chiaro.

### 2.1 Modello: Per-Table con crittografia campo-per-campo

```
File: src/lib/sync.js + src/lib/syncCrypto.js + src/lib/deviceSecret.js

Modello: ogni tabella Dexie ha una tabella corrispondente su Supabase.
I campi strutturali (id, family_id, updated_at, _version, _device_id, _deleted) vanno in chiaro.
I campi sensibili (title, amount, name, note, etc.) sono crittografati in colonne `<campo>_enc` (Base64).
Il campo originale contiene '[encrypted]' come placeholder.
Un flag `_encrypted: true` marca i record crittografati.

Mapping locale → remoto:
  family → families          members → members
  expenses → expenses        budgets → budgets
  events → events            tasks → tasks
  taskTemplates → task_templates    meals → meals
  mealPlans → meal_plans     shoppingItems → shopping_items
  inventory → inventory      rewards → rewards
  recurrences → recurrences  notifications → notifications

Push: per ogni tabella, filtra record dove local.updated_at > remote.updated_at → encryptRecord() → upsert in batch da 100.
Pull: per ogni tabella, scarica tutti i record della famiglia → decryptRecord() → merge con LWW (updated_at) + field-level merge per shoppingItems.
Conflitti: loggati in conflictLog.

Tabelle NON sincronizzate: patterns, nlpDocuments, nlpLogs, conversationDrafts, conflictLog, syncLog, settings.
```

**Join famiglia:** via `invite_code` (6 caratteri) + `sync_secret` (64 hex chars, condiviso via QR). Il nuovo device chiama `joinFamilyByCode(code, pin, syncSecret)` → salva sync_secret → scarica famiglia + membri → decrypt → pull completo.

### 2.2 Formato campi crittografati

Ogni campo sensibile viene crittografato individualmente. Il valore crittografato è un **Base64 string** che contiene:

```
┌──────────────────────────────────────────────────┐
│  IV (12 bytes)  │  AES-256-GCM ciphertext (N bytes) │
└──────────────────────────────────────────────────┘
```

Il plaintext di ogni campo è `JSON.stringify(valore_originale)` codificato in UTF-8.

**Esempio di flusso encrypt per un record expenses:**
```js
// src/lib/syncCrypto.js
// Record locale:
{ id: "abc", family_id: "xyz", amount: 45, note: "Dentista", updated_at: "2026-03..." }

// Dopo encryptRecord(record, 'expenses', syncKey):
{
  id: "abc",                    // ← in chiaro (strutturale)
  family_id: "xyz",             // ← in chiaro (per RLS)
  updated_at: "2026-03...",     // ← in chiaro (per LWW)
  _version: 3,                  // ← in chiaro (per merge)
  amount: "[encrypted]",        // ← placeholder
  amount_enc: "dGVzdC4uLg==",  // ← Base64(iv + ciphertext)
  note: "[encrypted]",
  note_enc: "YW5vdGhlci4=",
  _encrypted: true,             // ← flag per backward compat
}
```

**Mappa campi sensibili** (definita in `SENSITIVE_FIELDS` di `src/lib/syncCrypto.js`):
- `family`: name, pin_hash, invite_code
- `members`: name, surname, birth_date, avatar, role
- `expenses`: amount, note, category, subcategory, description
- `events`: title, description, time, location, type
- `tasks`: title, description, priority, status
- (e così via per tutte le 14 tabelle — vedere syncCrypto.js per la lista completa)

### 2.3 Derivazione chiave sync

Come definito in `1_MASTER_ARCHITECTURE.md` sezione 5.2 e `src/lib/deviceSecret.js`:

```
Chiave = PBKDF2(
  input:      PIN + sync_secret_hex,
  salt:       family_id (come UTF-8),
  iterations: 200000,
  hash:       SHA-256,
  output:     AES-256-GCM key (256 bit)
)
```

Il `sync_secret` è un segreto per-famiglia (32 bytes random), condiviso tra i device tramite QR code durante il join. Non va mai su Supabase.

### 2.4 Conflict resolution

Il conflict resolution avviene sui **campi strutturali in chiaro** (updated_at, _version), prima della decrittografia:

```
1. Vince updated_at più recente (LWW)
2. Per shoppingItems: field-level merge (ogni campo dal record più recente)
3. Conflitti loggati in conflictLog con dettaglio per debug
```

### 2.5 Ordine di sincronizzazione

```
PUSH: per ogni tabella, filtra record locali più nuovi del remoto → encryptRecord() → upsert batch 100
PULL: per ogni tabella, scarica tutti → decryptRecord() → merge LWW con conflictLog
FULL SYNC: push first → pull after (locale ha priorità su conflitti durante push)
```

---

## 3. Backup (.fmbackup) — Contratto di formato

### 3.1 Struttura file

Un file `.fmbackup` è un **blob binario**:

```
Formato: salt (16 bytes) + iv (12 bytes) + AES-256-GCM ciphertext

Chiave: PBKDF2(PIN, salt, 200000 iterazioni, SHA-256) → AES-256-GCM 256-bit

Plaintext (dopo decifratura):
{
  "version": 2,
  "exported_at": "ISO 8601",
  "tables": {
    "family": [...],
    "members": [...],
    "expenses": [...],
    "budgets": [...],
    "events": [...],
    "tasks": [...],
    "taskTemplates": [...],
    "meals": [...],
    "mealPlans": [...],
    "shoppingItems": [...],
    "inventory": [...],
    "rewards": [...],
    "recurrences": [...],
    "notifications": [...],
    "settings": [...]
  }
}
```

✅ Tutte le 15 tabelle (14 sync + settings) incluse. 200K iterazioni PBKDF2.

> **NOTA:** Il backup NON contiene il `sync_secret`. Se l'utente importa un backup su un nuovo device, deve anche fare il join via QR per ottenere il sync_secret e abilitare la sync cloud crittografata.

### 3.2 Formato binario

Il file `.fmbackup` è un blob binario puro (non JSON envelope):

```
Offset  Lunghezza  Contenuto
0       16 bytes   PBKDF2 salt (random)
16      12 bytes   AES-GCM IV (random)
28      N bytes    AES-GCM ciphertext (include 16-byte auth tag)
```

Non c'è header, magic bytes, o metadata in chiaro. L'intero file dopo i primi 28 bytes è ciphertext opaco.
```

### 3.3 Contenuto del `cipher.data` (dopo decifratura)

Il plaintext decriptato è un JSON con questa struttura:

```ts
interface BackupPayload {
  family: Family;                     // 1 record
  members: Member[];                  // N record
  expenses: Expense[];                // N record (esclusi _deleted)
  budgets: Budget[];
  events: Event[];
  tasks: Task[];
  taskTemplates: TaskTemplate[];
  meals: Meal[];
  mealPlans: MealPlan[];
  shoppingItems: ShoppingItem[];
  inventory: InventoryItem[];
  rewards: Reward[];
  notifications: Notification[];
  recurrences: Recurrence[];
  metadata: {
    total_records: number;            // Conteggio totale record esportati
    exported_tables: string[];        // ["family", "members", "expenses", ...]
    dexie_version: number;            // Versione schema Dexie.js (1)
  };
}
```

**Regole export:**
- I record con `_deleted: true` **NON vengono inclusi** nel backup (sono tombstone, non servono)
- L'ordine dei record negli array non è significativo
- Il backup include TUTTO il database locale (non un subset)

### 3.4 Flusso Export

```
1. Utente clicca "Esporta backup" in Settings
2. UI mostra warning: "Questo file contiene la chiave di accesso ai tuoi dati.
   Non condividerlo e conservalo in un luogo sicuro."
3. Utente conferma
4. App raccoglie tutti i record da Dexie.js (esclusi _deleted, settings, syncLog)
5. Serializza come JSON → UTF-8
6. Cifra con AES-256-GCM usando chiave derivata da PBKDF2(PIN, random_salt, 200K)
7. Compone il file .fmbackup binario: salt + iv + ciphertext
8. Salva/condividi via Web Share API o download diretto
```

### 3.5 Flusso Import

```
1. Utente seleziona file .fmbackup (da file picker o share)
2. App legge il file come ArrayBuffer
3. Chiedi PIN all'utente
4. Estrai salt (primi 16 bytes) + iv (12 bytes) + ciphertext (resto)
5. Deriva chiave: PBKDF2(PIN, salt, 200000)
6. Decripta ciphertext con AES-GCM
7. SE decryption fallisce → errore: "PIN errato o file corrotto"
8. Parsa il JSON decriptato
9. VALIDAZIONE PAYLOAD:
   a. Verifica che `version` e `tables` esistano
   b. Verifica che `tables.family` e `tables.members` non siano vuoti
10. Svuota Dexie.js corrente (se esiste già una famiglia)
11. Inserisci tutti i record tabella per tabella (clear + bulkAdd per ogni tabella)
12. Redirect a login (selezione membro + PIN)
13. NOTA: per abilitare sync cloud, l'utente deve anche fare join via QR per ricevere il sync_secret
```

### 3.6 Compatibilità versioni

```
format_version 1: versione iniziale (v1 R2+)

Regole per versioni future:
- format_version 2+ deve poter leggere format_version 1 (backward compatible)
- Se format_version > versione supportata dall'app → errore: "Aggiorna l'app per importare questo backup"
- Mai rompere la backward compatibility senza un migration path
```

---

## 4. Supabase Edge Function — Brain AI

### 4.1 Setup

```
Nome funzione: brain-parse
Runtime: Deno
Secrets necessari: ANTHROPIC_API_KEY
```

### 4.2 Implementazione di riferimento

```ts
// supabase/functions/brain-parse/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
  }

  const { text, context } = await req.json();

  if (!text || text.trim().length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "Testo vuoto" }), { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(context);

  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: text.slice(0, 500) }],
    }),
  });

  if (!anthropicResponse.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: `Errore AI (HTTP ${anthropicResponse.status})` }),
      { status: 502 }
    );
  }

  const result = await anthropicResponse.json();
  const aiText = result.content?.[0]?.text ?? "";

  // Pulizia markdown
  const cleaned = aiText
    .replace(/^```json\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.actions || !Array.isArray(parsed.actions)) throw new Error("No actions");

    // Validazione azioni
    const validTypes = ["task", "calendar", "expense", "meal", "note"];
    const validActions = parsed.actions.filter((a: any) =>
      a.type && validTypes.includes(a.type)
    );

    return new Response(JSON.stringify({
      ok: true,
      actions: validActions,
      summary: parsed.summary ?? `${validActions.length} azioni trovate`,
    }));
  } catch {
    // Fallback: salva come nota
    return new Response(JSON.stringify({
      ok: true,
      actions: [{ type: "note", text, originalFragment: text }],
      summary: "Non ho capito — salvato come nota",
    }));
  }
});

function buildSystemPrompt(context: any): string {
  // ... come da brain.php — adattato per Deno/TypeScript
  // Vedi sezione 1.2 per il contesto e le regole di parsing
  return `Sei il cervello di un'app famiglia italiana...`; // prompt completo
}
```

### 4.3 Rate limiting e costi

```
Limiti consigliati (enforced lato client):
- Max 20 chiamate/giorno per famiglia (contatore in settings Dexie.js)
- Throttle: min 3 secondi tra una chiamata e l'altra
- Se il contatore giornaliero è esaurito → mostra messaggio: "Hai raggiunto il limite giornaliero"

Costo stimato per famiglia/mese:
- ~600 chiamate/mese × ~200 token/chiamata = 120K token
- Claude Haiku: ~$0.015/mese per famiglia
- A 10K famiglie: ~$150/mese
```

---

## 5. Supabase Realtime — Contratto eventi (design target)

> **NOTA:** Realtime non è ancora implementato. Il design sotto è il target per quando il progetto Supabase sarà riattivato.

### 5.1 Canale

```
Nome canale: sync_{family_id}
Tabelle: tutte le 14 tabelle sync (non più sync_blobs)
Eventi: INSERT, UPDATE
```

### 5.2 Gestione lato client (design target)

```js
// Pseudocodice — una subscription per tabella critica
for (const [localTable, remoteTable] of Object.entries(TABLE_MAP)) {
  supabase
    .channel(`sync_${familyId}_${remoteTable}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: remoteTable,
      filter: `family_id=eq.${familyId}`
    }, async (payload) => {
      if (payload.new._device_id === myDeviceId) return;

      // Decripta campi sensibili
      const record = syncKey
        ? await decryptRecord(payload.new, localTable, syncKey)
        : payload.new;

      const local = await db[localTable].get(record.id);
      const remoteTime = new Date(record.updated_at).getTime();
      const localTime = local ? new Date(local.updated_at).getTime() : 0;

      if (remoteTime > localTime) {
        await db[localTable].put(record);
      }
    })
    .subscribe();
}
```

---

## 6. Riepilogo contratti

| Contratto | Producer | Consumer | Formato | Stato |
|-----------|----------|----------|---------|-------|
| Brain NLP locale (L0-L2) | brain/index.js | useBrain.js | JSON canonico (6_AUDIT §6) | ✅ Operativo |
| Brain AI L3 Request | Client (app) | Edge Function | JSON (sezione 1.2) | ⚠️ Edge fn non deployata |
| Brain AI L3 Response | Edge Function | Client (app) | JSON (sezione 1.3) | ⚠️ Edge fn non deployata |
| Contratto Canonico Azioni | normalizer | executor (useBrain) | 7 tipi canonici (6_AUDIT §6) | ✅ 82 test |
| Sync Per-Table | sync.js (push) | Supabase / sync.js (pull) | Campi sensibili AES-256-GCM (sezione 2) | ✅ Crittografia ibrida |
| Backup Export | backup.js | File system | Binary AES-256-GCM 200K iter (sezione 3) | ✅ 15 tabelle |
| Backup Import | File system | backup.js | Binary AES-256-GCM 200K iter (sezione 3) | ✅ 15 tabelle |
| Sync UI | useSync.js | SettingsPage | Optimistic state machine (R4) | ✅ useOptimistic |
| List Optimistic | useOptimisticList.js | ShoppingPage | Instant toggle/delete (R4) | ✅ useOptimistic |
| Form Actions | useFormAction.js | ExpenseForm | useActionState state machine (R4) | ✅ useActionState |
| CAPTCHA Auth | supabase.js | Turnstile CDN | Invisible token → signInAnonymously (R4) | ✅ Opzionale |

**Regola di compatibilità:** ogni modifica a un contratto richiede aggiornamento sia del producer che del consumer. Nessun breaking change senza migration path documentato.

---

## 7. React 19 Hooks — Contratti interni (R4)

### 7.1 useSync — State Machine

```ts
type SyncState = 'idle' | 'pushing' | 'pulling' | 'success' | 'error'

interface UseSyncReturn {
  syncState: SyncState       // Stato corrente (optimistic)
  lastSyncAt: string | null  // ISO timestamp ultima sync riuscita
  error: string | null       // Messaggio errore se syncState === 'error'
  progress: SyncProgress     // { phase: 'push'|'pull', table: string, current: number, total: number }
  isPending: boolean         // true durante transizione React
  startSync(mode?: 'full'|'push'|'pull'): void
  cancel(): void
}
```

### 7.2 useOptimisticList — Wrapper generico

```ts
interface UseOptimisticListReturn<T> {
  items: T[]                 // Lista con aggiornamenti ottimistici applicati
  optimisticUpdate(id: string, changes: Partial<T>, action: () => Promise<void>): void
  optimisticRemove(id: string, action: () => Promise<void>): void
  optimisticAdd(tempItem: T, action: () => Promise<void>): void
  isPending: boolean
}
```

### 7.3 useFormAction / useValidatedFormAction

```ts
interface FormState {
  ok: boolean | null   // null = non ancora inviato
  error: string        // vuoto se ok === true
  data: any            // risultato dell'azione se ok === true
}

// useFormAction(action, onSuccess) → { formState, handleSubmit, isPending }
// useValidatedFormAction(asyncFn, validate, onSuccess) → { formState, submitForm, isPending }
```
