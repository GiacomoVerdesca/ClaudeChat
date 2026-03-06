import React, { useEffect, useRef, useState } from 'react'
import type { Conversation, ClaudeMode } from '../../types'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { MODELS, MODES } from '../../types'
import './Chat.css'

interface Props {
  conversation: Conversation | null
  streamState: 'idle' | 'streaming' | 'error'
  error: string | null
  onSend: (content: string) => void
  onStop: () => void
  onModelChange: (model: string) => void
  onModeChange: (mode: ClaudeMode) => void
  onProjectDirChange: () => void
}

function shortPath(p: string) {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : p
}

export function ChatWindow({ conversation, streamState, error, onSend, onStop, onModelChange, onModeChange, onProjectDirChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [conversation?.messages, autoScroll])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100
    setAutoScroll(nearBottom)
  }

  if (!conversation) {
    return (
      <div className="chat-empty">
        <div className="chat-empty-content">
          <div className="chat-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" fill="var(--accent)" opacity="0.15"/>
              <circle cx="20" cy="20" r="12" fill="var(--accent)" opacity="0.3"/>
              <circle cx="20" cy="20" r="6" fill="var(--accent)"/>
            </svg>
          </div>
          <h2>Claude Chat</h2>
          <p>Seleziona una conversazione o creane una nuova per iniziare.</p>
        </div>
      </div>
    )
  }

  const isStreaming = streamState === 'streaming'
  const messages = conversation.messages
  const currentMode = conversation.mode ?? 'chat'

  return (
    <div className="chat-window">
      <div className="chat-header">
        <span className="chat-title">{conversation.title}</span>

        <div className="chat-header-controls">
          {/* Selettore modello migliorato */}
          <div className="model-select-wrapper">
            <select
              className="model-select-chat"
              value={conversation.model}
              onChange={e => onModelChange(e.target.value)}
              disabled={isStreaming}
              title={MODELS.find(m => m.id === conversation.model)?.description}
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label} [{m.badge}]</option>
              ))}
            </select>
          </div>

          {/* Mode pills */}
          <div className="mode-pills">
            {MODES.map(mode => (
              <button
                key={mode.id}
                className={`mode-pill ${currentMode === mode.id ? 'active' : ''}`}
                onClick={() => onModeChange(mode.id)}
                disabled={isStreaming}
                title={mode.description}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Directory picker — visibile solo in modalità non-chat */}
          {currentMode !== 'chat' && (
            <button
              className="dir-picker-btn"
              onClick={onProjectDirChange}
              disabled={isStreaming}
              title={conversation.projectDir ?? 'Seleziona cartella di progetto'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="dir-picker-label">
                {conversation.projectDir ? shortPath(conversation.projectDir) : 'Cartella…'}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="messages-area" ref={scrollRef} onScroll={handleScroll}>
        {messages.length === 0 && (
          <div className="messages-empty">
            <p>Inizia la conversazione scrivendo un messaggio.</p>
            {currentMode !== 'chat' && !conversation.projectDir && (
              <p className="dir-hint">Seleziona una cartella di progetto nell&apos;header per usare la modalità {currentMode}.</p>
            )}
          </div>
        )}
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1
          const showCursor = isLast && isStreaming && msg.role === 'assistant'
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={showCursor}
            />
          )
        })}
        {error && (
          <div className="error-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Errore: {error}
          </div>
        )}
      </div>

      <InputBar
        onSend={onSend}
        onStop={onStop}
        disabled={false}
        streaming={isStreaming}
      />
    </div>
  )
}
