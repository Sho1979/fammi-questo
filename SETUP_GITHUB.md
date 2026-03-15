# Fammi Questo — Setup GitHub Repository

> Istruzioni da eseguire dal terminale del tuo PC (o dal terminale integrato di Android Studio).

---

## PREREQUISITI

- Git installato (`git --version` per verificare)
- Account GitHub attivo
- Connessione internet

---

## METODO A — Da github.com (consigliato se non hai gh CLI)

### 1. Crea il repository su GitHub

1. Vai su https://github.com/new
2. **Repository name:** `fammi-questo`
3. **Description:** "App gestione familiare local-first con AI vocale in italiano"
4. **Visibilità:** Private
5. **NON** spuntare "Add a README" (ne abbiamo già uno)
6. **NON** spuntare "Add .gitignore" (ne abbiamo già uno)
7. Clicca **Create repository**

### 2. Elimina la cartella .git rotta (se presente)

```bash
cd /percorso/della/tua/cartella/APP_Family_Local
# Se esiste una cartella .git rotta, eliminala:
rm -rf .git
```

### 3. Inizializza il repository e fai il primo commit

```bash
# Inizializza
git init -b main

# Aggiungi tutti i file (il .gitignore esclude automaticamente .env, node_modules, ecc.)
git add -A

# Verifica che .env NON sia incluso
git status | grep ".env"
# Devi vedere SOLO .env.example, NON .env

# Primo commit
git commit -m "feat: Fammi Questo v1.0.0 — initial commit

App gestione familiare local-first con:
- React 19 + Vite 7 + Capacitor 8 + Dexie.js
- Brain NLP italiano a 4 livelli (L0-L3)
- Sync cloud crittografata AES-256-GCM (opzionale)
- Gamification, calendario, task, spese, dispensa
- Android + iOS + PWA"
```

### 4. Collega a GitHub e pusha

```bash
# Sostituisci TUO_USERNAME con il tuo username GitHub
git remote add origin https://github.com/TUO_USERNAME/fammi-questo.git

# Pusha
git push -u origin main
```

Ti chiederà le credenziali GitHub. Se hai 2FA attivo (consigliato), dovrai usare un **Personal Access Token** al posto della password:
1. Vai su https://github.com/settings/tokens
2. "Generate new token (classic)"
3. Seleziona scope: `repo` (full control)
4. Copia il token e usalo come password quando git lo chiede

---

## METODO B — Con GitHub CLI (gh)

Se preferisci installare la GitHub CLI (più comodo per il futuro):

### 1. Installa gh

- **Windows:** `winget install GitHub.cli` oppure scarica da https://cli.github.com
- **Mac:** `brew install gh`
- **Linux:** `sudo apt install gh`

### 2. Autenticati

```bash
gh auth login
# Scegli: GitHub.com → HTTPS → Login with browser
```

### 3. Elimina .git rotta, inizializza e pusha

```bash
cd /percorso/della/tua/cartella/APP_Family_Local

# Se esiste .git rotta
rm -rf .git

# Inizializza
git init -b main
git add -A
git commit -m "feat: Fammi Questo v1.0.0 — initial commit"

# Crea repo E pusha in un colpo solo
gh repo create fammi-questo --private --source=. --push
```

---

## DOPO IL PUSH — Attiva GitHub Pages per la Privacy Policy

1. Vai su https://github.com/TUO_USERNAME/fammi-questo/settings/pages
2. **Source:** Deploy from a branch
3. **Branch:** `main`, cartella `/docs`
4. Salva
5. Dopo 1-2 minuti, la privacy policy sarà su:
   `https://TUO_USERNAME.github.io/fammi-questo/privacy-policy.html`

Questo URL è quello che metterai nella scheda Play Store.

---

## VERIFICA FINALE

Dopo il push, controlla che:

```bash
# Il repo è su GitHub
git remote -v
# Deve mostrare origin → github.com/TUO_USERNAME/fammi-questo

# Verifica che .env NON è su GitHub
# Vai su https://github.com/TUO_USERNAME/fammi-questo
# NON devi vedere il file .env nella root (solo .env.example)
```

---

## NOTE IMPORTANTI

- Il file `.env` contiene le chiavi Supabase — NON deve MAI finire su GitHub
- Il file `keystore.properties` e `*.keystore` sono in `.gitignore` — sicuri
- Se in futuro fai modifiche, il workflow è: `git add . && git commit -m "descrizione" && git push`
