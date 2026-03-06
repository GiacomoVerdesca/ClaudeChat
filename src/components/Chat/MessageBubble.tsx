import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Message } from '../../types'
import './Chat.css'

interface Props {
  message: Message
  isStreaming?: boolean
  userInitials?: string
}

export function MessageBubble({ message, isStreaming, userInitials }: Props) {
  const isUser = message.role === 'user'
  const showThinking = !isUser && isStreaming && !message.content

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-avatar ${isUser ? 'user-avatar' : 'assistant-avatar'}`}>
        {isUser ? (userInitials || 'U') : 'C'}
      </div>
      <div className={`message-content ${isStreaming && !showThinking ? 'streaming-cursor' : ''}`}>
        {isUser ? (
          <>
            {message.images && message.images.length > 0 && (
              <div className="message-images">
                {message.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={`data:${img.mediaType};base64,${img.data}`}
                    alt=""
                    className="message-image"
                  />
                ))}
              </div>
            )}
            {message.content && <span className="user-text">{message.content}</span>}
          </>
        ) : showThinking ? (
          <div className="thinking-indicator">
            <span>Claude sta pensando</span>
            <span className="thinking-dots"><span/><span/><span/></span>
          </div>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, className, children, ...props }) {
                const inline = !className
                const match = /language-(\w+)/.exec(className || '')
                if (!inline && match) {
                  return (
                    <CodeBlock language={match[1]}>
                      {String(children).replace(/\n$/, '')}
                    </CodeBlock>
                  )
                }
                return <code className="inline-code" {...props}>{children}</code>
              },
            }}
          >
            {message.content || ''}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-lang">{language}</span>
        <button className="copy-btn" onClick={copy}>
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Copiato
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copia
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: '0 0 6px 6px', fontSize: '13px' }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}
