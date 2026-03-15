# Fammi Questo

> La famiglia organizzata, semplicemente.

App **local-first** per la gestione familiare: spese, calendario, task con gamification, dispensa, pasti e AI vocale — tutto in italiano.

## Piattaforme

| Piattaforma | Stato | Build |
|------------|-------|-------|
| Android | ✅ Attivo | Android Studio / GitHub Actions |
| iOS | ✅ Attivo | GitHub Actions (macOS runner) |
| Web (PWA) | ✅ Attivo | Vite build |

## Stack

React 19 + Vite 7 + Tailwind CSS 4 + Capacitor 8 + Dexie.js (IndexedDB) + Supabase (opzionale) + Zustand

## Quick Start

```bash
npm install
npm run dev          # Dev server
npm run build        # Production build
npm test             # Vitest
npm run cap:sync     # Sync Android + iOS
```

## Build nativi

```bash
# Android
npm run cap:sync:android
npm run cap:open           # Apre Android Studio

# iOS
npm run cap:sync:ios
npm run cap:open:ios       # Apre Xcode (solo macOS)
```

## CI/CD

GitHub Actions compila automaticamente ad ogni push su `main`:

- **Android:** build APK su Ubuntu runner
- **iOS:** build su macOS-14 runner (Apple Silicon)

Per pubblicare su App Store: workflow manuale `Release iOS` con certificati Apple nei GitHub Secrets.

Vedere `SETUP_IOS.md` per la guida completa.

## Cross-platform

L'app è identica su Samsung e iPhone. Le differenze UI sono gestite automaticamente:

- Safe areas per notch/Dynamic Island (iOS) e gesture navigation (Android)
- Touch feedback nativo per piattaforma (opacity flash iOS, scale Android)
- Tastiera: bottom nav si nasconde, input auto-scroll in vista
- Haptic feedback su tap, conferma e errori
- Status bar integrata con il brand viola

## Documentazione

| File | Contenuto |
|------|-----------|
| `1_MASTER_ARCHITECTURE.md` | Architettura, stack, sicurezza, sync |
| `2_PRODUCT_SCOPE_V1.md` | Scope V1, release plan, Definition of Done |
| `3_BUILD_ORDER_CURSOR.md` | Build order operativo |
| `4_DATA_MODEL.md` | Modello dati Dexie + Supabase |
| `5_API_CONTRACTS.md` | Contratti API Edge Functions |
| `6_AUDIT_CERVELLONE_NLP.md` | Pipeline NLP (Il Cervellone) |
| `SETUP_IOS.md` | Guida setup iOS + GitHub Actions |
| `SETUP_NOTIFICATIONS.md` | Setup notifiche native |

## Privacy

I dati della famiglia risiedono **sul dispositivo** (IndexedDB via Dexie.js). La sync cloud è opzionale e usa crittografia AES-256-GCM campo-per-campo. Nemmeno gli sviluppatori possono leggere i dati degli utenti.
