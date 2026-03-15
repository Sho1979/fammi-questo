# Fammi Questo — Governance

> Questo file è il punto d'ingresso. Leggi questo PRIMA di qualsiasi altro file.
> Ultimo aggiornamento: 14 marzo 2026.

---

## Fonti di verità (in ordine di autorità)

| # | File | Ruolo | Autorità |
|---|------|-------|----------|
| 0 | `0_GOVERNANCE.md` | Indice e regole meta | **Massima.** Se un altro file contraddice questo, vince questo. |
| 1 | `1_MASTER_ARCHITECTURE.md` | Vincoli, stack, modello dati, sync, sicurezza, convenzioni | **Normativo.** Nessun codice può violare questo documento. |
| 2 | `2_PRODUCT_SCOPE_V1.md` | Scope delle 3 release, modello dati per release, Definition of Done | **Decisionale.** Cosa si costruisce e cosa no. |
| 3 | `3_BUILD_ORDER_CURSOR.md` | Sequenza operativa per Cursor: step numerati, verifica per step | **Esecutivo.** L'ordine esatto di implementazione. |
| 4 | `4_DATA_MODEL.md` | Schema entità, record d'esempio, relazioni, invarianti, constraints logici | **Referenziale.** Il modello dati è il cuore dell'app. Ogni tabella Dexie.js è definita qui. |
| 5 | `5_API_CONTRACTS.md` | Payload Brain AI, formato sync per-table, formato backup, Realtime events | **Interoperabilità.** Definisce i contratti tra moduli. Se cambi un contratto, aggiorni entrambi i lati. |
| 6 | `6_AUDIT_CERVELLONE_NLP.md` | Documentazione tecnica completa: pipeline NLP 3+1 livelli, contratto canonico azioni, Sprint 1-4, audit completati | **Documentazione tecnica.** La fonte di verità dettagliata per il Cervellone e lo stato del codice. |

**Il file 6 è il documento tecnico più completo e aggiornato.** Per la pipeline NLP, i contratti delle azioni canoniche e lo stato degli sprint, fare riferimento al file 6.

---

## File archiviati (NON usare per decisioni)

| File | Stato | Motivo |
|------|-------|--------|
| `docs/archive/PIANO_FAMMI_QUESTO_CURSOR.md` | Archiviato | Contiene contraddizioni local-first vs Supabase completo. Superato dalla triade. |
| `docs/archive/PIANO_FAMMI_QUESTO.md` | Archiviato | Architettura backend tradizionale (Node/PHP + SQLite server-side). Filosofia diversa. |
| `docs/archive/CONFRONTO_ARCHITETTURE_FAMMI_QUESTO.md` | Archiviato | Utile storicamente. La scelta architetturale è stata fatta (local-first + Supabase relay). |

Questi file restano nel repository come documentazione storica. Non devono influenzare nessuna decisione di codice.

---

## Regole per chi scrive codice (umano o AI)

1. **In caso di dubbio, vince il MASTER.** Se il BUILD_ORDER dice una cosa e il MASTER ne dice un'altra, segui il MASTER.

2. **Lo scope è chiuso per release.** Non aggiungere feature non presenti nel PRODUCT_SCOPE per la release corrente. Se serve qualcosa di nuovo, prima lo si aggiunge al PRODUCT_SCOPE e si rivalida.

3. **L'ordine è sacro.** Non saltare step nel BUILD_ORDER. Ogni step ha una verifica. Se la verifica fallisce, non andare avanti.

4. **Nessuna release successiva senza validazione della precedente.** R2 non si inizia finché R1 non passa TUTTE le Definition of Done. R3 non si inizia finché R2 non è validata **su due dispositivi reali**.

5. **Zero librerie non autorizzate.** Lo stack è definito nel MASTER sezione 2. Se serve una libreria nuova, prima si aggiunge al MASTER e si motiva.

6. **⚠️ SYNC IN CHIARO (DEBITO TECNICO).** Attualmente la sync invia i dati a Supabase **in chiaro per tabella** (14 tabelle separate). Il modello blob crittografato descritto originariamente in questo documento **non è stato implementato**. Questo è il debito tecnico di sicurezza più importante. L'obiettivo resta: nessun dato leggibile sul cloud. Il backup locale (.fmbackup) è invece crittografato con AES-256-GCM via PIN.

---

## Come dare questi file a Cursor

Opzione A — Project context (consigliata):
Metti i 7 file (0, 1, 2, 3, 4, 5, 6) nella root del progetto. In Cursor, aggiungi la cartella come context. Cursor li leggerà automaticamente.

Opzione B — Rules for AI:
In Cursor Settings → Rules for AI, incolla:

```
You are building Fammi Questo, a local-first family management PWA.

MANDATORY: Before writing any code, read these files in order:
1. 0_GOVERNANCE.md — source of truth hierarchy
2. 1_MASTER_ARCHITECTURE.md — all architectural constraints
3. 2_PRODUCT_SCOPE_V1.md — what to build per release
4. 3_BUILD_ORDER_CURSOR.md — exact build sequence
5. 4_DATA_MODEL.md — entity schemas, examples, relationships, invariants
6. 5_API_CONTRACTS.md — Brain AI payload, sync format, backup format
7. 6_AUDIT_CERVELLONE_NLP.md — full technical docs, NLP pipeline, canonical contract, sprint status

RULES:
- Follow the build order step by step. Do not skip.
- No persistence logic in React components. Use hooks and src/lib/ only.
- Only use libraries listed in MASTER_ARCHITECTURE section 2.
- All user data stays in IndexedDB (Dexie.js). Supabase sync currently sends per-table in clear (tech debt — blob encryption planned).
- Interface language: Italian. Code language: English.
- Mobile-first. Base width: 375px.
- Tailwind only. No custom CSS files.
```

Opzione C — Per conversazione:
Ad ogni nuova chat con Cursor, incolla: "Leggi 0_GOVERNANCE.md, poi 1_MASTER_ARCHITECTURE.md, poi 4_DATA_MODEL.md, poi 5_API_CONTRACTS.md, poi segui 3_BUILD_ORDER_CURSOR.md dallo step [N]."
