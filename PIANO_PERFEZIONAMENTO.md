# FAMMI QUESTO — Piano di Perfezionamento Completo

> Ogni tab al 100%. Nessun compromesso.
> Generato il 14 marzo 2026 dopo audit completo del codebase.
> **Ultimo aggiornamento: 15 marzo 2026 — aggiunto cross-platform iOS + Play Store**

---

## Legenda priorità

- 🔴 **Critico** — Bug, sicurezza, perdita dati
- 🟠 **Alto** — UX rotta, funzionalità incompleta
- 🟡 **Medio** — Polish, performance, coerenza
- 🟢 **Basso** — Nice-to-have, futuro

**Stato:** ✅ = completato | ⬜ = da fare

---

## FASE 0 — Fondamenta (trasversale, da fare PRIMA delle tab)

### 0.1 Design Tokens & Costanti
- ✅ 🟠 Estrarre colori hardcoded in CSS custom properties (`designTokens.js` creato)
- ✅ 🟠 Creare `src/lib/designTokens.js` con palette, spacing, shadows
- ✅ 🟡 Creare enum per ruoli (`ROLES` in `constants.js` con `isParentRole()`, `isChildRole()`)

### 0.2 Error Handling Pattern
- ✅ 🔴 Creare `src/components/shared/ErrorState.jsx`
- ✅ 🔴 Aggiungere error boundary globale in AppShell
- ✅ 🟠 Hook CRUD con pattern `{ data, loading, error }`

### 0.3 Validazione Input
- ✅ 🔴 Creare `src/lib/validate.js` con validators
- ✅ 🔴 Applicare a tutti i form dell'app
- ✅ 🟠 Feedback visuale errori inline

### 0.4 Accessibilità Base
- ✅ 🟠 `aria-label` a bottoni icon-only
- ✅ 🟠 Sostituire `<div onClick>` con `<button>`
- ✅ 🟠 Focus trap nei Modal
- ✅ 🟡 Contrasto colori verificato

### 0.5 Loading States
- ✅ 🟠 Creare `src/components/shared/Skeleton.jsx`
- ✅ 🟠 Applicare skeleton a Dashboard, Calendar, Tasks, Expenses, Dispensa
- ✅ 🟡 `Suspense` fallback per BrainSheet (blur overlay + spinning border)

### 0.6 Sicurezza
- ✅ 🔴 Logout cancella `sessionPin`
- ✅ 🔴 Rate limit AI persistito in Dexie settings con timestamp
- ✅ 🟠 PIN: CryptoKey cached in useRef, PIN cancellato da Zustand dopo derivazione

### 0.7 Test
- ✅ 🟠 Fixati i 2 test pre-esistenti
- ✅ 🟡 Test per validators in validate.js
- ✅ 🟡 Test encryption round-trip

---

## SESSIONE 1 — Dashboard + Brain (Cervellone)

### DashboardPage.jsx
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 1 | `MEAL_RECIPES` → spostato in `constants.js` | 🟡 | ✅ |
| 2 | Skeleton loader al primo render | 🟠 | ✅ |
| 3 | `diffDays` memoizzato | 🟡 | ✅ |
| 4 | Smart alerts con azione diretta (tap → modifica) | 🟠 | ✅ |
| 5 | CTA "Pianifica i pasti" se non ci sono meal plans | 🟠 | ✅ |
| 6 | Gradienti/colori → design tokens | 🟡 | ✅ |

### BrainInput / BrainSheet / useBrain
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 7 | `console.log` gated con `isDebugEnabled()` | 🟠 | ✅ |
| 8 | `retrain` error → `console.warn` aggiunto | 🟠 | ✅ |
| 9 | Race condition: `nlpInitPromise` singleton pattern | 🔴 | ✅ |
| 10 | Entity resolution fallback se linking fallisce | 🟠 | ✅ |
| 11 | Log errore arricchito con tipo azione/titolo | 🟡 | ✅ |
| 12 | Rate limit AI persistito in Dexie `settings` | 🔴 | ✅ |

### Voice.js
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 13 | Modello Claude → `AI_MODEL` da `constants.js` | 🟡 | ✅ |
| 14 | URL API → `AI_API_URL` da `constants.js` | 🟡 | ✅ |
| 15 | Timeout: messaggio differenziato rete vs nessun parlato | 🟠 | ✅ |
| 16 | Edge Function fallita → messaggio utente chiaro | 🟠 | ✅ |

---

## SESSIONE 2 — Calendario

### CalendarPage.jsx
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 1 | Skeleton loader per i 3 view | 🟠 | ✅ |
| 2 | Stringhe logistica → costanti (`LOGISTICS_ROLES`) | 🟡 | ✅ |
| 3 | UI ricorrenze completata nel form | 🟠 | ✅ |
| 4 | Week view tap con indicazione visiva | 🟡 | ✅ |
| 5 | Empty state per Day view senza eventi | 🟠 | ✅ |
| 6 | Deep linking condivisibile da UI | 🟢 | ⬜ |
| 7 | Conferma eliminazione evento ricorrente | 🟠 | ✅ |
| 8 | Feedback visuale task logistica creato | 🟠 | ✅ |

---

## SESSIONE 3 — Task + Rewards (Gamification)

### TasksPage.jsx
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 1 | Template manager verificato e funzionante | 🟠 | ✅ |
| 2 | Leaderboard: mostra TUTTI i membri (non solo top 3) | 🟡 | ✅ |
| 3 | `reopenTask` → feedback se figlio tenta | 🟡 | ✅ |
| 4 | Proposal system testato end-to-end | 🟠 | ✅ |
| 5 | Filtro priorità + ordinamento scadenza | 🟡 | ✅ |
| 6 | Drag & drop per riordinare task | 🟢 | ⬜ |

### RewardsPage.jsx
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 7 | Premio settimanale configurabile in Settings | 🟠 | ✅ |
| 8 | `parseInt(bonusPoints)` con validazione NaN-safe | 🔴 | ✅ |
| 9 | Breakdown punti sempre visibile | 🟡 | ✅ |
| 10 | Parimerito: spiegazione chiara in UI | 🟡 | ✅ |
| 11 | Tab "Storico" premi passati | 🟢 | ⬜ |

---

## SESSIONE 4 — Spese + Budget + Statistiche

### SpesePage.jsx (hub unificato)
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 1 | Recurrence logic spostata nel hook | 🟡 | ✅ |
| 2 | Validazione data prima di creare ricorrenza | 🔴 | ✅ |
| 3 | Filtro per categoria e persona | 🟠 | ✅ |
| 4 | Tooltip uniformato pie/bar chart | 🟡 | ✅ |
| 5 | Drill-down da grafico a spese | 🟡 | ✅ |
| 6 | Month-over-month memoizzato | 🟡 | ✅ |
| 7 | "Media giornaliera" e "proiezione fine mese" | 🟠 | ✅ |

### BudgetPage.jsx
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 8 | BudgetOverview + BudgetSetup verificati e funzionanti | 🟠 | ✅ |
| 9 | Categorie budget validate vs categorie spese | 🟡 | ✅ |
| 10 | Alert soglia budget 80% (warning) e 100% (exceeded) | 🟠 | ✅ |

---

## SESSIONE 5 — Dispensa (Lista Spesa + Inventario)

### DispensaPage.jsx
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 1 | InventoryTab inline (328 righe) — rimane inline per semplicità | 🟡 | ✅ |
| 2 | Collapse shelf state persistito in localStorage | 🟡 | ✅ |
| 3 | Spostare prodotti tra location dopo aggiunta | 🟠 | ✅ |
| 4 | Search/filtro implementato (shopping + inventario) | 🟠 | ✅ |
| 5 | Due bottoni "Aggiungi" → FAB contestuale | 🟠 | ✅ |
| 6 | Tab attivo persistito in localStorage | 🟡 | ✅ |

### Shopping (lista spesa)
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 7 | Ordinamento (Categoria, Nome A-Z, Più recenti) | 🟠 | ✅ |
| 8 | Rilevamento duplicati all'aggiunta | 🟠 | ✅ |
| 9 | Move-to-inventory: risultato merge mostrato | 🟡 | ✅ |
| 10 | Placeholder con esempi random | 🟢 | ⬜ |

### Inventario
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 11 | OCR `captureReceipt` + `extractProductsFromReceipt` verificati | 🟠 | ✅ |
| 12 | Soglia scadenza 3 giorni — hardcoded (accettabile v1) | 🟡 | ✅ |
| 13 | Merge logic per prodotti duplicati | 🟠 | ✅ |
| 14 | Unità `UNITS` in `constants.js` (nota: anche in useShopping.js) | 🟡 | ✅ |

---

## SESSIONE 6 — Pasti (Meal Planning)

### MealsPage.jsx
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 1 | `MEAL_RECIPES` centralizzate in `constants.js` | 🟠 | ✅ |
| 2 | Slot duplicati → componente riusabile MealSlot | 🟡 | ✅ |
| 3 | Segnare pasto come "fatto" | 🟡 | ✅ |
| 4 | Integrazione con dispensa (suggerimenti da inventario) | 🟠 | ✅ |
| 5 | Vista settimanale "a colpo d'occhio" | 🟠 | ✅ |
| 6 | "Copia settimana precedente" | 🟢 | ⬜ |

---

## SESSIONE 7 — Settings + Sync + Login

### SettingsPage.jsx
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 1 | Reset cancella TUTTE le tabelle (meals, inventory, shopping incluse) | 🔴 | ✅ |
| 2 | Backup PIN → modale dedicato | 🟡 | ✅ |
| 3 | `isSyncEnabled()` memoizzato | 🟡 | ✅ |
| 4 | Stima spazio per tabella | 🟡 | ✅ |
| 5 | Reset selettivo per tabella | 🟢 | ⬜ |

### LoginPage.jsx
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 6 | Join famiglia senza `window.location.reload()` | 🟠 | ✅ |
| 7 | Loading spinner durante join | 🟠 | ✅ |
| 8 | `aria-label` sui bottoni membro | 🟡 | ✅ |

### Sync & Crypto
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 9 | `SENSITIVE_FIELDS` cross-check completo con schema | 🔴 | ✅ |
| 10 | Versioning parametri PBKDF2 | 🟠 | ✅ |
| 11 | Conflict resolution LWW (accettabile v1) | 🟡 | ✅ |
| 12 | `TABLE_MAP` vs localDb.js — documentato | 🟡 | ✅ |
| 13 | `conversationDrafts` cleanup periodico (`expireOldDrafts` in useBrain init) | 🟡 | ✅ |

---

## SESSIONE 8 — Pulizia Codice & Performance

### Dead Code
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 1 | `priceHistory` — zero runtime, lasciata (rimozione richiede version bump) | 🟡 | ✅ |
| 2 | `brainNotes` — zero runtime, lasciata (rimozione richiede version bump) | 🟡 | ✅ |
| 3 | Export brain/index.js verificati | 🟡 | ✅ |

### Performance
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 4 | BottomNav: `useBadgeCounts` meta-hook (single Promise.all query) | 🟠 | ✅ |
| 5 | VoiceButton wrappato con `memo()` | 🟡 | ✅ |
| 6 | StatsPage: `pieData` con useMemo | 🟡 | ✅ |
| 7 | Bundle size: code splitting attivo (lazy-loaded pages) | 🟡 | ✅ |

### Type Safety
| # | Issue | Priorità | Stato |
|---|-------|----------|-------|
| 8 | JSDoc `@param` e `@returns` su funzioni lib/ | 🟡 | ✅ |
| 9 | `src/types/action.js` shape validata | 🟠 | ✅ |

---

## SESSIONE 9 — Test su Dispositivo Reale + Bug Fix

Questa sessione è dedicata a:
1. Build Android pulita con tutte le fix
2. Test su dispositivo reale (non emulatore)
3. Test con utente reale (tua moglie/figli)
4. Raccolta bug e fix immediati
5. Verifica performance su device medio (tempo primo caricamento, fluidità scroll)

---

## Riepilogo numerico aggiornato

| Priorità | Totale | Completati | Rimanenti |
|----------|--------|------------|-----------|
| 🔴 Critico | 9 | 9 | 0 |
| 🟠 Alto | 38 | 38 | 0 |
| 🟡 Medio | 35 | 35 | 0 |
| 🟢 Basso | 6 | 0 | 6 |
| **Totale** | **88** | **82** | **6** |

### 🟢 Issue Low rimanenti (nice-to-have, post-v1):
1. Calendario: deep linking condivisibile da UI
2. Tasks: drag & drop per riordinare
3. Rewards: tab "Storico" premi passati
4. Dispensa: placeholder con esempi random
5. Pasti: "Copia settimana precedente"
6. Settings: reset selettivo per tabella

---

## Audit Coerenza Codice (14 marzo 2026)

### Risultato: ✅ NESSUN PROBLEMA CRITICO

| Check | Stato | Note |
|-------|-------|------|
| Imports orfani | ✅ CLEAN | Tutti gli import risolvono |
| Route coherence | ✅ OK | 4 pagine orfane (by design: sub-tab in SpesePage/DispensaPage) |
| Hook dependencies | ✅ CLEAN | useBadgeCounts→BottomNav, expireOldDrafts→useBrain, notifyParents→useBudget |
| Dexie table usage | ⚠️ 2 ghost | priceHistory + brainNotes (zero runtime, zero impatto) |
| Constants usage | ⚠️ minor | UNITS duplicato in constants.js e useShopping.js; AI_MAX_DAILY_CALLS duplicato in useBrain.js |
| Build | ✅ CLEAN | 0 errori, 0 warning, 267 file PWA precache |

---

## Ordine consigliato sessioni

1. ✅ **Fase 0** (fondamenta) — COMPLETATA
2. ✅ **Dashboard + Brain** — COMPLETATA
3. ✅ **Calendario** — COMPLETATA
4. ✅ **Task + Rewards** — COMPLETATA
5. ✅ **Spese + Budget** — COMPLETATA
6. ✅ **Dispensa** — COMPLETATA
7. ✅ **Pasti** — COMPLETATA
8. ✅ **Settings + Sync + Login** — COMPLETATA
9. ✅ **Pulizia + Performance** — COMPLETATA
10. ⬜ **Test reale** — DA FARE (dispositivo + famiglia)

> "Un'app che fa 12 cose al 100% batte 100 app che fanno 1 cosa."
> — La sfida è qui. Ci siamo quasi.
