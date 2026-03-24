import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIdentity } from '../hooks/useIdentity'
import { useAgentContext, AgentInfo } from '../contexts/AgentContext'
import { useConnection } from '../contexts/ConnectionContext'
import { colors } from '../theme'
import TabBar from '../components/TabBar'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { identity } = useIdentity()
  const { agents, activeAgentId, selectAgent, removeAgent } = useAgentContext()
  const { disconnect } = useConnection()
  const [confirmUnpair, setConfirmUnpair] = useState<string | null>(null)

  const agentList = Object.values(agents)

  const handleConnect = (agent: AgentInfo) => {
    disconnect()
    selectAgent(agent.roomId)
  }

  const handleReconnect = () => {
    disconnect()
  }

  const confirmDoUnpair = (agent: AgentInfo) => {
    if (activeAgentId === agent.roomId) disconnect()
    removeAgent(agent.roomId)
    setConfirmUnpair(null)
  }

  const s: Record<string, React.CSSProperties> = {
    page: { display: 'flex', flexDirection: 'column', height: '100dvh', background: colors.bg },
    header: { padding: '12px 16px', background: colors.surface, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 },
    title: { color: colors.textHigh, fontSize: 17, fontWeight: 700 },
    content: { flex: 1, overflowY: 'auto', padding: 16 },
    section: { marginBottom: 24 },
    sectionTitle: { color: colors.textMed, fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 1 },
    card: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 12, marginBottom: 8 },
    agentHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    agentNameRow: { display: 'flex', alignItems: 'center', gap: 6 },
    activeDot: { width: 7, height: 7, borderRadius: '50%', background: colors.accent, flexShrink: 0 },
    agentName: { color: colors.textHigh, fontSize: 15, fontWeight: 600 },
    activeLabel: { color: colors.accent, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    label: { color: colors.textLow, fontSize: 11, marginTop: 8, marginBottom: 2 },
    value: { color: colors.textHigh, fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all' as const },
    agentActions: { display: 'flex', gap: 8, marginTop: 12 },
    connectBtn: { flex: 1, background: colors.accent, border: 'none', borderRadius: 8, padding: 10, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
    dangerBtn: { flex: 1, background: 'transparent', border: `1px solid ${colors.red}`, borderRadius: 8, padding: 10, color: colors.red, fontWeight: 600, cursor: 'pointer', fontSize: 14 },
    addBtn: { width: '100%', background: colors.accent, border: 'none', borderRadius: 8, padding: 12, color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginTop: 4 },
    emptyText: { color: colors.textLow, fontSize: 14, textAlign: 'center' as const, padding: '16px 0' },
    overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    dialog: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, width: 280, display: 'flex', flexDirection: 'column' as const, gap: 12 },
    dialogTitle: { color: colors.textHigh, fontSize: 17, fontWeight: 700 },
    dialogMsg: { color: colors.textMed, fontSize: 14 },
    dialogActions: { display: 'flex', gap: 8, marginTop: 4 },
    cancelBtn: { flex: 1, background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10, color: colors.textMed, cursor: 'pointer', fontWeight: 600 },
  }

  const confirmAgent = confirmUnpair ? agents[confirmUnpair] : null

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.title}>Settings</span>
      </div>

      <div style={s.content}>
        <div style={s.section}>
          <p style={s.sectionTitle}>Device Identity</p>
          <div style={s.card}>
            <p style={s.label}>Public Key</p>
            <p style={s.value}>{identity?.publicKeyB64 ?? 'Loading...'}</p>
          </div>
        </div>

        <div style={s.section}>
          <p style={s.sectionTitle}>Paired Agents</p>
          {agentList.length === 0 ? (
            <p style={s.emptyText}>No agents paired yet</p>
          ) : (
            agentList.map((agent) => {
              const isActive = agent.roomId === activeAgentId
              return (
                <div key={agent.roomId} style={s.card}>
                  <div style={s.agentHeader}>
                    <div style={s.agentNameRow}>
                      {isActive && <div style={s.activeDot} />}
                      <span style={s.agentName}>{agent.agentName}</span>
                    </div>
                    {isActive && <span style={s.activeLabel}>active</span>}
                  </div>
                  <p style={s.label}>Room ID</p>
                  <p style={s.value}>{agent.roomId}</p>
                  <p style={s.label}>Signal URL</p>
                  <p style={s.value}>{agent.signalUrl}</p>
                  <div style={s.agentActions}>
                    {isActive ? (
                      <button style={s.connectBtn} onClick={handleReconnect}>Reconnect</button>
                    ) : (
                      <button style={s.connectBtn} onClick={() => handleConnect(agent)}>Connect</button>
                    )}
                    <button style={s.dangerBtn} onClick={() => setConfirmUnpair(agent.roomId)}>Unpair</button>
                  </div>
                </div>
              )
            })
          )}
          <button style={s.addBtn} onClick={() => navigate('/pair')}>+ Add Agent</button>
        </div>
      </div>

      <TabBar />

      {confirmAgent && (
        <div style={s.overlay} onClick={() => setConfirmUnpair(null)}>
          <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
            <p style={s.dialogTitle}>Unpair Agent</p>
            <p style={s.dialogMsg}>Remove "{confirmAgent.agentName}"?</p>
            <div style={s.dialogActions}>
              <button style={s.cancelBtn} onClick={() => setConfirmUnpair(null)}>Cancel</button>
              <button style={s.dangerBtn} onClick={() => confirmDoUnpair(confirmAgent)}>Unpair</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
