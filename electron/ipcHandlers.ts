import { ipcMain, safeStorage, app, BrowserWindow, dialog } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import { spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(app.getPath('userData'), 'conversations')
const KEY_FILE = path.join(app.getPath('userData'), 'apikey.bin')
const AUTH_MODE_FILE = path.join(app.getPath('userData'), 'authmode.json')

let abortController: AbortController | null = null
let cliAbortProc: ReturnType<typeof spawn> | null = null

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

// ── AUTH MODE ─────────────────────────────────────────────────────────────────

type AuthMode = 'apikey' | 'cli'

function getAuthMode(): AuthMode {
  try {
    if (fs.existsSync(AUTH_MODE_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_MODE_FILE, 'utf-8')).mode
    }
  } catch { /* */ }
  return 'apikey'
}

function saveAuthMode(mode: AuthMode) {
  fs.writeFileSync(AUTH_MODE_FILE, JSON.stringify({ mode }), 'utf-8')
}

// ── CLAUDE CLI ────────────────────────────────────────────────────────────────

function findClaudeCLI(): string | null {
  // Percorso noto dell'installazione Claude Code
  const knownPaths = [
    path.join(process.env.USERPROFILE || '', '.claude', 'claude.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'claude', 'claude.exe'),
  ]
  for (const p of knownPaths) {
    if (fs.existsSync(p)) return p
  }
  // Fallback: cerca nel PATH
  try {
    const result = execSync('where claude', { encoding: 'utf-8' }).trim().split('\n')[0].trim()
    if (result && fs.existsSync(result)) return result
  } catch { /* */ }
  return null
}

// Mappa mode CLI → --allowedTools
const TOOL_SETS: Record<string, string> = {
  plan: 'Read,LS,Glob,Grep,WebSearch,WebFetch',
  edit: 'Read,Write,Edit,MultiEdit,LS,Glob,Grep',
}

function sendViaCLI(
  event: Electron.IpcMainInvokeEvent,
  payload: { lastMessage: string; sessionId?: string; model: string; mode?: string; projectDir?: string },
  win: BrowserWindow
) {
  const claudePath = findClaudeCLI()
  if (!claudePath) {
    event.sender.send('stream:error', 'Claude CLI non trovato. Installa Claude Code da claude.ai/download')
    return Promise.resolve({ sessionId: undefined })
  }

  return new Promise<{ sessionId?: string }>((resolve) => {
    const args = ['-p', payload.lastMessage, '--output-format', 'stream-json', '--verbose']
    if (payload.sessionId) {
      args.push('--resume', payload.sessionId)
    }
    // Modalità operative: aggiunge --allowedTools o --dangerously-skip-permissions
    if (payload.mode === 'auto') {
      args.push('--dangerously-skip-permissions')
    } else if (payload.mode && TOOL_SETS[payload.mode]) {
      args.push('--allowedTools', TOOL_SETS[payload.mode])
    }

    const proc = spawn(claudePath, args, {
      cwd: payload.projectDir || undefined,
      env: { ...process.env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    cliAbortProc = proc
    let buffer = ''
    let newSessionId: string | undefined
    let stderrText = ''
    let sentChunk = false

    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8')
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const obj = JSON.parse(line)

          if (obj.type === 'assistant' && Array.isArray(obj.message?.content)) {
            // Raccoglie tutto il testo e lo invia in un unico chunk
            const parts: string[] = []
            for (const block of obj.message.content) {
              if (block.type === 'text' && block.text) {
                parts.push(block.text as string)
              }
            }
            const fullText = parts.join('')
            if (fullText) {
              event.sender.send('stream:chunk', fullText)
              sentChunk = true
            }
          } else if (obj.type === 'result') {
            newSessionId = obj.session_id
            if (obj.subtype === 'error' || obj.is_error) {
              event.sender.send('stream:error', obj.result || 'Errore dalla CLI')
            }
          }
        } catch { /* linee non-JSON, es. avvisi */ }
      }
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrText += chunk.toString('utf-8')
    })

    proc.on('close', (code) => {
      cliAbortProc = null
      if (code !== 0 && code !== null) {
        // Qualsiasi codice di uscita non-zero è un errore
        const errMsg = stderrText.trim() || buffer.trim() || `Codice uscita ${code}`
        event.sender.send('stream:error', `Claude CLI (exit ${code}): ${errMsg.slice(0, 400)}`)
      } else if (!sentChunk) {
        // Uscita con codice 0 ma nessun testo ricevuto
        const hint = stderrText.trim() || buffer.trim()
        const msg = hint
          ? `CLI non ha restituito risposta: ${hint.slice(0, 300)}`
          : 'CLI non ha restituito risposta (output vuoto). Controlla l\'autenticazione con: claude -p "test"'
        event.sender.send('stream:error', msg)
      } else {
        event.sender.send('stream:end', { sessionId: newSessionId })
      }
      resolve({ sessionId: newSessionId })
    })

    proc.on('error', (err) => {
      cliAbortProc = null
      event.sender.send('stream:error', `Impossibile avviare la CLI: ${err.message}`)
      resolve({ sessionId: undefined })
    })

    // Timeout di 120 secondi
    const timeout = setTimeout(() => {
      if (cliAbortProc === proc) {
        proc.kill()
        cliAbortProc = null
        event.sender.send('stream:error', 'Timeout: la CLI non ha risposto entro 120s')
        resolve({ sessionId: undefined })
      }
    }, 120_000)
    proc.on('close', () => clearTimeout(timeout))
  })
}

// ── API KEY AUTH ──────────────────────────────────────────────────────────────

function getStoredApiKey(): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  if (!fs.existsSync(KEY_FILE)) return null
  try {
    const encrypted = fs.readFileSync(KEY_FILE)
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(encrypted)
    }
    return encrypted.toString('utf-8')
  } catch {
    return null
  }
}

function storeApiKey(key: string) {
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(KEY_FILE, safeStorage.encryptString(key))
  } else {
    fs.writeFileSync(KEY_FILE, key, 'utf-8')
  }
}

function getCliOAuthToken(): string | null {
  const credFile = path.join(CLAUDE_DIR, '.credentials.json')
  try {
    if (fs.existsSync(credFile)) {
      const cred = JSON.parse(fs.readFileSync(credFile, 'utf-8'))
      return cred?.claudeAiOauth?.accessToken ?? null
    }
  } catch { /* */ }
  return null
}

async function sendViaAPI(
  event: Electron.IpcMainInvokeEvent,
  client: Anthropic,
  payload: { messages: { role: 'user' | 'assistant'; content: string; images?: MessageImage[] }[]; model: string }
) {
  const apiMessages = payload.messages.map(m => {
    if (m.images?.length) {
      return {
        role: m.role,
        content: [
          ...m.images.map(img => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
          })),
          { type: 'text' as const, text: m.content },
        ],
      }
    }
    return { role: m.role, content: m.content }
  })

  try {
    const stream = await client.messages.stream({
      model: payload.model || 'claude-sonnet-4-6',
      max_tokens: 8096,
      messages: apiMessages as Parameters<typeof client.messages.stream>[0]['messages'],
    })
    for await (const chunk of stream) {
      if (abortController?.signal.aborted) break
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        event.sender.send('stream:chunk', chunk.delta.text)
      }
    }
    if (!abortController?.signal.aborted) event.sender.send('stream:end')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('aborted')) event.sender.send('stream:error', msg)
  } finally {
    abortController = null
  }
}

// ── CONVERSATIONS ─────────────────────────────────────────────────────────────

interface MessageImage {
  data: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  images?: MessageImage[]
}

interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  messages: Message[]
  cliSessionId?: string   // solo per modalità CLI
}

interface ConversationMeta {
  id: string
  title: string
  updatedAt: number
  model: string
  source?: 'local' | 'vscode'
  vscodeSessionId?: string
  projectDir?: string
}

function convPath(id: string) {
  return path.join(DATA_DIR, `${id}.json`)
}

// ── CLAUDE CODE SESSION IMPORT ────────────────────────────────────────────────

const CLAUDE_DIR = path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude')
const CLAUDE_PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects')

interface SessionMeta {
  sessionId: string
  projectDir: string          // es. C:\BPS\batch-genera-ricevute-f24
  firstMessage: string        // anteprima del primo messaggio utente
  startedAt: number
  lastActivity: number
  messageCount: number
}

interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/** Converte il nome cartella ~/.claude/projects/X → percorso originale */
function decodeProjDir(encoded: string): string {
  // C--BPS-batch → C:\BPS\batch  (approssimazione)
  // Il primo token è la lettera di unità, i successivi sono il path
  const parts = encoded.split('-')
  if (parts.length < 2) return encoded
  const drive = parts[0]  // "C"
  const rest = parts.slice(1).join('\\')
  return `${drive}:\\${rest}`
}

function listClaudeCodeSessions(): SessionMeta[] {
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return []
  const metas: SessionMeta[] = []

  const projDirs = fs.readdirSync(CLAUDE_PROJECTS_DIR)
  for (const projEncoded of projDirs) {
    const projPath = path.join(CLAUDE_PROJECTS_DIR, projEncoded)
    if (!fs.statSync(projPath).isDirectory()) continue

    const files = fs.readdirSync(projPath).filter(f => f.endsWith('.jsonl') && !f.startsWith('agent-'))
    for (const file of files) {
      const sessionId = file.replace('.jsonl', '')
      const filePath = path.join(projPath, file)
      try {
        const stat = fs.statSync(filePath)
        // Legge solo le prime 200 righe per ottenere il primo messaggio e data inizio
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n').filter(l => l.trim())

        let firstMessage = ''
        let startedAt = stat.birthtimeMs
        let messageCount = 0

        for (const line of lines.slice(0, 200)) {
          try {
            const obj = JSON.parse(line)
            if (obj.timestamp && typeof obj.timestamp === 'string') {
              const ts = new Date(obj.timestamp).getTime()
              if (ts && ts < startedAt) startedAt = ts
            }
            if (obj.type === 'user' && obj.userType === 'external') {
              const textBlock = obj.message?.content?.find(
                (b: { type: string }) => b.type === 'text'
              )
              const text: string = textBlock?.text || ''
              // Salta i messaggi di sistema (tag XML)
              const clean = text.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim()
              if (clean && !firstMessage) firstMessage = clean.slice(0, 100)
              messageCount++
            }
          } catch { /* riga non JSON */ }
        }

        if (!firstMessage) continue  // sessione vuota o solo tool calls

        metas.push({
          sessionId,
          projectDir: decodeProjDir(projEncoded),
          firstMessage,
          startedAt,
          lastActivity: stat.mtimeMs,
          messageCount,
        })
      } catch { /* file non leggibile */ }
    }
  }

  return metas.sort((a, b) => b.lastActivity - a.lastActivity)
}

function loadClaudeCodeSession(sessionId: string): SessionMessage[] {
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) return []

  // Trova il file della sessione in qualsiasi cartella progetto
  const projDirs = fs.readdirSync(CLAUDE_PROJECTS_DIR)
  for (const projEncoded of projDirs) {
    const filePath = path.join(CLAUDE_PROJECTS_DIR, projEncoded, `${sessionId}.jsonl`)
    if (!fs.existsSync(filePath)) continue

    const messages: SessionMessage[] = []
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim())

    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        const ts = obj.timestamp ? new Date(obj.timestamp).getTime() : Date.now()

        // Messaggi utente reali (non tool_result)
        if (obj.type === 'user' && obj.userType === 'external') {
          const parts: string[] = []
          for (const block of (obj.message?.content || [])) {
            if (block.type === 'text') {
              // Rimuovi i tag di sistema (<ide_opened_file>, <system-reminder>, ecc.)
              const clean = (block.text as string)
                .replace(/<[a-z_-]+[^>]*>[\s\S]*?<\/[a-z_-]+>/gi, '')
                .trim()
              if (clean) parts.push(clean)
            }
          }
          const content = parts.join('\n').trim()
          if (content) messages.push({ role: 'user', content, timestamp: ts })
        }

        // Risposte di Claude (solo testo, salta tool_use e thinking)
        if (obj.type === 'assistant') {
          const parts: string[] = []
          for (const block of (obj.message?.content || [])) {
            if (block.type === 'text' && block.text?.trim()) {
              parts.push(block.text as string)
            }
          }
          const content = parts.join('\n').trim()
          if (content) messages.push({ role: 'assistant', content, timestamp: ts })
        }
      } catch { /* riga non valida */ }
    }

    return messages
  }
  return []
}

// ── REGISTER ALL HANDLERS ─────────────────────────────────────────────────────

export function registerIpcHandlers(win: BrowserWindow) {
  ensureDataDir()

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config()
  } catch { /* in produzione non c'è dotenv */ }

  // ── Auth ───────────────────────────────────────────────────────────────────

  ipcMain.handle('auth:getMode', () => getAuthMode())

  ipcMain.handle('auth:setMode', (_event, mode: AuthMode) => {
    saveAuthMode(mode)
    return true
  })

  ipcMain.handle('auth:checkCLI', () => {
    return !!findClaudeCLI()
  })

  ipcMain.handle('auth:installCLI', () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      // Installa Claude Code globalmente via npm
      const proc = spawn('npm', ['install', '-g', '@anthropic-ai/claude-code'], {
        shell: true,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let errText = ''
      proc.stderr.on('data', (d: Buffer) => { errText += d.toString() })
      proc.on('close', (code) => {
        if (code === 0) resolve({ success: true })
        else resolve({ success: false, error: errText.slice(0, 500) || `Exit code ${code}` })
      })
      proc.on('error', (err) => {
        resolve({ success: false, error: `npm non trovato: ${err.message}` })
      })
    })
  })

  ipcMain.handle('auth:getKey', () => getStoredApiKey())

  ipcMain.handle('auth:saveKey', (_event, key: string) => {
    storeApiKey(key)
    saveAuthMode('apikey')
    return true
  })

  ipcMain.handle('auth:clearKey', () => {
    if (fs.existsSync(KEY_FILE)) fs.unlinkSync(KEY_FILE)
    if (fs.existsSync(AUTH_MODE_FILE)) fs.unlinkSync(AUTH_MODE_FILE)
    return true
  })

  ipcMain.handle('auth:getAccountInfo', () => {
    const mode = getAuthMode()
    const raw = process.env.USERNAME || process.env.USER || 'Utente'
    const username = raw.split(/[._\s]/).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')

    if (mode === 'cli') {
      // Legge ~/.claude/.credentials.json per subscriptionType
      const credFile = path.join(CLAUDE_DIR, '.credentials.json')
      try {
        if (fs.existsSync(credFile)) {
          const cred = JSON.parse(fs.readFileSync(credFile, 'utf-8'))
          const sub: string = cred?.claudeAiOauth?.subscriptionType ?? ''
          const subLabel = sub === 'team' ? 'Team' : sub === 'pro' ? 'Pro' : sub ? sub : 'Free'
          return { mode: 'cli', username, subscriptionType: subLabel }
        }
      } catch { /* ignora errori di lettura */ }
      return { mode: 'cli', username, subscriptionType: null }
    }

    // API key mode
    const key = getStoredApiKey()
    const maskedKey = key ? `${key.slice(0, 14)}…${key.slice(-4)}` : null
    return { mode: 'apikey', username, apiKeyMasked: maskedKey }
  })

  // ── Conversations ──────────────────────────────────────────────────────────

  ipcMain.handle('conv:list', (): ConversationMeta[] => {
    ensureDataDir()
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
    const metas: ConversationMeta[] = []
    for (const file of files) {
      try {
        const conv: Conversation = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'))
        metas.push({ id: conv.id, title: conv.title, updatedAt: conv.updatedAt, model: conv.model, source: 'local' })
      } catch { /* ignora file corrotti */ }
    }
    return metas.sort((a, b) => b.updatedAt - a.updatedAt)
  })

  ipcMain.handle('conv:listAll', (): ConversationMeta[] => {
    ensureDataDir()
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
    const localMetas: (ConversationMeta & { cliSessionId?: string })[] = []
    for (const file of files) {
      try {
        const conv: Conversation = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'))
        localMetas.push({
          id: conv.id,
          title: conv.title,
          updatedAt: conv.updatedAt,
          model: conv.model,
          source: 'local',
          cliSessionId: conv.cliSessionId,
        })
      } catch { /* ignora file corrotti */ }
    }

    const importedSessionIds = new Set(
      localMetas.map(m => m.cliSessionId).filter(Boolean) as string[]
    )

    const vscodeSessions = listClaudeCodeSessions()
    const vscodeNotImported: ConversationMeta[] = vscodeSessions
      .filter(s => !importedSessionIds.has(s.sessionId))
      .map(s => ({
        id: `vscode-${s.sessionId}`,
        title: s.firstMessage.slice(0, 60) || 'Sessione VS Code',
        updatedAt: s.lastActivity,
        model: 'claude-sonnet-4-6',
        source: 'vscode' as const,
        vscodeSessionId: s.sessionId,
        projectDir: s.projectDir,
      }))

    return [...localMetas, ...vscodeNotImported].sort((a, b) => b.updatedAt - a.updatedAt)
  })

  ipcMain.handle('conv:load', (_event, id: string): Conversation | null => {
    const p = convPath(id)
    if (!fs.existsSync(p)) return null
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return null }
  })

  ipcMain.handle('conv:save', (_event, conv: Conversation) => {
    ensureDataDir()
    fs.writeFileSync(convPath(conv.id), JSON.stringify(conv, null, 2), 'utf-8')
    return true
  })

  ipcMain.handle('conv:delete', (_event, id: string) => {
    const p = convPath(id)
    if (fs.existsSync(p)) fs.unlinkSync(p)
    return true
  })

  // ── Claude send ────────────────────────────────────────────────────────────

  ipcMain.handle('claude:send', async (event, payload: {
    messages: { role: 'user' | 'assistant'; content: string; images?: MessageImage[] }[]
    model: string
    cliSessionId?: string
    mode?: string
    projectDir?: string
  }) => {
    const authMode = getAuthMode()
    const lastMsg = payload.messages[payload.messages.length - 1]
    if (!lastMsg) {
      event.sender.send('stream:error', 'Nessun messaggio da inviare')
      return
    }

    if (authMode === 'cli' && !lastMsg.images?.length) {
      // Testo puro: usa il processo CLI
      return sendViaCLI(
        event,
        {
          lastMessage: lastMsg.content,
          sessionId: payload.cliSessionId,
          model: payload.model,
          mode: payload.mode,
          projectDir: payload.projectDir,
        },
        win
      )
    }

    // Con immagini in CLI mode: usa token OAuth della CLI con l'SDK
    // In API key mode: usa la chiave API memorizzata
    let client: Anthropic
    if (authMode === 'cli') {
      const oauthToken = getCliOAuthToken()
      if (!oauthToken) {
        event.sender.send('stream:error', 'Token OAuth non trovato. Effettua il login con "claude" per usare le immagini.')
        return
      }
      client = new Anthropic({ authToken: oauthToken })
    } else {
      const apiKey = getStoredApiKey()
      if (!apiKey) {
        event.sender.send('stream:error', 'API key non configurata')
        return
      }
      client = new Anthropic({ apiKey })
    }

    abortController = new AbortController()
    await sendViaAPI(event, client, payload)
  })

  // ── Import sessioni Claude Code (VS Code) ─────────────────────────────────

  ipcMain.handle('dialog:pickDirectory', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Seleziona cartella di progetto',
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:pickImages', async (): Promise<MessageImage[] | null> => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
      title: 'Seleziona immagini',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths.map(p => {
      const data = fs.readFileSync(p).toString('base64')
      const ext = path.extname(p).toLowerCase().slice(1)
      const mediaType = (ext === 'jpg' ? 'image/jpeg' : `image/${ext}`) as MessageImage['mediaType']
      return { data, mediaType }
    })
  })

  ipcMain.handle('vscode:listSessions', () => listClaudeCodeSessions())

  ipcMain.handle('vscode:loadSession', (_event, sessionId: string) =>
    loadClaudeCodeSession(sessionId)
  )

  ipcMain.handle('claude:abort', () => {
    if (cliAbortProc) {
      cliAbortProc.kill()
      cliAbortProc = null
      win.webContents.send('stream:end')
    }
    if (abortController) {
      abortController.abort()
      win.webContents.send('stream:end')
    }
    return true
  })
}
