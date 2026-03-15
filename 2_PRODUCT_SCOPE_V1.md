# Fammi Questo — Scope V1

> Cosa si costruisce, cosa no, e in che ordine.
> Riferimento: `1_MASTER_ARCHITECTURE.md` per vincoli e stack.
> Ultimo aggiornamento: 15 marzo 2026.

---

## Stato avanzamento (15 marzo 2026)

| Release | Stato | Note |
|---------|-------|------|
| R1 (Fondamenta + Spese) | ✅ **COMPLETATA** | PWA funzionante, spese, budget, stats, login PIN |
| R2 (Calendario + Task + Rewards) | ✅ **COMPLETATA** | Calendario 3 viste, task con gamification, rewards, backup, notifiche native |
| R3 (Sync + Cucina + AI) | 🔶 **IN CORSO** | Sync per-table funzionante (non crittografata), Brain NLP 4 livelli operativo, cucina/shopping/inventario completi |
| Sprint 1-4 (Contratto Canonico + UX) | ✅ **COMPLETATI** | 82 test Vitest, pipeline canonizzazione, dual action, calendario 3 viste |
| R5 (Rebrand + Brand Identity) | ✅ **COMPLETATO** | Rebrand Family Manager → Fammi Questo, logo Voice Ripple, brand book Canva, appId `com.fammiquesto.app` |
| R6 (Cross-platform iOS) | ✅ **COMPLETATO** | Capacitor iOS, GitHub Actions CI/CD, UI cross-platform (safe areas, haptics, keyboard, status bar) |

**Rebrand completato (14 marzo 2026):**
- Nome: Fammi Questo (appId: `com.fammiquesto.app`)
- Logo: Voice Ripple — onde sonore viola/corallo da punto centrale
- File logo: `public/logo.svg` (colori), `public/logo-white.svg` (bianco), `public/logo-header.svg` (header unificato con pillola)
- Favicon aggiornato a logo.svg
- Header con logo + wordmark in pillola arrotondata
- Brand book su Canva (5 slide) + slide Cervellone in `brand/cervellone-slide.png`
- Tutti i 14+ file .md, config, sorgenti, Android aggiornati al nuovo nome

**Cross-platform completato (15 marzo 2026):**
- Capacitor iOS aggiunto (`@capacitor/ios`, cartella `ios/` con progetto Xcode)
- GitHub Actions: build automatico Android (Ubuntu) + iOS (macOS-14) ad ogni push
- GitHub Actions: workflow manuale release App Store con certificati Apple
- UI cross-platform: safe areas (notch/Dynamic Island), touch feedback per piattaforma, keyboard handling, haptic feedback, status bar
- Nuovi file: `platform.js`, `haptics.js`, `useKeyboard.js`, `useBackButton.js`, `useStatusBar.js`
- `main.jsx` applica classi `plt-ios`/`plt-android` per CSS condizionale
- `index.html` aggiornato con `viewport-fit=cover` e meta Apple
- Guida completa in `SETUP_IOS.md`

**Cosa manca per chiudere R3:**
- Crittografia sync (blob model) — debito tecnico principale
- Deploy Edge Function brain-parse su Supabase
- Eseguire supabase-migration-v2.sql
- Test su 2 dispositivi fisici reali (Android + iOS)
- Build finale e pubblicazione Play Store + App Store

---

## Release Plan

La v1 è divisa in 3 release incrementali. Ogni release produce un'app **funzionante e testabile**.

---

## Release 1 (R1): Fondamenta + Spese

**Obiettivo:** Un'app PWA installabile che gestisce spese, budget e dashboard per una famiglia, tutto locale.

### Funzionalità IN scope

| Feature | Dettaglio |
|---------|-----------|
| **Onboarding wizard** | 4 step: benvenuto, chi sei (genitore/figlio), composizione famiglia, PIN. Salva tutto in Dexie.js |
| **Login** | Selezione membro + inserimento PIN. Verifica bcrypt locale |
| **Dashboard** | Riepilogo giorno: spese di oggi, task di oggi (placeholder vuoto per R1), eventi di oggi (placeholder) |
| **Gestione spese** | Aggiunta, modifica, eliminazione, duplicazione. Campi: importo, categoria, nota, persona, data |
| **Lista spese** | Filtro per mese. Card con importo, categoria icona, persona badge, nota. Swipe o bottone per delete (con undo toast) |
| **Categorie** | Le 16 categorie standard dell'app attuale, con icona e colore. Non personalizzabili in R1 |
| **Budget mensile** | Impostazione importo mensile globale. Barra progresso speso/totale. Breakdown per categoria |
| **Statistiche base** | PieChart categorie mese corrente. BarChart totale ultimi 6 mesi |
| **PWA base** | manifest.json, service worker, installabile su homescreen |
| **Offline** | Funziona al 100% senza internet (tutto è in Dexie.js) |

### Funzionalità FUORI scope R1

- Calendario, task, rewards, pasti, shopping, inventario, brain AI, OCR, voice input
- Sync cloud, backup/export, migrazione telefono
- Push notifications
- Personalizzazione categorie
- Foto scontrini

### Modello dati R1

```js
// Entities attive in R1:

// family
{ id, name, created_at, updated_at, _deleted, _version, _device_id }

// member
{ id, family_id, name, role, age, birth_date, icon, color,
  pin_hash, access_level, is_active,
  created_at, updated_at, _deleted, _version, _device_id }

// expense
{ id, family_id, amount, category, note, person_id, date,
  created_by,
  created_at, updated_at, _deleted, _version, _device_id }

// budget
{ id, family_id, monthly_amount, category, month,
  created_at, updated_at, _deleted, _version, _device_id }

// settings (key-value locale)
{ key, value }
```

### Componenti da creare in R1

```
src/lib/
  localDb.js          — Schema Dexie.js (tutte le tabelle, anche quelle vuote per ora)
  crud.js             — createRecord, updateRecord, deleteRecord
  constants.js        — categorie, icone, colori, ruoli
  dates.js            — formattazione date in italiano
  format.js           — formatCurrency, formatNumber

src/store/
  authStore.js        — session locale, currentMember, familyId

src/hooks/
  useAuth.js          — login, logout, verifica PIN
  useExpenses.js      — CRUD spese + query reattive (useLiveQuery)
  useBudget.js        — CRUD budget + calcolo progresso

src/components/auth/
  SetupWizard.jsx     — Container wizard 4 step
  WizardStep1.jsx     — Benvenuto
  WizardStep2.jsx     — Chi sei?
  WizardStep3.jsx     — Composizione famiglia (nomi, età, ruoli)
  WizardStep4.jsx     — Creazione PIN
  PinLogin.jsx        — Inserimento PIN
  MemberSelect.jsx    — Griglia avatar per selezione membro

src/components/layout/
  AppShell.jsx        — Header + content area + BottomNav
  BottomNav.jsx       — Tab navigation (adattiva al ruolo)
  Header.jsx          — Nome famiglia + avatar membro + badge notifiche (vuoto in R1)
  ProtectedRoute.jsx  — Redirect a login se non autenticato

src/components/expenses/
  ExpenseForm.jsx     — Form aggiunta/modifica spesa
  ExpenseList.jsx     — Lista spese filtrata per mese
  ExpenseCard.jsx     — Card singola spesa
  CategoryPicker.jsx  — Griglia categorie con icone

src/components/budget/
  BudgetOverview.jsx  — Barra progresso + breakdown
  BudgetSetup.jsx     — Form modifica budget mensile

src/components/shared/
  Toast.jsx           — Toast con undo (per delete)
  PersonBadge.jsx     — Icona + colore + nome membro
  PersonPicker.jsx    — Selettore membro famiglia
  DatePicker.jsx      — Selettore data in italiano
  Modal.jsx           — Dialog modale
  ConfirmDialog.jsx   — Conferma eliminazione
  EmptyState.jsx      — Placeholder "nessun dato"
  LoadingSpinner.jsx  — Spinner

src/pages/
  SetupPage.jsx       — Pagina onboarding
  LoginPage.jsx       — Pagina login
  DashboardPage.jsx   — Home con riepilogo (spese oggi + placeholder)
  ExpensesPage.jsx    — Tab spese
  StatsPage.jsx       — Tab statistiche
  BudgetPage.jsx      — Tab budget
  SettingsPage.jsx    — Impostazioni base (modifica membri, reset app)

src/App.jsx           — Router
src/main.jsx          — Entry point
src/index.css         — Tailwind
```

### Definition of Done R1

- [ ] Setup wizard funziona: crea famiglia + membri in Dexie.js
- [ ] Login con PIN funziona, accesso corretto per ruolo
- [ ] Aggiungi 10 spese con categorie diverse: tutte visibili in lista
- [ ] Elimina spesa con undo: funziona
- [ ] Budget: barra progresso si aggiorna con le spese
- [ ] Stats: PieChart e BarChart mostrano dati corretti
- [ ] Chiudi app e riapri: dati persistenti (IndexedDB)
- [ ] PWA: installabile su Android Chrome
- [ ] Offline: attiva airplane mode, l'app funziona
- [ ] Mobile: tutto usabile su schermo 375px

---

## Release 2 (R2): Calendario + Task + Rewards

**Obiettivo:** Gestione compiti e eventi con gamification per i figli.

### Funzionalità IN scope

| Feature | Dettaglio |
|---------|-----------|
| **Calendario settimanale** | Vista 7 giorni, card eventi, navigazione ←→ |
| **CRUD eventi** | Titolo, data, orario, persona, accompagnato da, ritirato da, note |
| **Task board** | Vista giornaliera, task per persona, toggle completamento |
| **Template task** | Task ricorrenti con generazione giornaliera |
| **Proposta task** | Figli propongono → genitori approvano/rifiutano |
| **Rewards** | Classifica settimanale, percentuale completamento, premio configurabile |
| **Notifiche in-app** | Toast per azioni importanti (task completato, proposta ricevuta) |
| **Backup/Export** | Esporta .fmbackup crittografato, importa su altro device |

### Funzionalità FUORI scope R2

- Sync cloud (R3)
- Pasti, shopping, inventario (R3)
- Brain AI, voice input, OCR (R3)
- Ricorrenze calendario (R3)
- Push notifications (R3)

### Componenti nuovi in R2

```
src/hooks/
  useCalendar.js
  useTasks.js
  useRewards.js

src/components/calendar/
  WeekView.jsx
  DayColumn.jsx
  EventCard.jsx
  EventForm.jsx

src/components/tasks/
  TaskBoard.jsx
  TaskCard.jsx
  TaskForm.jsx
  TaskProposal.jsx
  TaskApproval.jsx
  TemplateManager.jsx

src/components/rewards/
  Leaderboard.jsx
  RewardHistory.jsx

src/components/notifications/
  NotifBanner.jsx
  NotifList.jsx

src/lib/
  backup.js            — export/import .fmbackup
  crypto.js            — deriveKey, encrypt, decrypt (per backup)

src/pages/
  CalendarPage.jsx
  TasksPage.jsx
  RewardsPage.jsx
```

### Definition of Done R2

- [ ] Crea 5 eventi nel calendario: visibili nella settimana corretta
- [ ] Crea 3 template task: generati automaticamente ogni giorno
- [ ] Completa task come figlio: leaderboard si aggiorna
- [ ] Proponi task come figlio → approva come genitore: funziona
- [ ] Rewards: percentuale e premio calcolati correttamente
- [ ] Export .fmbackup da device A → import su device B → dati identici
- [ ] PIN sbagliato in import: errore chiaro, nessun dato corrotto

---

## Release 3 (R3): Sync + Cucina + AI

**Obiettivo:** Sync crittografato tra device, moduli cucina, Brain AI.

### Funzionalità IN scope

| Feature | Dettaglio |
|---------|-----------|
| **Sync cloud crittografato** | Toggle ON/OFF. Supabase vede solo blob. LWW conflict resolution |
| **Join famiglia** | Secondo device con QR code o invite code |
| **Pasti** | Lista piatti, piano settimanale, votazione |
| **Shopping list** | Lista spesa interattiva con toggle comprato |
| **Inventario** | Dispensa con scadenze e alert |
| **Brain AI (base)** | Solo parsing spese da testo. Claude Haiku via Edge Function. Preview + conferma |
| **Voice input** | Web Speech API, solo per campo Brain input |
| **Ricorrenze** | Spese e eventi ricorrenti |
| **Privacy screen** | Sezione in Settings con info su dove sono i dati, toggle sync, backup |

### Funzionalità FUORI scope v1 (future)

- OCR scontrini (Tesseract.js — non affidabile abbastanza per v1)
- Brain AI multi-azione (executor automatico — troppo rischioso per v1)
- Push notifications (Web Push VAPID)
- Storico prezzi
- Pattern learning
- Suggerimenti AI pasti da inventario
- Personalizzazione categorie
- Multi-lingua
- QR code transfer tra device vicini (metodo B migrazione)

### Componenti nuovi in R3

```
src/lib/
  syncEngine.js         — push, pull, subscribe
  supabase.js           — client Supabase

src/hooks/
  useMeals.js
  useShopping.js
  useInventory.js
  useSync.js
  useVoice.js
  useOnline.js

src/components/meals/
  MealList.jsx
  MealForm.jsx
  MealPlanWeek.jsx
  MealVote.jsx

src/components/shopping/
  ShoppingList.jsx
  ShoppingItem.jsx

src/components/inventory/
  InventoryList.jsx
  InventoryForm.jsx
  ExpiryAlert.jsx

src/components/brain/
  BrainInput.jsx        — campo testo + voice toggle
  BrainPreview.jsx      — preview azione parsata con conferma

src/pages/
  MealsPage.jsx
  ShoppingPage.jsx
  InventoryPage.jsx
  BrainPage.jsx

supabase/functions/
  brain-parse/index.ts  — Edge Function con Claude Haiku
```

### Brain AI v1 — Scope ESPANSO (stato reale al 14 marzo 2026)

> Lo scope originale prevedeva solo parsing spese. L'implementazione reale è una **pipeline NLP a 4 livelli** con 7 tipi di azione. Vedere `6_AUDIT_CERVELLONE_NLP.md` per la documentazione tecnica completa.

```
Input testo/voce in italiano
     ↓
Pipeline NLP a cascata:
  L0: Pattern regex strutturali (expense, absence, logistics, meal, reminder, task, visitor)
  L1: NLP.js classify (217 frasi training + documenti utente)
  L2: Sinapsi pesate (85 bootstrap + apprese, con learning engine)
  L3: Claude Haiku 4.5 via Edge Function (fallback se confidence < 0.55)
     ↓
Normalizzazione canonica (actionNormalizer.js + actionValidator.js)
     ↓
Preview all'utente con tutte le azioni parsate
     ↓
Utente conferma/modifica/cancella singole azioni
     ↓
Persist ordinato (linked entities prima indipendenti, poi dipendenti)
     ↓
Learning engine: rinforzo azioni confermate, punizione azioni cancellate
```

**7 tipi di azione supportati:** calendar, task, expense, meal, shopping, reminder, note.

**Feature avanzate implementate:**
- Conversation memory multi-turno (draft con merge incrementale)
- Coreference resolution (pronomi → contesto precedente)
- Dual action (es. "ricordami di comprare X" → reminder + shopping)
- Logistica (driver/subject/accompaniedBy/pickupBy)
- Activity taxonomy fuzzy con 4 categorie gerarchiche
- Shadow learning (sinapsi utente attive solo dopo 3 conferme)
- Decay temporale delle sinapsi non usate

### Definition of Done R3

- [ ] Attiva sync su device A → aggiungi spesa → appare su device B (crittografata)
- [ ] Disattiva sync → nessun dato esce dal telefono
- [ ] Join famiglia da device B con invite code: riceve tutti i dati
- [ ] Aggiungi 3 piatti → crea meal plan → vota → funziona
- [ ] Lista spesa: aggiungi items → segna comprati → sync su altro device
- [ ] Brain: dì "ho speso 45 euro benzina" → preview corretta → conferma → spesa creata
- [ ] Privacy screen: mostra conteggio record, spazio, stato sync
- [ ] 2 device offline simultaneamente → entrambi aggiungono spese → tornano online → merge corretto (LWW)
