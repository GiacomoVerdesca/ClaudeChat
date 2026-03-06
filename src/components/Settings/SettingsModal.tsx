import React, { useState, useEffect } from 'react'
import type { AuthMode } from '../../types'
import './SettingsModal.css'

interface Props {
  onClose: () => void
  onLogout: () => void
}

export function SettingsModal({ onClose, onLogout }: Props) {
  const [authMode, setAuthModeState] = useState<AuthMode | null>(null)
  const [newKey, setNewKey] = useState('')
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.claudeAPI.getAuthMode().then(setAuthModeState)
  }, [])

  const handleSaveKey = async () => {
    if (!newKey.trim()) return
    await window.claudeAPI.saveApiKey(newKey.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setNewKey('')
  }

  const handleLogout = async () => {
    await window.claudeAPI.clearApiKey()
    onLogout()
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2>Impostazioni</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">

          {/* Modalità corrente */}
          <section className="settings-section">
            <h3>Modalità di accesso</h3>
            {authMode === 'cli' ? (
              <div className="auth-mode-badge cli">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Account Anthropic (tramite Claude Code)
              </div>
            ) : authMode === 'apikey' ? (
              <div className="auth-mode-badge apikey">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
                API Key
              </div>
            ) : null}
          </section>

          {/* Sezione API key (sempre visibile per permettere di cambiare) */}
          <section className="settings-section">
            <h3>API Key</h3>
            <p className="settings-desc">
              {authMode === 'cli'
                ? 'Puoi passare all\'autenticazione con API key inserendo una chiave qui.'
                : 'Aggiorna la tua API key di Anthropic.'}
            </p>
            <div className="settings-input-row">
              <div className="setup-input-wrap">
                <input
                  type={show ? 'text' : 'password'}
                  placeholder="API key (sk-ant-...)"
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  spellCheck={false}
                />
                <button type="button" className="toggle-show" onClick={() => setShow(s => !s)}>
                  {show ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <button
                className={`save-key-btn ${saved ? 'saved' : ''}`}
                onClick={handleSaveKey}
                disabled={!newKey.trim()}
              >
                {saved ? '✓ Salvato' : 'Salva'}
              </button>
            </div>
          </section>

          <section className="settings-section danger-section">
            <h3>Disconnetti</h3>
            <p className="settings-desc">
              Rimuovi la configurazione di accesso e torna alla schermata iniziale.
            </p>
            <button className="logout-btn" onClick={handleLogout}>
              Disconnetti
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
