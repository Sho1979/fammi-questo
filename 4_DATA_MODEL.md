# Fammi Questo — Data Model

> Schema entità, record d'esempio, relazioni, invarianti.
> Questo file è il cuore dell'app. Ogni tabella Dexie.js è definita qui.
> Riferimento: `1_MASTER_ARCHITECTURE.md` per vincoli tecnici, `2_PRODUCT_SCOPE_V1.md` per scope per release.
> Ultimo aggiornamento: 14 marzo 2026. Schema Dexie: **v8**.
>
> **Nota:** Questo file documenta le 14 tabelle sincronizzate + le tabelle di supporto. Per le 6 tabelle solo-locali (patterns, nlpDocuments, nlpLogs, conversationDrafts, conflictLog, syncLog), consultare `6_AUDIT_CERVELLONE_NLP.md` §3 che è la fonte di verità per il data model NLP.

---

## Convenzioni generali

### BaseRecord (ereditato da TUTTE le entità tranne `settings`)

```ts
interface BaseRecord {
  id: string;           // crypto.randomUUID()
  family_id: string;    // UUID della famiglia
  created_at: string;   // ISO 8601 con timezone
  updated_at: string;   // ISO 8601 con timezone
  _deleted: boolean;    // tombstone per sync (default: false)
  _version: number;     // incrementale, per conflict resolution LWW
  _device_id: string;   // identifica il device che ha scritto per ultimo
}
```

### Regole sui campi

- **id**: sempre `crypto.randomUUID()`, generato lato client
- **date**: formato `YYYY-MM-DD` per date senza orario (spese, task, meal plan)
- **datetime**: formato ISO 8601 completo `2026-03-06T20:01:48+01:00` per timestamp
- **time**: formato `HH:mm` per orari (eventi calendario)
- **amount**: numero decimale, MAI stringa. Precisione: 2 decimali
- **person references**: usano `member.id` (UUID), mai il nome stringa
- **enums**: definiti in `src/lib/constants.js`, mai hardcoded nei componenti

---

## Constraint Legend

Ogni entità documenta i propri vincoli logici. Anche se Dexie.js non è SQL, questi vincoli devono essere **enforced nel codice applicativo** (nel CRUD helper o nelle funzioni di validazione).

| Simbolo | Significato |
|---------|-------------|
| `PK` | Primary Key — campo univoco, usato come chiave Dexie |
| `UNIQUE` | Vincolo di unicità — enforced a livello applicativo |
| `INDEX` | Indice Dexie — per query performanti |
| `FK →` | Foreign Key logica — referenza a un'altra tabella |
| `NOT NULL` | Campo obbligatorio |
| `CHECK` | Vincolo di dominio — validazione nel CRUD |
| `DEFAULT` | Valore di default se non fornito |

---

## 1. family (R1)

Schema Dexie: `'id'`

**Constraints:**
```
PK:      id
UNIQUE:  id (max 1 record per database locale)
CHECK:   name NOT NULL, length(name) <= 50
CHECK:   family_id === id (self-referencing)
```

```ts
interface Family extends BaseRecord {
  name: string;           // "Famiglia Rossi"
}
```

**Esempio:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Famiglia Rossi",
  "created_at": "2026-03-01T10:00:00+01:00",
  "updated_at": "2026-03-01T10:00:00+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Invarianti:**
- Esiste esattamente 1 record `family` per database locale
- `family.id === family.family_id` (self-referencing)
- `family.name` non vuoto, max 50 caratteri

---

## 2. members (R1)

Schema Dexie: `'id, family_id, role'`

**Constraints:**
```
PK:      id
INDEX:   family_id, role
UNIQUE:  [family_id + name] (no due membri con lo stesso nome nella stessa famiglia)
FK:      family_id → family.id
NOT NULL: name, role, icon, color, access_level
CHECK:   name length > 0 AND <= 50
CHECK:   role IN ("parent", "child", "elder", "other")
CHECK:   access_level IN ("full", "calendar_tasks", "basic", "view_only")
CHECK:   pin_hash NOT NULL IF access_level !== "view_only"
CHECK:   birth_date NOT NULL IF role === "child"
CHECK:   age >= 0
CHECK:   color matches /^#[0-9A-Fa-f]{6}$/
CHECK:   almeno 1 member con role="parent" per famiglia (enforced in UI, non nel CRUD)
DEFAULT: is_active = true
```

```ts
interface Member extends BaseRecord {
  name: string;           // "Cristian", "Asia", "Viola"
  role: MemberRole;       // "parent" | "child" | "elder" | "other"
  age: number;            // calcolato da birth_date, usato per access_level
  birth_date: string;     // "2010-05-15" — formato YYYY-MM-DD
  icon: string;           // emoji avatar "👨" "👧" "👦"
  color: string;          // hex color "#4A90D9"
  pin_hash: string;       // bcrypt hash del PIN
  access_level: AccessLevel; // "full" | "calendar_tasks" | "basic" | "view_only"
  is_active: boolean;     // membro attivo nella famiglia
}

type MemberRole = "parent" | "child" | "elder" | "other";
type AccessLevel = "full" | "calendar_tasks" | "basic" | "view_only";
```

**Esempio:**
```json
{
  "id": "m001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Cristian",
  "role": "parent",
  "age": 40,
  "birth_date": "1985-09-12",
  "icon": "👨",
  "color": "#4A90D9",
  "pin_hash": "$2a$10$...",
  "access_level": "full",
  "is_active": true,
  "created_at": "2026-03-01T10:00:00+01:00",
  "updated_at": "2026-03-01T10:00:00+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

```json
{
  "id": "m003-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Viola",
  "role": "child",
  "age": 12,
  "birth_date": "2013-11-20",
  "icon": "👧",
  "color": "#E91E63",
  "pin_hash": "$2a$10$...",
  "access_level": "basic",
  "is_active": true,
  "created_at": "2026-03-01T10:00:00+01:00",
  "updated_at": "2026-03-01T10:00:00+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Invarianti:**
- Almeno 1 member con `role: "parent"` e `access_level: "full"` per famiglia
- `name` non vuoto, unico all'interno della famiglia
- `access_level` derivato automaticamente da `role` + `age`:
  - parent/elder → `full`
  - child 13-17 → `calendar_tasks`
  - child 6-12 → `basic`
  - child 0-5 → `view_only`
- `pin_hash` obbligatorio per `access_level !== "view_only"`
- `birth_date` obbligatorio per `role === "child"`

---

## 3. expenses (R1)

Schema Dexie: `'id, family_id, date, category, person_id'`

**Constraints:**
```
PK:      id
INDEX:   family_id, date, category, person_id
INDEX:   [family_id + date] (query principale: spese per giorno/mese)
FK:      family_id → family.id
FK:      person_id → members.id (member.is_active === true)
NOT NULL: amount, category, person_id, date
CHECK:   amount > 0
CHECK:   category IN (16 categorie standard — vedi enum ExpenseCategory)
CHECK:   date formato YYYY-MM-DD, date <= oggi
CHECK:   note length <= 200
DEFAULT: note = ""
```

```ts
interface Expense extends BaseRecord {
  amount: number;         // 618.00, 8.99, 20.00 — sempre positivo
  category: ExpenseCategory; // una delle 16 categorie standard
  note: string;           // "Mutuo", "Netflix", "Carne" — descrizione libera
  person_id: string;      // member.id di chi ha sostenuto la spesa
  date: string;           // "2026-03-04" — formato YYYY-MM-DD
}

type ExpenseCategory =
  | "alimentari" | "trasporto" | "bollette" | "affitto"
  | "salute" | "scuola" | "abbigliamento" | "svago"
  | "telefono" | "assicurazione" | "animali" | "casa"
  | "regali" | "viaggi" | "sport" | "altro";
```

**Esempi (basati su dati reali):**
```json
{
  "id": "exp-001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "amount": 618,
  "category": "affitto",
  "note": "Mutuo",
  "person_id": "m001-uuid",
  "date": "2026-03-04",
  "created_at": "2026-03-04T12:00:00+01:00",
  "updated_at": "2026-03-04T12:00:00+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

```json
{
  "id": "exp-002-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "amount": 13.99,
  "category": "svago",
  "note": "Netflix",
  "person_id": "m001-uuid",
  "date": "2026-03-04",
  "created_at": "2026-03-04T12:00:00+01:00",
  "updated_at": "2026-03-04T12:00:00+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

```json
{
  "id": "exp-003-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "amount": 350,
  "category": "scuola",
  "note": "Scuola guida",
  "person_id": "m002-uuid",
  "date": "2026-03-04",
  "created_at": "2026-03-04T12:00:00+01:00",
  "updated_at": "2026-03-04T12:00:00+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Invarianti:**
- `amount > 0` — nessuna spesa negativa
- `category` deve essere una delle 16 categorie standard
- `person_id` deve riferirsi a un `member.id` esistente e attivo
- `date` non può essere nel futuro (max: oggi)
- `note` opzionale, max 200 caratteri

**Nota migrazione dall'app attuale:** l'app esistente usa `person` come stringa nome (es. `"Cristian"`). In Fammi Questo si usa `person_id` come UUID reference a `members.id`. La migrazione richiede un mapping nome → id.

---

## 4. budgets (R1)

Schema Dexie: `'id, family_id, &[category+month]'`

**Constraints:**
```
PK:      id
INDEX:   family_id
UNIQUE:  [family_id + category + month] (enforced da Dexie con &[category+month])
FK:      family_id → family.id
NOT NULL: monthly_amount, month
CHECK:   monthly_amount > 0
CHECK:   month formato YYYY-MM
CHECK:   category IN (16 categorie standard) OR category === null
```

```ts
interface Budget extends BaseRecord {
  monthly_amount: number;   // 3000.00 — importo budget mensile
  category: string | null;  // null = budget globale, altrimenti categoria specifica
  month: string;            // "2026-03" — formato YYYY-MM
}
```

**Esempi:**
```json
{
  "id": "bud-001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "monthly_amount": 3000,
  "category": null,
  "month": "2026-03",
  "created_at": "2026-03-01T10:00:00+01:00",
  "updated_at": "2026-03-01T10:00:00+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

```json
{
  "id": "bud-002-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "monthly_amount": 500,
  "category": "alimentari",
  "month": "2026-03",
  "created_at": "2026-03-01T10:00:00+01:00",
  "updated_at": "2026-03-01T10:00:00+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Invarianti:**
- `monthly_amount > 0`
- Unique constraint: `[category + month]` per famiglia — un solo budget per categoria per mese
- `category: null` indica il budget globale mensile
- `month` formato `YYYY-MM`, non una data completa

---

## 5. events (R2)

Schema Dexie: `'id, family_id, date, person_id'`

**Constraints:**
```
PK:      id
INDEX:   family_id, date, person_id
INDEX:   [family_id + date] (query principale: eventi per giorno/settimana)
FK:      family_id → family.id
FK:      person_id → members.id OR "all"
FK:      accompanied_by → members.id (nullable)
FK:      pickup_by → members.id (nullable)
FK:      created_by → members.id
NOT NULL: title, date, time, person_id, created_by
CHECK:   title length > 0 AND <= 100
CHECK:   time formato HH:mm
CHECK:   duration >= 0
CHECK:   end_date >= date (se end_date !== null)
CHECK:   date formato YYYY-MM-DD
DEFAULT: duration = 0, done = false, end_date = null
```

```ts
interface Event extends BaseRecord {
  title: string;            // "Allenamento pallavolo", "Colloquio prof tecnologia"
  date: string;             // "2026-03-06" — YYYY-MM-DD
  time: string;             // "15:45" — HH:mm
  end_date: string | null;  // null se evento singolo, "2026-03-07" se multi-giorno
  duration: number;         // minuti, 0 = non specificato
  person_id: string;        // member.id di chi è coinvolto (assignedTo)
  accompanied_by: string | null;  // member.id di chi accompagna
  pickup_by: string | null;       // member.id di chi va a prendere
  done: boolean;            // evento completato/passato
  created_by: string;       // member.id di chi ha creato l'evento
}
```

**Esempi (basati su dati reali):**
```json
{
  "id": "evt-001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Viola allenamento",
  "date": "2026-03-06",
  "time": "16:00",
  "end_date": null,
  "duration": 135,
  "person_id": "m003-uuid",
  "accompanied_by": "m002-uuid",
  "pickup_by": "m001-uuid",
  "done": true,
  "created_by": "m001-uuid",
  "created_at": "2026-03-05T22:32:50+01:00",
  "updated_at": "2026-03-06T18:15:00+01:00",
  "_deleted": false,
  "_version": 2,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

```json
{
  "id": "evt-002-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Partita pallavolo a Pisogne",
  "date": "2026-03-08",
  "time": "10:00",
  "end_date": null,
  "duration": 0,
  "person_id": "m003-uuid",
  "accompanied_by": null,
  "pickup_by": null,
  "done": false,
  "created_by": "m001-uuid",
  "created_at": "2026-03-05T13:58:03+01:00",
  "updated_at": "2026-03-05T13:58:03+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Invarianti:**
- `title` non vuoto, max 100 caratteri
- `time` formato `HH:mm` (24h)
- `duration >= 0` (0 = non specificato)
- `person_id` deve riferirsi a un member attivo, oppure valore speciale `"all"` per eventi di famiglia
- `accompanied_by` e `pickup_by` opzionali, devono essere member.id validi se presenti
- `end_date` se presente deve essere `>= date`

---

## 6. tasks (R2)

Schema Dexie: `'id, family_id, due_date, assigned_to, status'` *(cambiato da `date` a `due_date` in v2)*

**Constraints:**
```
PK:      id
INDEX:   family_id, date, assigned_to, status
INDEX:   [family_id + date + assigned_to] (query: task di oggi per persona)
INDEX:   [family_id + status] (query: task in attesa di approvazione)
FK:      family_id → family.id
FK:      assigned_to → members.id
FK:      created_by → members.id
FK:      done_by → members.id (nullable)
FK:      proposed_by → members.id (nullable)
FK:      approved_by → members.id (nullable, must have access_level="full")
NOT NULL: title, icon, category, type, assigned_to, date, created_by, status
CHECK:   title length > 0 AND <= 100
CHECK:   category IN ("pulizia", "personale", "studio", "altro")
CHECK:   type IN ("assigned", "proposed")
CHECK:   status IN ("active", "proposed", "approved", "rejected")
CHECK:   IF type="proposed" THEN proposed_by NOT NULL AND proposed_at NOT NULL
CHECK:   IF status="approved" THEN approved_by NOT NULL AND approved_at NOT NULL
CHECK:   IF done=true THEN done_by NOT NULL AND done_at NOT NULL
CHECK:   date formato YYYY-MM-DD
DEFAULT: done = false, status = "active" (se type="assigned")
```

```ts
interface Task extends BaseRecord {
  title: string;            // "Svuotare lavastoviglie", "apparecchiato"
  icon: string;             // emoji "🍽️", "👕", "🛏️"
  category: TaskCategory;   // "pulizia" | "personale" | "altro"
  type: TaskType;           // "assigned" | "proposed"
  assigned_to: string;      // member.id
  date: string;             // "2026-03-06" — YYYY-MM-DD
  done: boolean;
  done_by: string | null;   // member.id di chi ha completato
  done_at: string | null;   // ISO 8601
  created_by: string;       // member.id
  status: TaskStatus;       // "active" | "proposed" | "approved" | "rejected"
  proposed_by: string | null;   // member.id (se type === "proposed")
  proposed_at: string | null;   // ISO 8601
  approved_by: string | null;   // member.id del genitore che approva
  approved_at: string | null;   // ISO 8601
}

type TaskCategory = "pulizia" | "personale" | "studio" | "altro";
type TaskType = "assigned" | "proposed";
type TaskStatus = "active" | "proposed" | "approved" | "rejected";
```

**Esempi (basati su dati reali):**

Task proposto da figlio e approvato:
```json
{
  "id": "tsk-001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Svuotato lavastoviglie",
  "icon": "🍽️",
  "category": "altro",
  "type": "proposed",
  "assigned_to": "m003-uuid",
  "date": "2026-03-06",
  "done": true,
  "done_by": "m003-uuid",
  "done_at": "2026-03-06T20:02:14+01:00",
  "created_by": "m003-uuid",
  "status": "approved",
  "proposed_by": "m003-uuid",
  "proposed_at": "2026-03-06T20:02:01+01:00",
  "approved_by": "m001-uuid",
  "approved_at": "2026-03-06T20:02:14+01:00",
  "created_at": "2026-03-06T20:02:01+01:00",
  "updated_at": "2026-03-06T20:02:14+01:00",
  "_deleted": false,
  "_version": 3,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

Task proposto in attesa di approvazione:
```json
{
  "id": "tsk-002-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Distribuito vestiti su",
  "icon": "👕",
  "category": "altro",
  "type": "proposed",
  "assigned_to": "m003-uuid",
  "date": "2026-03-06",
  "done": false,
  "done_by": null,
  "done_at": null,
  "created_by": "m003-uuid",
  "status": "proposed",
  "proposed_by": "m003-uuid",
  "proposed_at": "2026-03-06T21:25:59+01:00",
  "approved_by": null,
  "approved_at": null,
  "created_at": "2026-03-06T21:25:59+01:00",
  "updated_at": "2026-03-06T21:25:59+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Invarianti:**
- `title` non vuoto, max 100 caratteri
- `assigned_to` deve essere un member.id attivo
- Se `type === "proposed"`: `proposed_by` e `proposed_at` obbligatori
- Se `status === "approved"`: `approved_by` e `approved_at` obbligatori, `approved_by` deve avere `access_level: "full"`
- Se `done === true`: `done_by` e `done_at` obbligatori
- Un task `proposed` non conta per i rewards finché non è `approved`
- `status` lifecycle: `proposed → approved/rejected` (se proposed), `active` (se assigned direttamente)

---

## 7. taskTemplates (R2)

Schema Dexie: `'id, family_id'`

**Constraints:**
```
PK:      id
INDEX:   family_id
UNIQUE:  [family_id + title] (no due template con lo stesso titolo)
FK:      family_id → family.id
FK:      assigned_to → members.id (nullable)
NOT NULL: title, icon, category, recurrence
CHECK:   title length > 0 AND <= 100
CHECK:   category IN ("pulizia", "personale", "studio", "altro")
CHECK:   recurrence IN ("daily", "weekly", "weekdays")
```

```ts
interface TaskTemplate extends BaseRecord {
  title: string;            // "Rifare il letto"
  icon: string;             // "🛏️"
  category: TaskCategory;
  recurrence: Recurrence;   // "daily" | "weekly" | "weekdays"
  assigned_to: string | null; // null = rotazione o da assegnare
}

type Recurrence = "daily" | "weekly" | "weekdays";
```

**Esempi (8 template predefiniti):**
```json
{
  "id": "tmpl-001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Rifare il letto",
  "icon": "🛏️",
  "category": "personale",
  "recurrence": "daily",
  "assigned_to": null,
  "created_at": "2026-03-01T10:00:00+01:00",
  "updated_at": "2026-03-01T10:00:00+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Template predefiniti (seed al setup):**

| title | icon | category | recurrence |
|-------|------|----------|------------|
| Rifare il letto | 🛏️ | personale | daily |
| Svuotare lavastoviglie | 🍽️ | pulizia | daily |
| Caricare lavastoviglie | 🫧 | pulizia | daily |
| Piegare vestiti | 👕 | pulizia | daily |
| Far partire Roomba | 🤖 | pulizia | daily |
| Apparecchiare tavola | 🍴 | pulizia | daily |
| Sparecchiare tavola | 🧹 | pulizia | daily |
| Spazzatura | 🗑️ | pulizia | daily |

**Invarianti:**
- `title` non vuoto, unico per famiglia
- `assigned_to` se presente deve essere un member.id attivo; se null = da assegnare ogni giorno
- La generazione task da template avviene all'avvio app: per ogni template con `recurrence === "daily"`, se non esiste un task per oggi con lo stesso `title`, creane uno con `status: "active"`

---

## 8. meals (R3)

Schema Dexie: `'id, family_id'`

**Constraints:**
```
PK:      id
INDEX:   family_id
UNIQUE:  [family_id + name] (no due piatti con lo stesso nome)
FK:      family_id → family.id
NOT NULL: name, prep_time, difficulty, tags
CHECK:   name length > 0 AND <= 100
CHECK:   prep_time > 0
CHECK:   difficulty IN ("facile", "medio", "difficile")
CHECK:   tags.length >= 1
CHECK:   last_served formato YYYY-MM-DD (se non null)
DEFAULT: last_served = null
```

```ts
interface Meal extends BaseRecord {
  name: string;           // "Pasta al pomodoro", "Carbonara"
  prep_time: number;      // minuti di preparazione
  difficulty: Difficulty;  // "facile" | "medio" | "difficile"
  tags: string[];         // ["primo", "pasta"], ["secondo", "carne"]
  last_served: string | null;  // "2026-03-01" — ultima volta servito
}

type Difficulty = "facile" | "medio" | "difficile";
```

**Esempi (basati su dati reali):**
```json
{
  "id": "meal-001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Carbonara",
  "prep_time": 25,
  "difficulty": "medio",
  "tags": ["primo", "pasta"],
  "last_served": null,
  "created_at": "2026-03-05T00:00:00+01:00",
  "updated_at": "2026-03-05T00:00:00+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**15 piatti predefiniti (seed al setup):**

| name | prep_time | difficulty | tags |
|------|-----------|------------|------|
| Pasta al pomodoro | 20 | facile | primo, pasta |
| Cotoletta con patatine | 30 | facile | secondo, carne |
| Risotto alla milanese | 35 | medio | primo, riso |
| Pizza fatta in casa | 60 | medio | unico, pizza |
| Insalatona mista | 15 | facile | leggero, verdure |
| Penne all'arrabbiata | 20 | facile | primo, pasta |
| Pollo alla griglia con verdure | 30 | facile | secondo, carne |
| Pasta al pesto | 15 | facile | primo, pasta |
| Hamburger con insalata | 25 | facile | secondo, carne |
| Lasagna al ragù | 90 | difficile | primo, pasta, forno |
| Pesce al forno con patate | 40 | medio | secondo, pesce |
| Carbonara | 25 | medio | primo, pasta |
| Minestrone | 45 | facile | primo, verdure, zuppa |
| Spaghetti aglio olio e peperoncino | 15 | facile | primo, pasta |
| Frittata con verdure | 20 | facile | secondo, uova |

**Invarianti:**
- `name` non vuoto, unico per famiglia, max 100 caratteri
- `prep_time > 0`
- `tags` array non vuoto, almeno 1 tag
- `difficulty` deve essere uno dei 3 valori enum

---

## 9. mealPlans (R3)

Schema Dexie: `'id, family_id, date'`

**Constraints:**
```
PK:      id
INDEX:   family_id, date
UNIQUE:  [family_id + date + slot] (un solo piatto per slot per giorno)
FK:      family_id → family.id
FK:      meal_id → meals.id
FK:      created_by → members.id
FK:      votes[].member_id → members.id
NOT NULL: date, slot, meal_id, created_by
CHECK:   slot IN ("pranzo", "cena")
CHECK:   date formato YYYY-MM-DD
CHECK:   votes[].value IN (0, 1)
CHECK:   votes[].member_id unico per array (un voto per persona)
DEFAULT: votes = []
```

```ts
interface MealPlan extends BaseRecord {
  date: string;           // "2026-03-06" — YYYY-MM-DD
  slot: MealSlot;         // "pranzo" | "cena"
  meal_id: string;        // riferimento a meals.id
  votes: Vote[];          // voti dei membri
  created_by: string;     // member.id
}

type MealSlot = "pranzo" | "cena";

interface Vote {
  member_id: string;
  value: number;          // 1-5 stelle, oppure 👍/👎 (1 o 0)
  voted_at: string;       // ISO 8601
}
```

**Esempio:**
```json
{
  "id": "mp-001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "date": "2026-03-07",
  "slot": "cena",
  "meal_id": "meal-001-uuid",
  "votes": [
    { "member_id": "m001-uuid", "value": 1, "voted_at": "2026-03-06T20:00:00+01:00" },
    { "member_id": "m003-uuid", "value": 0, "voted_at": "2026-03-06T20:05:00+01:00" }
  ],
  "created_by": "m001-uuid",
  "created_at": "2026-03-06T19:00:00+01:00",
  "updated_at": "2026-03-06T20:05:00+01:00",
  "_deleted": false,
  "_version": 3,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Invarianti:**
- Unique: `[date + slot]` per famiglia — un solo piatto per slot per giorno
- `meal_id` deve riferirsi a un `meals.id` esistente
- `votes[].member_id` unico per meal plan (un voto per persona)
- `votes[].value` è 0 (👎) o 1 (👍)

---

## 10. shoppingItems (R3)

Schema Dexie: `'id, family_id, checked'` *(cambiato da `bought` a `checked` in v2)*

**Constraints:**
```
PK:      id
INDEX:   family_id, bought
INDEX:   [family_id + bought] (query: lista spesa non comprata)
FK:      family_id → family.id
FK:      added_by → members.id
NOT NULL: name, category, added_by
CHECK:   name length > 0 AND <= 100
CHECK:   category IN (13 categorie shopping — vedi enum ShoppingCategory)
DEFAULT: quantity = "", bought = false, urgent = false
```

```ts
interface ShoppingItem extends BaseRecord {
  name: string;           // "Birre", "formaggio grattugiato"
  quantity: string;       // "" (non specificato), "1", "500g", "2 pacchi"
  category: ShoppingCategory;
  added_by: string;       // member.id
  bought: boolean;
  urgent: boolean;
}

type ShoppingCategory =
  | "frutta_verdura" | "carne" | "pesce" | "latticini"
  | "pane" | "pasta_riso" | "surgelati" | "bevande"
  | "dolci" | "condimenti" | "pulizia" | "igiene"
  | "altro";
```

**Esempi (basati su dati reali):**
```json
{
  "id": "shop-001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Birre",
  "quantity": "",
  "category": "bevande",
  "added_by": "m001-uuid",
  "bought": false,
  "urgent": false,
  "created_at": "2026-03-06T20:08:42+01:00",
  "updated_at": "2026-03-06T20:08:42+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

```json
{
  "id": "shop-002-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "formaggio grattugiato",
  "quantity": "",
  "category": "latticini",
  "added_by": "m003-uuid",
  "bought": false,
  "urgent": false,
  "created_at": "2026-03-06T20:19:14+01:00",
  "updated_at": "2026-03-06T20:19:14+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Invarianti:**
- `name` non vuoto, max 100 caratteri
- `quantity` stringa libera (non numerico puro — l'utente scrive "2 pacchi", "500g", ecc.)
- `added_by` deve essere un member.id attivo
- Gli item con `bought: true` restano visibili fino a fine giornata, poi vengono marcati `_deleted`

---

## 11. inventory (R3)

Schema Dexie: `'id, family_id, expiry_date'` *(cambiato da `expires_at` a `expiry_date` in v2)*

**Constraints:**
```
PK:      id
INDEX:   family_id, expires_at
INDEX:   [family_id + expires_at] (query: prodotti in scadenza)
FK:      family_id → family.id
FK:      added_by → members.id
NOT NULL: name, quantity, expires_at, source, added_by
CHECK:   name length > 0 AND <= 100
CHECK:   price >= 0
CHECK:   expires_at formato YYYY-MM-DD
CHECK:   source IN ("manuale", "shopping", "brain")
DEFAULT: category = "", quantity = "1", price = 0, store = ""
```

```ts
interface InventoryItem extends BaseRecord {
  name: string;           // "tortelli di zucca", "yogurt"
  category: string;       // libero, non enum — l'utente categorizza come vuole
  quantity: string;       // "1", "2", "3" — stringa per flessibilità
  price: number;          // 0 se non noto
  expires_at: string;     // "2026-04-05" — YYYY-MM-DD
  source: InventorySource;
  store: string;          // "" se non specificato, altrimenti "Conad", "Esselunga"
  added_by: string;       // member.id
}

type InventorySource = "manuale" | "shopping" | "brain";
```

**Esempi (basati su dati reali):**
```json
{
  "id": "inv-001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "tortelli di zucca",
  "category": "",
  "quantity": "1",
  "price": 0,
  "expires_at": "2026-04-05",
  "source": "manuale",
  "store": "",
  "added_by": "m003-uuid",
  "created_at": "2026-03-06T20:37:51+01:00",
  "updated_at": "2026-03-06T20:37:51+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Invarianti:**
- `name` non vuoto, max 100 caratteri
- `quantity` stringa, default "1"
- `price >= 0` (0 = non specificato)
- `expires_at` deve essere una data valida YYYY-MM-DD
- Alert scadenza: mostrato se `expires_at <= oggi + 3 giorni`
- `added_by` deve essere un member.id attivo

---

## 12. rewards (R2)

Schema Dexie: `'id, family_id, member_id, week_start'`

**Constraints:**
```
PK:      id
INDEX:   family_id, member_id, week_start
UNIQUE:  [family_id + member_id + week_start] (un solo reward per membro per settimana)
FK:      family_id → family.id
FK:      member_id → members.id
NOT NULL: member_id, week_start, tasks_completed, tasks_total, percentage
CHECK:   week_start è un lunedì (dayOfWeek === 1)
CHECK:   week_start formato YYYY-MM-DD
CHECK:   tasks_completed >= 0 AND <= tasks_total
CHECK:   tasks_total >= 0
CHECK:   percentage = Math.round((tasks_completed / tasks_total) * 100) — oppure 0 se total=0
DEFAULT: prize = "", prize_claimed = false
```

```ts
interface Reward extends BaseRecord {
  member_id: string;        // member.id del figlio
  week_start: string;       // "2026-03-03" — lunedì della settimana, YYYY-MM-DD
  tasks_completed: number;  // conteggio task completati (solo approved)
  tasks_total: number;      // conteggio task totali assegnati
  percentage: number;       // (completed / total) * 100, arrotondato
  prize: string;            // "30 minuti extra videogiochi", configurabile dal genitore
  prize_claimed: boolean;
}
```

**Esempio:**
```json
{
  "id": "rew-001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "member_id": "m003-uuid",
  "week_start": "2026-03-03",
  "tasks_completed": 12,
  "tasks_total": 14,
  "percentage": 86,
  "prize": "30 min extra tablet",
  "prize_claimed": false,
  "created_at": "2026-03-03T00:00:00+01:00",
  "updated_at": "2026-03-06T20:03:18+01:00",
  "_deleted": false,
  "_version": 12,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Invarianti:**
- Unique: `[member_id + week_start]` — un solo record reward per membro per settimana
- `week_start` deve essere un lunedì
- `percentage = Math.round((tasks_completed / tasks_total) * 100)` — ricalcolato ad ogni task completion
- `tasks_completed` conta solo task con `status === "approved"` e `done === true`
- `prize` configurabile dal genitore in Settings, default vuoto
- `prize_claimed` toggle manuale del genitore

---

## 13. notifications (R2)

Schema Dexie: `'id, family_id, member_id, read'` *(aggiunto indice `member_id` in v3)*

**Constraints:**
```
PK:      id
INDEX:   family_id, read
INDEX:   [family_id + target_member_id + read] (query: notifiche non lette per membro)
FK:      family_id → family.id
FK:      target_member_id → members.id
FK:      related_id → [related_table].id (nullable, polimorphic FK)
NOT NULL: type, title, body, target_member_id
CHECK:   type IN (8 tipi — vedi enum NotifType)
CHECK:   title length > 0 AND <= 100
CHECK:   IF related_id NOT NULL THEN related_table NOT NULL
CHECK:   related_table IN ("tasks", "events", "inventory", "rewards", "sync_blobs") se non null
DEFAULT: read = false, related_id = null, related_table = null
```

```ts
interface Notification extends BaseRecord {
  type: NotifType;
  title: string;            // "Viola ha proposto un task"
  body: string;             // "Svuotato lavastoviglie — in attesa di approvazione"
  target_member_id: string; // member.id del destinatario
  related_id: string | null;     // id dell'entità collegata (task, event, ecc.)
  related_table: string | null;  // "tasks", "events", ecc.
  read: boolean;
}

type NotifType =
  | "task_proposed"    // figlio propone task
  | "task_approved"    // genitore approva task
  | "task_rejected"    // genitore rifiuta task
  | "task_completed"   // qualcuno completa un task
  | "reward_earned"    // raggiunto premio settimanale
  | "event_reminder"   // promemoria evento
  | "expiry_alert"     // prodotto in scadenza
  | "sync_conflict";   // conflitto sync risolto
```

**Esempio:**
```json
{
  "id": "notif-001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "task_proposed",
  "title": "Viola ha proposto un task",
  "body": "Svuotato lavastoviglie — in attesa di approvazione",
  "target_member_id": "m001-uuid",
  "related_id": "tsk-001-uuid",
  "related_table": "tasks",
  "read": false,
  "created_at": "2026-03-06T20:02:01+01:00",
  "updated_at": "2026-03-06T20:02:01+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Invarianti:**
- `target_member_id` deve essere un member.id attivo
- `type` deve essere uno dei valori enum
- Le notifiche non lette sono mostrate come badge nel Header
- GC: notifiche lette e più vecchie di 30 giorni vengono marcate `_deleted`

---

## 14. recurrences (R3)

Schema Dexie: `'id, family_id, type'`

**Constraints:**
```
PK:      id
INDEX:   family_id, type
INDEX:   [family_id + next_run + active] (query: ricorrenze da eseguire all'avvio)
FK:      family_id → family.id
FK:      source_id → expenses.id (se type="expense") OPPURE events.id (se type="event")
NOT NULL: type, source_id, frequency, next_run
CHECK:   type IN ("expense", "event")
CHECK:   frequency IN ("weekly", "monthly", "yearly")
CHECK:   IF frequency="monthly" THEN day_of_month NOT NULL AND day_of_month 1-28
CHECK:   IF frequency="weekly" THEN day_of_week NOT NULL AND day_of_week 0-6
CHECK:   next_run formato YYYY-MM-DD
DEFAULT: active = true
```

```ts
interface Recurrence extends BaseRecord {
  type: "expense" | "event";
  source_id: string;        // id del record originale (expense o event)
  frequency: RecurrenceFreq;
  day_of_month: number | null;  // 1-28 per "monthly"
  day_of_week: number | null;   // 0-6 (dom-sab) per "weekly"
  next_run: string;         // "2026-04-15" — prossima generazione
  active: boolean;
}

type RecurrenceFreq = "weekly" | "monthly" | "yearly";
```

**Esempio:**
```json
{
  "id": "rec-001-uuid",
  "family_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "expense",
  "source_id": "exp-001-uuid",
  "frequency": "monthly",
  "day_of_month": 15,
  "day_of_week": null,
  "next_run": "2026-04-15",
  "active": true,
  "created_at": "2026-03-04T12:00:00+01:00",
  "updated_at": "2026-03-04T12:00:00+01:00",
  "_deleted": false,
  "_version": 1,
  "_device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef"
}
```

**Invarianti:**
- `source_id` deve riferirsi a un record esistente nella tabella corrispondente a `type`
- `day_of_month` obbligatorio e 1-28 se `frequency === "monthly"` (28 max per evitare problemi con febbraio)
- `day_of_week` obbligatorio e 0-6 se `frequency === "weekly"`
- La generazione avviene all'avvio app: se `next_run <= oggi` e `active === true`, genera il record e aggiorna `next_run`

---

## 15. Tabelle solo-locali NLP (v4-v8)

> Queste tabelle NON vengono sincronizzate. Documentazione dettagliata in `6_AUDIT_CERVELLONE_NLP.md` §3.

### patterns (v4)

Schema Dexie: `'id, family_id, keyword, actionType, score'`

Sinapsi apprese dalla pipeline NLP L2. Contiene sia le sinapsi bootstrap (~85, da `patterns.js`) che quelle apprese dall'utente tramite il learning engine.

### nlpDocuments (v5)

Schema Dexie: `'id, family_id, intent'`

Documenti di training aggiunti dall'utente per migliorare la classificazione NLP.js (L1).

### nlpLogs (v6)

Schema Dexie: `'id, family_id, created_at, result_intent, confidence, used_ai'`

Log di ogni operazione di parsing per debug e analisi. Visualizzabile in `BrainDebugPage`.

### conversationDrafts (v7)

Schema Dexie: `'id, [family_id+created_by+status], status, created_at'`

Draft per la conversation memory multi-turno. Un solo draft attivo per autore.

### conflictLog (v8)

Schema Dexie: `'++id, family_id, table_name, record_id, resolved_at'`

Log dei conflitti di sync risolti, con dettaglio local vs remote.

---

## 16. Tabelle di supporto

### syncLog

Schema Dexie: `'++id, table_name, record_id, synced'`

**Constraints:**
```
PK:      id (auto-increment)
INDEX:   table_name, record_id, synced
INDEX:   [synced] (query: pending da pushare, WHERE synced=0)
NOT NULL: table_name, record_id, action, synced
CHECK:   action IN ("upsert")
CHECK:   synced IN (0, 1)
DEFAULT: synced = 0
```

```ts
interface SyncLogEntry {
  id?: number;            // auto-increment
  table_name: string;     // "expenses", "tasks", ecc.
  record_id: string;      // UUID del record modificato
  action: "upsert";       // per ora solo upsert (tombstone = upsert con _deleted)
  synced: number;         // 0 = pending, 1 = synced
}
```

Non ha BaseRecord. Non viene sincronizzata.

### settings

Schema Dexie: `'key'`

**Constraints:**
```
PK:      key
UNIQUE:  key
NOT NULL: key, value
CHECK:   key IN (chiavi note — vedi tabella sotto)
```

```ts
interface Setting {
  key: string;
  value: any;
}
```

**Chiavi note:**

| key | value type | descrizione |
|-----|-----------|-------------|
| `device_secret` | string (hex) | 32 bytes random, per crypto |
| `device_id` | string (UUID) | identità del device |
| `last_sync` | string (ISO 8601) | timestamp ultimo pull riuscito |
| `last_gc_run` | string (ISO 8601) | timestamp ultimo garbage collection |
| `sync_enabled` | boolean | toggle sync cloud |
| `current_member_id` | string (UUID) | membro attualmente loggato |
| `weekly_prize` | string | premio settimanale configurato |

Non ha BaseRecord. Non viene sincronizzata (è specifica per device).

---

## Diagramma relazioni

```
family (1)
  ├── members (N)
  │     ├── expenses.person_id (N)
  │     ├── events.person_id / .accompanied_by / .pickup_by / .created_by (N)
  │     ├── tasks.assigned_to / .done_by / .created_by / .proposed_by / .approved_by (N)
  │     ├── rewards.member_id (N per settimana)
  │     ├── shoppingItems.added_by (N)
  │     ├── inventory.added_by (N)
  │     ├── notifications.target_member_id (N)
  │     └── mealPlans.created_by / .votes[].member_id (N)
  │
  ├── expenses (N)
  │     └── recurrences.source_id (0..1)
  │
  ├── budgets (N per mese)
  │
  ├── events (N)
  │     └── recurrences.source_id (0..1)
  │
  ├── tasks (N)
  │     └── taskTemplates → genera tasks (daily)
  │
  ├── taskTemplates (N)
  │
  ├── meals (N)
  │     └── mealPlans.meal_id (N)
  │
  ├── mealPlans (N)
  │
  ├── shoppingItems (N)
  │
  ├── inventory (N)
  │
  ├── rewards (N)
  │
  ├── notifications (N)
  │
  └── recurrences (N)
```

---

## Regole globali

1. **Nessun DELETE reale.** Tutte le eliminazioni passano per tombstone (`_deleted: true`). GC dopo 30 giorni.

2. **Ogni write incrementa `_version`.** Il CRUD helper lo fa automaticamente.

3. **`family_id` è su ogni record.** Anche se c'è una sola famiglia per database locale. Serve per la sync e per il backup.

4. **References sono UUID, mai stringhe nome.** L'app attuale usa nomi come "Cristian", "Viola". Fammi Questo usa `member.id`.

5. **Nessun campo calcolato persistito** tranne `rewards.percentage` (che è un cache del calcolo per performance nella leaderboard).

6. **Dates vs Datetimes:** `date` (YYYY-MM-DD) per campi che rappresentano un giorno (spese, task, meal plan). ISO 8601 completo per timestamp di sistema (`created_at`, `updated_at`, `done_at`, ecc.).

7. **Campi opzionali: `null`, non `undefined`.** Dexie.js non indicizza `undefined`, quindi i campi opzionali devono essere esplicitamente `null`.
