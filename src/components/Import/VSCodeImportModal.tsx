import React, { useState, useEffect } from 'react'
import type { VSCodeSessionMeta } from '../../types'
import './VSCodeImportModal.css'

interface Props {
  onImport: (sessionId: string, firstMessage: string) => void
  onClose: () => void
}

function formatDate(ts: number) {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(ts))
}

function shortPath(p: string) {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts.length > 3 ? '…/' + parts.slice(-2).join('/') : p
}

export function VSCodeImportModal({ onImport, onClose }: Props) {
  const [sessions, setSessions] = useState<VSCodeSessionMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState<string | null>(null)

  useEffect(() => {
    window.claudeAPI.listVSCodeSessions().then(s => {
      setSessions(s)
      setLoading(false)
    })
  }, [])

  const filtered = sessions.filter(s =>
    s.firstMessage.toLowerCase().includes(search.toLowerCase()) ||
    s.projectDir.toLowerCase().includes(search.toLowerCase())
  )

  const handleImport = async (meta: VSCodeSessionMeta) => {
    setImporting(meta.sessionId)
    onImport(meta.sessionId, meta.firstMessage)
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="import-modal">
        <div className="import-header">
          <div className="import-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            Sessioni da Claude Code / VS Code
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="import-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Cerca nelle sessioni..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="import-list">
          {loading && (
            <div className="import-loading">Caricamento sessioni...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="import-empty">
              {search ? 'Nessuna sessione trovata.' : 'Nessuna sessione Claude Code trovata in ~/.claude/projects/'}
            </div>
          )}
          {filtered.map(meta => (
            <button
              key={meta.sessionId}
              className={`import-item ${importing === meta.sessionId ? 'loading' : ''}`}
              onClick={() => handleImport(meta)}
              disabled={importing !== null}
            >
              <div className="import-item-main">
                <span className="import-item-msg">{meta.firstMessage}</span>
                <span className="import-item-project">{shortPath(meta.projectDir)}</span>
              </div>
              <div className="import-item-meta">
                <span className="import-item-date">{formatDate(meta.lastActivity)}</span>
                <span className="import-item-count">{meta.messageCount} msg</span>
              </div>
            </button>
          ))}
        </div>

        <div className="import-footer">
          {filtered.length > 0 && (
            <span>{filtered.length} sessioni • Clicca per aprire e continuare</span>
          )}
        </div>
      </div>
    </div>
  )
}
