import { useState, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Conversation, Message } from '../types'

type StreamState = 'idle' | 'streaming' | 'error'

interface UseStreamingProps {
  activeConv: Conversation | null
  setActiveConv: (conv: Conversation | null | ((prev: Conversation | null) => Conversation | null)) => void
  saveConversation: (conv: Conversation) => Promise<void>
  generateTitle: (conv: Conversation) => Promise<string>
}

export function useStreaming({ activeConv, setActiveConv, saveConversation, generateTitle }: UseStreamingProps) {
  const [streamState, setStreamState] = useState<StreamState>('idle')
  const [error, setError] = useState<string | null>(null)
  const streamingContentRef = useRef('')
  const activeConvRef = useRef<Conversation | null>(null)
  activeConvRef.current = activeConv

  const sendMessage = useCallback(async (userContent: string) => {
    if (!activeConv) return
    setError(null)

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    }
    const assistantMsg: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }

    const convWithUser: Conversation = {
      ...activeConv,
      messages: [...activeConv.messages, userMsg, assistantMsg],
      updatedAt: Date.now(),
    }
    setActiveConv(convWithUser)
    setStreamState('streaming')
    streamingContentRef.current = ''

    window.claudeAPI.removeStreamListeners()

    window.claudeAPI.onStreamChunk((chunk) => {
      streamingContentRef.current += chunk
      setActiveConv(prev => {
        if (!prev) return prev
        const msgs = [...prev.messages]
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: streamingContentRef.current }
        return { ...prev, messages: msgs }
      })
    })

    window.claudeAPI.onStreamEnd(async (data) => {
      setStreamState('idle')
      window.claudeAPI.removeStreamListeners()

      const finalConv = activeConvRef.current
      if (!finalConv) return

      // Fix race condition: React state updates are async, so activeConvRef.current
      // may still have empty assistant content. Use streamingContentRef (sync mutable ref).
      const messages = [...finalConv.messages]
      const lastMsg = messages[messages.length - 1]
      if (lastMsg?.role === 'assistant' && streamingContentRef.current) {
        messages[messages.length - 1] = { ...lastMsg, content: streamingContentRef.current }
      }

      // Salva cliSessionId se restituito dalla CLI (per --resume nelle chiamate successive)
      let savedConv: Conversation = {
        ...finalConv,
        messages,
        updatedAt: Date.now(),
        ...(data?.sessionId ? { cliSessionId: data.sessionId } : {}),
      }

      // Auto-titolo alla prima risposta
      if (savedConv.title === 'Nuova conversazione' && savedConv.messages.length >= 2) {
        const title = await generateTitle(savedConv)
        savedConv = { ...savedConv, title }
      }

      await saveConversation(savedConv)
      setActiveConv(savedConv)
    })

    window.claudeAPI.onStreamError((err) => {
      setStreamState('error')
      setError(err)
      window.claudeAPI.removeStreamListeners()
    })

    await window.claudeAPI.sendMessage({
      messages: convWithUser.messages
        .filter(m => !(m.role === 'assistant' && m.content === ''))  // escludi solo il placeholder vuoto
        .map(m => ({ role: m.role, content: m.content })),
      model: activeConv.model,
      cliSessionId: activeConv.cliSessionId,
      mode: activeConv.mode,
      projectDir: activeConv.projectDir,
    })
  }, [activeConv, setActiveConv, saveConversation, generateTitle])

  const stopStream = useCallback(() => {
    window.claudeAPI.abortStream()
    setStreamState('idle')
    window.claudeAPI.removeStreamListeners()
  }, [])

  return { streamState, error, sendMessage, stopStream }
}
