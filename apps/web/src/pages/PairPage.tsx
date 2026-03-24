import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import { useNavigate } from 'react-router-dom'
import { useAgentContext } from '../contexts/AgentContext'
import { useIdentity, signPayload } from '../hooks/useIdentity'
import { colors } from '../theme'

interface AgentQRPayload {
  agentPubKey: string
  signalUrl: string
  agentUrl: string
  agentUrlHttps?: string
  roomId: string
  agentName: string
}

type Step = 'scanning' | 'trust' | 'pairing' | 'done' | 'error'

export default function PairPage() {
  const navigate = useNavigate()
  const { identity } = useIdentity()
  const { agents, addAgent } = useAgentContext()
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const processingRef = useRef(false)

  const [step, setStep] = useState<Step>('scanning')
  const [payload, setPayload] = useState<AgentQRPayload | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!videoRef.current || step !== 'scanning') return

    const scanner = new QrScanner(
      videoRef.current,
      (result: QrScanner.ScanResult) => { handleScan(result.data) },
      { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true },
    )
    scanner.setInversionMode('invert')
    scannerRef.current = scanner
    scanner.start()

    return () => { scanner.stop(); scanner.destroy() }
  }, [identity, step])

  const handleScan = (data: string) => {
    if (processingRef.current || !identity) return
    processingRef.current = true
    scannerRef.current?.stop()

    try {
      const p: AgentQRPayload = JSON.parse(data)
      if (!p.agentPubKey || !p.signalUrl || !p.roomId || !p.agentUrl) throw new Error('Invalid QR code')

      if (agents[p.roomId]) {
        addAgent(p)
        setStatusMsg(`${p.agentName} is already paired.`)
        setStep('done')
        return
      }

      setPayload(p)
      setStep('trust')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setStep('error')
    }
  }

  const handleContinue = async () => {
    if (!payload || !identity) return
    setStep('pairing')

    try {
      const ts = Date.now()
      const pairingPayload = { mobilePubKey: identity.publicKeyB64, ts, deviceName: 'Web' }
      const sig = signPayload(pairingPayload, identity)

      const baseUrl = (payload.agentUrlHttps ?? payload.agentUrl).replace(/\/$/, '')
      const res = await fetch(`${baseUrl}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pairingPayload, sig }),
      })

      if (!res.ok) {
        const text = await res.text()
        let detail = text
        try { detail = JSON.parse(text).detail ?? text } catch {}
        throw new Error(`HTTP ${res.status}: ${detail}`)
      }

      const result = await res.json()
      addAgent(payload)
      setStatusMsg(
        result.status === 'already_approved'
          ? 'You\'re all set!'
          : 'Request sent — approve on the dashboard'
      )
      setStep('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setStep('error')
    }
  }

  const resetToScan = () => {
    processingRef.current = false
    setPayload(null)
    setErrorMsg('')
    setStatusMsg('')
    setStep('scanning')
  }

  const s: Record<string, React.CSSProperties> = {
    page: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: colors.bg, padding: 24, gap: 0 },
    title: { fontSize: 20, fontWeight: 700, color: colors.textHigh, marginBottom: 8 },
    subtitle: { fontSize: 14, color: colors.textMed, textAlign: 'center', lineHeight: 1.6, maxWidth: 300, marginBottom: 24 },
    videoWrap: { width: 280, height: 280, borderRadius: 12, overflow: 'hidden', border: `2px solid ${colors.accent}`, background: '#000', marginBottom: 24 },
    video: { width: '100%', height: '100%', objectFit: 'cover' },
    card: { width: '100%', maxWidth: 320, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 },
    cardTitle: { color: colors.textHigh, fontSize: 17, fontWeight: 700 },
    cardBody: { color: colors.textMed, fontSize: 14, lineHeight: 1.6 },
    agentName: { color: colors.accent, fontWeight: 600 },
    trustLink: { display: 'block', padding: '12px 0', color: colors.accent, fontSize: 15, fontWeight: 600, textAlign: 'center', textDecoration: 'none', border: `1px solid ${colors.accent}`, borderRadius: 8 },
    primaryBtn: { background: colors.accent, border: 'none', borderRadius: 8, padding: 14, color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', width: '100%' },
    ghostBtn: { background: 'none', border: `1px solid ${colors.border}`, borderRadius: 8, padding: 12, color: colors.textMed, fontWeight: 600, fontSize: 14, cursor: 'pointer', width: '100%' },
    badge: { width: 64, height: 64, background: colors.accent + '22', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 30 },
    errText: { color: colors.red, fontSize: 13, textAlign: 'center', lineHeight: 1.5 },
  }

  // ── Scanning ──
  if (step === 'scanning') {
    return (
      <div style={s.page}>
        <p style={s.title}>Scan Agent QR Code</p>
        <p style={s.subtitle}>Open the Nekoni dashboard on your machine and scan the QR code.</p>
        <div style={s.videoWrap}>
          <video ref={videoRef} style={s.video} muted playsInline />
        </div>
        <button style={{ ...s.ghostBtn, maxWidth: 200 }} onClick={() => navigate('/')}>Cancel</button>
      </div>
    )
  }

  // ── Trust cert ──
  if (step === 'trust' && payload) {
    return (
      <div style={s.page}>
        <div style={{ ...s.card }}>
          <p style={s.cardTitle}>Trust the agent</p>
          <p style={s.cardBody}>
            <span style={s.agentName}>{payload.agentName}</span> uses a local certificate.
            Open the agent in your browser once to accept it, then come back here.
          </p>
          <a href={payload.agentUrlHttps ?? payload.agentUrl} target="_blank" rel="noopener noreferrer" style={s.trustLink}>
            Open Agent in Browser ↗
          </a>
          <p style={{ ...s.cardBody, fontSize: 12, color: colors.textLow, textAlign: 'center' }}>
            Accept the security warning on that page, then tap Continue.
          </p>
          <button style={s.primaryBtn} onClick={handleContinue}>Continue →</button>
          <button style={s.ghostBtn} onClick={resetToScan}>Scan again</button>
        </div>
      </div>
    )
  }

  // ── Pairing ──
  if (step === 'pairing') {
    return (
      <div style={s.page}>
        <div style={{ width: 32, height: 32, border: `3px solid ${colors.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
        <p style={{ color: colors.textMed, fontSize: 15 }}>Sending pairing request…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Done ──
  if (step === 'done') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.badge}>✓</div>
          <p style={{ ...s.cardTitle, textAlign: 'center' }}>{statusMsg}</p>
          <button style={s.primaryBtn} onClick={() => navigate('/')}>Go to Chat</button>
        </div>
      </div>
    )
  }

  // ── Error ──
  return (
    <div style={s.page}>
      <div style={s.card}>
        <p style={s.cardTitle}>Something went wrong</p>
        <p style={s.errText}>{errorMsg}</p>
        <button style={s.primaryBtn} onClick={resetToScan}>Try again</button>
        <button style={s.ghostBtn} onClick={() => navigate('/')}>Cancel</button>
      </div>
    </div>
  )
}
