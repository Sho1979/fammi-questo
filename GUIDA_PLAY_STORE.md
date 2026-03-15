# Fammi Questo — Guida Pubblicazione Google Play Store

> Tutto quello che serve per pubblicare l'app su Google Play.
> Creato il 15 marzo 2026.

---

## Panoramica del processo

La pubblicazione su Google Play richiede 5 fasi principali:

1. Preparazione account sviluppatore Google
2. Preparazione dell'APK/AAB firmato
3. Creazione della scheda Play Store (listing)
4. Configurazione privacy e contenuti
5. Sottomissione per la review

Tempo stimato: 3-5 giorni (inclusa la review di Google).

---

## FASE 1 — Account Google Play Developer

### 1.1 Registrazione

Vai su https://play.google.com/console e registrati con il tuo account Google.

- **Costo:** 25$ una tantum (pagamento unico, non annuale)
- **Tipo account:** Personale (per iniziare) oppure Organizzazione
- **Documenti:** serve un documento d'identità per la verifica
- **Tempo:** la verifica dell'identità richiede 1-3 giorni lavorativi

### 1.2 Informazioni sviluppatore

Dovrai compilare:

- Nome sviluppatore visibile sul Play Store (es. "Cristian" o "Fammi Questo")
- Email di contatto pubblica
- Sito web (opzionale ma consigliato — può essere un link GitHub)
- Indirizzo fisico (obbligatorio dal 2024 per app con account)
- Numero di telefono

---

## FASE 2 — Preparazione del build firmato

### 2.1 Generare la keystore di firma

La keystore è il "certificato" che identifica te come sviluppatore. **Non perderla mai** — senza di essa non puoi più aggiornare l'app.

```bash
# Genera la keystore (esegui UNA SOLA VOLTA)
keytool -genkey -v \
  -keystore fammi-questo-release.keystore \
  -alias fammi-questo \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass LA_TUA_PASSWORD_SICURA \
  -keypass LA_TUA_PASSWORD_SICURA \
  -dname "CN=Cristian, O=Fammi Questo, L=Italia, C=IT"
```

**IMPORTANTE:** salva la keystore e le password in un posto sicuro. Se le perdi, non puoi più aggiornare l'app sullo Store.

### 2.2 Configurare la firma in Android

Crea il file `android/keystore.properties` (NON committare su git!):

```properties
storeFile=../fammi-questo-release.keystore
storePassword=LA_TUA_PASSWORD_SICURA
keyAlias=fammi-questo
keyPassword=LA_TUA_PASSWORD_SICURA
```

Modifica `android/app/build.gradle` per usare la keystore:

```groovy
// Aggiungi in cima al file, dopo i plugin
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('keystore.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // ... configurazione esistente ...

    signingConfigs {
        release {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            // ProGuard non necessario per app Capacitor/WebView
        }
    }
}
```

### 2.3 Build AAB (Android App Bundle)

Google Play richiede il formato AAB (non APK):

```bash
# 1. Build web
npm run build

# 2. Sync con Android
npx cap sync android

# 3. Build AAB firmato
cd android
./gradlew bundleRelease
```

Il file AAB sarà in: `android/app/build/outputs/bundle/release/app-release.aab`

### 2.4 Testare il build

Prima di pubblicare, testa il build release sul tuo telefono:

```bash
cd android
./gradlew assembleRelease

# Installa l'APK release sul device
adb install app/build/outputs/apk/release/app-release.apk
```

---

## FASE 3 — Scheda Play Store (Listing)

### 3.1 Informazioni base

| Campo | Valore consigliato |
|-------|-------------------|
| Nome app | Fammi Questo |
| Breve descrizione (80 char) | Organizza la tua famiglia con una frase. Spese, task, calendario, AI vocale. |
| Descrizione completa | Vedi sotto |
| Categoria | Produttività > Strumenti personali |
| Tag | famiglia, organizzazione, spese, task, calendario |

### 3.2 Descrizione completa (4000 char max)

```
Fammi Questo — La famiglia organizzata, semplicemente.

Gestisci tutto della tua famiglia con la voce: "Ho speso 45 euro di benzina", "Domani Lorenzo ha calcio alle 16", "Ricordami di comprare il latte". Il Cervellone, l'AI integrata, capisce l'italiano e organizza tutto per te.

FUNZIONALITÀ PRINCIPALI

Spese e Budget
Traccia le spese di tutta la famiglia, imposta budget mensili, visualizza statistiche con grafici. Ogni membro ha il suo profilo con spese separate.

Calendario Familiare
Eventi, appuntamenti, attività sportive dei figli — tutto in un calendario condiviso con vista giornaliera, settimanale e mensile.

Task e Gamification
Assegna compiti ai figli con un sistema di punti e classifiche settimanali. I figli possono proporre task, i genitori approvano. Premi configurabili.

Dispensa e Lista Spesa
Gestisci l'inventario della dispensa con avvisi scadenza. Lista della spesa condivisa che si aggiorna in tempo reale.

Pasti e Menu Settimanale
Pianifica i pasti della settimana, vota i piatti preferiti, genera automaticamente la lista spesa.

Il Cervellone — AI Vocale
Parla all'app in italiano naturale. L'AI capisce cosa vuoi fare e lo organizza per te. Funziona anche offline con NLP locale.

PRIVACY PRIMA DI TUTTO

I tuoi dati restano SUL TUO TELEFONO. Non raccogliamo nulla. La sincronizzazione cloud è opzionale e crittografata end-to-end con AES-256. Nemmeno noi possiamo leggere i tuoi dati.

Funziona al 100% offline. Nessun account email richiesto. Nessuna pubblicità. Nessun tracciamento.

PERFETTA PER TUTTA LA FAMIGLIA

Ogni membro ha il suo profilo con PIN personale e permessi diversi in base all'età:
- Genitori: accesso completo
- Ragazzi (13-17): calendario, task, lista spesa
- Bambini (6-12): task propri e premi

Sincronizza tra dispositivi della famiglia (Android e iPhone) con un semplice codice invito.
```

### 3.3 Asset grafici richiesti

| Asset | Dimensione | Note |
|-------|-----------|------|
| Icona app | 512x512 px | PNG, 32-bit, senza trasparenza (usa logo viola su sfondo #6C5CE7) |
| Feature graphic | 1024x500 px | Banner in cima alla scheda (logo + tagline + mockup) |
| Screenshot telefono | Min 2, max 8 | 16:9 o 9:16, min 320px, max 3840px |
| Screenshot tablet (opz.) | 7" e 10" | Consigliati per visibilità |

**Consiglio screenshot:** crea 5-6 screenshot che mostrano: Dashboard, Cervellone (AI vocale), Calendario, Task/Rewards, Spese/Budget, Dispensa.

---

## FASE 4 — Privacy e Contenuti

### 4.1 Dichiarazione Privacy (Data Safety)

Google richiede la compilazione della sezione "Data Safety". Per Fammi Questo:

| Domanda | Risposta |
|---------|---------|
| L'app raccoglie dati utente? | Sì (se sync attivo: dati famiglia crittografati) |
| L'app condivide dati con terze parti? | No |
| I dati sono crittografati in transito? | Sì (HTTPS + AES-256-GCM) |
| L'utente può richiedere la cancellazione? | Sì (cancella tutti i dati da Settings) |
| L'app funziona senza raccolta dati? | Sì (modalità offline = zero dati raccolti) |

Tipi di dati da dichiarare (solo se sync attivo):

- Informazioni personali: nome (membro famiglia)
- Informazioni finanziarie: spese (crittografate)
- Calendario: eventi (crittografati)
- Contenuti app: task, liste (crittografati)

### 4.2 Privacy Policy

Devi avere una privacy policy pubblica accessibile via URL. Opzioni:

1. Crea una pagina su GitHub Pages
2. Usa un servizio come Termly o Iubenda
3. Scrivi una pagina HTML semplice

La privacy policy deve spiegare che i dati sono salvati localmente, la sync è opzionale e crittografata, e non vengono condivisi dati con terze parti.

### 4.3 Content Rating

Google richiede un questionario IARC per la classificazione dei contenuti:

- **Violenza:** Nessuna
- **Contenuti sessuali:** Nessuno
- **Linguaggio:** Nessuno
- **Sostanze:** Nessuna
- **Interattività:** Nessuna (niente chat pubblica)

Risultato atteso: **PEGI 3 / Everyone** (adatta a tutte le età).

### 4.4 Target audience

- **Età minima:** 13+ (per l'uso di AI e gestione dati finanziari)
- **Destinata ai bambini?** No (destinata alle famiglie, i genitori gestiscono gli account)
- **Contiene pubblicità?** No

---

## FASE 5 — Sottomissione e Review

### 5.1 Tipo di rilascio

Google offre 3 opzioni:

- **Internal testing** (max 100 tester, no review) — per testare tu e la famiglia
- **Closed testing** (invito via email, review leggera) — per beta testers
- **Production** (pubblico, review completa) — per il lancio

**Consiglio:** parti con Internal testing → poi Closed testing → poi Production.

### 5.2 Procedura di upload

1. Vai su Play Console → Crea app
2. Compila le informazioni base
3. Vai su "Rilascio" → "Produzione" (o Testing)
4. Carica il file `.aab`
5. Compila la scheda Store
6. Compila Data Safety
7. Compila Content Rating
8. Clicca "Invia per la review"

### 5.3 Tempi di review

- **Internal testing:** immediato (nessuna review)
- **Closed testing:** 1-3 giorni
- **Production:** 3-7 giorni (prima pubblicazione più lunga)

### 5.4 Motivi comuni di rifiuto

Evita questi errori:

- Privacy policy mancante o non accessibile
- Data Safety non compilata o incoerente
- Screenshot con contenuti di altre app
- Descrizione che promette funzionalità non presenti
- App che crasha all'avvio (testa sempre il build release!)

---

## FASE 6 — Dopo la pubblicazione

### 6.1 Aggiornamenti

Per ogni aggiornamento:

```bash
# Incrementa la versione in android/app/build.gradle
# versionCode += 1 (numero intero, sempre crescente)
# versionName = "1.0.1" (visibile all'utente)

npm run build
npx cap sync android
cd android && ./gradlew bundleRelease
# Carica il nuovo AAB su Play Console
```

### 6.2 Crash reporting

Attiva i report crash nella Play Console per monitorare stabilità.

### 6.3 Rispondi alle recensioni

Google premia le app che rispondono alle recensioni. Rispondi sempre in modo cortese e costruttivo.

---

## Checklist finale pre-pubblicazione

- [ ] Account Google Play Developer creato e verificato (25$)
- [ ] Keystore generata e salvata in posto sicuro
- [ ] Build AAB firmato testato su device reale
- [ ] Icona 512x512 creata
- [ ] Feature graphic 1024x500 creata
- [ ] Almeno 4 screenshot del telefono
- [ ] Descrizione breve (80 char) e completa scritta
- [ ] Privacy policy pubblicata online (URL accessibile)
- [ ] Data Safety compilata
- [ ] Content Rating completata
- [ ] Testato offline (airplane mode)
- [ ] Testato cambio membro (login/logout)
- [ ] Testato su almeno 2 device diversi
- [ ] `keystore.properties` aggiunto a `.gitignore`
- [ ] `fammi-questo-release.keystore` NON committata su git

---

## Costi riepilogo

| Voce | Costo | Frequenza |
|------|-------|-----------|
| Google Play Developer | 25$ | Una tantum |
| Apple Developer (per iOS) | 99€ | Annuale |
| GitHub Actions (build) | Gratuito (piano free) | — |
| Server (Supabase free tier) | 0€ | — |
| **Totale per partire** | **~25$** | — |
