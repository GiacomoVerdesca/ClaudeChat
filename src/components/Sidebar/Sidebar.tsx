import React, { useState, useEffect } from 'react'
import type { ConversationMeta, Model, AccountInfo } from '../../types'
import { MODELS } from '../../types'
import './Sidebar.css'

interface Props {
  metas: ConversationMeta[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: (model: Model) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onSettings: () => void
  onImportVSCode: () => void
}

export function Sidebar({ metas, activeId, onSelect, onNew, onDelete, onRename, onSettings, onImportVSCode }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [selectedModel, setSelectedModel] = useState<Model>('claude-sonnet-4-6')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)

  useEffect(() => {
    let attempts = 0
    const tryLoad = () => {
      window.claudeAPI.getAccountInfo()
        .then(setAccountInfo)
        .catch(() => {
          if (attempts++ < 3) {
            setTimeout(tryLoad, 800)
          } else {
            // Fallback: mostra almeno la modalità auth
            window.claudeAPI.getAuthMode()
              .then(mode => setAccountInfo({ mode, username: 'Utente', subscriptionType: null, apiKeyMasked: null }))
              .catch(() => {})
          }
        })
    }
    tryLoad()
  }, [])

  const startRename = (meta: ConversationMeta, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingId(meta.id)
    setRenameValue(meta.title)
  }

  const commitRename = (id: string) => {
    if (renameValue.trim()) onRename(id, renameValue.trim())
    setRenamingId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') commitRename(id)
    if (e.key === 'Escape') setRenamingId(null)
  }

  // Iniziali per l'avatar
  const initials = accountInfo?.username
    ? accountInfo.username.split('.').map(p => p[0]?.toUpperCase() ?? '').join('').slice(0, 2)
    : '?'

  // Etichetta secondaria
  const subLabel = accountInfo?.mode === 'cli'
    ? (accountInfo.subscriptionType ?? 'Claude Code')
    : (accountInfo?.apiKeyMasked ?? 'API Key')

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={() => onNew(selectedModel)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Nuova chat
        </button>
        <select
          className="model-select"
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value as Model)}
          title="Modello per le nuove conversazioni"
        >
          {MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="conv-list">
        {metas.length === 0 && (
          <div className="conv-empty">Nessuna conversazione</div>
        )}
        {metas.map(meta => (
          <div
            key={meta.id}
            className={`conv-item ${meta.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(meta.id)}
            onMouseEnter={() => setHoveredId(meta.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {renamingId === meta.id ? (
              <input
                className="rename-input"
                value={renameValue}
                autoFocus
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => commitRename(meta.id)}
                onKeyDown={e => handleKeyDown(e, meta.id)}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="conv-title" onDoubleClick={e => startRename(meta, e)}>
                  {meta.title}
                </span>
                {(hoveredId === meta.id || meta.id === activeId) && (
                  <div className="conv-actions">
                    <button
                      className="conv-action-btn"
                      title="Rinomina"
                      onClick={e => startRename(meta, e)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      className="conv-action-btn danger"
                      title="Elimina"
                      onClick={e => { e.stopPropagation(); onDelete(meta.id) }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="vscode-btn" onClick={onImportVSCode}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
          Sessioni VS Code
        </button>
        <button className="settings-btn" onClick={onSettings}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Impostazioni
        </button>

        {accountInfo && (
          <div className="account-info">
            <div className="account-avatar">{initials}</div>
            <div className="account-details">
              <span className="account-username">{accountInfo.username}</span>
              <span className="account-sub">{subLabel}</span>
            </div>
            <div className={`account-dot ${accountInfo.mode === 'cli' ? 'online' : 'key'}`} title="Autenticato" />
          </div>
        )}
      </div>
    </div>
  )
}
