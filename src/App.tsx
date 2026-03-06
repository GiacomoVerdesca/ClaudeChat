import React, { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ChatWindow } from './components/Chat/ChatWindow'
import { Setup } from './components/Setup/Setup'
import { SettingsModal } from './components/Settings/SettingsModal'
import { VSCodeImportModal } from './components/Import/VSCodeImportModal'
import { useConversations } from './hooks/useConversations'
import { useStreaming } from './hooks/useStreaming'
import type { Conversation, Model, ClaudeMode } from './types'
import { v4 as uuidv4 } from 'uuid'
import './styles/globals.css'
import './App.css'

type AppState = 'loading' | 'setup' | 'ready'

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading')
  const [showSettings, setShowSettings] = useState(false)
  const [showVSCodeImport, setShowVSCodeImport] = useState(false)

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

  // Controlla autenticazione all'avvio
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
  }, [])

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

  // Importa una sessione VS Code: carica i messaggi e la apre come conversazione
  const handleImportVSCode = async (sessionId: string, firstMessage: string) => {
    setShowVSCodeImport(false)
    const rawMessages = await window.claudeAPI.loadVSCodeSession(sessionId)
    if (rawMessages.length === 0) return

    const messages = rawMessages.map(m => ({
      id: uuidv4(),
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }))

    const conv: Conversation = {
      id: uuidv4(),
      title: firstMessage.slice(0, 60),
      createdAt: messages[0]?.timestamp ?? Date.now(),
      updatedAt: messages[messages.length - 1]?.timestamp ?? Date.now(),
      model: 'claude-sonnet-4-6',
      messages,
      cliSessionId: sessionId,  // permette di continuare con --resume
    }

    await saveConversation(conv)
    setActiveConv(conv)
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
        onSelect={selectConversation}
        onNew={handleNew}
        onDelete={deleteConversation}
        onRename={renameConversation}
        onSettings={() => setShowSettings(true)}
        onImportVSCode={() => setShowVSCodeImport(true)}
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
      />
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onLogout={() => { setShowSettings(false); setAppState('setup') }}
        />
      )}
      {showVSCodeImport && (
        <VSCodeImportModal
          onImport={handleImportVSCode}
          onClose={() => setShowVSCodeImport(false)}
        />
      )}
    </div>
  )
}
