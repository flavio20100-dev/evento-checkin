# Sistema Check-in Eventi Multi-Device

Sistema di check-in per eventi basato su Google Sheets, con interfaccia hostess senza login e dashboard admin protetta.

## Features MVP

✅ **Hostess Mode** (no login richiesto)
- Accesso con codice evento a 6 caratteri
- Ricerca invitati rapida
- Check-in con anti-doppio-check robusto
- Sincronizzazione automatica ogni 5 secondi
- Mobile-first responsive UI

✅ **Admin Mode** (Google OAuth)
- Collegamento Google Sheets esistenti
- Generazione codici evento automatica
- Visualizzazione eventi attivi
- Link diretti per hostess

✅ **Sicurezza**
- Lock ottimistico per prevenire doppi check-in
- Whitelist email/domini admin
- Service Account per accesso Sheets sicuro
- Event code validation server-side

## Prerequisiti

- **Node.js** 20.x o superiore ([Download](https://nodejs.org/))
- **Google Cloud Project** con Sheets API abilitata
- **Google Sheets** con liste invitati

---

## Setup Completo (Passo per Passo)

### 1. Installazione Node.js

Se non hai già installato Node.js:

**macOS** (via Homebrew):
```bash
brew install node
```

**Oppure scarica installer**: https://nodejs.org/en/download/

Verifica installazione:
```bash
node --version  # Deve mostrare v20.x o superiore
npm --version
```

### 2. Installazione Dipendenze

```bash
cd evento-checkin
npm install
```

Questo installerà tutte le dipendenze dichiarate in `package.json`.

### 3. Setup Google Cloud Project

#### 3.1 Crea Progetto

1. Vai a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea nuovo progetto (o usa esistente)
3. Nome suggerito: "Eventi Check-in"

#### 3.2 Abilita Google Sheets API

1. Nel progetto, vai a **APIs & Services** > **Library**
2. Cerca "Google Sheets API"
3. Click **Enable**

#### 3.3 Crea Service Account

1. Vai a **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **Service Account**
3. Nome: `eventi-checkin-sa`
4. Click **Create and Continue**
5. Role: **Editor** (opzionale per questo step)
6. Click **Done**

#### 3.4 Scarica JSON Key

1. Nella lista Service Accounts, click sulla email appena creata
2. Tab **Keys**
3. Click **Add Key** > **Create New Key**
4. Scegli tipo **JSON**
5. Click **Create** - scarica il file JSON
6. **IMPORTANTE**: Salva questo file in modo sicuro, lo userai dopo

La email del Service Account sarà tipo:
```
eventi-checkin-sa@your-project-id.iam.gserviceaccount.com
```

**Copia questa email**, la userai per condividere i Google Sheets.

#### 3.5 Configura OAuth 2.0 (per Admin Login)

1. Vai a **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth Client ID**
3. Se richiesto, configura **OAuth consent screen**:
   - User Type: **Internal** (se hai Google Workspace) o **External**
   - App name: "Eventi Check-in Admin"
   - User support email: tua email
   - Developer contact: tua email
   - Scopes: Nessuno (default va bene)
   - Test users (se External): aggiungi email admin
4. Torna a **Credentials** > **Create Credentials** > **OAuth Client ID**
5. Application type: **Web application**
6. Name: "Eventi Check-in Web"
7. Authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
   (Aggiungerai il dominio produzione dopo il deploy)
8. Click **Create**
9. **Copia Client ID e Client Secret** (li userai in `.env.local`)

### 4. Crea Registry Sheet (Master)

Questo foglio conterrà la lista di tutti gli eventi.

1. Vai a [Google Sheets](https://sheets.google.com)
2. Crea nuovo foglio, rinominalo "Registry Eventi"
3. Nella prima riga (header), inserisci queste colonne:

   

4. **Condividi il foglio** con la email del Service Account (quella copiata prima):
   - Click **Share** in alto a destra
   - Incolla email Service Account
   - Role: **Editor**
   - Deseleziona "Notify people"
   - Click **Share**

5. **Copia lo Sheet ID** dall'URL:
   ```
   https://docs.google.com/spreadsheets/d/1ABC...XYZ/edit
                                           ^^^^^^^^^
                                           Questo è lo Sheet ID
   ```

### 5. Configura Environment Variables

1. Copia il template:
   ```bash
   cp .env.example .env.local
   ```

2. Apri `.env.local` e compila:

```bash
# Google OAuth (dal passo 3.5)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Google Service Account (dal file JSON scaricato al passo 3.4)
# IMPORTANTE: Copia TUTTO il contenuto del file JSON in una sola riga
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"..."}

# Registry Sheet ID (dal passo 4)
REGISTRY_SHEET_ID=1ABC...XYZ

# NextAuth Secret (genera nuovo)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here-see-below

# Admin Access (le tue email autorizzate)
ALLOWED_ADMIN_EMAILS=tua-email@example.com,admin2@example.com
# OPPURE domini interi:
ALLOWED_ADMIN_DOMAINS=tuacompany.com
```

**Genera NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```
Copia l'output e incollalo in `NEXTAUTH_SECRET`.

⚠️ **IMPORTANTE**:
- `.env.local` è già in `.gitignore` - NON committare mai questo file
- Il Service Account Key deve essere tutto su una riga (JSON compresso)

### 6. Prepara Event Sheets (Opzionale - puoi farlo dopo)

Per ogni evento avrai un Google Sheet con la lista invitati. Esempio:

1. Crea nuovo Google Sheet
2. Prima riga (header):
   ```
   Nome | Cognome | Azienda | Email
   ```
3. Aggiungi invitati nelle righe successive
4. **Condividi con Service Account** (stesso procedimento del Registry Sheet)
5. **Copia Sheet ID** (servirà quando crei evento nell'admin dashboard)

**Nota**: Il sistema aggiungerà automaticamente le colonne per check-in (GuestId, Checkin, CheckinTime, etc.)

---

## Sviluppo Locale

### Avvia Server

```bash
npm run dev
```

Apri browser: http://localhost:3000

### Struttura URL

- **Homepage**: http://localhost:3000 → redirect a `/hostess`
- **Hostess Entry**: http://localhost:3000/hostess → inserisci codice evento
- **Hostess Check-in**: http://localhost:3000/hostess/ABC123 → con codice evento
- **Admin Login**: http://localhost:3000/admin → richiede Google OAuth
- **Sign In**: http://localhost:3000/auth/signin

### Test Funzionalità

1. **Login Admin**:
   - Vai su http://localhost:3000/admin
   - Click "Accedi con Google"
   - Usa email in whitelist (`ALLOWED_ADMIN_EMAILS`)

2. **Crea Evento**:
   - Nel dashboard admin, compila form:
     - Nome evento: "Test Event"
     - Data: oggi
     - Sheet ID: ID del tuo Event Sheet
     - Tab Name: "Invitati" (o nome tab nel foglio)
     - Event Code: lascia vuoto (auto-generato) o scegli (es. "TEST01")
   - Click "Crea Evento"
   - Copia il codice evento generato

3. **Test Hostess**:
   - Apri http://localhost:3000/hostess (meglio in incognito o altro browser)
   - Inserisci codice evento
   - Cerca invitato
   - Click "CHECK-IN"
   - Verifica nel Google Sheet che la riga si aggiorni

4. **Test Sincronizzazione**:
   - Apri due tab/browser su stesso evento (codice evento)
   - Fai check-in in uno
   - Verifica che l'altro si aggiorni entro ~5 secondi

---

## Deploy su Vercel (Produzione)

### 1. Crea Repository Git

```bash
cd evento-checkin
git init
git add .
git commit -m "Initial commit - MVP Check-in App"
```

Opzionale - push su GitHub:
```bash
gh repo create evento-checkin --private --source=. --remote=origin --push
```

### 2. Deploy Vercel

#### Opzione A: Via Dashboard

1. Vai su [vercel.com](https://vercel.com)
2. Click **Add New Project**
3. Importa repository GitHub
4. **Environment Variables**: aggiungi TUTTE le variabili da `.env.local`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_SERVICE_ACCOUNT_KEY`
   - `REGISTRY_SHEET_ID`
   - `NEXTAUTH_URL` = `https://tuo-dominio.vercel.app`
   - `NEXTAUTH_SECRET` (stesso di prima)
   - `ALLOWED_ADMIN_EMAILS`
   - `ALLOWED_ADMIN_DOMAINS` (opzionale)
5. Click **Deploy**

#### Opzione B: Via CLI

```bash
npm install -g vercel
vercel login
vercel
# Segui wizard, alla fine verrà deployato
```

Aggiungi env vars via dashboard o:
```bash
vercel env add GOOGLE_CLIENT_ID
# Ripeti per ogni variabile
```

### 3. Configura OAuth Redirect (IMPORTANTE)

Dopo deploy, avrai un URL tipo: `https://evento-checkin-xyz.vercel.app`

1. Torna su [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** > **Credentials**
3. Click sul tuo OAuth Client ID
4. **Authorized redirect URIs**, aggiungi:
   ```
   https://evento-checkin-xyz.vercel.app/api/auth/callback/google
   ```
   (Sostituisci con tuo dominio Vercel)
5. Click **Save**

### 4. Aggiorna NEXTAUTH_URL

In Vercel dashboard:
- **Settings** > **Environment Variables**
- Modifica `NEXTAUTH_URL` → `https://evento-checkin-xyz.vercel.app`
- **Redeploy** progetto (Deployments > ... > Redeploy)

---

## Utilizzo Produzione

### Per Admin

1. Vai su `https://tuo-dominio.vercel.app/admin`
2. Login con Google
3. Crea eventi collegando Google Sheets
4. Copia codice evento e link hostess
5. Condividi codice con team hostess

### Per Hostess

**Link diretto (consigliato)**:
```
https://tuo-dominio.vercel.app/hostess/ABC123
```
(Sostituisci ABC123 con codice evento)

**Oppure via entry page**:
1. Apri `https://tuo-dominio.vercel.app`
2. Inserisci codice evento
3. Cerca invitato → Check-in

---

## Troubleshooting

### Errore "Service Account Key invalid"

✅ Verifica che `GOOGLE_SERVICE_ACCOUNT_KEY` sia:
- Tutto su una riga (no newlines)
- JSON valido (copia-incolla da file scaricato)
- Con escape corretto delle virgolette se necessario

### Errore "Sheets API not enabled"

✅ Vai su Google Cloud Console > APIs & Services > Library
✅ Cerca "Google Sheets API" e clicca Enable

### Errore "Access denied" al login admin

✅ Verifica che la tua email sia in `ALLOWED_ADMIN_EMAILS`
✅ O che il tuo dominio sia in `ALLOWED_ADMIN_DOMAINS`

### Google Sheet non si aggiorna

✅ Verifica che Sheet sia condiviso con Service Account (email tipo `xxx@xxx.iam.gserviceaccount.com`)
✅ Ruolo deve essere **Editor**, non "Viewer"
✅ Controlla console browser (F12) per errori

### Polling non funziona

✅ Apri Dev Tools > Network
✅ Verifica richieste GET a `/api/events/[id]/guests` ogni 5 secondi
✅ Se 401/403: problema con event code validation

### Build Error su Vercel

❌ **Errore TypeScript**: controlla che tutti i tipi siano corretti
❌ **Module not found**: verifica `package.json` dependencies
✅ Vercel log mostra errore esatto: **Deployments** > Click deployment > **Build Logs**

### NextAuth errors

✅ Verifica `NEXTAUTH_URL` sia corretto (http://localhost:3000 locale, https://... in prod)
✅ Verifica redirect URI in Google Cloud Console
✅ `NEXTAUTH_SECRET` deve essere stesso in locale e produzione

---

## Stack Tecnologico

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Query (polling, caching)
- **Auth**: NextAuth.js v5 (Google OAuth)
- **Backend**: Next.js API Routes
- **Storage**: Google Sheets API v4
- **Deploy**: Vercel (serverless)

---

## Struttura Progetto

```
evento-checkin/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── auth/            # NextAuth
│   │   └── events/          # Events & check-in
│   ├── admin/               # Admin dashboard (OAuth protected)
│   ├── hostess/             # Hostess UI (event code protected)
│   └── auth/                # Sign in pages
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── admin/               # Admin-specific components
│   └── hostess/             # Hostess-specific components
├── lib/
│   ├── sheets/              # Google Sheets client & check-in logic
│   ├── auth/                # NextAuth config & permissions
│   ├── validation/          # Zod schemas
│   └── utils/               # Utilities (normalize, cn)
├── hooks/                    # React hooks (useGuests, useCheckIn)
├── types/                    # TypeScript types
└── middleware.ts             # Next.js middleware

```

---

## Sicurezza

⚠️ **CRITICHE**:
- `.env.local` è in `.gitignore` - mai committare
- Service Account key è sensibile - rotazione annuale consigliata
- Whitelist admin via env vars - aggiorna quando necessario
- HTTPS obbligatorio in produzione (Vercel lo fornisce automaticamente)

## Limitazioni MVP

- **Polling**: 5 secondi fissi (Fase 2: adattivo 3s/10s)
- **No dashboard stats** (Fase 2)
- **No column mapping custom UI** (usa nomi standard)
- **No rate limiting avanzato** (Fase 2)
- **No export CSV** (Fase 2)

## Prossimi Step (Fase 2 - Opzionale)

- [ ] Polling adattivo (3s attivo, 10s idle)
- [ ] Dashboard stats con grafici
- [ ] Column mapping custom UI
- [ ] Export CSV
- [ ] Rate limiting con Upstash Redis
- [ ] Toast notifications invece di alert()
- [ ] Offline detection e retry logic
- [ ] Service Worker per PWA

---

## Supporto

Per problemi o domande:
1. Controlla sezione Troubleshooting
2. Verifica log Vercel (se deploy)
3. Console browser (F12 > Console) per errori client

---

## Licenza

Progetto proprietario - Uso interno.
