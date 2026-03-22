# Production Readiness — Design Spec

**Data:** 22 Marzo 2026
**Obiettivo:** Portare l'app da pre-produzione a produzione risolvendo bug critici, hardening security/cloud, e chiudendo i gap di test coverage e CI/CD.

**Ordine causale:** prima stabilità dato → poi hardening cloud → poi test/CI. Una famiglia perdona UI imperfetta, non dati incoerenti.

---

## Fase 1 — Stabilità e fiducia del dato

### C1 — Fix family ID mismatch

**Obiettivo:** Il PK della famiglia in Dexie deve coincidere con il `familyId` salvato in authStore e usato come chiave in tutti i record (members, expenses, events, tasks...).

**Problema:** `createRecord()` in `crud.js` genera un proprio `crypto.randomUUID()` come `id` e lo spread dopo `data`, sovrascrivendo qualsiasi `id` passato. Il wizard chiama `createRecord('family', { family_id: familyId, ... })` — ma `family_id` non è `id`. Il record famiglia finisce con un PK random diverso da `familyId`.

**File toccati:**
- `src/components/auth/SetupWizard.jsx` (linea ~86)

**Modifica precisa:**
```js
// DA:
await createRecord('family', {
  family_id: familyId,
  name: 'La mia famiglia',
  created_by: 'setup',
})

// A:
await createRecord('family', {
  id: familyId,
  name: 'La mia famiglia',
  created_by: 'setup',
})
```

**Nota:** `createRecord` fa `{ id: crypto.randomUUID(), ...data }` — passando `id` in `data`, il nostro `id` vince perché viene dopo nello spread.

**Test atteso:**
- `wizardCompletion.test.js` già verifica la creazione famiglia — aggiungere assertion che `family.id === familyId` usato per i members.

**Rischio regressione:** Basso. Il campo `family_id` non era mai usato come PK, era ridondante.

---

### C2 — Guard OCR con errore strutturato

**Obiettivo:** `scanReceipt()` deve fallire in modo controllato con un errore tipizzato, non chiamare un'edge function inesistente.

**Problema:** `receiptOcr.js` chiama `supabase.functions.invoke('receipt-ocr', ...)` — la funzione non esiste su Supabase.

**File toccati:**
- `src/lib/receiptOcr.js`

**Modifica precisa:**
```js
// Errore strutturato con codice
export class OcrError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'OcrError'
    this.code = code
  }
}

export async function scanReceipt(imageData) {
  // Guard: OCR non ancora disponibile
  throw new OcrError(
    'OCR_NOT_AVAILABLE',
    'La scansione scontrini non è ancora disponibile. Inserisci la spesa manualmente.'
  )

  // --- implementazione futura sotto questo punto ---
  // ...codice esistente...
}
```

**Test atteso:**
- Nuovo test in `receiptOcr.test.js`: verifica che `scanReceipt()` lancia `OcrError` con `code === 'OCR_NOT_AVAILABLE'`.

**Rischio regressione:** Zero. La funzione non ha mai funzionato.

---

## Fase 2 — Hardening cloud/security

### I6 — JWT verification + audit log su edge function

**Obiettivo:** `brain-parse` deve verificare l'identità del chiamante e loggare le chiamate per audit.

**Problema:** La funzione esegue per qualsiasi richiesta, senza controllo JWT. Chiunque con l'URL può consumare token Anthropic.

**File toccati:**
- `supabase/functions/brain-parse/index.ts`

**Modifica precisa:**

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Dentro il handler, prima della logica di parsing:
const authHeader = req.headers.get("Authorization");
if (!authHeader) {
  return new Response(
    JSON.stringify({ ok: false, error: "Missing authorization", code: "AUTH_MISSING" }),
    { status: 401, headers: corsHeaders }
  );
}

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: authHeader } } }
);

const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

if (authError || !user) {
  console.warn(`[AUTH] Rejected: ${authError?.message || 'no user'} from ${origin}`);
  return new Response(
    JSON.stringify({ ok: false, error: "Invalid or expired token", code: "AUTH_INVALID" }),
    { status: 401, headers: corsHeaders }
  );
}

// Audit log (no sensitive data)
console.info(`[AUDIT] brain-parse called by user=${user.id} origin=${origin}`);
```

**Comportamento:**
- Token mancante → 401 `AUTH_MISSING`
- Token non valido/scaduto → 401 `AUTH_INVALID`
- Token valido → procedi con parsing + audit log

**Nota su 403:** Per ora non implementiamo 403 (contesto applicativo scorretto) perché non abbiamo claim custom nei JWT. Se in futuro aggiungiamo `family_id` nel JWT, allora avremo 403 per "token valido ma famiglia non autorizzata".

**Test atteso:**
- Non testabile localmente (edge function Deno). Verificare con `curl` dopo deploy: senza header → 401, con header valido → 200.

**Rischio regressione:** Il client già invia `Authorization: Bearer <token>` nelle chiamate Supabase. Se l'utente non è autenticato (anonimo senza Turnstile), la chiamata fallirà — ma il flusso attuale richiede sempre autenticazione anonima prima di usare Brain.

---

### I1 — Web Lock per sync multi-tab con fallback

**Obiettivo:** Impedire che due tab eseguano `fullSync` contemporaneamente.

**Problema:** `_syncInProgress` è un flag JS in-memory — ogni tab ha il suo.

**File toccati:**
- `src/lib/sync.js`

**Modifica precisa:**

```js
// Sostituire il pattern _syncInProgress con:

async function acquireSyncLock(fn) {
  // Web Locks API (Chrome 69+, Safari 15.4+, Capacitor WebView: sì)
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('fm-sync', { ifAvailable: true }, async (lock) => {
      if (!lock) {
        console.info('[Sync] Another tab holds the lock, skipping')
        return { skipped: true }
      }
      return fn()
    })
  }

  // Fallback: in-memory flag (single-tab protection)
  if (_syncInProgress) {
    console.info('[Sync] Sync already in progress (fallback lock)')
    return { skipped: true }
  }
  _syncInProgress = true
  try {
    return await fn()
  } finally {
    _syncInProgress = false
  }
}

// Poi in fullSync:
export async function fullSync(familyId, pin) {
  return acquireSyncLock(async () => {
    // ... logica sync esistente ...
  })
}
```

**Test atteso:**
- `sync.test.js`: test che due chiamate concorrenti a `fullSync` non eseguono entrambe (mock `navigator.locks`).

**Rischio regressione:** Basso. Il comportamento è identico al precedente per single-tab. Il fallback garantisce compatibilità con ambienti senza Web Locks.

---

### I4 — CSP come HTTP header

**Obiettivo:** `frame-ancestors 'none'` deve funzionare davvero (ignorato nei meta tag per spec W3C).

**Problema:** La CSP è solo in `<meta>` tag. Su web deployment, clickjacking non è protetto.

**File toccati:**
- Nuovo file: `public/_headers` (Netlify/Cloudflare Pages) oppure `vercel.json` (Vercel)

**Modifica precisa (formato Netlify/Cloudflare Pages `_headers`):**

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://ixmaxjtkievjkqzeepje.supabase.co wss://ixmaxjtkievjkqzeepje.supabase.co https://api.anthropic.com https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

**Nota:** Il meta tag in `vite.config.ts` resta come fallback per Capacitor (dove non ci sono HTTP headers da settare). I due non confliggono — il browser applica la policy più restrittiva.

**Test atteso:**
- Verifica manuale: dopo deploy, `curl -I https://app-url` mostra gli header.
- Se CI/CD su Netlify/Vercel, il file viene incluso automaticamente nella build `dist/`.

**Rischio regressione:** Zero per l'app. Potenziale rottura se un futuro servizio esterno viene aggiunto a connect-src senza aggiornare entrambi i posti (meta tag + _headers).

---

### I5 — Escludere pin_hash da TUTTI i percorsi di uscita dati

**Obiettivo:** `pin_hash` non deve mai lasciare il dispositivo, in nessun percorso.

**Problema attuale:** `pin_hash` è in `SENSITIVE_FIELDS.family` (sincronizzato crittografato) e NON è in `SENSITIVE_FIELDS.members` (sincronizzato in chiaro).

**File toccati:**
- `src/lib/syncCrypto.js` — rimuovere `pin_hash` da SENSITIVE_FIELDS
- `src/lib/sync.js` — escludere `pin_hash` in `pushToCloud`
- `src/lib/backup.js` — escludere `pin_hash` in `exportBackup`

**Modifica precisa:**

In `sync.js`, nella funzione `pushToCloud`, prima di inviare il record:
```js
// Strip pin_hash prima di push
const { pin_hash, ...safeRecord } = record
// usa safeRecord per la chiamata RPC
```

In `backup.js`, nella funzione `exportBackup`, per la tabella `members`:
```js
// Strip pin_hash dall'export
const safeRecords = records.map(({ pin_hash, ...rest }) => rest)
```

In `syncCrypto.js`:
```js
// Rimuovere 'pin_hash' da SENSITIVE_FIELDS.family
// Non serve più: pin_hash non viene sincronizzato affatto
```

**Percorsi verificati:**
- ✅ Push sync → strip in pushToCloud
- ✅ Export backup → strip in exportBackup
- ✅ Pull sync / merge inbound → pin_hash non arriva mai da Supabase (non c'è più)
- ✅ Debug/diagnostica → `nlpLogs` e `debugAnalytics` non toccano mai members
- ✅ Import backup → record senza pin_hash, il PIN va reimpostato dal genitore

**Test atteso:**
- `sync.test.js`: push di un record member non deve contenere `pin_hash` nel payload.
- `backup.test.js` (nuovo): export non contiene `pin_hash`.

**Rischio regressione:** Dopo import backup, i PIN non ci sono → il genitore deve reimpostarli. Questo è il comportamento corretto (il backup è per dati, non per credenziali).

---

### I7 — Validazione backup import robusta

**Obiettivo:** `importBackup` deve validare la struttura dei record e produrre un report di scarto debuggabile.

**Problema:** Oggi fa `bulkAdd(records)` senza controlli. Un backup corrotto o malevolo può inserire record malformati.

**File toccati:**
- `src/lib/backup.js`

**Modifica precisa:**

```js
// Schema minimo per tabella
const REQUIRED_FIELDS = {
  family:       ['id', 'name'],
  members:      ['id', 'family_id', 'name', 'role'],
  expenses:     ['id', 'family_id', 'date', 'amount'],
  events:       ['id', 'family_id', 'date'],
  tasks:        ['id', 'family_id'],
  budgets:      ['id'],
  shoppingItems:['id', 'family_id'],
  inventory:    ['id', 'family_id'],
  meals:        ['id', 'family_id'],
  notifications:['id', 'family_id'],
}

function validateRecords(tableName, records) {
  const required = REQUIRED_FIELDS[tableName]
  if (!required) return { valid: records, rejected: [] }

  const valid = []
  const rejected = []

  for (const record of records) {
    if (!record || typeof record !== 'object') {
      rejected.push({ record, reason: 'not_an_object' })
      continue
    }
    const missing = required.filter(f => record[f] === undefined || record[f] === null)
    if (missing.length > 0) {
      rejected.push({ record, reason: `missing_fields: ${missing.join(', ')}` })
    } else {
      valid.push(record)
    }
  }

  return { valid, rejected }
}

// In importBackup, sostituire il loop bulkAdd con:
const importReport = { imported: 0, rejected: 0, details: [] }

for (const table of tables) {
  const { valid, rejected } = validateRecords(table, data[table])

  if (rejected.length > 0) {
    importReport.rejected += rejected.length
    importReport.details.push({ table, rejected })
    console.warn(`[Backup] ${table}: ${rejected.length} record scartati`, rejected)
  }

  if (valid.length > 0) {
    await db[table].bulkAdd(valid)
    importReport.imported += valid.length
  }
}

console.info(`[Backup] Import completato: ${importReport.imported} importati, ${importReport.rejected} scartati`)
return importReport
```

**Test atteso:**
- Nuovo `backup.test.js`: import con record validi → tutti importati. Import con record senza `id` → scartati. Import misto → report corretto.

**Rischio regressione:** Basso. Record che prima venivano importati silenziosamente con campi mancanti ora vengono scartati. Questo è il comportamento desiderato.

---

## Fase 3 — Test coverage UI + CI/CD

### T1 — Coverage threshold (base iniziale 60%)

**Obiettivo:** Impedire che la copertura cali silenziosamente. 60% è la soglia ponte iniziale, non il target sano. Target sano: 80% entro 3 mesi.

**File toccati:**
- `vitest.config.js`

**Modifica precisa:**
```js
test: {
  // ...config esistente...
  coverage: {
    provider: 'v8',
    reporter: ['text', 'text-summary'],
    thresholds: {
      lines: 60,
      // TODO: alzare a 80% entro Q3 2026
    },
    exclude: [
      'node_modules/**',
      'e2e/**',
      'dist/**',
      '**/*.test.{js,jsx}',
      'src/lib/brain/stressTest.js',
      'src/lib/brain/testBatch.js',
      'src/lib/brain/testMemory.js',
    ],
  },
},
```

**Dipendenza:** `@vitest/coverage-v8` da aggiungere come devDependency.

---

### T2 — CI/CD con GitHub Actions

**Obiettivo:** Ogni push e PR esegue automaticamente unit test + lint. E2E opzionali (richiedono browser).

**File toccati:**
- Nuovo: `.github/workflows/ci.yml`

**Contenuto:**
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx vitest run
      - run: npx vitest run --coverage
```

**Nota:** Playwright E2E non incluso nel CI iniziale (richiede browser install + setup wizard, troppo fragile per CI). Si aggiunge dopo con container dedicato.

---

### T3 — Test unitari per componenti critici

**3 componenti, 3 file test nuovi:**

1. **`src/components/brain/brainSheet.test.jsx`**
   - Renderizza lista azioni dal risultato Brain
   - Bottone "Conferma" chiama `onConfirm` con le azioni
   - Bottone "Rifiuta" chiama `onReject`
   - Mostra summary text

2. **`src/components/tasks/taskCard.test.jsx`**
   - Renderizza titolo, assegnatario, punti, stato
   - Badge "proposta" per task non approvati
   - Click chiama `onSelect`

3. **`src/components/calendar/eventForm.test.jsx`**
   - Renderizza campi: titolo, data, ora, categoria
   - Validazione: titolo vuoto → errore
   - Submit con dati validi chiama `onCreate`

---

### T4 — Accessibility audit leggero

**Obiettivo:** Feedback a11y in console durante lo sviluppo. Zero overhead in produzione.

**File toccati:**
- `src/main.jsx` (o entry point)

**Modifica:**
```js
if (import.meta.env.DEV) {
  import('@axe-core/react').then(({ default: axe }) => {
    import('react-dom').then((ReactDOM) => {
      axe(React, ReactDOM, 1000)
    })
  })
}
```

**Dipendenza:** `@axe-core/react` come devDependency.

---

## Note operative

- **Coverage 60% è base ponte**, non target. Alzare a 80% entro Q3 2026.
- **Import backup senza pin_hash** → i PIN vanno reimpostati. Documentare nel messaggio di import.
- **Edge function dopo deploy** → testare con `curl` senza auth header per confermare 401.
- **`_headers` file** → va nella cartella `public/` per essere copiato in `dist/` durante la build.
