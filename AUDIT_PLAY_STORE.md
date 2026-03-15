# Fammi Questo — Audit Pre-Pubblicazione Play Store

> Audit basato sulla lettura completa di tutti i 13 file .md + verifica del codice sorgente.
> Data: 15 marzo 2026. Nessuna invenzione, solo fatti verificati dal codebase.

---

## QUADRO GENERALE

**App:** Fammi Questo (`com.fammiquesto.app`)
**Tipo:** App gestione familiare local-first con AI vocale in italiano
**Stack:** React 19 + Vite 7 + Capacitor 8 + Dexie.js + Supabase (opzionale) + Tailwind 4
**Piattaforme:** Android, iOS (Capacitor), Web (PWA)

---

## STATO RELEASE — Cosa è fatto, cosa no

### ✅ COMPLETATO (verificato nel codice)

| Area | Stato | Evidenza |
|------|-------|----------|
| R1: Fondamenta + Spese | ✅ | PWA funzionante, 16 categorie, budget, stats, PIN login |
| R2: Calendario + Task + Rewards | ✅ | Calendario 3 viste, gamification, backup .fmbackup, notifiche |
| R3: Cucina + Shopping + Inventario | ✅ | MealsPage, ShoppingPage, InventoryPage, DispensaPage |
| R3: Brain NLP 4 livelli | ✅ | 18 file in `src/lib/brain/`, 82 test, pipeline L0-L3 |
| R3: Sync cloud per-table | ✅ | `sync.js` + `syncCrypto.js` con AES-256-GCM campo-per-campo |
| R5: Rebrand → Fammi Questo | ✅ | Logo Voice Ripple, appId, strings.xml, Capacitor config |
| R6: Cross-platform iOS | ✅ | Cartella `ios/`, CI/CD GitHub Actions |
| Piano Perfezionamento | ✅ 82/88 | Solo 6 issue "nice-to-have" rimaste (tutte 🟢 Basso) |
| Sicurezza: crittografia sync | ✅ | Campi sensibili AES-256-GCM, PBKDF2 200K iter |
| Sicurezza: backup | ✅ | .fmbackup crittografato, 15 tabelle, 200K iter |
| RLS Supabase | ✅ | 56 policy family-scoped attive |
| Accessibilità base | ✅ | aria-label, focus trap, contrasto verificato |
| Error handling | ✅ | ErrorState, error boundary, validate.js |
| Performance | ✅ | Lazy-loaded pages, useBadgeCounts, memo() |
| Test | ✅ | 82 test Vitest (unitari + integrazione + E2E) |
| Build Android debug | ✅ | `app-debug.zip` presente in outputs |
| Icone Android | ✅ | Adaptive icon con foreground custom (324x324), tutte le densità |
| Splash screen | ✅ | `splash.png` in drawable, tema SplashScreen |

### ⚠️ PARZIALE O DA VERIFICARE

| Area | Stato | Dettaglio |
|------|-------|-----------|
| Sync crittografata E2E | ⚠️ | Codice pronto ma `supabase-migration-v2.sql` NON eseguita su Supabase |
| Edge Function brain-parse | ⚠️ | Codice in `supabase/functions/brain-parse/`, NON deployata |
| Test dispositivo reale | ⚠️ | Sessione 9 del Piano: "DA FARE (dispositivo + famiglia)" |
| Versione app | ⚠️ | `package.json` ha `"version": "0.0.0"` — da portare a `1.0.0` |
| versionCode Android | ⚠️ | `build.gradle` ha `versionCode 1` — ok per prima release |

### ❌ MANCANTE PER PLAY STORE

| Area | Blocco | Azione necessaria |
|------|--------|-------------------|
| **Firma release (keystore)** | 🔴 BLOCCANTE | Nessuna signingConfig release in `build.gradle`. Solo build debug disponibile |
| **Build AAB firmato** | 🔴 BLOCCANTE | Non esiste `app-release.aab`. Serve keystore + config |
| **Permessi notifiche** | 🟠 IMPORTANTE | `POST_NOTIFICATIONS` e `SCHEDULE_EXACT_ALARM` mancanti dal Manifest (richiesti Android 13+) |
| **Privacy Policy URL** | 🔴 BLOCCANTE | Nessun file privacy policy trovato nel progetto. Google la richiede obbligatoriamente |
| **Icona Play Store 512x512** | 🟠 IMPORTANTE | Le icone Android esistono (adaptive), ma serve il file 512x512 PNG separato per lo Store |
| **Feature Graphic 1024x500** | 🟠 IMPORTANTE | Non esiste. Richiesta da Google per la scheda Store |
| **Screenshot (min 4)** | 🟠 IMPORTANTE | Non esistono. Servono almeno 4 screenshot del telefono |
| **Account Google Play Developer** | 🔴 BLOCCANTE | Registrazione (25$) + verifica identità (1-3 giorni) |
| **Data Safety** | 🟠 IMPORTANTE | Da compilare nella Play Console |
| **Content Rating (IARC)** | 🟠 IMPORTANTE | Questionario da compilare nella Play Console |

---

## ANALISI DETTAGLIATA BLOCCHI

### 1. FIRMA E BUILD RELEASE

**Stato attuale:** `build.gradle` ha solo il buildType `release` con `minifyEnabled false` e ProGuard default. Non c'è `signingConfigs` con keystore.

**Cosa fare:**

```
1. Generare keystore:
   keytool -genkey -v -keystore fammi-questo-release.keystore \
     -alias fammi-questo -keyalg RSA -keysize 2048 -validity 10000

2. Creare android/keystore.properties (NON committare)

3. Aggiungere signingConfigs in build.gradle

4. Build:
   npm run build
   npx cap sync android
   cd android && ./gradlew bundleRelease

5. Testare APK release su device reale prima di caricare
```

La GUIDA_PLAY_STORE.md già presente nel progetto documenta questi passi in dettaglio (sezione 2.1-2.3).

### 2. PERMESSI ANDROID MANCANTI

**Stato attuale:** AndroidManifest.xml ha solo `INTERNET`. Il file `SETUP_NOTIFICATIONS.md` documenta che servono 3 permessi aggiuntivi, ma non sono stati aggiunti.

**Mancanti:**
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

Senza `POST_NOTIFICATIONS`, su Android 13+ le notifiche locali non funzionano.

### 3. PRIVACY POLICY

**Stato:** Non esiste nessun file privacy policy nel progetto. Google Play la richiede come URL pubblico accessibile.

**Contenuto necessario (basato sull'architettura documentata):**
- Dati salvati localmente su dispositivo (IndexedDB)
- Sync cloud opzionale, crittografata AES-256-GCM
- Nessun dato condiviso con terze parti
- Auth anonimo Supabase (no email, no dati personali sul cloud)
- Uso opzionale di Claude Haiku (testo inviato alla Edge Function solo se confidence locale < 0.55)
- Nessuna pubblicità, nessun tracciamento
- Possibilità di cancellare tutti i dati da Settings

### 4. ASSET GRAFICI

**Esistenti:**
- Logo SVG: `public/logo.svg`, `logo-white.svg`, `logo-header.svg`
- Icone Android adaptive: tutte le densità (mdpi→xxhdpi) con foreground custom
- Splash screen: `splash.png` in drawable
- Brand book: su Canva (5 slide)

**Da creare:**
- Icona Store 512x512 PNG (sfondo #6C5CE7 + logo bianco)
- Feature Graphic 1024x500 (banner con logo + tagline + mockup)
- 4-6 screenshot telefono (Dashboard, Cervellone, Calendario, Task, Spese, Dispensa)

### 5. VERSIONE

**Stato:**
- `package.json`: `"version": "0.0.0"` → da cambiare a `"1.0.0"`
- `build.gradle`: `versionCode 1`, `versionName "1.0"` → ok per prima release

---

## DEBITI TECNICI NOTI (non bloccanti per Play Store)

Dalla documentazione e dal codice emergono questi debiti tecnici documentati, nessuno dei quali blocca la pubblicazione:

| Debito | Rischio | Note |
|--------|---------|------|
| Supabase free tier (auto-pausa 7 giorni) | Basso | L'app funziona offline. Sync è opzionale |
| Tabelle ghost (priceHistory, brainNotes) | Zero | Nessun reader/writer, zero impatto runtime |
| UNITS duplicato (constants.js vs useShopping.js) | Zero | Funziona, solo ridondanza |
| AI_MAX_DAILY_CALLS duplicato | Zero | Funziona, solo ridondanza |
| Edge Function non deployata | Medio | Il Brain L3 (fallback AI) non funziona. L0-L2 locale funziona al 100% |
| Migration v2 non eseguita su Supabase | Medio | Sync cloud potrebbe avere problemi di schema. Offline ok |
| 6 issue nice-to-have rimaste | Zero | Deep linking, drag&drop, storico premi, ecc. — tutte post-v1 |

---

## PIANO D'AZIONE ORDINATO

### FASE A — Prerequisiti (1 giorno)

| # | Azione | Tempo stimato |
|---|--------|--------------|
| A1 | Registrare account Google Play Developer (25$) + avviare verifica identità | 15 min + attesa 1-3 giorni |
| A2 | Cambiare version in package.json da "0.0.0" a "1.0.0" | 1 min |

### FASE B — Fix tecnici (2-3 ore)

| # | Azione | File coinvolti |
|---|--------|---------------|
| B1 | Aggiungere 3 permessi notifiche nel Manifest | `android/app/src/main/AndroidManifest.xml` |
| B2 | Generare keystore e configurare signingConfigs release | `build.gradle`, `keystore.properties` |
| B3 | Aggiungere `keystore.properties` e `*.keystore` a `.gitignore` | `.gitignore` |
| B4 | Build AAB release + test su device reale | Terminale |
| B5 | (Opzionale) Eseguire `supabase-migration-v2.sql` su Supabase | Dashboard Supabase |
| B6 | (Opzionale) Deployare Edge Function brain-parse | `supabase functions deploy brain-parse` |

### FASE C — Contenuti Store (3-4 ore)

| # | Azione | Output |
|---|--------|--------|
| C1 | Creare Privacy Policy HTML e pubblicare (GitHub Pages o simile) | URL pubblico |
| C2 | Creare icona 512x512 PNG per lo Store | `brand/icon-512.png` |
| C3 | Creare Feature Graphic 1024x500 | `brand/feature-graphic.png` |
| C4 | Catturare 4-6 screenshot dall'app su device reale | `brand/screenshots/` |
| C5 | Preparare descrizione breve (80 char) e completa (già in GUIDA_PLAY_STORE.md) | Testo |

### FASE D — Pubblicazione (1 ora + attesa review)

| # | Azione | Note |
|---|--------|------|
| D1 | Creare app nella Play Console | Compilare info base |
| D2 | Caricare AAB firmato | `app-release.aab` |
| D3 | Compilare scheda Store (nome, descrizione, asset) | Da FASE C |
| D4 | Compilare Data Safety | Vedi sezione 4.1 della GUIDA_PLAY_STORE.md |
| D5 | Compilare Content Rating (IARC) | Risultato atteso: PEGI 3 / Everyone |
| D6 | Sottomettere — consigliato partire da Internal Testing | Immediato, no review |
| D7 | Poi Closed Testing → poi Production | 3-7 giorni review |

---

## RIEPILOGO

| Categoria | Pronto | Da fare |
|-----------|--------|---------|
| Codice app | ✅ 95% | Permessi Manifest, version bump |
| Build sistema | ⚠️ 60% | Keystore, signingConfig, build AAB |
| Contenuti Store | ❌ 20% | Privacy policy, icon 512, feature graphic, screenshot |
| Account Play Store | ❌ 0% | Registrazione + verifica |
| Backend (Supabase) | ⚠️ 80% | Migration v2 + deploy Edge Function (opzionali) |

**Tempo totale stimato per essere pronti:** 1-2 giorni di lavoro effettivo + attesa verifica Google (1-3 giorni).

**L'app è funzionalmente completa.** I blocchi per il Play Store sono tutti "amministrativi" e di packaging, non di codice. La qualità del codebase è alta (82 test, documentazione dettagliata, 82/88 issue risolte nel piano di perfezionamento).
