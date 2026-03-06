import React, { useState, useRef, useEffect } from 'react'
import './Chat.css'

interface Props {
  onSend: (content: string) => void
  onStop: () => void
  disabled: boolean
  streaming: boolean
}

export function InputBar({ onSend, onStop, disabled, streaming }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape' && streaming) {
      onStop()
    }
  }

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled || streaming) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <div className="input-bar">
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          className="message-input"
          placeholder="Scrivi un messaggio... (Invio per inviare, Shift+Invio per andare a capo)"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        <div className="input-actions">
          {streaming ? (
            <button className="stop-btn" onClick={onStop} title="Interrompi (Esc)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
          ) : (
            <button
              className={`send-btn ${value.trim() ? 'active' : ''}`}
              onClick={submit}
              disabled={!value.trim() || disabled}
              title="Invia (Invio)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="input-hint">
        Claude può fare errori. Verifica le informazioni importanti.
      </div>
    </div>
  )
}
