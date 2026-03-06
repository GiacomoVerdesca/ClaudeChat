# Claude Chat Desktop

Applicazione desktop per chattare con Claude AI, con interfaccia simile a ChatGPT.
Costruita con **Electron + React + TypeScript**.

![Electron](https://img.shields.io/badge/Electron-33-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Windows](https://img.shields.io/badge/Windows-11-0078d4)

---

## Funzionalità

- **Chat streaming** — le risposte appaiono in tempo reale token per token
- **Conversazioni persistenti** — salvate automaticamente in `AppData`
- **Selettore modello** — Claude Opus 4.6, Sonnet 4.6, Haiku 4.5
- **Modalità operative**:
  - **Chat** — conversazione pura, nessuno strumento
  - **Plan** — legge file e pianifica, non esegue azioni
  - **Edit** — legge e modifica file di testo
  - **Auto** — tutti gli strumenti, esecuzione automatica (`--dangerously-skip-permissions`)
- **Seleziona cartella di progetto** — per le modalità Plan/Edit/Auto
- **Import sessioni VS Code** — importa e continua sessioni Claude Code dall'estensione VS Code
- **Auto-titolo** — titolo generato automaticamente alla prima risposta
- **Info account** — mostra utente e tipo di abbonamento nella sidebar
- **Rinomina / Elimina** conversazioni
- **Scorciatoie**: `Ctrl+N` nuova chat, `Ctrl+Enter` invia

---

## Prerequisiti

### Per usare l'app con il proprio account Anthropic (consigliato)

Installare [Claude Code CLI](https://claude.ai/download):

```powershell
# Verifica che sia installato
claude --version
```

Al primo avvio selezionare **"Account Anthropic"** nella schermata di setup — l'app userà la stessa autenticazione di Claude Code.

### Per usare con API Key

Ottenere una chiave API da [console.anthropic.com](https://console.anthropic.com) → **API Keys**.

---

## Installazione (da zip)

1. Scaricare e decomprimere `ClaudeChat.zip`
2. Aprire la cartella estratta
3. Fare doppio click su **`Claude Chat.exe`**
4. Al primo avvio configurare l'autenticazione

> Nessuna installazione richiesta — è una versione portable.

---

## Sviluppo locale

```bash
# Clona il repository
git clone https://github.com/GiacomoVerdesca/ClaudeChat.git
cd ClaudeChat

# Installa le dipendenze
npm install

# Avvia in modalità sviluppo (hot-reload)
npm run dev
```

---

## Build eseguibile `.exe`

```bash
npm run dist
```

Genera nella cartella `release/`:
- `Claude Chat Setup 1.0.0.exe` — installer con shortcut desktop
- `Claude Chat 1.0.0.exe` — versione portable

> **Nota Windows:** se la build fallisce su `winCodeSign`, abilitare **Modalità sviluppatore** in
> `Impostazioni → Sistema → Per gli sviluppatori` per permettere la creazione di symlink.
> In alternativa, zippare manualmente la cartella `release/win-unpacked/`.

---

## Struttura del progetto

```
claude-desktop-chat/
├── electron/
│   ├── main.ts           # Entry point Electron
│   ├── preload.ts        # Context bridge IPC
│   └── ipcHandlers.ts    # Logica backend: Claude CLI/API, file I/O
├── src/
│   ├── App.tsx           # Layout principale
│   ├── components/
│   │   ├── Chat/         # Finestra chat, messaggi, input
│   │   ├── Sidebar/      # Lista conversazioni, account info
│   │   ├── Setup/        # Schermata configurazione iniziale
│   │   ├── Settings/     # Modale impostazioni
│   │   └── Import/       # Import sessioni VS Code
│   ├── hooks/
│   │   ├── useConversations.ts   # Gestione conversazioni
│   │   └── useStreaming.ts       # Streaming messaggi
│   └── types/index.ts    # Tipi TypeScript
├── package.json
└── vite.config.ts
```

---

## Autenticazione

| Modalità | Come funziona |
|----------|--------------|
| **CLI (Account Anthropic)** | Usa `claude.exe` già autenticato. Richiede Claude Code installato. |
| **API Key** | Chiave Anthropic inserita manualmente. Salvata cifrata con `electron.safeStorage`. |

---

## Dati e privacy

- Le conversazioni vengono salvate localmente in `%APPDATA%\Claude Chat\conversations\`
- Nessun dato viene inviato a server terzi — tutto passa direttamente alle API Anthropic
- Il file `~/.claude/.credentials.json` non viene mai modificato
