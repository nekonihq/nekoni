import { createContext, useContext, useRef, useEffect, ReactNode } from 'react'
import { useIdentity } from '../hooks/useIdentity'
import { useAgentContext } from './AgentContext'
import { useWebRTC } from '../hooks/useWebRTC'
import { useAgent, ChatMessage } from '../hooks/useAgent'

interface ConnectionContextValue {
  sendRawRef: React.MutableRefObject<((data: string) => void) | null>
  onRagMessageRef: React.MutableRefObject<((msg: any) => void) | null>
  onSkillMessageRef: React.MutableRefObject<((msg: any) => void) | null>
  loadConversationRef: React.MutableRefObject<((id: string) => void) | null>
  rtcState: string
  authState: string
  rtcError: string | null
  messages: ChatMessage[]
  pendingMessage: string | null
  isThinking: boolean
  sendMessage: (text: string) => void
  setInitialMessages: (msgs: ChatMessage[]) => void
  disconnect: () => void
}

const ConnectionContext = createContext<ConnectionContextValue>({
  sendRawRef: { current: null },
  onRagMessageRef: { current: null },
  onSkillMessageRef: { current: null },
  loadConversationRef: { current: null },
  rtcState: 'idle',
  authState: 'pending',
  rtcError: null,
  messages: [],
  pendingMessage: null,
  isThinking: false,
  sendMessage: () => {},
  setInitialMessages: () => {},
  disconnect: () => {},
})

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const { identity } = useIdentity()
  const { activeAgent } = useAgentContext()
  const activeAgentRef = useRef(activeAgent)
  useEffect(() => { activeAgentRef.current = activeAgent }, [activeAgent])

  const sendRawRef = useRef<((data: string) => void) | null>(null)
  const onRagMessageRef = useRef<((msg: any) => void) | null>(null)
  const onSkillMessageRef = useRef<((msg: any) => void) | null>(null)
  const loadConversationRef = useRef<((id: string) => void) | null>(null)
  const handleDataChannelMessageRef = useRef<((raw: string) => void) | null>(null)
  const sessionId = useRef(`web-${Math.random().toString(36).slice(2, 10)}`).current

  const { state: rtcState, error: rtcError, connect, disconnect, sendMessage: sendRaw } = useWebRTC({
    identity,
    onDataChannelMessage: (raw) => {
      let msg: any
      try { msg = JSON.parse(raw) } catch { handleDataChannelMessageRef.current?.(raw); return }
      if (typeof msg.type === 'string' && msg.type.startsWith('rag_')) {
        onRagMessageRef.current?.(msg); return
      }
      if (typeof msg.type === 'string' && (msg.type.startsWith('skill_') || msg.type.startsWith('cron_'))) {
        onSkillMessageRef.current?.(msg); return
      }
      handleDataChannelMessageRef.current?.(raw)
    },
  })

  useEffect(() => { sendRawRef.current = sendRaw }, [sendRaw])

  const { authState, messages, pendingMessage, isThinking, handleDataChannelMessage, startHandshake, sendMessage, reset, setInitialMessages } = useAgent(
    identity,
    activeAgent?.agentPubKey ?? null,
    sendRaw,
    sessionId,
  )

  useEffect(() => { handleDataChannelMessageRef.current = handleDataChannelMessage }, [handleDataChannelMessage])

  // Connect on agent / identity change
  useEffect(() => {
    if (!activeAgent || !identity) return
    reset()
    connect(activeAgent)
  }, [activeAgent?.roomId, identity?.publicKeyB64])

  // Start handshake once connected
  useEffect(() => {
    if (rtcState === 'connected' && authState === 'pending') startHandshake()
  }, [rtcState, authState])

  // Auto-reconnect
  useEffect(() => {
    if ((rtcState === 'disconnected' || rtcState === 'error') && activeAgent && identity) {
      reset()
      const t = setTimeout(() => { if (activeAgentRef.current) connect(activeAgentRef.current) }, 3000)
      return () => clearTimeout(t)
    }
  }, [rtcState])

  // Disconnect on auth failure
  useEffect(() => { if (authState === 'failed') disconnect() }, [authState])

  return (
    <ConnectionContext.Provider value={{
      sendRawRef, onRagMessageRef, onSkillMessageRef, loadConversationRef,
      rtcState, authState, rtcError,
      messages, pendingMessage, isThinking, sendMessage, setInitialMessages, disconnect,
    }}>
      {children}
    </ConnectionContext.Provider>
  )
}

export const useConnection = () => useContext(ConnectionContext)
