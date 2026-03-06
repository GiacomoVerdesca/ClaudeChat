import React, { useState, useEffect } from 'react'
import './Setup.css'

type Tab = 'cli' | 'apikey'

interface Props {
  onReady: () => void
}

export function Setup({ onReady }: Props) {
  const [tab, setTab] = useState<Tab>('cli')
  const [cliAvailable, setCLIAvailable] = useState<boolean | null>(null)
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.claudeAPI.checkCLI().then(ok => {
      setCLIAvailable(ok)
      // Se Claude Code non è installato, mostra direttamente la tab API key
      if (!ok) setTab('apikey')
    })
  }, [])

  const handleCLILogin = async () => {
    setLoading(true)
    await window.claudeAPI.setAuthMode('cli')
    setLoading(false)
    onReady()
  }

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed.startsWith('sk-ant-')) {
      setError("La chiave deve iniziare con 'sk-ant-'")
      return
    }
    setLoading(true)
    setError('')
    await window.claudeAPI.saveApiKey(trimmed)
    setLoading(false)
    onReady()
  }

  return (
    <div className="setup-overlay">
      <div className="setup-card">
        <div className="setup-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" fill="#10a37f" opacity="0.15"/>
            <circle cx="24" cy="24" r="14" fill="#10a37f" opacity="0.3"/>
            <circle cx="24" cy="24" r="7" fill="#10a37f"/>
          </svg>
        </div>
        <h1>Claude Chat</h1>
        <p className="setup-subtitle">Scegli come accedere a Claude</p>

        {/* Tab switcher */}
        <div className="setup-tabs">
          <button
            className={`setup-tab ${tab === 'cli' ? 'active' : ''}`}
            onClick={() => setTab('cli')}
          >
            Account Anthropic
          </button>
          <button
            className={`setup-tab ${tab === 'apikey' ? 'active' : ''}`}
            onClick={() => setTab('apikey')}
          >
            API Key
          </button>
        </div>

        {/* ── Tab: Account Anthropic via Claude Code CLI ── */}
        {tab === 'cli' && (
          <div className="setup-panel">
            {cliAvailable === null && (
              <p className="setup-checking">Verifica installazione Claude Code...</p>
            )}

            {cliAvailable === true && (
              <>
                <div className="cli-status ok">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Claude Code rilevato — già autenticato con il tuo account
                </div>
                <p className="setup-desc">
                  Usa il tuo account Anthropic tramite Claude Code, esattamente come
                  l'estensione VS Code. Nessuna API key richiesta.
                </p>
                <button
                  className="setup-submit"
                  onClick={handleCLILogin}
                  disabled={loading}
                >
                  {loading ? 'Configurazione...' : 'Accedi con Account Anthropic'}
                </button>
              </>
            )}

            {cliAvailable === false && (
              <>
                <div className="cli-status error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Claude Code non trovato
                </div>
                <p className="setup-desc">
                  Per usare l'account Anthropic installa Claude Code (lo stesso usato
                  per l'estensione VS Code), poi riavvia questa app.
                </p>
                <a
                  href="#"
                  className="setup-link-btn"
                  onClick={e => { e.preventDefault(); window.open('https://claude.ai/download') }}
                >
                  Scarica Claude Code
                </a>
                <button
                  className="setup-tab-switch"
                  onClick={() => setTab('apikey')}
                >
                  Usa API key invece →
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Tab: API Key ── */}
        {tab === 'apikey' && (
          <div className="setup-panel">
            <p className="setup-desc">
              Inserisci la tua API key di Anthropic. Viene cifrata e salvata
              localmente sul tuo computer.
            </p>
            <form onSubmit={handleApiKeySubmit}>
              <div className="setup-field">
                <label htmlFor="apikey">API Key</label>
                <div className="setup-input-wrap">
                  <input
                    id="apikey"
                    type={show ? 'text' : 'password'}
                    placeholder="sk-ant-..."
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    autoFocus={tab === 'apikey'}
                    spellCheck={false}
                  />
                  <button type="button" className="toggle-show" onClick={() => setShow(s => !s)}>
                    {show ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
                {error && <div className="setup-error">{error}</div>}
              </div>
              <button type="submit" className="setup-submit" disabled={!key.trim() || loading}>
                {loading ? 'Salvataggio...' : 'Continua'}
              </button>
            </form>
            <div className="setup-help">
              <a href="#" onClick={e => { e.preventDefault(); window.open('https://console.anthropic.com') }}>
                Ottieni la tua API key su console.anthropic.com
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
