import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgentContext } from '../contexts/AgentContext'
import { useConnection } from '../contexts/ConnectionContext'
import { getOrCreateConversation, getMessages, saveMessage, createConversation } from '../db'
import { colors } from '../theme'
import TabBar from '../components/TabBar'

export default function ChatPage() {
  const navigate = useNavigate()
  const { activeAgent, agents, selectAgent, loaded: agentsLoaded } = useAgentContext()
  const { rtcState, rtcError, authState, messages, pendingMessage, isThinking, sendMessage, setInitialMessages, loadConversationRef } = useConnection()

  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const conversationIdRef = useRef<string | null>(null)
  const savedMessageIdsRef = useRef(new Set<string>())
  const messagesRef = useRef(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

  // Navigate to pair if no agents
  useEffect(() => {
    if (agentsLoaded && Object.keys(agents).length === 0) navigate('/pair')
  }, [agentsLoaded, agents])

  // Load or create conversation when active agent changes
  useEffect(() => {
    if (!activeAgent) return
    conversationIdRef.current = null
    savedMessageIdsRef.current = new Set()

    getOrCreateConversation(activeAgent.roomId).then(async (convId) => {
      conversationIdRef.current = convId
      const stored = await getMessages(convId)
      stored.forEach((m) => savedMessageIdsRef.current.add(m.id))
      // Only load from DB if no in-memory messages (first mount or agent switch)
      if (messagesRef.current.length === 0 && stored.length > 0) {
        setInitialMessages(stored.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'agent',
          content: m.content,
          timestamp: m.timestamp,
        })))
      }
    })
  }, [activeAgent?.roomId])

  // Save new complete messages to DB
  useEffect(() => {
    const convId = conversationIdRef.current
    if (!convId) return
    for (const msg of messages) {
      if (!savedMessageIdsRef.current.has(msg.id)) {
        savedMessageIdsRef.current.add(msg.id)
        saveMessage(convId, { id: msg.id, role: msg.role, content: msg.content, timestamp: msg.timestamp })
      }
    }
  }, [messages])

  // loadConversationRef: switch to a specific conversation
  useEffect(() => {
    loadConversationRef.current = async (convId: string) => {
      conversationIdRef.current = convId
      savedMessageIdsRef.current = new Set()
      const stored = await getMessages(convId)
      stored.forEach((m) => savedMessageIdsRef.current.add(m.id))
      setInitialMessages(stored.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'agent',
        content: m.content,
        timestamp: m.timestamp,
      })))
    }
    return () => { loadConversationRef.current = null }
  }, [setInitialMessages])

  const handleNewChat = useCallback(async () => {
    if (!activeAgent) return
    const convId = await createConversation(activeAgent.roomId)
    conversationIdRef.current = convId
    savedMessageIdsRef.current = new Set()
    setInitialMessages([])
  }, [activeAgent?.roomId, setInitialMessages])

  // Scroll to bottom
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, pendingMessage, isThinking])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || authState !== 'ready') return
    sendMessage(text)
    setInput('')
  }, [input, authState, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (!agentsLoaded) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh', background: colors.bg }}>
      <div style={{ width: 24, height: 24, border: `2px solid ${colors.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  }

  const statusColor = rtcState === 'connected' ? colors.green : colors.red
  const statusText = rtcState === 'connected'
    ? authState === 'ready' ? (activeAgent?.agentName ?? 'Connected') : 'Authenticating...'
    : rtcState === 'connecting' ? 'Connecting...'
    : rtcState === 'disconnected' ? 'Reconnecting in 3s...'
    : 'Not connected'

  const agentList = Object.values(agents)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: colors.bg }}>
      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: colors.surface, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <button onClick={() => navigate('/history')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 12px', color: colors.accent, fontSize: 15 }}>
          History
        </button>

        <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
        <span style={{ color: colors.textMed, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{statusText}</span>
        {rtcError && <span style={{ color: colors.red, fontSize: 11 }}>{rtcError}</span>}

        {agentList.length > 1 && (
          <select
            value={activeAgent?.roomId ?? ''}
            onChange={(e) => selectAgent(e.target.value)}
            style={{ background: colors.surfaceAlt, color: colors.textHigh, border: `1px solid ${colors.border}`, borderRadius: 4, padding: '2px 6px', fontSize: 12 }}
          >
            {agentList.map((a) => <option key={a.roomId} value={a.roomId}>{a.agentName}</option>)}
          </select>
        )}

        <button onClick={handleNewChat} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 12px', color: colors.accent, fontSize: 15 }}>
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && !pendingMessage && !isThinking && (
          <p style={{ color: colors.textLow, textAlign: 'center', marginTop: 60, fontSize: 14 }}>
            {authState === 'ready' ? 'Send a message to start chatting' : 'Connect to your agent to start'}
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              maxWidth: '80%',
              padding: '10px 12px',
              borderRadius: 8,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              background: msg.role === 'user' ? colors.accentSurface : colors.surface,
              border: `1px solid ${msg.role === 'user' ? colors.accent + '44' : colors.border}`,
            }}
          >
            <p style={{ color: colors.textHigh, fontSize: 15, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</p>
            <p style={{ color: colors.textLow, fontSize: 10, marginTop: 4 }}>{new Date(msg.timestamp).toLocaleTimeString()}</p>
          </div>
        ))}
        {isThinking && (
          <div style={{ padding: '10px 12px', borderRadius: 8, alignSelf: 'flex-start', background: colors.surface, border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: colors.textMed, animation: `bounce 1s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        {!isThinking && pendingMessage && (
          <div style={{ maxWidth: '80%', padding: '10px 12px', borderRadius: 8, alignSelf: 'flex-start', background: colors.surface, border: `1px solid ${colors.border}` }}>
            <p style={{ color: colors.textHigh, fontSize: 15, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{pendingMessage}</p>
          </div>
        )}
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, padding: 8, borderTop: `1px solid ${colors.border}`, background: colors.surface, flexShrink: 0 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          disabled={authState !== 'ready'}
          rows={1}
          style={{
            flex: 1,
            background: colors.surfaceAlt,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 6,
            padding: '8px 10px',
            color: colors.textHigh,
            fontSize: 15,
            resize: 'none',
            fontFamily: 'inherit',
            maxHeight: 100,
            overflowY: 'auto',
          }}
        />
        <button
          onClick={handleSend}
          disabled={authState !== 'ready'}
          style={{
            background: authState === 'ready' ? colors.accent : colors.surfaceAlt,
            border: authState === 'ready' ? 'none' : `1px solid ${colors.borderStrong}`,
            color: authState === 'ready' ? '#fff' : colors.textLow,
            padding: '8px 16px',
            borderRadius: 6,
            cursor: authState === 'ready' ? 'pointer' : 'default',
            fontWeight: 600,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          Send
        </button>
      </div>

      <TabBar />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  )
}
