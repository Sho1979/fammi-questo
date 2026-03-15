# Fammi Questo — Architettura Master

> Documento normativo. Ogni decisione di codice deve essere coerente con questo file.
> Se qualcosa non è qui, non si implementa. Se qualcosa contraddice questo file, si corregge.

---

## 1. Filosofia

Fammi Questo è un'app **local-first**. Significa:

- La fonte di verità sono i dati **sul dispositivo dell'utente**
- Il cloud è un **relay crittografato opzionale**, non un database
- L'app funziona al 100% **offline**
- La sync è un'**ottimizzazione**, non un requisito
- Nessuno — nemmeno noi — può leggere i dati degli utenti

Questa non è una feature. È il vincolo architetturale numero 1.

---

## 2. Stack

> Aggiornato: 15 marzo 2026. Versioni reali da `package.json`.

| Layer | Tecnologia | Versione | Ruolo |
|-------|-----------|----------|-------|
| UI | React + Vite | 19.2 + 7.x | Rendering + build |
| Stile | Tailwind CSS | 4.x | Utility-first CSS |
| State | Zustand | 5.0.11 | State management in-memory |
| Persistenza locale | Dexie.js (IndexedDB) | 4.3.0 | **Database primario** |
| Query reattive | dexie-react-hooks (`useLiveQuery`) | 4.2.0 | UI reattiva ai cambiamenti DB |
| Routing | React Router | 7.13.1 | Navigazione SPA |
| Icone | Lucide React | 0.577.0 | Iconografia |
| Grafici | Recharts | 3.8.0 | Statistiche |
| Cloud (opzionale) | Supabase JS | 2.49.0 | Sync per-table + auth + Edge Functions |
| AI (L3 fallback) | Claude Haiku 4.5 via Edge Function | claude-haiku-4-5-20251001 | Fallback NLP quando locale < 0.55 confidence |
| NLP locale (L0+L1+L2) | @nlpjs/core + @nlpjs/nlp + @nlpjs/lang-it | 5.0.0-alpha.5 | Pipeline NLP a 3 livelli locale |
| Native bridge | Capacitor | 8.2.0 | Bridge Android + iOS nativo |
| Android platform | @capacitor/android | 8.2.0 | Piattaforma Android nativa |
| iOS platform | @capacitor/ios | 8.2.0 | Piattaforma iOS (build via GitHub Actions macOS) |
| CI/CD | GitHub Actions | - | Build automatico Android (Ubuntu) + iOS (macOS-14) |
| Cross-platform UI | platform.js + haptics.js + useKeyboard.js | - | Rilevamento piattaforma, haptic feedback, keyboard handling |
| Notifiche native | @capacitor/local-notifications | 8.0.2 | Push notifications locali |
| PWA | vite-plugin-pwa | 1.2.0 | Installazione + offline |
| Hash PIN | bcryptjs | 3.0.3 | Hash sicuro per verifica PIN login locale |
| Anti-abuse | Cloudflare Turnstile | via CDN | CAPTCHA invisibile su auth anonimo (opzionale) |

**React 19 features attive:** `useOptimistic`, `useActionState`, `useTransition` — vedi §4.1.

**React Compiler:** valutato, non attivato. Richiede switch da SWC a Babel (dev ~2-3x più lento). Config pronta in `vite.config.ts` per abilitazione futura.

### 2.1 Brand Identity

| Elemento | Valore |
|----------|--------|
| Nome app | Fammi Questo |
| App ID | `com.fammiquesto.app` |
| Tagline | "La famiglia organizzata, semplicemente" |
| Claim | "Organizza la tua famiglia con una frase" |
| Logo | Voice Ripple — onde sonore viola/corallo da punto centrale |
| Colori brand | Violet Deep #2D1B69, Violet Primary #6C5CE7, Violet Light #A29BFE, Coral #FF6B6B, Amber #F9CA24, Teal #00B894, Cream #FAFAF8, Dark #1A1A2E |
| Logo files | `public/logo.svg` (colori), `public/logo-white.svg` (bianco), `public/logo-header.svg` (header pill) |
| Brand book | Canva (5 slide) + `brand/cervellone-slide.png` |
| Tre pilastri | Privacy First (AES-256), Il Cervellone (NLP italiano), Gamification |

**Librerie NON autorizzate senza approvazione esplicita:** qualsiasi altra dipendenza non listata qui sopra. Cursor NON deve aggiungere librerie a package.json senza che siano presenti in questa tabella.

**Nota:** il file `receiptOcr.js` esiste nel codice ma NON è in scope v1. Tesseract.js non è nelle dipendenze.

---

## 3. Architettura Dati

### 3.1 Dove vivono i dati

```
┌─────────────────────────────────────────────┐
│            DISPOSITIVO UTENTE                │
│                                              │
│  React ←→ Zustand (in-memory, volatile)     │
│               ↕                              │
│  Dexie.js (IndexedDB) ← FONTE DI VERITÀ    │
│               ↕ (solo se sync ON)           │
│  syncEngine → encryptFields → push per-table │
└──────────────────┬──────────────────────────┘
                   │ campi sensibili AES-256-GCM
                   ▼
        ┌──────────────────────────┐
        │  SUPABASE CLOUD          │
        │  (14 tabelle sync)       │
        │                          │
        │  Campi strutturali:      │
        │  id, family_id, *_at,    │
        │  _version, _deleted      │
        │  → IN CHIARO (per LWW)   │
        │                          │
        │  Campi sensibili:        │
        │  title, amount, name...  │
        │  → CRITTOGRAFATI (campo  │
        │    _enc con AES-256-GCM) │
        └──────────────────────────┘
```

### 3.2 Tabelle Supabase — Modello ibrido crittografato (Opzione B)

Supabase mantiene le **14 tabelle** (mirror di Dexie), ma i **campi sensibili** sono crittografati con AES-256-GCM prima del push. I campi strutturali (id, family_id, updated_at, _version, _device_id, _deleted) restano in chiaro per consentire LWW merge, RLS e Realtime.

I campi crittografati sono salvati in colonne `<campo>_enc` (Base64), il campo originale contiene `'[encrypted]'`. Vedere `src/lib/syncCrypto.js` per la mappa completa dei campi sensibili per tabella.

Supabase contiene **14 tabelle dati** (mirror delle tabelle Dexie sincronizzate) + 1 tabella famiglia:

```
Mapping Dexie (locale) → Supabase (cloud):
  family        → families
  members       → members
  expenses      → expenses
  budgets       → budgets
  events        → events
  tasks         → tasks
  taskTemplates → task_templates
  meals         → meals
  mealPlans     → meal_plans
  shoppingItems → shopping_items
  inventory     → inventory
  rewards       → rewards
  recurrences   → recurrences
  notifications → notifications
```

La tabella `families` include un campo `invite_code` per il join da altro device.

**Tabelle NON sincronizzate** (solo locali in Dexie.js): `patterns`, `nlpDocuments`, `nlpLogs`, `conversationDrafts`, `conflictLog`, `syncLog`, `settings`.

**Tabelle fantasma** (nello schema Dexie ma senza nessun reader/writer): `priceHistory`, `brainNotes`. Candidate per rimozione.

### 3.3 RLS (Row Level Security)

> **STATO:** ✅ Progetto Supabase ACTIVE (riattivato 14 Mar 2026). RLS + policy family-scoped attive su tutte le 14 tabelle. Migration applicate: `add_encrypted_sync_columns`, `replace_rls_with_family_scoped_policies`.

**Auth model:** `signInAnonymously()` → `linkUserToFamily(familyId)` salva il family_id in `user_metadata` del JWT → le policies filtrano via `auth.jwt()->'user_metadata'->>'family_id'`.

```sql
-- Funzione helper
CREATE FUNCTION public.get_user_family_id() RETURNS text AS $$
  SELECT coalesce(auth.jwt()->'user_metadata'->>'family_id', '')
$$;

-- 4 policy per ogni tabella (SELECT, INSERT, UPDATE, DELETE)
-- Esempio expenses:
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (family_id = public.get_user_family_id());
-- Eccezione: families INSERT è aperto (per creare nuove famiglie prima del link)
```

**Doppia protezione:** RLS impedisce accesso cross-famiglia + crittografia ibrida protegge i contenuti.

### 3.4 Schema Dexie.js (database locale, fonte di verità)

> Schema attuale: **v8**. Vedere `src/lib/localDb.js` per la catena completa di migrazioni v1→v8.

```js
// src/lib/localDb.js — schema v8 (ultimo)
import Dexie from 'dexie';

export const db = new Dexie('FammiQuestoDB');

// Tabelle sincronizzate (14)
db.version(8).stores({
  family:              'id',
  members:             'id, family_id, role',
  expenses:            'id, family_id, date, category, person_id',
  budgets:             'id, family_id, &[category+month]',
  events:              'id, family_id, date, person_id',
  tasks:               'id, family_id, due_date, assigned_to, status',
  taskTemplates:       'id, family_id',
  meals:               'id, family_id',
  mealPlans:           'id, family_id, date',
  shoppingItems:       'id, family_id, checked',
  inventory:           'id, family_id, expiry_date',
  notifications:       'id, family_id, member_id, read',
  recurrences:         'id, family_id, type',
  rewards:             'id, family_id, member_id, week_start',

  // Tabelle solo locali (6)
  patterns:            'id, family_id, keyword, actionType, score',
  nlpDocuments:        'id, family_id, intent',
  nlpLogs:             'id, family_id, created_at, result_intent, confidence, used_ai',
  conversationDrafts:  'id, [family_id+created_by+status], status, created_at',
  conflictLog:         '++id, family_id, table_name, record_id, resolved_at',
  syncLog:             '++id, table_name, record_id, synced',

  // Tabelle condivise
  settings:            'id, family_id, key',

  // Tabelle fantasma (zero reader/writer — candidate per rimozione v9)
  priceHistory:        'id, family_id, product_name',
  brainNotes:          'id, family_id',
});
```

**Differenze chiave rispetto alla v1 originale:**
- `tasks`: indice `date` → `due_date` (v2)
- `shoppingItems`: indice `bought` → `checked` (v2)
- `inventory`: indice `expires_at` → `expiry_date` (v2)
- `notifications`: aggiunto indice `member_id` (v3)
- `patterns`: indici `keyword, actionType, score` per lookup sinapsi (v4)
- `nlpDocuments`, `nlpLogs`, `conversationDrafts`, `conflictLog`: aggiunti nelle v5-v8
- `settings`: cambiato da `'key'` a `'id, family_id, key'` (v5)

### 3.5 Record Type Definitions

Ogni record in Dexie.js segue questa struttura base:

```ts
// Ogni entità ha questi campi comuni:
interface BaseRecord {
  id: string;          // crypto.randomUUID()
  family_id: string;
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
  _deleted: boolean;   // tombstone per sync (default: false)
  _version: number;    // incrementale, per conflict resolution
  _device_id: string;  // identifica il device che ha scritto
}
```

Campi specifici per entità — vedi PRODUCT_SCOPE_V1.md per quelli della v1.

---

## 4. Autenticazione

### 4.1 Modello a due livelli

```
LIVELLO 1 — Identità Supabase (per il cloud)
  → auth.signInAnonymously()
  → genera un auth_user_id unico per device
  → linkato a un member → linkato a una family
  → serve SOLO per le policy RLS su sync_blobs

LIVELLO 2 — Identità locale (per l'app)
  → PIN famiglia: accesso rapido UI
  → Selezione membro: "Chi sei?"
  → Permessi basati su ruolo membro
```

### 4.2 Flusso dettagliato

**Primo accesso (setup):**
1. Wizard: composizione famiglia, nomi, età, ruoli
2. Salva tutto in Dexie.js locale
3. Genera PIN genitori + PIN figli (4-6 cifre)
4. PIN hashati con bcrypt e salvati in `members` locale
5. Se sync attivato: `supabase.auth.signInAnonymously()` → crea family + member su Supabase
6. Genera `device_secret`: 32 bytes random, salvato in `settings` Dexie.js
7. La chiave crypto è: `PBKDF2(PIN + device_secret, family_id, 200000 iter)` — non solo il PIN

**Accessi successivi:**
1. Schermata: seleziona membro (avatar grid)
2. Inserisci PIN
3. Verifica `bcrypt(PIN, member.pin_hash)`
4. Se OK → set currentMember in authStore → redirect a dashboard

**Secondo device (join famiglia):**
1. Nuovo device installa l'app
2. "Hai già una famiglia?" → Sì
3. Metodo A: scansiona QR dal primo device (contiene invite_code + device_secret)
4. Metodo B: inserisci invite_code manualmente + chiedi il device_secret al primo device
5. `supabase.auth.signInAnonymously()` → crea member linkato alla stessa family
6. Pull blob crittografati → decrypt → popola Dexie.js locale

### 4.3 Ruoli e permessi

| Ruolo | access_level | Può fare |
|-------|-------------|----------|
| parent | `full` | Tutto |
| child (13-17) | `calendar_tasks` | Calendario, task propri, lista spesa, proporre task, rewards |
| child (6-12) | `basic` | Task propri, rewards, calendario in lettura |
| child (0-5) | `view_only` | Solo visibile nel calendario genitori |
| elder | `full` | Come parent |
| other | configurable | Configurabile caso per caso |

### 4.4 Anti-abuse: Cloudflare Turnstile CAPTCHA

L'auth anonimo (`signInAnonymously`) è protetto opzionalmente da Cloudflare Turnstile (CAPTCHA invisibile).

- **Attivazione:** impostare `VITE_TURNSTILE_SITE_KEY` in `.env` + abilitare "Bot Detection" nella Dashboard Supabase → Auth
- **Se non configurato:** l'auth funziona normalmente senza CAPTCHA (degradazione graceful)
- **Flusso:** `ensureAuth()` → `getTurnstileToken()` → `signInAnonymously({ captchaToken })` → Supabase verifica il token con Turnstile
- **Implementazione:** `src/lib/supabase.js`, script Turnstile in `index.html`

---

## 4b. Pattern React 19 (R4)

### 4b.1 useOptimistic — Feedback istantaneo

React 19 `useOptimistic` è usato per dare feedback UI immediato durante operazioni asincrone:

**Sync (`src/hooks/useSync.js`):**
- Lo stato della sync (idle/pushing/pulling/success/error) cambia **istantaneamente** alla pressione del bottone
- Il bottone mostra immediatamente lo stato "syncing" senza aspettare la risposta di Supabase
- Auto-reset a idle dopo 3s (success) o 5s (error)

**Liste (`src/hooks/useOptimisticList.js`):**
- Wrapper generico per qualsiasi lista Dexie + `useLiveQuery`
- `optimisticUpdate(id, changes, asyncFn)` — aggiorna l'item nella UI istantaneamente, poi esegue la write
- `optimisticRemove(id, asyncFn)` — rimuove l'item dalla UI istantaneamente, poi esegue il soft-delete
- `optimisticAdd(tempItem, asyncFn)` — aggiunge un item temporaneo alla UI, poi crea il record reale
- Usato in: ShoppingPage (toggle checked, delete item)

### 4b.2 useActionState — Form semplificati

React 19 `useActionState` sostituisce i pattern `useState(saving) + useState(error)` nei form:

**`src/hooks/useFormAction.js`:**
- `useFormAction(action, onSuccess)` — wrapper base
- `useValidatedFormAction(asyncFn, validate, onSuccess)` — con validazione integrata
- Lo state machine è: `{ ok: null } → { ok: true } | { ok: false, error: '...' }`
- `isPending` sostituisce `saving` state manuale
- Usato in: ExpenseForm

### 4b.3 React Compiler — Valutazione

**Status:** valutato, **non attivato**. Config pronta in `vite.config.ts`.

| Aspetto | Dettaglio |
|---------|-----------|
| Requisito | Switch da `@vitejs/plugin-react-swc` a `@vitejs/plugin-react` (Babel) |
| Impatto dev | HMR ~2-3x più lento (SWC ~100ms → Babel ~300ms) |
| Beneficio | Memoizzazione automatica, elimina `useMemo`/`useCallback` manuali |
| Decisione | Mantenere SWC per velocità dev. Riattivare quando React Compiler è stable |

---

## 5. Sicurezza e Crittografia

### 5.1 Modello di minaccia

| Minaccia | Protezione |
|----------|-----------|
| Qualcuno accede al telefono | PIN per accesso app |
| Qualcuno legge i campi su Supabase | AES-256-GCM per campo, chiave non sul server |
| Brute force sul PIN (offline, con dati cloud) | `sync_secret` condiviso per famiglia rende il PIN insufficiente da solo |
| Intercettazione rete | HTTPS + campi sensibili già crittografati prima del push |
| Noi (sviluppatori) leggiamo i dati | Impossibile: non abbiamo sync_secret né PIN |
| Supabase admin/breach | Vede solo campi strutturali (id, date, _version) + campi `_enc` opachi |

### 5.2 Derivazione chiave — Due sistemi

**A. Chiave Backup** (`src/lib/crypto.js`):

```js
// Per file .fmbackup — chiave usa-e-getta con salt random
const ITERATIONS = 200000;  // ✅ 200K iterazioni
// PBKDF2(PIN, random_salt_16bytes, 200K, SHA-256) → AES-256-GCM
// Formato output: salt(16) + iv(12) + ciphertext
```

**B. Chiave Sync** (`src/lib/deviceSecret.js`):

```js
// Per sync cloud — chiave stabile derivata da PIN + sync_secret + family_id
const SYNC_ITERATIONS = 200000;  // ✅ 200K iterazioni

// 1. sync_secret: 32 bytes random, generato alla creazione famiglia
//    Salvato in Dexie settings come `sync_secret_{familyId}`
//    Condiviso via QR/invite quando un altro device fa join

// 2. Derivazione:
//    PBKDF2(PIN + sync_secret_hex, UTF8(family_id), 200K, SHA-256) → AES-256-GCM
//    Tutti i device della stessa famiglia con lo stesso PIN derivano la stessa chiave

export async function getSyncKey(pin, familyId) {
  const secret = await getOrCreateSyncSecret(familyId);
  return deriveSyncKey(pin, familyId, secret);
}
```

### 5.3 Sync Secret — IMPLEMENTATO

Il `sync_secret` (evoluzione del `device_secret` originale) è implementato in `src/lib/deviceSecret.js`:

- **Generazione:** 32 bytes random, creato automaticamente con `getOrCreateSyncSecret(familyId)`
- **Storage:** Dexie `settings` table, chiave `sync_secret_{familyId}`
- **Multi-device:** Trasmesso via QR code o manualmente durante il join (parametro `syncSecret` di `joinFamilyByCode`)
- **Mai sincronizzato:** Il secret non va MAI su Supabase — solo trasferimento device-to-device

---

## 6. Sync e Conflitti

L'implementazione (`src/lib/sync.js`) usa il modello **ibrido crittografato** (Opzione B): 14 tabelle Supabase con campi sensibili AES-256-GCM encrypted e campi strutturali in chiaro. Se viene fornito un `syncKey`, i campi vengono crittografati/decrittati automaticamente durante push/pull.

### 6.1 Strategia: Last-Write-Wins (LWW) + Field-Level Merge

```
Strategia base: Last-Write-Wins per la maggior parte delle tabelle.
  → Se remote.updated_at > local.updated_at → remote vince
  → Altrimenti → local vince (verrà pushato dopo)

Eccezione: Field-Level Merge per tabelle in FIELD_MERGE_TABLES (attualmente solo shoppingItems).
  → In caso di conflitto, i campi vengono mergiati dal record più recente.

Conflitti loggati in tabella conflictLog con dettaglio per debug.
```

Nota: il design originale prevedeva LWW a 3 livelli (_version → updated_at → device_id). L'implementazione usa solo `updated_at` come tie-break e field-level merge per le tabelle dove ha senso (es. shopping list dove due persone spuntano item diversi contemporaneamente).

### 6.2 Cancellazioni: tombstone

```
NON si fa DELETE reale.
Si fa: record._deleted = true, record._version++, record.updated_at = now()
```

Il tombstone viene sincronizzato come qualsiasi altro update.

**Garbage collection tombstone — regola esplicita:**

```
All'avvio dell'app, se last_gc_run (salvato in settings) è > 24h fa:
  1. Per ogni tabella: DELETE reale di tutti i record con _deleted === true E updated_at < (now - 30 giorni)
  2. Salva settings.last_gc_run = now()
Se last_gc_run < 24h fa: skip (non rallentare ogni avvio)
```

La soglia di 30 giorni garantisce che tutti i device abbiano tempo di ricevere la tombstone via sync prima che venga rimossa. Il check ogni 24h evita overhead inutile.

### 6.3 Sync Engine

```js
// src/lib/sync.js — modello ibrido crittografato (Opzione B)
import { encryptRecord, decryptRecord } from './syncCrypto.js'

// PUSH (locale → cloud, con crittografia opzionale)
export async function pushToCloud(familyId, onProgress, syncKey) {
  for (const localTable of SYNC_TABLES) {
    const records = await db[localTable].where('family_id').equals(familyId).toArray()
    // Filtra solo record più nuovi del remoto (LWW)
    const toPush = records.filter(r => isNewerThanRemote(r))
    // Cripta campi sensibili se syncKey fornita
    const ready = syncKey
      ? await Promise.all(toPush.map(r => encryptRecord(r, localTable, syncKey)))
      : toPush
    // Upsert a batch di 100
    await supabase.from(TABLE_MAP[localTable]).upsert(ready, { onConflict: 'id' })
  }
}

// PULL (cloud → locale, con decrittografia opzionale)
export async function pullFromCloud(familyId, onProgress, syncKey) {
  for (const localTable of SYNC_TABLES) {
    const { data } = await supabase.from(TABLE_MAP[localTable]).select('*').eq('family_id', familyId)
    // Decripta campi sensibili (se record._encrypted === true)
    const decrypted = syncKey
      ? await Promise.all(data.map(r => decryptRecord(r, localTable, syncKey)))
      : data
    // Smart merge: LWW + field-merge per shoppingItems
    for (const remote of decrypted) {
      const local = await db[localTable].get(remote.id)
      // ... conflict detection + log + merge logic
    }
  }
}

// FULL SYNC
export async function fullSync(familyId, onProgress, syncKey) {
  await pushToCloud(familyId, onProgress, syncKey)
  await pullFromCloud(familyId, onProgress, syncKey)
}
```

**Campi crittografati** (mappa in `src/lib/syncCrypto.js`):
- Ogni tabella ha una lista di campi sensibili (es. expenses: `amount, note, category, subcategory, description`)
- I campi vengono salvati come `<campo>_enc` (Base64 di iv+ciphertext) su Supabase
- Il campo originale contiene `'[encrypted]'` come placeholder
- Un flag `_encrypted: true` marca i record crittografati per backward compatibility

### 6.4 Quando avviene la sync

| Evento | Azione |
|--------|--------|
| Dopo ogni write locale | Logga in syncLog. Push con debounce 3s |
| App torna in foreground | Pull da last_sync |
| App torna online (navigator.onLine) | Push pending + Pull |
| Realtime event ricevuto | Decrypt + merge immediato |
| Manuale da Settings | Push + Pull completo |

---

## 7. Backup e Migrazione Telefono

### 7.1 Formato file backup (.fmbackup)

Il backup è un **blob binario** con formato: `salt (16 bytes) + iv (12 bytes) + AES-256-GCM ciphertext`.

Chiave derivata con `PBKDF2(PIN, salt_random, 200000 iterazioni, SHA-256)` — ✅ 200K iterazioni.

Il plaintext è un JSON:
```json
{
  "version": 2,
  "exported_at": "2026-03-14T10:00:00Z",
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

✅ Tutte le 15 tabelle (14 sync + settings) sono ora incluse nel backup.

### 7.2 Tre metodi di migrazione

**A. Sync cloud (se attivo):** nuovo device → signup anonimo → join famiglia con invite_code + sync_secret (via QR) → `joinFamilyByCode(code, pin, syncSecret)` → pull + decrypt campi sensibili.

**B. QR code (tra 2 device vicini):** vecchio device genera QR con `{invite_code, sync_secret, supabase_url}`. Nuovo device scansiona → join → pull.

**C. File .fmbackup:** vecchio device esporta → condividi file → nuovo device importa + inserisci PIN. Il file non contiene il `sync_secret`, quindi il nuovo device deve anche fare join via QR per abilitare la sync cloud.

### 7.3 Schermata Privacy (UI reference)

In Settings, sezione "Privacy e Dati":
- Indicatore: "I tuoi dati sono sul tuo telefono" con conteggio record e spazio occupato
- Toggle: Sync cloud ON/OFF
- Bottoni: Esporta backup, Importa backup, Ripristina da cloud
- Bottone rosso: Cancella tutti i dati (con doppia conferma)

---

## 8. Convenzioni di Codice

### 8.1 Naming

| Cosa | Convenzione | Esempio |
|------|-------------|---------|
| Componenti React | PascalCase | `ExpenseForm.jsx` |
| Hook | camelCase con prefix `use` | `useExpenses.js` |
| Store Zustand | camelCase con prefix `use` + `Store` | `useAuthStore.js` |
| Utility | camelCase | `formatCurrency.js` |
| Costanti | UPPER_SNAKE_CASE | `DEFAULT_CATEGORIES` |
| Tabelle Dexie | camelCase | `db.expenses` |
| Campi record | snake_case | `person_id`, `created_at` |
| CSS classes | Tailwind utility only | No CSS custom files |

### 8.2 Regole di architettura

1. **Nessun componente contiene logica di persistenza.** I componenti chiamano funzioni da `src/lib/` o hook. Mai `db.expenses.add()` direttamente in un componente.

2. **Ogni operazione CRUD passa per un helper centralizzato.** File: `src/lib/crud.js` — wrappa Dexie.js + syncLog in un'unica funzione.

3. **Query reattive solo via `useLiveQuery`.** Niente polling, niente setInterval per refresh dati.

4. **Nessuna libreria aggiuntiva** senza che sia listata nella sezione 2 Stack.

5. **Tutto in italiano** nell'interfaccia. Codice e commenti in inglese.

6. **Mobile-first.** Ogni componente deve funzionare su 375px di larghezza come caso base.

7. **Cross-platform.** L'app gira su Android (Capacitor Android) e iOS (Capacitor iOS). Le differenze UI sono gestite tramite `src/lib/platform.js` (rilevamento piattaforma), classi CSS condizionali `plt-ios` / `plt-android` su `<html>`, e hook dedicati (`useKeyboard`, `useBackButton`, `useStatusBar`). Il build iOS avviene via GitHub Actions su runner macOS.

### 8.3 CRUD Helper centralizzato

```js
// src/lib/crud.js
import { db } from './localDb';

function getDeviceId() {
  // Lazy init: genera e salva in localStorage
  let id = localStorage.getItem('fm_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('fm_device_id', id);
  }
  return id;
}

export async function createRecord(table, data) {
  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    ...data,
    created_at: now,
    updated_at: now,
    _deleted: false,
    _version: 1,
    _device_id: getDeviceId(),
  };
  await db.table(table).add(record);
  await db.syncLog.add({ table_name: table, record_id: record.id, action: 'upsert', synced: 0 });
  return record;
}

export async function updateRecord(table, id, changes) {
  const existing = await db.table(table).get(id);
  if (!existing) throw new Error(`Record ${id} not found in ${table}`);
  const updated = {
    ...existing,
    ...changes,
    updated_at: new Date().toISOString(),
    _version: (existing._version || 0) + 1,
    _device_id: getDeviceId(),
  };
  await db.table(table).put(updated);
  await db.syncLog.add({ table_name: table, record_id: id, action: 'upsert', synced: 0 });
  return updated;
}

export async function deleteRecord(table, id) {
  // Tombstone, non delete reale
  return updateRecord(table, id, { _deleted: true });
}
```

---

## 9. Cosa NON fare

- ❌ NON usare Supabase RPC/funzioni per query dati (solo Edge Functions per Brain AI)
- ❌ NON usare email reali per auth (solo signInAnonymously o invite code)
- ❌ NON aggiungere librerie non autorizzate (vedi sezione 2)
- ❌ NON mettere logica di persistenza nei componenti React (usare hooks e src/lib/)
- ❌ NON fare DELETE reali in Dexie (usare tombstone `_deleted: true`)
- ❌ NON implementare feature fuori dallo scope della release corrente
- ❌ NON ottimizzare per "1 milione di famiglie" — ottimizzare per correttezza e semplicità
- ❌ NON scrivere direttamente su Dexie dai componenti — passare SEMPRE per `crud.js`

### 8.4 Pattern introdotti nella sessione di perfezionamento

**Badge consolidati (`useBadgeCounts.js`):**
- Hook unico che sostituisce 5 query separate in BottomNav
- `Promise.all` per esecuzione parallela: tasks, calendar, dispensa, expenses
- Restituisce oggetto `{ tasks, calendar, dispensa, expenses }`

**Budget threshold alerts (`useBudget.js`):**
- `alertLevel` calcolato: `'none'` | `'warning'` (≥80%) | `'exceeded'` (≥100%)
- `checkBudgetThreshold()` persiste livello in Dexie settings per evitare notifiche duplicate
- Integrato con `notifyParents()` da `useNotifications.js`

**PIN security (`useSync.js`):**
- `CryptoKey` cached in `useRef` (opaca, non estraibile)
- PIN cancellato da Zustand (`setSessionPin(null)`) dopo prima derivazione
- La key sopravvive al clear del PIN perché è un oggetto CryptoKey nativo

**Conversation drafts cleanup (`useBrain.js`):**
- `expireOldDrafts(familyId)` chiamato all'init di useBrain, dopo il decay
- Draft con `expires_at` scaduto → marcati `status: 'expired'`
- Fire-and-forget (`.catch()` per non bloccare init)

**Dispensa persistence:**
- Tab attivo persistito in `localStorage` (`dispensa_active_tab`)
- Collapse state delle shelf persistito (`dispensa_collapsed`)
- Funzioni helper `readPersistedTab()` e `readPersistedCollapse()` con try/catch

**Tasks filters (`TasksPage.jsx`):**
- Filtro per priorità: `all` | `high` | `medium` | `low`
- Ordinamento: `default` | `deadline` | `priority`
- `useMemo` per applicare filtri + sort in un unico pass

**Leaderboard completa:**
- Mostra tutti i membri della famiglia (non solo top 3)
- Medaglie 🥇🥈🥉 per i primi 3, posizione numerica per gli altri

**Costanti centralizzate (`constants.js`):**
- `ROLES = { PARENT, ELDER, CHILD }` + alias italiani (`ROLE_ALIASES`)
- `isParentRole(role)` e `isChildRole(role)` helper functions
- `AI_MODEL`, `AI_API_URL` (usati in `voice.js` e `receiptOcr.js`)
- `AI_MAX_DAILY_CALLS = 20`
- `UNITS = ['pz', 'kg', 'g', 'L', 'mL']`
- `MEAL_RECIPES` (spostato da DashboardPage)

---

### Debiti tecnici noti (da risolvere)

- ✅ ~~Sync in chiaro~~ — RISOLTO: crittografia ibrida campo-per-campo implementata (`syncCrypto.js`)
- ✅ ~~Backup incompleto~~ — RISOLTO: tutte le 15 tabelle incluse (`backup.js` v2)
- ✅ ~~device_secret non implementato~~ — RISOLTO: `sync_secret` per famiglia implementato (`deviceSecret.js`)
- ✅ ~~PBKDF2 100K iterazioni~~ — RISOLTO: 200K sia per backup che per sync
- ✅ ~~Supabase INACTIVE~~ — RISOLTO: progetto riattivato (ACTIVE_HEALTHY, 14 Mar 2026)
- ✅ ~~Migration colonne crypto~~ — RISOLTO: colonne `*_enc`, `_encrypted`, `_device_id`, `updated_by` aggiunte a tutte le 14 tabelle
- ✅ ~~Edge function brain-parse non deployata~~ — RISOLTO: deployata v1 (14 Mar 2026). Richiede secret `ANTHROPIC_API_KEY`
- ✅ ~~ANTHROPIC_API_KEY non impostata~~ — RISOLTO: secret configurato su Supabase Edge Functions (14 Mar 2026)
- ✅ ~~RLS policies non configurate~~ — RISOLTO: 56 policy family-scoped (4 per tabella × 14 tabelle) via `get_user_family_id()` + `signInAnonymously()` + `linkUserToFamily()`
- ⚠️ **Supabase free tier**: il progetto si auto-pausa dopo 7 giorni di inattività — considerare upgrade a Pro o ping periodico
- ⚠️ **Tabelle ghost**: `priceHistory` e `brainNotes` nello schema Dexie ma mai usate — candidate per rimozione in v9
- ✅ ~~React 19 hooks non sfruttati~~ — RISOLTO R4: `useOptimistic` (sync, shopping), `useActionState` (ExpenseForm), `useTransition` (sync)
- ✅ ~~CAPTCHA mancante su auth anonimo~~ — RISOLTO R4: Cloudflare Turnstile invisibile integrato in `supabase.js` (opzionale)
- ✅ ~~React Compiler non valutato~~ — RISOLTO R4: valutato, config pronta in `vite.config.ts`, non attivato (SWC più veloce)
- ✅ ~~BottomNav N+1 query~~ — RISOLTO: `useBadgeCounts` meta-hook con `Promise.all` (1 query consolidata)
- ✅ ~~Budget senza alert~~ — RISOLTO: sistema threshold 80%/100% con `notifyParents` + dedup mensile in Dexie settings
- ✅ ~~PIN in memoria dopo derivazione~~ — RISOLTO: CryptoKey cached in useRef, PIN cancellato da Zustand
- ✅ ~~conversationDrafts mai puliti~~ — RISOLTO: `expireOldDrafts()` chiamato all'init di useBrain
- ✅ ~~VoiceButton re-render~~ — RISOLTO: wrappato con `memo()`
- ✅ ~~Leaderboard solo top 3~~ — RISOLTO: mostra tutti i membri
- ✅ ~~Dispensa senza search/sort~~ — RISOLTO: search + sort su entrambi i tab
- ✅ ~~Dispensa tab non persistito~~ — RISOLTO: localStorage per tab attivo + collapse state
- ✅ ~~Tasks senza filtri~~ — RISOLTO: filtro priorità + sort scadenza/priorità
- ⚠️ **UNITS duplicato**: definito in `constants.js` (mai importato) e in `useShopping.js` (usato) — consolidare
- ⚠️ **AI_MAX_DAILY_CALLS duplicato**: definito in `constants.js` e localmente in `useBrain.js` — consolidare
- ⚠️ **4 pagine orfane**: StatsPage, BudgetPage, ShoppingPage, InventoryPage — by design (sub-tab in SpesePage/DispensaPage)
- ✅ ~~Solo Android~~ — RISOLTO: Capacitor iOS aggiunto, CI/CD GitHub Actions per build cross-platform (15 Mar 2026)
- ✅ ~~UI solo Android~~ — RISOLTO: safe areas (notch/Dynamic Island), touch feedback per piattaforma, keyboard handling, status bar, haptic feedback (15 Mar 2026)
