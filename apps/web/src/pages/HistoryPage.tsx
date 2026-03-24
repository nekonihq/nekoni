import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgentContext } from '../contexts/AgentContext'
import { useConnection } from '../contexts/ConnectionContext'
import { getConversations, deleteConversation, ConversationRow } from '../db'
import { colors } from '../theme'

const formatDate = (ts: number): string => {
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const { activeAgent } = useAgentContext()
  const { loadConversationRef } = useConnection()
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [confirmDelete, setConfirmDelete] = useState<ConversationRow | null>(null)

  useEffect(() => {
    if (activeAgent) {
      getConversations(activeAgent.roomId).then(setConversations)
    }
  }, [activeAgent?.roomId])

  const handleLoad = (conv: ConversationRow) => {
    loadConversationRef.current?.(conv.id)
    navigate('/')
  }

  const doDelete = async (conv: ConversationRow) => {
    await deleteConversation(conv.id)
    setConversations((prev) => prev.filter((c) => c.id !== conv.id))
    setConfirmDelete(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: colors.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: colors.surface, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.accent, padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span style={{ color: colors.textHigh, fontSize: 17, fontWeight: 700 }}>History</span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 ? (
          <p style={{ color: colors.textLow, textAlign: 'center', marginTop: 60, fontSize: 14 }}>No conversations yet</p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleLoad(conv)}
              style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', background: colors.surface, borderBottom: `1px solid ${colors.border}`, cursor: 'pointer', gap: 8 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: colors.textHigh, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.title ?? 'New conversation'}
                </div>
                <div style={{ color: colors.textLow, fontSize: 12, marginTop: 3 }}>{formatDate(conv.updated_at)}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(conv) }}
                style={{ background: 'none', border: 'none', color: colors.textLow, fontSize: 18, cursor: 'pointer', padding: 4, flexShrink: 0 }}
              >✕</button>
            </div>
          ))
        )}
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setConfirmDelete(null)}>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, width: 280, display: 'flex', flexDirection: 'column', gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <p style={{ color: colors.textHigh, fontSize: 17, fontWeight: 700 }}>Delete conversation</p>
            <p style={{ color: colors.textMed, fontSize: 14 }}>{confirmDelete.title ? `"${confirmDelete.title}"` : 'This conversation will be deleted.'}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button style={{ flex: 1, background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10, color: colors.textMed, cursor: 'pointer', fontWeight: 600 }} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button style={{ flex: 1, background: 'transparent', border: `1px solid ${colors.red}`, borderRadius: 8, padding: 10, color: colors.red, fontWeight: 600, cursor: 'pointer' }} onClick={() => doDelete(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
