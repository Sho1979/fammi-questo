# Code Reviewer — Fammi Questo

## Description
Revisiona codice per Fammi Questo verificando conformità alle regole architetturali, sicurezza, performance e best practices. Segnala violazioni dei vincoli documentali.

## When to Use
Usa quando vuoi fare review del codice scritto. Trigger: "review", "revisiona", "controlla il codice", "code review", "verifica conformità".

## Instructions

### Checklist di Review

#### 1. Conformità Architetturale
- [ ] Nessuna query diretta a Supabase per dati utente (solo Dexie)
- [ ] Nessun uso di `localStorage` (solo IndexedDB via Dexie)
- [ ] Componenti max 150 righe
- [ ] Dipendenze solo quelle approvate in `1_MASTER_ARCHITECTURE.md`
- [ ] Schema dati conforme a `4_DATA_MODEL.md`

#### 2. TypeScript
- [ ] Nessun `any` — usa `unknown` o tipi specifici
- [ ] Tutte le funzioni hanno tipi parametri e return
- [ ] Interfaces per props di ogni componente
- [ ] Strict mode rispettato

#### 3. Sicurezza
- [ ] Nessun dato sensibile in chiaro (PIN, device_secret)
- [ ] Crittografia AES-256-GCM per dati sincronizzati
- [ ] Input sanitizzato prima di salvataggio
- [ ] Nessun `dangerouslySetInnerHTML`

#### 4. Performance
- [ ] `useLiveQuery` con dependency array corretto
- [ ] `useMemo`/`useCallback` dove necessario
- [ ] Nessun re-render inutile (React DevTools)
- [ ] Bundle size controllato (no dipendenze pesanti)

#### 5. Accessibilità & UX
- [ ] Touch target >= 44px
- [ ] `aria-label` su bottoni con solo icona
- [ ] Testi UI in italiano
- [ ] Loading skeleton per stati di caricamento
- [ ] Error states gestiti con messaggi utente

#### 6. Data Integrity
- [ ] `_version` incrementato ad ogni update
- [ ] `updated_at` impostato su ogni write
- [ ] `_deleted = true` per soft delete (mai hard delete)
- [ ] `family_id` filtrato in tutte le query
- [ ] Records con `_deleted === true` filtrati nelle query

### Output Review
Produci un report con:
1. **BLOCCANTI** — Violazioni che impediscono il merge
2. **IMPORTANTI** — Problemi da risolvere presto
3. **SUGGERIMENTI** — Miglioramenti opzionali
4. **OK** — Cosa è fatto bene (rinforzo positivo)
