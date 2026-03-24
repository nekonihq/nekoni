import { useState, useEffect, useRef } from 'react'
import { useRAG } from '../hooks/useRAG'
import { useConnection } from '../contexts/ConnectionContext'
import { useAgentContext } from '../contexts/AgentContext'
import { colors } from '../theme'
import TabBar from '../components/TabBar'

export default function KnowledgePage() {
  const { documents, loading, uploading, error, loadDocuments, deleteDocument, uploadDocument } = useRAG()
  const { rtcState, authState } = useConnection()
  const { activeAgent } = useAgentContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState<{ doc_id: string; source: string } | null>(null)

  useEffect(() => {
    if (authState === 'ready') loadDocuments()
  }, [authState])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    await uploadDocument(file)
  }

  const statusColor = rtcState === 'connected' ? colors.green : colors.red
  const statusText = rtcState === 'connected'
    ? authState === 'ready' ? (activeAgent?.agentName ?? 'Connected') : 'Authenticating...'
    : rtcState === 'connecting' ? 'Connecting...'
    : rtcState === 'disconnected' ? 'Disconnected'
    : 'Not connected'

  const isReady = authState === 'ready'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: colors.bg }}>
      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: colors.surface, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
        <span style={{ color: colors.textMed, fontSize: 13, flex: 1 }}>{statusText}</span>
      </div>

      {error && (
        <div style={{ background: colors.red + '22', borderBottom: `1px solid ${colors.red}`, padding: 10 }}>
          <span style={{ color: colors.red, fontSize: 13 }}>{error}</span>
        </div>
      )}

      {/* Document list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {(loading || uploading) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
            <div style={{ width: 16, height: 16, border: `2px solid ${colors.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: colors.textMed, fontSize: 13 }}>{uploading ? 'Uploading…' : 'Loading…'}</span>
          </div>
        )}

        {!loading && documents.length === 0 && (
          <p style={{ color: colors.textLow, textAlign: 'center', marginTop: 60, fontSize: 14 }}>
            {isReady ? 'No documents in the knowledge base.' : 'Connect to your agent to manage the knowledge base.'}
          </p>
        )}

        {documents.map((doc) => (
          <div key={doc.doc_id} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${colors.border}`, gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: colors.textHigh, fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.source || doc.doc_id}
              </div>
              <div style={{ color: colors.textLow, fontSize: 11, marginTop: 2 }}>
                {doc.chunks} chunk{doc.chunks !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              style={{ padding: '5px 10px', borderRadius: 5, border: `1px solid ${colors.red}`, background: 'transparent', color: colors.red, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
              onClick={() => setConfirm(doc)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Upload footer */}
      <div style={{ padding: 12, borderTop: `1px solid ${colors.border}`, background: colors.surface, flexShrink: 0 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          style={{
            width: '100%',
            background: isReady && !uploading ? colors.accent : colors.surfaceAlt,
            border: 'none',
            borderRadius: 8,
            padding: 12,
            color: isReady && !uploading ? '#fff' : colors.textLow,
            fontWeight: 600,
            fontSize: 15,
            cursor: isReady && !uploading ? 'pointer' : 'default',
          }}
          onClick={() => fileInputRef.current?.click()}
          disabled={!isReady || uploading}
        >
          {uploading ? 'Uploading…' : '+ Upload Document'}
        </button>
      </div>

      <TabBar />

      {/* Confirm delete dialog */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setConfirm(null)}>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, width: 280, display: 'flex', flexDirection: 'column', gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <p style={{ color: colors.textHigh, fontSize: 17, fontWeight: 700 }}>Delete document</p>
            <p style={{ color: colors.textMed, fontSize: 14 }}>Remove "{confirm.source || confirm.doc_id}" from the knowledge base?</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button style={{ flex: 1, background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10, color: colors.textMed, cursor: 'pointer', fontWeight: 600 }} onClick={() => setConfirm(null)}>Cancel</button>
              <button style={{ flex: 1, background: 'transparent', border: `1px solid ${colors.red}`, borderRadius: 8, padding: 10, color: colors.red, fontWeight: 600, cursor: 'pointer', fontSize: 14 }} onClick={() => { deleteDocument(confirm.doc_id); setConfirm(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
