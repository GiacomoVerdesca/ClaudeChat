import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Conversation, ConversationMeta, Message, Model } from '../types'

export function useConversations() {
  const [metas, setMetas] = useState<ConversationMeta[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshList = useCallback(async () => {
    const list = await window.claudeAPI.listAllConversations()
    setMetas(list)
  }, [])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  const selectConversation = useCallback(async (id: string, meta?: ConversationMeta) => {
    setLoading(true)

    // Sessione VS Code non ancora importata: carica dal JSONL e salva come conversazione locale
    if (meta?.source === 'vscode' && meta.vscodeSessionId) {
      const rawMessages = await window.claudeAPI.loadVSCodeSession(meta.vscodeSessionId)
      if (rawMessages.length > 0) {
        const messages = rawMessages.map(m => ({
          id: uuidv4(),
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }))
        const conv: Conversation = {
          id: uuidv4(),
          title: meta.title,
          createdAt: messages[0]?.timestamp ?? Date.now(),
          updatedAt: messages[messages.length - 1]?.timestamp ?? Date.now(),
          model: meta.model ?? 'claude-sonnet-4-6',
          messages,
          cliSessionId: meta.vscodeSessionId,
          projectDir: meta.projectDir,
        }
        await window.claudeAPI.saveConversation(conv)
        setActiveConv(conv)
        await refreshList()
      }
      setLoading(false)
      return
    }

    const conv = await window.claudeAPI.loadConversation(id)
    setActiveConv(conv)
    setLoading(false)
  }, [refreshList])

  const newConversation = useCallback((model: Model = 'claude-sonnet-4-6') => {
    const conv: Conversation = {
      id: uuidv4(),
      title: 'Nuova conversazione',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model,
      messages: [],
    }
    setActiveConv(conv)
    return conv
  }, [])

  const saveConversation = useCallback(async (conv: Conversation) => {
    await window.claudeAPI.saveConversation(conv)
    await refreshList()
  }, [refreshList])

  const deleteConversation = useCallback(async (id: string) => {
    await window.claudeAPI.deleteConversation(id)
    if (activeConv?.id === id) setActiveConv(null)
    await refreshList()
  }, [activeConv, refreshList])

  const renameConversation = useCallback(async (id: string, title: string) => {
    const conv = await window.claudeAPI.loadConversation(id)
    if (!conv) return
    conv.title = title
    await window.claudeAPI.saveConversation(conv)
    if (activeConv?.id === id) setActiveConv({ ...conv, title })
    await refreshList()
  }, [activeConv, refreshList])

  const appendMessage = useCallback((msg: Message) => {
    setActiveConv(prev => {
      if (!prev) return prev
      return { ...prev, messages: [...prev.messages, msg] }
    })
  }, [])

  const updateLastMessage = useCallback((content: string) => {
    setActiveConv(prev => {
      if (!prev) return prev
      const messages = [...prev.messages]
      if (messages.length === 0) return prev
      messages[messages.length - 1] = { ...messages[messages.length - 1], content }
      return { ...prev, messages }
    })
  }, [])

  return {
    metas,
    activeConv,
    loading,
    setActiveConv,
    selectConversation,
    newConversation,
    saveConversation,
    deleteConversation,
    renameConversation,
    appendMessage,
    updateLastMessage,
    refreshList,
  }
}
