import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('claudeAPI', {
  // Auth
  getAuthMode: () => ipcRenderer.invoke('auth:getMode'),
  setAuthMode: (mode: string) => ipcRenderer.invoke('auth:setMode', mode),
  checkCLI: () => ipcRenderer.invoke('auth:checkCLI'),
  getApiKey: () => ipcRenderer.invoke('auth:getKey'),
  saveApiKey: (key: string) => ipcRenderer.invoke('auth:saveKey', key),
  clearApiKey: () => ipcRenderer.invoke('auth:clearKey'),
  getAccountInfo: () => ipcRenderer.invoke('auth:getAccountInfo'),

  // Dialog
  pickDirectory: () => ipcRenderer.invoke('dialog:pickDirectory'),

  // Conversations
  listConversations: () => ipcRenderer.invoke('conv:list'),
  loadConversation: (id: string) => ipcRenderer.invoke('conv:load', id),
  saveConversation: (conv: unknown) => ipcRenderer.invoke('conv:save', conv),
  deleteConversation: (id: string) => ipcRenderer.invoke('conv:delete', id),

  // Import sessioni VS Code
  listVSCodeSessions: () => ipcRenderer.invoke('vscode:listSessions'),
  loadVSCodeSession: (sessionId: string) => ipcRenderer.invoke('vscode:loadSession', sessionId),

  // Claude API
  sendMessage: (payload: unknown) => ipcRenderer.invoke('claude:send', payload),
  abortStream: () => ipcRenderer.invoke('claude:abort'),

  // Streaming events (main → renderer)
  onStreamChunk: (cb: (chunk: string) => void) => {
    ipcRenderer.on('stream:chunk', (_event, chunk) => cb(chunk))
  },
  onStreamEnd: (cb: (data?: { sessionId?: string }) => void) => {
    ipcRenderer.on('stream:end', (_event, data) => cb(data))
  },
  onStreamError: (cb: (err: string) => void) => {
    ipcRenderer.on('stream:error', (_event, err) => cb(err))
  },
  removeStreamListeners: () => {
    ipcRenderer.removeAllListeners('stream:chunk')
    ipcRenderer.removeAllListeners('stream:end')
    ipcRenderer.removeAllListeners('stream:error')
  },
})
