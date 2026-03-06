import React, { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ChatWindow } from './components/Chat/ChatWindow'
import { Setup } from './components/Setup/Setup'
import { SettingsModal } from './components/Settings/SettingsModal'
import { useConversations } from './hooks/useConversations'
import { useStreaming } from './hooks/useStreaming'
import type { Conversation, Model, ClaudeMode, AccountInfo } from './types'
import './styles/globals.css'
import './App.css'

type AppState = 'loading' | 'setup' | 'ready'

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading')
  const [showSettings, setShowSettings] = useState(false)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)

  const {
    metas,
    activeConv,
    setActiveConv,
    selectConversation,
    newConversation,
    saveConversation,
    deleteConversation,
    renameConversation,
  } = useConversations()

  // Auto-title: chiede a Claude un titolo breve
  const generateTitle = useCallback(async (conv: Conversation): Promise<string> => {
    try {
      const firstUser = conv.messages.find(m => m.role === 'user')?.content || ''
      const firstAssistant = conv.messages.find(m => m.role === 'assistant')?.content || ''
      const prompt = `Crea un titolo breve (massimo 6 parole, senza virgolette) per questa conversazione:\nUtente: ${firstUser.slice(0, 200)}\nAssistente: ${firstAssistant.slice(0, 200)}`

      return new Promise((resolve) => {
        let title = ''
        window.claudeAPI.removeStreamListeners()

        window.claudeAPI.onStreamChunk((chunk) => { title += chunk })
        window.claudeAPI.onStreamEnd(() => {
          window.claudeAPI.removeStreamListeners()
          resolve(title.trim().replace(/^["']|["']$/g, '') || 'Conversazione')
        })
        window.claudeAPI.onStreamError(() => {
          window.claudeAPI.removeStreamListeners()
          resolve('Conversazione')
        })

        window.claudeAPI.sendMessage({
          messages: [{ role: 'user', content: prompt }],
          model: 'claude-haiku-4-5-20251001',
        })
      })
    } catch {
      return 'Conversazione'
    }
  }, [])

  const { streamState, error, sendMessage, stopStream } = useStreaming({
    activeConv,
    setActiveConv: setActiveConv as (conv: Conversation | null | ((prev: Conversation | null) => Conversation | null)) => void,
    saveConversation,
    generateTitle,
  })

  // Controlla autenticazione all'avvio e carica info account
  useEffect(() => {
    Promise.all([
      window.claudeAPI.getAuthMode(),
      window.claudeAPI.getApiKey(),
    ]).then(([mode, key]) => {
      if (mode === 'cli' || key) {
        setAppState('ready')
      } else {
        setAppState('setup')
      }
    })
    window.claudeAPI.getAccountInfo().then(setAccountInfo).catch(() => {})
  }, [])

  const userInitials = accountInfo?.username
    ? accountInfo.username.split(/[\s._]/).map(p => p[0]?.toUpperCase() ?? '').join('').slice(0, 2)
    : 'U'

  // Ctrl+N per nuova conversazione
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        handleNew('claude-sonnet-4-6')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleNew = (model: Model) => {
    const conv = newConversation(model)
    setActiveConv(conv)
  }

  const handleModelChange = (model: string) => {
    if (!activeConv) return
    setActiveConv({ ...activeConv, model })
  }

  const handleModeChange = (mode: ClaudeMode) => {
    if (!activeConv) return
    setActiveConv({ ...activeConv, mode })
  }

  const handleProjectDirChange = async () => {
    const dir = await window.claudeAPI.pickDirectory()
    if (dir && activeConv) setActiveConv({ ...activeConv, projectDir: dir })
  }

  if (appState === 'loading') {
    return (
      <div className="app-loading">
        <div className="loading-spinner"/>
      </div>
    )
  }

  if (appState === 'setup') {
    return <Setup onReady={() => setAppState('ready')} />
  }

  return (
    <div className="app-layout">
      <Sidebar
        metas={metas}
        activeId={activeConv?.id ?? null}
        onSelect={(id, meta) => selectConversation(id, meta)}
        onNew={handleNew}
        onDelete={deleteConversation}
        onRename={renameConversation}
        onSettings={() => setShowSettings(true)}
      />
      <ChatWindow
        conversation={activeConv}
        streamState={streamState}
        error={error}
        onSend={sendMessage}
        onStop={stopStream}
        onModelChange={handleModelChange}
        onModeChange={handleModeChange}
        onProjectDirChange={handleProjectDirChange}
        userInitials={userInitials}
      />
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onLogout={() => { setShowSettings(false); setAppState('setup') }}
        />
      )}
    </div>
  )
}
