import React, { useState, useRef, useEffect } from 'react'
import type { MessageImage } from '../../types'
import './Chat.css'

interface Props {
  onSend: (content: string, images: MessageImage[]) => void
  onStop: () => void
  disabled: boolean
  streaming: boolean
}

export function InputBar({ onSend, onStop, disabled, streaming }: Props) {
  const [value, setValue] = useState('')
  const [images, setImages] = useState<MessageImage[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imageItems = Array.from(items).filter(i => i.type.startsWith('image/'))
    if (imageItems.length === 0) return
    e.preventDefault()
    imageItems.forEach(item => {
      const blob = item.getAsFile()
      if (!blob) return
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const [header, data] = dataUrl.split(',')
        const mediaType = (header.match(/data:([^;]+)/)?.[1] || 'image/png') as MessageImage['mediaType']
        setImages(prev => [...prev, { data, mediaType }])
      }
      reader.readAsDataURL(blob)
    })
  }

  const handlePickImages = async () => {
    const picked = await window.claudeAPI.pickImages()
    if (picked) setImages(prev => [...prev, ...picked])
  }

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx))
  }

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled || streaming) return
    onSend(trimmed, images)
    setValue('')
    setImages([])
  }

  const canSend = value.trim().length > 0 && !disabled && !streaming

  return (
    <div className="input-bar">
      <div className="input-wrapper">
        {images.length > 0 && (
          <div className="image-previews">
            {images.map((img, idx) => (
              <div key={idx} className="image-preview-item">
                <img src={`data:${img.mediaType};base64,${img.data}`} alt="" />
                <button className="image-remove-btn" onClick={() => removeImage(idx)} title="Rimuovi">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="input-row">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            style={{ display: 'none' }}
            onChange={e => {
              const files = Array.from(e.target.files || [])
              files.forEach(file => {
                const reader = new FileReader()
                reader.onload = () => {
                  const dataUrl = reader.result as string
                  const [header, data] = dataUrl.split(',')
                  const mediaType = (header.match(/data:([^;]+)/)?.[1] || 'image/png') as MessageImage['mediaType']
                  setImages(prev => [...prev, { data, mediaType }])
                }
                reader.readAsDataURL(file)
              })
              e.target.value = ''
            }}
          />
          <button
            className="attach-btn"
            onClick={handlePickImages}
            disabled={disabled || streaming}
            title="Allega immagine"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            className="message-input"
            placeholder="Scrivi un messaggio... (Invio per inviare, Shift+Invio per andare a capo)"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
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
                className={`send-btn ${canSend ? 'active' : ''}`}
                onClick={submit}
                disabled={!canSend}
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
      </div>
      <div className="input-hint">
        Claude può fare errori. Verifica le informazioni importanti.
      </div>
    </div>
  )
}
