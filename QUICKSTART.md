# Quick Start - Prossimi Passi

## 1. Installa Node.js ⚠️ PRIMO STEP

**macOS - Opzione A: Installer Grafico (Consigliato)**
1. Vai su https://nodejs.org/
2. Scarica versione **LTS** (20.x)
3. Apri file `.pkg` scaricato
4. Segui wizard installazione
5. Riavvia Terminal

**macOS - Opzione B: Homebrew**
```bash
# Se non hai Homebrew, installalo prima:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Poi installa Node.js:
brew install node
```

**Verifica installazione**:
```bash
node --version  # Deve mostrare v20.x o superiore
npm --version   # Deve mostrare 10.x o superiore
```

---

## 2. Installa Dipendenze

```bash
cd evento-checkin
npm install
```

Attendi 1-2 minuti per installazione completa.

---

## 3. Setup Google Cloud

📖 **Guida completa**: Vedi `README.md` sezione "Setup Google Cloud Project"

**Checklist rapida**:
- [ ] Crea Google Cloud Project
- [ ] Abilita Google Sheets API
- [ ] Crea Service Account + scarica JSON key
- [ ] Configura OAuth 2.0 credentials
- [ ] Crea Registry Sheet
- [ ] Condividi Registry Sheet con Service Account
- [ ] Copia Sheet ID

**Tempo stimato**: 10-15 minuti

---

## 4. Configura Environment

```bash
cp .env.example .env.local
```

Poi apri `.env.local` e compila con:
- Google OAuth credentials (Client ID + Secret)
- Service Account Key (JSON completo)
- Registry Sheet ID
- Le tue email admin

**Genera NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```

---

## 5. Avvia Sviluppo Locale

```bash
npm run dev
```

Apri browser: http://localhost:3000

---

## 6. Test

1. **Admin**: http://localhost:3000/admin → Login con Google
2. **Crea evento** con Google Sheet esistente
3. **Hostess**: http://localhost:3000/hostess → Inserisci codice evento
4. **Check-in** di test

---

## 7. Deploy Vercel (quando pronto)

```bash
# Opzione A: Via Dashboard
# 1. Vai su vercel.com
# 2. Import repository
# 3. Aggiungi env vars
# 4. Deploy

# Opzione B: Via CLI
npm install -g vercel
vercel login
vercel
```

⚠️ **Dopo deploy**: Aggiungi redirect URI in Google Cloud Console!

---

## Troubleshooting Quick

**"command not found: npm"**
→ Node.js non installato correttamente. Riprova step 1.

**"Error: GOOGLE_SERVICE_ACCOUNT_KEY invalid"**
→ Copia tutto il JSON del Service Account (senza newline)

**"Access denied" al login**
→ Verifica email in `ALLOWED_ADMIN_EMAILS`

**Serve aiuto?**
→ Vedi `README.md` sezione "Troubleshooting" completa

---

## File Chiave da Conoscere

- `README.md` - Documentazione completa
- `.env.local` - Secrets (NON committare mai)
- `.env.example` - Template environment variables
- `package.json` - Dipendenze
- `lib/sheets/client.ts` - Google Sheets API wrapper
- `lib/sheets/checkin.ts` - Logic check-in con anti-doppio

---

🎯 **Obiettivo**: App funzionante in ~30 minuti (dopo setup Google Cloud)
