import { useState, useEffect } from 'react'
import { useSkills, Skill, CronJob } from '../hooks/useSkills'
import { useConnection } from '../contexts/ConnectionContext'
import { useAgentContext } from '../contexts/AgentContext'
import { colors } from '../theme'
import TabBar from '../components/TabBar'

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily 9am', value: '0 9 * * *' },
  { label: 'Daily 6pm', value: '0 18 * * *' },
  { label: 'Every 6h', value: '0 */6 * * *' },
  { label: 'Mon-Fri 9am', value: '0 9 * * 1-5' },
]

export default function SkillsPage() {
  const { skills, jobs, loading, runResult, running, error, loadAll, createSkill, updateSkill, deleteSkill, runSkill, createCron, toggleCron, deleteCron, clearRunResult } = useSkills()
  const { rtcState, authState } = useConnection()
  const { activeAgent } = useAgentContext()

  const [showSkillForm, setShowSkillForm] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [sName, setSName] = useState('')
  const [sDesc, setSDesc] = useState('')
  const [sPrompt, setSPrompt] = useState('')

  const [showCronForm, setShowCronForm] = useState(false)
  const [cronSkillId, setCronSkillId] = useState('')
  const [cronExpr, setCronExpr] = useState('0 9 * * *')

  const [confirmSkill, setConfirmSkill] = useState<Skill | null>(null)
  const [confirmCron, setConfirmCron] = useState<CronJob | null>(null)

  useEffect(() => {
    if (authState === 'ready') loadAll()
  }, [authState])

  const openCreate = () => {
    setEditingSkill(null); setSName(''); setSDesc(''); setSPrompt('')
    setShowSkillForm(true)
  }

  const openEdit = (skill: Skill) => {
    setEditingSkill(skill); setSName(skill.name); setSDesc(skill.description); setSPrompt(skill.prompt)
    setShowSkillForm(true)
  }

  const saveSkill = () => {
    if (!sName.trim() || !sPrompt.trim()) return
    if (editingSkill) updateSkill(editingSkill.id, sName.trim(), sPrompt.trim(), sDesc.trim())
    else createSkill(sName.trim(), sPrompt.trim(), sDesc.trim())
    setShowSkillForm(false)
  }

  const openCronForm = (skillId: string) => {
    setCronSkillId(skillId); setCronExpr('0 9 * * *')
    setShowCronForm(true)
  }

  const saveCron = () => {
    createCron(cronSkillId, cronExpr)
    setShowCronForm(false)
  }

  const isReady = authState === 'ready'
  const statusColor = rtcState === 'connected' ? colors.green : colors.red
  const statusText = rtcState === 'connected'
    ? authState === 'ready' ? (activeAgent?.agentName ?? 'Connected') : 'Authenticating...'
    : rtcState === 'connecting' ? 'Connecting...'
    : rtcState === 'disconnected' ? 'Disconnected'
    : 'Not connected'

  const skillJobsOf = (skillId: string) => jobs.filter((j) => j.skillId === skillId)

  const inputStyle: React.CSSProperties = {
    background: colors.surfaceAlt,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: 6,
    padding: 10,
    color: colors.textHigh,
    fontSize: 14,
    marginBottom: 10,
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

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

      {/* Skills list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, paddingBottom: 80 }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
            <div style={{ width: 16, height: 16, border: `2px solid ${colors.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: colors.textMed, fontSize: 13 }}>Loading...</span>
          </div>
        )}

        {!loading && skills.length === 0 && (
          <p style={{ color: colors.textLow, textAlign: 'center', marginTop: 60, fontSize: 14 }}>
            {isReady ? 'No skills yet. Create one below.' : 'Connect to manage skills.'}
          </p>
        )}

        {skills.map((skill) => (
          <div key={skill.id} style={{ background: colors.surface, borderRadius: 8, border: `1px solid ${colors.border}`, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: 12, gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: colors.textHigh, fontSize: 15, fontWeight: 600 }}>{skill.name}</div>
                {!!skill.description && <div style={{ color: colors.textLow, fontSize: 12, marginTop: 2 }}>{skill.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{ padding: '4px 8px', borderRadius: 5, background: colors.accent, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={() => runSkill(skill.id)}>Run</button>
                <button style={{ padding: '4px 8px', borderRadius: 5, background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textMed, fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(skill)}>Edit</button>
                <button style={{ padding: '4px 8px', borderRadius: 5, background: 'transparent', border: `1px solid ${colors.red}`, color: colors.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={() => setConfirmSkill(skill)}>Delete</button>
              </div>
            </div>

            {skillJobsOf(skill.id).map((job) => (
              <div key={job.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderTop: `1px solid ${colors.border}`, gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: colors.textMed, fontSize: 12, fontFamily: 'monospace' }}>{job.cronExpression}</div>
                  <div style={{ color: colors.textLow, fontSize: 10, marginTop: 2 }}>Last run: {job.lastRun ? new Date(job.lastRun).toLocaleDateString() : 'Never'}</div>
                </div>
                <span style={{ color: colors.textLow, fontSize: 11 }}>Enabled</span>
                <label style={{ position: 'relative', display: 'inline-block', width: 36, height: 20, cursor: 'pointer' }}>
                  <input type="checkbox" checked={job.enabled} onChange={() => toggleCron(job)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                  <span style={{ position: 'absolute', inset: 0, background: job.enabled ? colors.accent : colors.border, borderRadius: 10, transition: '0.2s' }} />
                  <span style={{ position: 'absolute', top: 2, left: job.enabled ? 18 : 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: '0.2s' }} />
                </label>
                <button style={{ width: 28, height: 28, borderRadius: 6, background: colors.red + '18', border: 'none', color: colors.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }} onClick={() => setConfirmCron(job)}>✕</button>
              </div>
            ))}

            <button
              style={{ width: '100%', padding: 8, borderTop: `1px solid ${colors.border}`, background: 'none', border: 'none', color: colors.accent, fontSize: 12, cursor: 'pointer', textAlign: 'center' }}
              onClick={() => openCronForm(skill.id)}
            >
              + Add schedule
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      {isReady && (
        <div style={{ padding: 12, borderTop: `1px solid ${colors.border}`, background: colors.surface, flexShrink: 0 }}>
          <button style={{ width: '100%', background: colors.accent, border: 'none', borderRadius: 8, padding: 12, color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer' }} onClick={openCreate}>
            + New Skill
          </button>
        </div>
      )}

      <TabBar />

      {/* Run result modal */}
      {(running || runResult !== null) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
          <div style={{ background: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, width: '100%', maxHeight: '85%', display: 'flex', flexDirection: 'column' }}>
            <p style={{ color: colors.textHigh, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Skill Result</p>
            {running ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                <div style={{ width: 24, height: 24, border: `2px solid ${colors.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : (
              <div style={{ overflowY: 'auto', maxHeight: 300, marginBottom: 16 }}>
                <pre style={{ color: colors.textHigh, fontSize: 14, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{runResult}</pre>
              </div>
            )}
            {!running && (
              <button style={{ padding: 12, background: colors.surfaceAlt, border: 'none', borderRadius: 8, color: colors.textMed, fontWeight: 600, cursor: 'pointer' }} onClick={clearRunResult}>Close</button>
            )}
          </div>
        </div>
      )}

      {/* Skill form modal */}
      {showSkillForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
          <div style={{ background: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, width: '100%', maxHeight: '85%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <p style={{ color: colors.textHigh, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{editingSkill ? 'Edit Skill' : 'New Skill'}</p>
            <div style={{ overflowY: 'auto' }}>
              <input style={inputStyle} placeholder="Name" value={sName} onChange={(e) => setSName(e.target.value)} />
              <input style={inputStyle} placeholder="Description (optional)" value={sDesc} onChange={(e) => setSDesc(e.target.value)} />
              <textarea style={{ ...inputStyle, height: 100, resize: 'none', verticalAlign: 'top' }} placeholder="Prompt - what should the agent do?" value={sPrompt} onChange={(e) => setSPrompt(e.target.value)} />
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${colors.border}`, background: 'none', color: colors.textMed, fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowSkillForm(false)}>Cancel</button>
                <button style={{ flex: 1, padding: 12, borderRadius: 8, background: sName && sPrompt ? colors.accent : colors.surfaceAlt, border: 'none', color: sName && sPrompt ? '#fff' : colors.textLow, fontWeight: 600, cursor: sName && sPrompt ? 'pointer' : 'default' }} onClick={saveSkill} disabled={!sName || !sPrompt}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cron form modal */}
      {showCronForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
          <div style={{ background: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, width: '100%', boxSizing: 'border-box' }}>
            <p style={{ color: colors.textHigh, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Schedule Skill</p>
            <p style={{ color: colors.textMed, fontSize: 12, marginBottom: 6 }}>Preset</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.value}
                  style={{ padding: '5px 10px', borderRadius: 12, border: `1px solid ${cronExpr === p.value ? colors.accent : colors.border}`, background: cronExpr === p.value ? colors.accent : 'transparent', color: cronExpr === p.value ? '#fff' : colors.textMed, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => setCronExpr(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="0 9 * * *" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} />
            <p style={{ color: colors.textLow, fontSize: 11, marginTop: -6, marginBottom: 10 }}>minute hour day month weekday</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${colors.border}`, background: 'none', color: colors.textMed, fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowCronForm(false)}>Cancel</button>
              <button style={{ flex: 1, padding: 12, borderRadius: 8, background: colors.accent, border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }} onClick={saveCron}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete skill */}
      {confirmSkill && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setConfirmSkill(null)}>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, width: 280, display: 'flex', flexDirection: 'column', gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <p style={{ color: colors.textHigh, fontSize: 17, fontWeight: 700 }}>Delete skill</p>
            <p style={{ color: colors.textMed, fontSize: 14 }}>Remove "{confirmSkill.name}"?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10, color: colors.textMed, cursor: 'pointer', fontWeight: 600 }} onClick={() => setConfirmSkill(null)}>Cancel</button>
              <button style={{ flex: 1, background: 'transparent', border: `1px solid ${colors.red}`, borderRadius: 8, padding: 10, color: colors.red, fontWeight: 600, cursor: 'pointer' }} onClick={() => { deleteSkill(confirmSkill.id); setConfirmSkill(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete cron */}
      {confirmCron && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setConfirmCron(null)}>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, width: 280, display: 'flex', flexDirection: 'column', gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <p style={{ color: colors.textHigh, fontSize: 17, fontWeight: 700 }}>Delete job</p>
            <p style={{ color: colors.textMed, fontSize: 14 }}>Remove this scheduled job?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ flex: 1, background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, padding: 10, color: colors.textMed, cursor: 'pointer', fontWeight: 600 }} onClick={() => setConfirmCron(null)}>Cancel</button>
              <button style={{ flex: 1, background: 'transparent', border: `1px solid ${colors.red}`, borderRadius: 8, padding: 10, color: colors.red, fontWeight: 600, cursor: 'pointer' }} onClick={() => { deleteCron(confirmCron.id); setConfirmCron(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
