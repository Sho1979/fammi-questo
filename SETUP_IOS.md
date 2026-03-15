# Fammi Questo — Guida Setup iOS

> L'app è già cross-platform grazie a Capacitor.
> Questa guida spiega come attivare il build iOS senza avere un Mac.

---

## Prerequisiti

1. **Account Apple Developer** (99€/anno) — necessario per pubblicare su App Store
   → Registrati su https://developer.apple.com/programs/
2. **Repository su GitHub** (già presente?)
3. **Node.js 20+** (già presente)

---

## Passo 1 — Aggiungere la piattaforma iOS

Esegui dal terminale nella root del progetto:

```bash
# Installa il pacchetto iOS di Capacitor
npm install @capacitor/ios@^8.2.0

# Aggiungi la piattaforma
npx cap add ios

# Build + sync
npm run cap:sync:ios
```

Oppure usa lo script pronto:
```bash
bash scripts/setup-ios.sh
```

Dopo questo comando avrai una cartella `ios/` nel progetto.

---

## Passo 2 — Configurare GitHub Secrets

Vai su GitHub → Repository → Settings → Secrets and variables → Actions.

### Secrets per il build di debug (gratuito)
Nessun secret necessario! Il workflow `build-ios.yml` compila senza firma.

### Secrets per pubblicare su App Store (quando sei pronto)
Dovrai aggiungere:

| Secret | Dove trovarla |
|--------|--------------|
| `IOS_DISTRIBUTION_CERT_P12` | Certificato .p12 esportato da Apple Developer (base64) |
| `IOS_DISTRIBUTION_CERT_PASSWORD` | Password del certificato .p12 |
| `IOS_PROVISIONING_PROFILE` | Provisioning profile (base64) |
| `APP_STORE_CONNECT_ISSUER_ID` | App Store Connect → Users → API Keys |
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect → Users → API Keys |
| `APP_STORE_CONNECT_API_PRIVATE_KEY` | File .p8 scaricato da App Store Connect |

---

## Passo 3 — Come funziona il build

### Build automatico (ad ogni push su main)
```
git push origin main
```
GitHub Actions farà:
1. Build web (npm run build)
2. Test (npm test)
3. Build Android APK (su Ubuntu)
4. Build iOS (su macOS) ← il Mac è nel cloud!

Vai su GitHub → Actions per vedere lo stato del build.

### Build manuale per release
Vai su GitHub → Actions → "Release iOS" → Run workflow → inserisci la versione.

---

## Passo 4 — Testare su iOS

### Senza Mac (TestFlight)
Una volta pubblicata su TestFlight tramite il workflow di release,
chiunque nella tua famiglia con un iPhone può installarla da TestFlight.

### Con simulatore (solo su macOS)
```bash
npx cap open ios   # Apre Xcode
# Premi ▶ per avviare il simulatore
```

---

## Comandi utili

| Comando | Cosa fa |
|---------|---------|
| `npm run cap:sync` | Build web + sync Android + iOS |
| `npm run cap:sync:ios` | Build web + sync solo iOS |
| `npm run cap:sync:android` | Build web + sync solo Android |
| `npm run cap:open:ios` | Apre progetto in Xcode (solo su Mac) |

---

## Note sulla compatibilità

L'app "Fammi Questo" usa tecnologie 100% compatibili con iOS:

| Tecnologia | iOS | Note |
|-----------|-----|------|
| React + Vite | ✅ | WebKit (Safari engine) |
| Dexie (IndexedDB) | ✅ | Supportato da Safari 10+ |
| Supabase JS | ✅ | Puro JavaScript |
| Zustand | ✅ | Puro JavaScript |
| Tailwind CSS | ✅ | CSS standard |
| @capacitor/local-notifications | ✅ | Plugin nativo iOS incluso |
| @nlpjs | ✅ | Puro JavaScript |
| bcryptjs | ✅ | Puro JavaScript |

---

## Costi

| Voce | Costo |
|------|-------|
| GitHub Actions (macOS runner) | ~40 min gratis/mese, poi $0.08/min |
| Apple Developer Program | 99€/anno |
| TestFlight (beta testing) | Gratuito |

> **Tip:** Il build iOS su GitHub Actions consuma minuti macOS a 10x rispetto
> a Linux. Con il piano gratuito hai ~200 min/mese di macOS.
> Per un build ogni tanto è più che sufficiente.
