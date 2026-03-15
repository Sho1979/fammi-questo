# Fammi Questo — Build Order per Cursor

> Istruzioni operative. Niente teoria, solo passi.
> Leggi `1_MASTER_ARCHITECTURE.md` per capire il PERCHÉ.
> Leggi `2_PRODUCT_SCOPE_V1.md` per capire il COSA.
> Questo file dice il COME e in che ORDINE.
> Ultimo aggiornamento: 15 marzo 2026.

---

## Stato completamento (15 marzo 2026)

| Blocco | Step | Stato |
|--------|------|-------|
| R1: BLOCCO 0-10 | Step 0.1 → 10.3 | ✅ COMPLETATO |
| R2: Step 11-30 | Step 11 → 30 | ✅ COMPLETATO |
| R3: Step 31-56 | Step 31 → 56 | 🔶 PARZIALE — vedi note sotto |
| Sprint 1-4 | Contratto canonico + UX | ✅ COMPLETATO (82 test) |
| R4: React 19 + Security | useOptimistic, useActionState, CAPTCHA | ✅ COMPLETATO (14 Mar 2026) |
| R6: Cross-platform iOS | Capacitor iOS, CI/CD, UI cross-platform | ✅ COMPLETATO (15 Mar 2026) |

**Step R3 non completati:**
- Step 32: `supabase-migration-v2.sql` non eseguita
- Step 34: `syncEngine.js` non esiste (la sync è in `sync.js` con modello per-table, non blob)
- Step 36: integrazione syncEngine nei CRUD non usa syncLog per push (push diretto per-table)
- Step 48: Edge function brain-parse non deployata (codice esiste)
- Step 54: Deploy su Vercel non fatto
- Step 55: Test su dispositivi fisici non completato

**Step R5 completati (14 marzo 2026) — Rebrand:**
- Rebrand completo: Family Manager → Fammi Questo (`com.fammiquesto.app`)
- Logo Voice Ripple: `public/logo.svg`, `public/logo-white.svg`, `public/logo-header.svg`
- Header aggiornato con logo pill (icona + wordmark in contenitore arrotondato)
- Favicon aggiornato da `vite.svg` a `logo.svg`
- Brand book Canva (5 slide) + slide Cervellone (`brand/cervellone-slide.png`)
- Tutti i config (capacitor, package.json, vite, Android gradle/strings/manifest) aggiornati
- 14+ file .md e sorgenti aggiornati al nuovo nome

**Step R4 completati (14 marzo 2026):**
- `useSync.js`: hook React 19 con `useOptimistic` + `useTransition` per sync con feedback istantaneo
- `useOptimisticList.js`: wrapper generico per liste Dexie con update/remove/add ottimistici
- `useFormAction.js`: wrapper `useActionState` per form (espone `isPending` + `formState`)
- `ExpenseForm.jsx`: migrato da `useState(saving)/useState(error)` a `useValidatedFormAction`
- `ShoppingPage.jsx`: toggle e delete con `useOptimisticList` (feedback istantaneo)
- `SettingsPage.jsx`: sync con `useSync` (stato ottimistico, auto-reset, last sync timestamp)
- `supabase.js`: Cloudflare Turnstile CAPTCHA invisibile su `ensureAuth()` (opzionale)
- `index.html`: script Turnstile CDN
- `.env.example`: documentazione `VITE_TURNSTILE_SITE_KEY`
- `vite.config.ts`: React Compiler valutato, config ready-to-switch documentata

**Step R6 completati (15 marzo 2026) — Cross-platform iOS:**
- `npm install @capacitor/ios` + `npx cap add ios` → cartella `ios/` con progetto Xcode
- `capacitor.config.ts`: aggiunta sezione `ios` (backgroundColor, contentInset, scheme)
- `package.json`: aggiunti script `cap:sync:ios`, `cap:sync:android`, `cap:open:ios`, `cap:sync` (entrambi)
- `.gitignore`: aggiunte esclusioni per iOS/Xcode, Android build artifacts
- `.github/workflows/build-ios.yml`: build automatico Android + iOS ad ogni push su main
- `.github/workflows/release-ios.yml`: workflow manuale per release App Store con firma Apple
- `scripts/setup-ios.sh`: script one-shot per aggiungere piattaforma iOS
- `SETUP_IOS.md`: guida completa passo passo
- `index.html`: `viewport-fit=cover`, meta Apple status bar
- `src/main.jsx`: classi `plt-ios`/`plt-android`/`plt-web` su `<html>`, viewport-fit iOS
- `src/index.css`: blocco cross-platform completo (safe areas, touch feedback, no-bounce, input zoom fix)
- `src/lib/platform.js`: rilevamento piattaforma (isIOS, isAndroid, isNative, isWeb)
- `src/lib/haptics.js`: haptic feedback cross-platform via navigator.vibrate
- `src/hooks/useKeyboard.js`: rilevamento tastiera via visualViewport
- `src/hooks/useBackButton.js`: back button Android via popstate
- `src/hooks/useStatusBar.js`: stile status bar via meta tag theme-color
- `AppShell.jsx`: layout adattivo (height fixata iOS, momentum scroll, keyboard aware)
- `Header.jsx`: integrazione useStatusBar + haptic feedback su pulsanti
- `BottomNav.jsx`: nascosta quando tastiera aperta + haptic feedback sui tab
- `VoiceButton.jsx`: posizionamento dinamico safe area + haptic al tap
- `Modal.jsx`: max height con 100dvh + safe areas
- `Toast.jsx`: posizionamento adattivo iOS safe area
- `ConfirmDialog.jsx`: haptic feedback su conferma/annulla

---

## Regole per Cursor

1. **Segui l'ordine.** Non saltare step. Non anticipare feature.
2. **Data model prima di tutto.** Prima crei i modelli, poi i CRUD helper, poi gli hook, poi i componenti, poi le pagine.
3. **Ogni step produce qualcosa di testabile.** Se non puoi verificarlo, non andare avanti.
4. **Zero logica di persistenza nei componenti.** I componenti chiamano hook o funzioni da `src/lib/`. Mai `db.table()` dentro un .jsx.
5. **Solo librerie autorizzate** (vedi MASTER_ARCHITECTURE sezione 2).
6. **Interfaccia in italiano, codice in inglese.**
7. **Mobile-first.** Larghezza base: 375px.
8. **Tailwind only.** Nessun file CSS custom.

---

## Subagent Team

| Subagent | Ruolo | Responsabilità principali |
|----------|-------|--------------------------|
| `@tech-lead` | Orchestratore | Pianifica, decompone task, coordina, review finale |
| `@frontend-dev` | Frontend Developer | Componenti React, pagine, UI/UX, Tailwind, routing |
| `@data-engineer` | Data Engineer | Schema Dexie, query, CRUD, migrazioni, crittografia, sync |
| `@qa-tester` | QA Engineer | Test unitari, test integrazione, conformity review |

### Regole di assegnazione
- **`@tech-lead`** avvia ogni BLOCCO: legge lo step, decompone, assegna ai subagent
- **`@data-engineer`** lavora PRIMA su schema e CRUD (dipendenza per il frontend)
- **`@frontend-dev`** lavora DOPO il data layer (usa hook e servizi già pronti)
- **`@qa-tester`** interviene DOPO ogni step: scrive test e verifica conformità
- Dove possibile, `@data-engineer` e `@frontend-dev` lavorano in **parallelo** su task indipendenti

---

## RELEASE 1 — Build Order

### BLOCCO 0: Progetto e tooling

```
STEP 0.1  @tech-lead → Crea progetto
          $ npm create vite@latest family-manager -- --template react
          $ cd family-manager && npm install

STEP 0.2  @tech-lead → Installa dipendenze
          $ npm install dexie dexie-react-hooks zustand react-router-dom lucide-react recharts bcryptjs
          $ npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa

STEP 0.3  @frontend-dev → Configura vite.config.js
          - plugin: react, tailwindcss, VitePWA
          - alias: '@' → '/src'
          - PWA: manifest con name "Fammi Questo", theme_color "#6C5CE7"
          - Vedi MASTER_ARCHITECTURE per dettagli manifest

STEP 0.4  @frontend-dev → Configura index.css
          - Solo: @import 'tailwindcss';

STEP 0.5  @tech-lead → Crea .gitignore (node_modules, dist, .env.local, *.sqlite)
          Crea .env.example (vuoto per ora, niente Supabase in R1)

STEP 0.6  @qa-tester → VERIFICA: $ npm run dev → pagina Vite default si apre → OK
```

### BLOCCO 1: Data layer

```
STEP 1.1  @data-engineer → Crea src/lib/localDb.js
          → Schema Dexie.js completo (TUTTE le tabelle, anche quelle vuote per R2/R3)
          → Vedi MASTER_ARCHITECTURE sezione 3.4 per lo schema esatto

STEP 1.2  @data-engineer → Crea src/lib/crud.js
          → createRecord(table, data): genera id, timestamps, _version, _device_id
          → updateRecord(table, id, changes): incrementa _version, aggiorna updated_at
          → deleteRecord(table, id): tombstone (_deleted = true)
          → getRecord(table, id): legge da Dexie
          → Vedi MASTER_ARCHITECTURE sezione 8.3 per il codice

STEP 1.3  @data-engineer → Crea src/lib/constants.js
          → DEFAULT_CATEGORIES: array di {id, label, icon, color} — 16 categorie
          → ROLE_ICONS, MEMBER_COLORS
          → ACCESS_BY_AGE(age): ritorna access_level
          → NAV_TABS: mappa access_level → tab visibili
          → TASK_CATEGORIES (per R2, definisci già)

STEP 1.4  @frontend-dev → Crea src/lib/dates.js
          → formatDate(isoString): "6 marzo 2026"
          → formatDateShort(isoString): "6 mar"
          → formatWeekday(isoString): "Venerdì"
          → getMonthRange(yyyy_mm): {start, end}
          → getWeekRange(date): {monday, sunday}
          → isToday(isoString): boolean
          → Tutto in italiano. Usare date-fns/locale/it se necessario, altrimenti manuale.

STEP 1.5  @frontend-dev → Crea src/lib/format.js
          → formatCurrency(amount): "€ 45,50"
          → formatPercent(value): "73%"

STEP 1.6  @qa-tester → VERIFICA: nel browser console:
          import { db } from './lib/localDb';
          await db.expenses.add({id: 'test', family_id: 'f1', amount: 10, ...});
          await db.expenses.toArray(); // deve ritornare il record
          → Scrivi test per localDb, crud, constants, dates, format
          → OK
```

### BLOCCO 2: Auth store e hook

```
STEP 2.1  @data-engineer → Crea src/store/authStore.js
          → Zustand con persist (localStorage)
          → State: familyId, currentMember, isSetupComplete
          → Actions: setFamily, setMember, completeSetup, logout, fullReset
          → Getters: canManageExpenses(), canManageTasks(), isParent()
          → Vedi MASTER_ARCHITECTURE sezione 4 per i ruoli

STEP 2.2  @data-engineer → Crea src/hooks/useAuth.js
          → verifyPin(memberId, inputPin): legge member da Dexie, confronta bcrypt hash
          → Usa bcryptjs (autorizzato nello stack — vedi MASTER sezione 2)
          → login(memberId, pin): verifyPin → se ok, authStore.setMember
          → logout(): authStore.logout

STEP 2.3  @qa-tester → VERIFICA:
          → useAuthStore.getState().isSetupComplete === false
          → Test unitari per authStore e useAuth
          → OK
```

### BLOCCO 3: Componenti shared (usati ovunque)

```
STEP 3.1  @frontend-dev → Crea src/components/shared/Toast.jsx
          → Posizionato in basso, sopra BottomNav
          → Props: message, action (opzionale, es. "Annulla"), onAction, duration (default 4s)
          → Auto-dismiss dopo duration
          → Animazione: slide-up + fade

STEP 3.2  @frontend-dev → Crea src/components/shared/Modal.jsx
          → Overlay scuro + card centrata
          → Props: isOpen, onClose, title, children
          → Click su overlay chiude
          → Escape key chiude

STEP 3.3  @frontend-dev → Crea src/components/shared/ConfirmDialog.jsx
          → Usa Modal internamente
          → Props: isOpen, onConfirm, onCancel, title, message, confirmLabel, danger (boolean)
          → Se danger=true, bottone conferma è rosso

STEP 3.4  @frontend-dev → Crea src/components/shared/PersonBadge.jsx
          → Props: member ({name, icon, color}) + size ('sm'|'md'|'lg')
          → Cerchio colorato con icona + nome sotto (se size > sm)

STEP 3.5  @frontend-dev → Crea src/components/shared/PersonPicker.jsx
          → Props: members[], value, onChange
          → Griglia di PersonBadge cliccabili
          → Quello selezionato ha bordo evidenziato

STEP 3.6  @frontend-dev → Crea src/components/shared/DatePicker.jsx
          → Input date nativo (type="date") con label in italiano
          → Props: value, onChange, label

STEP 3.7  @frontend-dev → Crea src/components/shared/EmptyState.jsx
          → Props: icon (Lucide), title, description
          → Centrato, grigio, illustrativo

STEP 3.8  @frontend-dev → Crea src/components/shared/LoadingSpinner.jsx
          → Spinner Tailwind animate-spin

STEP 3.9  @qa-tester → VERIFICA: crea test per tutti i componenti shared
          → Rendering, props, interazioni, accessibilità
          → Crea pagina test che mostra tutti i componenti → tutti visibili e funzionanti → OK
```

### BLOCCO 4: Onboarding wizard

```
STEP 4.1  @frontend-dev → Crea src/components/auth/WizardStep1.jsx
          → Logo/icona Fammi Questo
          → Testo: "Benvenuto in Fammi Questo"
          → Sottotesto: "I tuoi dati restano sul tuo telefono."
          → Bottone: "Inizia →"

STEP 4.2  @frontend-dev → Crea src/components/auth/WizardStep2.jsx
          → Domanda: "Di chi è questo telefono?"
          → Due card grandi: "Genitore / Adulto" con icona 👨 e "Figlio/a" con icona 👧
          → Campo testo: "Il tuo nome"
          → Validazione: nome obbligatorio, selezione obbligatoria

STEP 4.3  @frontend-dev → Crea src/components/auth/WizardStep3.jsx
          → Se genitore:
            - "Quanti adulti nella famiglia?" → bottoni 1/2/3/4
            - Per ogni adulto: nome + select ruolo (parent/elder/other)
            - "Ci sono figli?" → toggle Sì/No
            - Se sì: "Quanti?" → bottoni 1/2/3/4/5/6
            - Per ogni figlio: nome + età (input number)
          → Se figlio (da step 2):
            - "Inserisci il codice famiglia" → input codice invito
            - (in R1 questo flusso è semplificato: il figlio accede solo se il genitore ha già fatto setup)
          → Il primo adulto inserito è automaticamente chi ha in mano il telefono

STEP 4.4  @frontend-dev → Crea src/components/auth/WizardStep4.jsx
          → "Crea un PIN per i genitori" → input 4-6 cifre + conferma
          → "Crea un PIN per i figli" → input 4-6 cifre + conferma
          → Validazione: min 4 cifre, i due PIN devono essere diversi
          → Bottone: "Completa Setup ✓"

STEP 4.5  @frontend-dev + @data-engineer → Crea src/components/auth/SetupWizard.jsx
          → @frontend-dev: Container con state step (1-4) + dati raccolti, freccia indietro,
            indicatore progresso (4 pallini)
          → @data-engineer: Logica completamento:
            1. Genera family_id con crypto.randomUUID()
            2. createRecord('family', { name: 'Famiglia ' + cognome })
            3. Per ogni membro: createRecord('members', { ..., pin_hash: hash(pin) })
               - access_level calcolato con ACCESS_BY_AGE(age) per figli
               - access_level = 'full' per genitori
               - icon e color assegnati automaticamente da ROLE_ICONS e MEMBER_COLORS
            4. createRecord('budgets', { monthly_amount: 3000, category: null, month: null })
            5. authStore.setFamily(familyId)
            6. authStore.completeSetup()
            7. Navigate a /login

STEP 4.6  @qa-tester → VERIFICA:
          → Completa wizard con 2 genitori + 2 figli
          → Apri DevTools > Application > IndexedDB > FamilyManagerDB
          → Verifica: tabella family ha 1 record, tabella members ha 4 record
          → Test integrazione: wizard flow completo
          → OK
```

### BLOCCO 5: Login

```
STEP 5.1  @frontend-dev → Crea src/components/auth/MemberSelect.jsx
          → Griglia di PersonBadge per tutti i membri della famiglia
          → Click su un membro → passa a PinLogin

STEP 5.2  @frontend-dev → Crea src/components/auth/PinLogin.jsx
          → Mostra avatar + nome del membro selezionato
          → Input PIN (numerico, 4-6 cifre, type="password")
          → Tastiera numerica custom (opzionale, bella su mobile)
          → Bottone "Entra"
          → Se PIN errato: shake animation + messaggio "PIN errato"
          → Se OK: authStore.setMember → navigate a /dashboard
          → Link "Torna alla selezione"

STEP 5.3  @frontend-dev → Crea src/pages/SetupPage.jsx → renderizza SetupWizard
          Crea src/pages/LoginPage.jsx → renderizza MemberSelect o PinLogin

STEP 5.4  @qa-tester → VERIFICA:
          → Login come genitore → accede alla dashboard
          → Login come figlio → accede alla dashboard (con meno tab)
          → PIN sbagliato → messaggio errore, non accede
          → Test: MemberSelect, PinLogin, flusso login/logout
          → OK
```

### BLOCCO 6: Layout e navigazione

```
STEP 6.1  @frontend-dev → Crea src/components/layout/Header.jsx
          → Sinistra: PersonBadge piccolo del membro corrente
          → Centro: nome famiglia
          → Destra: icona campana (placeholder, badge numero in R2)
          → Sfondo: colore primary (#6C5CE7)

STEP 6.2  @frontend-dev → Crea src/components/layout/BottomNav.jsx
          → Tab basati su access_level del membro corrente (NAV_TABS)
          → Per R1 con access_level 'full': Home, Spese, Statistiche, Budget, Settings
          → Icone Lucide: Home, Wallet, BarChart3, PiggyBank, Settings
          → Tab attivo: colore primary, altri: grigio
          → Fisso in basso, safe-area-inset per iOS

STEP 6.3  @frontend-dev → Crea src/components/layout/AppShell.jsx
          → Header + <main> scrollabile + BottomNav
          → main ha padding-bottom per non andare sotto il BottomNav

STEP 6.4  @frontend-dev → Crea src/components/layout/ProtectedRoute.jsx
          → Se !isSetupComplete → redirect a /setup
          → Se !currentMember → redirect a /login
          → Se access_level non sufficiente → redirect a /dashboard
          → Altrimenti: renderizza children

STEP 6.5  @frontend-dev → Crea src/App.jsx
          → BrowserRouter con routes:
            - /setup → SetupPage (solo se non setup)
            - /login → LoginPage (solo se setup ma non logged in)
            - /dashboard → ProtectedRoute > DashboardPage
            - /expenses → ProtectedRoute (full) > ExpensesPage
            - /stats → ProtectedRoute (full) > StatsPage
            - /budget → ProtectedRoute (full) > BudgetPage
            - /settings → ProtectedRoute > SettingsPage
            - * → redirect a /dashboard
          → Root redirect logic: se !setup → /setup, se !member → /login, else /dashboard

STEP 6.6  @frontend-dev → Crea src/main.jsx
          → StrictMode > App

STEP 6.7  @qa-tester → VERIFICA:
          → Navigazione tra tab funziona
          → Refresh pagina: redirect corretto basato su stato auth
          → Test: ProtectedRoute con access_level diversi, routing, AppShell
          → OK
```

### BLOCCO 7: Spese

```
STEP 7.1  @data-engineer → Crea src/hooks/useExpenses.js
          → addExpense(data): chiama createRecord('expenses', {...data, family_id})
          → updateExpense(id, changes): chiama updateRecord
          → deleteExpense(id): chiama deleteRecord (tombstone)
          → undoDelete(id): updateRecord(id, {_deleted: false})
          → useExpensesByMonth(familyId, yyyy_mm): useLiveQuery che filtra per mese e !_deleted
          → useExpensesByCategory(familyId, yyyy_mm): calcola totali per categoria in JS
          → useMonthlyTotals(familyId, numMonths): totali per mese, ultimi N mesi
          → useTodayExpenses(familyId): spese di oggi

STEP 7.2  @frontend-dev → Crea src/components/expenses/CategoryPicker.jsx
          → Griglia 4 colonne di categorie
          → Ogni categoria: icona + label + sfondo colore
          → Click seleziona, evidenzia con bordo

STEP 7.3  @frontend-dev → Crea src/components/expenses/ExpenseForm.jsx
          → Campi: importo (input numerico con €), categoria (CategoryPicker), nota (testo),
            persona (PersonPicker, default = membro corrente), data (DatePicker, default = oggi)
          → Bottone "Salva"
          → Se editing: pre-popola campi, bottone "Aggiorna"
          → Validazione: importo > 0 obbligatorio, categoria obbligatoria
          → Dopo save: toast "Spesa aggiunta" + reset form

STEP 7.4  @frontend-dev → Crea src/components/expenses/ExpenseCard.jsx
          → Layout: sinistra icona categoria, centro nota + persona badge piccolo, destra importo €
          → Data sotto in grigio piccolo
          → Click → apre ExpenseForm in modalità edit (Modal)
          → Swipe left o bottone delete → ConfirmDialog → deleteExpense → toast con Undo

STEP 7.5  @frontend-dev → Crea src/components/expenses/ExpenseList.jsx
          → Selettore mese in alto (← Febbraio 2026 →)
          → Totale mese in evidenza
          → Lista ExpenseCard ordinate per data desc
          → Se vuoto: EmptyState "Nessuna spesa questo mese"
          → FAB (floating action button) in basso destra: "+" → apre ExpenseForm in Modal

STEP 7.6  @frontend-dev → Crea src/pages/ExpensesPage.jsx
          → Renderizza ExpenseList

STEP 7.7  @qa-tester → VERIFICA:
          → Aggiungi 5 spese diverse: categorie, importi, persone
          → Cambio mese: lista filtrata correttamente
          → Elimina spesa → toast con "Annulla" → click Annulla → spesa ripristinata
          → Modifica spesa → importo aggiornato in lista
          → Chiudi app → riapri → tutte le spese ancora lì
          → Test: useExpenses hook, ExpenseForm, ExpenseCard, ExpenseList
          → Data integrity: _version incrementato, _deleted flag, family_id filtrato
          → OK
```

### BLOCCO 8: Budget

```
STEP 8.1  @data-engineer → Crea src/hooks/useBudget.js
          → useBudget(familyId): legge budget corrente da Dexie, calcola totale speso mese
          → setBudget(amount): updateRecord o createRecord budget
          → Ritorna: { budget, spent, remaining, percentage, byCategory }

STEP 8.2  @frontend-dev → Crea src/components/budget/BudgetOverview.jsx
          → Barra progresso circolare o lineare: spent/budget
          → Colore: verde <50%, giallo <80%, rosso >=80%
          → Sotto: lista categorie con mini-barre e importo

STEP 8.3  @frontend-dev → Crea src/components/budget/BudgetSetup.jsx
          → Input "Budget mensile" con € → salva

STEP 8.4  @frontend-dev → Crea src/pages/BudgetPage.jsx
          → BudgetOverview + BudgetSetup

STEP 8.5  @qa-tester → VERIFICA: budget 1000€, spese 750€ → barra al 75% gialla
          → Test: useBudget hook, BudgetOverview con vari scenari (0%, 50%, 80%, 100%+)
          → OK
```

### BLOCCO 9: Statistiche

```
STEP 9.1  @frontend-dev → Crea src/pages/StatsPage.jsx
          → Selettore mese in alto
          → PieChart (Recharts) categorie mese selezionato
          → BarChart (Recharts) totali ultimi 6 mesi
          → Sotto: top 3 categorie con importo e percentuale

STEP 9.2  @qa-tester → VERIFICA: con 10+ spese distribuite su 3 mesi → grafici visibili e corretti
          → Test: rendering grafici con dati mock, empty state, un solo mese
          → OK
```

### BLOCCO 10: Dashboard e Settings

```
STEP 10.1 @frontend-dev → Crea src/pages/DashboardPage.jsx
           → "Ciao [nome]!" con data odierna
           → Card "Spese oggi": totale + mini lista
           → Card "Budget mese": barra progresso compatta
           → Card "Task oggi" e "Eventi oggi": placeholder grigi con testo "In arrivo in R2"
           → Stile: card con shadow, sfondo sfumato in alto

STEP 10.2 @frontend-dev → Crea src/pages/SettingsPage.jsx
           → Sezione "Famiglia": nome famiglia, lista membri (non modificabili in R1)
           → Sezione "Dati": conteggio record per tabella, spazio occupato (stima)
           → Sezione "Altro": bottone "Cambia utente" (logout), bottone "Reset app" (con doppia conferma)

STEP 10.3 @qa-tester → VERIFICA FINALE R1:
           → Fresh start: cancella IndexedDB → apri app → wizard → crea famiglia
           → Login → dashboard → aggiungi 10 spese → lista, stats, budget tutto funziona
           → Installa come PWA → funziona da homescreen
           → Airplane mode → app funziona → spese persistenti
           → Test integrazione end-to-end per tutto R1
           → Conformity review completa (checklist code-reviewer skill)
           → Coverage check: componenti >80%, services >90%, hooks >85%
           → OK → R1 COMPLETA
```

---

## RELEASE 2 — Build Order

> Inizia SOLO dopo che R1 è completa e testata.

```
STEP 11  @data-engineer → Crea src/hooks/useCalendar.js — CRUD eventi + query per settimana
STEP 12  @frontend-dev → Crea WeekView + DayColumn + EventCard + EventForm
STEP 13  @frontend-dev → Crea CalendarPage
STEP 14  @qa-tester → VERIFICA: 5 eventi in 2 settimane → navigazione settimana → card corrette
         → Test componenti calendario + useCalendar hook → OK

STEP 15  @data-engineer → Crea src/hooks/useTasks.js — CRUD task, toggle done, propose, approve, reject
STEP 16  @frontend-dev → Crea TaskBoard + TaskCard + TaskForm
STEP 17  @frontend-dev → Crea TaskProposal + TaskApproval
STEP 18  @data-engineer + @frontend-dev → Crea TemplateManager + logica generazione giornaliera
         → @data-engineer: logica generazione da taskTemplates in base a recurrence
         → @frontend-dev: UI TemplateManager
         → Al primo accesso del giorno: controlla se task di oggi già generati
         → Se no: legge taskTemplates, genera task per oggi in base a recurrence
STEP 19  @frontend-dev → Crea TasksPage
STEP 20  @qa-tester → VERIFICA: crea template → genera task → completa → proponi → approva
         → Test: useTasks hook, TaskBoard, TaskForm, flusso proposta/approvazione → OK

STEP 21  @data-engineer → Crea src/hooks/useRewards.js — calcolo settimanale in JS
STEP 22  @frontend-dev → Crea Leaderboard + RewardHistory
STEP 23  @frontend-dev → Crea RewardsPage
STEP 24  @qa-tester → VERIFICA: 2 figli con task completati diversi → classifica corretta → premi calcolati
         → Test: useRewards hook, calcolo punteggi, Leaderboard → OK

STEP 25  @data-engineer → Crea src/lib/crypto.js (deriveKey, encrypt, decrypt)
STEP 26  @data-engineer → Crea src/lib/backup.js (exportBackup, importBackup)
         → Export: raccoglie TUTTE le tabelle Dexie → cripta con PIN+deviceSecret → .fmbackup
         → Import: legge file → chiede PIN → decripta → popola Dexie
         → Formato envelope: { format, format_version, family_id, device_secret, cipher: {iv, data} }
STEP 27  @frontend-dev → Aggiungi bottoni Export/Import in SettingsPage
STEP 28  @frontend-dev → Crea NotifBanner + NotifList
         @data-engineer → Crea src/hooks/useNotifications.js
STEP 29  @frontend-dev + @data-engineer → Integra notifiche:
         → task completato → notifica locale, proposta task → notifica
STEP 30  @qa-tester → VERIFICA:
         → Export .fmbackup → cancella IndexedDB → Import → tutti i dati ripristinati
         → PIN sbagliato → errore chiaro
         → Notifiche: completa task → banner appare
         → Test crypto.js, backup.js, useNotifications
         → Conformity review R2 completa
         → VERIFICA FINALE R2: tutto funziona insieme
```

---

## RELEASE 3 — Build Order

> Inizia SOLO dopo che R2 è completa e testata.

```
STEP 31  @tech-lead → Crea .env.local con chiavi Supabase (ora serve)
STEP 32  @data-engineer → Esegui le 4 migration SQL su Supabase Dashboard
         (families, members, sync_blobs, RLS)
         Abilita Realtime su sync_blobs
STEP 33  @data-engineer → Crea src/lib/supabase.js (client)
STEP 34  @data-engineer → Crea src/lib/syncEngine.js (push, pull, subscribe)
         → Vedi MASTER_ARCHITECTURE sezione 6 per la strategia completa
STEP 35  @data-engineer → Crea src/hooks/useSync.js
         → Toggle sync ON/OFF
         → Se ON: auth anonima Supabase, push pending, pull, subscribe realtime
         → Se OFF: nessun traffico cloud
STEP 36  @data-engineer → Integra syncEngine nei CRUD:
         → dopo ogni createRecord/updateRecord → logga in syncLog
         → Il push parte con debounce 3s dopo l'ultimo write
STEP 37  @qa-tester → VERIFICA SYNC:
         → Device A: sync ON → aggiungi spesa → blob crittografato appare su Supabase
         → Device B: sync ON → pull → spesa appare (decrittata localmente)
         → Test: syncEngine, useSync, crittografia end-to-end → OK

STEP 38  @data-engineer + @frontend-dev → Crea flusso "Join famiglia"
         → @data-engineer: logica invite_code + device_secret
         → @frontend-dev: UI join flow
STEP 39  @frontend-dev → Aggiungi Privacy screen in SettingsPage
STEP 40  @qa-tester → VERIFICA: 2 device sincronizzati → offline su entrambi
         → aggiungono spese → online → merge LWW → OK

STEP 41  @data-engineer → Crea src/hooks/useMeals.js, useShopping.js, useInventory.js
STEP 42  @frontend-dev → Crea MealList + MealForm + MealPlanWeek + MealVote
STEP 43  @frontend-dev → Crea ShoppingList + ShoppingItem
STEP 44  @frontend-dev → Crea InventoryList + InventoryForm + ExpiryAlert
STEP 45  @frontend-dev → Crea MealsPage + ShoppingPage + InventoryPage
STEP 46  @frontend-dev → Aggiorna BottomNav con le nuove sezioni (tab "Altro" con sottomenu)
STEP 47  @qa-tester → VERIFICA: piatti, meal plan, lista spesa, inventario funzionanti
         → Test componenti + hook per meals, shopping, inventory → OK

STEP 48  @data-engineer → Crea Supabase Edge Function brain-parse
         → Input: { text, context: { members, categories } }
         → Claude Haiku parse → { intent: "add_expense", amount, category, note }
         → Output: JSON azione singola
STEP 49  @frontend-dev → Crea src/hooks/useVoice.js (Web Speech API, lang 'it-IT')
STEP 50  @frontend-dev → Crea BrainInput + BrainPreview
         → Campo testo + bottone microfono
         → Submit → chiama Edge Function → mostra preview → conferma → createRecord
STEP 51  @frontend-dev → Crea BrainPage
STEP 52  @qa-tester → VERIFICA: "ho speso 30 euro benzina"
         → preview "€30 - Carburante" → conferma → spesa creata
         → Test: useVoice, BrainInput, flusso NLP → OK

STEP 53  @data-engineer → Crea logica ricorrenze (spese + eventi)
         → Genera automaticamente all'apertura app se last_generated < oggi

STEP 54  @tech-lead → Deploy su Vercel (vercel.json con rewrite SPA)
STEP 55  @qa-tester → TEST FINALE su dispositivi reali Android + iOS
         → Conformity review R3 completa
         → Coverage finale
STEP 56  @tech-lead → Fix bug + polish UX

         → v1 COMPLETA
```
