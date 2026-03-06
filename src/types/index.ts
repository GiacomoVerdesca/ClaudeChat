export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export type ClaudeMode = 'chat' | 'plan' | 'edit' | 'auto'

export const MODES: { id: ClaudeMode; label: string; description: string }[] = [
  { id: 'chat', label: 'Chat', description: 'Conversazione pura, nessuno strumento' },
  { id: 'plan', label: 'Plan', description: 'Legge file e pianifica, non esegue' },
  { id: 'edit', label: 'Edit', description: 'Legge e modifica file di testo' },
  { id: 'auto', label: 'Auto', description: 'Tutti gli strumenti, esecuzione automatica' },
]

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  messages: Message[]
  cliSessionId?: string   // solo modalità CLI: session_id di Claude Code
  mode?: ClaudeMode       // modalità operativa (default: 'chat')
  projectDir?: string     // cartella di lavoro per plan/edit/auto
}

export interface ConversationMeta {
  id: string
  title: string
  updatedAt: number
  model: string
}

export type AuthMode = 'apikey' | 'cli'

export type Model = 'claude-opus-4-6' | 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001'

export const MODELS: { id: Model; label: string; description: string; badge: string }[] = [
  { id: 'claude-opus-4-6',           label: 'Claude Opus 4.6',   description: 'Più potente, per task complessi', badge: 'Pro'     },
  { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6', description: 'Bilanciato, uso generale',        badge: 'Default' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  description: 'Più veloce, task semplici',       badge: 'Fast'    },
]

export interface VSCodeSessionMeta {
  sessionId: string
  projectDir: string
  firstMessage: string
  startedAt: number
  lastActivity: number
  messageCount: number
}

export interface AccountInfo {
  mode: 'cli' | 'apikey'
  username: string
  subscriptionType?: string | null   // solo CLI
  apiKeyMasked?: string | null       // solo apikey
}

export interface ClaudeAPI {
  getAuthMode: () => Promise<AuthMode>
  setAuthMode: (mode: AuthMode) => Promise<boolean>
  checkCLI: () => Promise<boolean>
  installCLI: () => Promise<{ success: boolean; error?: string }>
  getApiKey: () => Promise<string | null>
  saveApiKey: (key: string) => Promise<boolean>
  clearApiKey: () => Promise<boolean>
  getAccountInfo: () => Promise<AccountInfo>
  pickDirectory: () => Promise<string | null>
  listVSCodeSessions: () => Promise<VSCodeSessionMeta[]>
  loadVSCodeSession: (sessionId: string) => Promise<{ role: 'user' | 'assistant'; content: string; timestamp: number }[]>
  listConversations: () => Promise<ConversationMeta[]>
  loadConversation: (id: string) => Promise<Conversation | null>
  saveConversation: (conv: Conversation) => Promise<boolean>
  deleteConversation: (id: string) => Promise<boolean>
  sendMessage: (payload: {
    messages: { role: string; content: string }[]
    model: string
    cliSessionId?: string
    mode?: ClaudeMode
    projectDir?: string
  }) => Promise<void>
  abortStream: () => Promise<boolean>
  onStreamChunk: (cb: (chunk: string) => void) => void
  onStreamEnd: (cb: (data?: { sessionId?: string }) => void) => void
  onStreamError: (cb: (err: string) => void) => void
  removeStreamListeners: () => void
}

declare global {
  interface Window {
    claudeAPI: ClaudeAPI
  }
}
