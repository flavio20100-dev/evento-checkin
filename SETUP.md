# Setup Guida Rapida

## 🚀 Quick Start (3 passi)

### 1. Installa Node.js (se non ce l'hai)

Apri un **nuovo terminale** e verifica se hai già Node:
```bash
node --version
```

Se vedi un numero di versione, **salta al passo 2**.

Altrimenti installa Node.js:
```bash
# Metodo 1: Homebrew (raccomandato)
brew install node

# Metodo 2: Scarica da https://nodejs.org/
```

### 2. Avvia l'applicazione

```bash
cd "/Users/flavio/Dropbox/Il mio Mac (MacBook-Air-di-Flavio.local)/Desktop/sistema accredito/evento-checkin"

# Installa dipendenze (solo la prima volta)
npm install

# Avvia l'app
npm run dev
```

L'app sarà disponibile su: **http://localhost:3000**

### 3. Esegui la Migration

1. Vai su: **http://localhost:3000/admin**
2. Fai login con il tuo Google account
3. Clicca **"Esegui Migration"** (il pulsante giallo/arancione)
4. Conferma l'operazione
5. Verifica il risultato (ti dirà quanti guest sono stati migrati)

---

## ✅ Cosa Fa la Migration

La migration fixerà automaticamente tutti i guest documents in Firestore:

- ✅ Fix `_syncedToSheets: null` → `false`
- ✅ Aggiunge `_lastModified` timestamp
- ✅ Aggiunge `_createdAt` timestamp
- ✅ Aggiunge `_version: 1`
- ✅ Inizializza tutti i campi opzionali

**È sicuro eseguirla più volte!**

---

## 🧪 Test dopo la Migration

1. **Test Manual Sync**:
   - Fai alcuni check-in dall'app hostess
   - Vai su /admin
   - Clicca "Sincronizza Ora"
   - Verifica che i check-in appaiono su Google Sheet

2. **Verifica in Firestore Console**:
   - Vai su Firebase Console → Firestore
   - Apri un guest document
   - Verifica che abbia tutti i field (`_syncedToSheets`, `_lastModified`, etc.)

---

## 📝 Files Creati/Modificati

### Nuovi Files:
1. `/app/api/admin/migrate/route.ts` - API endpoint per migration
2. `/components/admin/MigrateButton.tsx` - UI button
3. `/scripts/migrate-guest-fields.ts` - Script standalone (alternativo)

### Files Modificati:
1. `/app/admin/page.tsx` - Aggiunto MigrateButton
2. `/lib/firestore/client.ts` - Query fix (già fatto precedentemente)

---

## 🆘 Troubleshooting

### "npm: command not found"
→ Node.js non installato. Installa con Homebrew: `brew install node`

### "Migration completata: 0 guests migrated"
→ Buon segno! Significa che tutti i guest sono già correttamente inizializzati

### Manual sync trova 0 guests
→ Esegui la migration prima! Fixerà i field mancanti

### L'app non parte su localhost:3000
→ Controlla se un'altra app sta usando la porta. Chiudi altre istanze di npm.

---

## 🎯 Prossimi Step

Dopo la migration:
1. ✅ Testa il manual sync
2. ✅ Verifica Google Sheet si aggiorna
3. ✅ Deploy su Vercel
4. ✅ Test produzione con 5 hostess

**Target: Zero errori!** 🚀
