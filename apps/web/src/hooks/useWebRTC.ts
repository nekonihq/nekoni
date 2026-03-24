import { useRef, useState, useCallback } from 'react'
import { Identity, signPayload } from './useIdentity'

export type RTCState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

export interface AgentInfo {
  agentPubKey: string
  signalUrl: string
  agentUrl: string
  roomId: string
  agentName: string
}

interface UseWebRTCOptions {
  identity: Identity | null
  onDataChannelMessage?: (msg: string) => void
}

export function useWebRTC({ identity, onDataChannelMessage }: UseWebRTCOptions) {
  const [state, setState] = useState<RTCState>('idle')
  const [error, setError] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPongRef = useRef(0)
  const connectGenRef = useRef(0)
  const clientId = useRef(`mobile-${Math.random().toString(36).slice(2, 10)}`)
  const onDataChannelMessageRef = useRef(onDataChannelMessage)
  onDataChannelMessageRef.current = onDataChannelMessage
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    clearTimeout(connectionTimeoutRef.current!)
    connectionTimeoutRef.current = null
    clearInterval(pingIntervalRef.current!)
    pingIntervalRef.current = null

    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onmessage = null
      wsRef.current.onerror = null
      wsRef.current.onclose = null
      wsRef.current.close()
      wsRef.current = null
    }
    if (dcRef.current) {
      dcRef.current.onopen = null
      dcRef.current.onclose = null
      dcRef.current.onmessage = null
      try { dcRef.current.close() } catch {}
      dcRef.current = null
    }
    if (pcRef.current) {
      pcRef.current.onicecandidate = null
      pcRef.current.oniceconnectionstatechange = null
      try { pcRef.current.close() } catch {}
      pcRef.current = null
    }
  }, [])

  const disconnect = useCallback(() => {
    connectGenRef.current++
    cleanup()
    setState('disconnected')
  }, [cleanup])

  const connect = useCallback(async (agentInfo: AgentInfo) => {
    if (!identity) { setError('Identity not initialized'); return }

    const gen = ++connectGenRef.current
    cleanup()
    setState('connecting')
    setError(null)

    await new Promise((r) => setTimeout(r, 150))
    if (connectGenRef.current !== gen) return

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    pcRef.current = pc

    let offerSent = false
    let remoteDescSet = false
    const pendingCandidates: RTCIceCandidateInit[] = []

    connectionTimeoutRef.current = setTimeout(() => {
      if (connectGenRef.current !== gen) return
      cleanup()
      setState('disconnected')
    }, 20_000)

    const dc = pc.createDataChannel('nekoni', { ordered: true })
    dcRef.current = dc

    dc.onopen = () => {
      if (connectGenRef.current !== gen) return
      clearTimeout(connectionTimeoutRef.current!)
      setState('connected')
      lastPongRef.current = Date.now()
      pingIntervalRef.current = setInterval(() => {
        if (dc.readyState !== 'open') return
        dc.send(JSON.stringify({ type: 'ping' }))
        if (Date.now() - lastPongRef.current > 15_000) {
          cleanup()
          setState('disconnected')
        }
      }, 5_000)
    }

    dc.onclose = () => {
      if (connectGenRef.current !== gen) return
      clearInterval(pingIntervalRef.current!)
      setState('disconnected')
    }

    dc.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'pong') { lastPongRef.current = Date.now(); return }
      } catch {}
      onDataChannelMessageRef.current?.(evt.data)
    }

    let agentClientId = ''

    pc.onicecandidate = (evt) => {
      if (evt.candidate && wsRef.current?.readyState === WebSocket.OPEN && agentClientId) {
        const payload = {
          type: 'ice',
          candidate: evt.candidate.toJSON(),
          from: clientId.current,
          to: agentClientId,
          ts: Date.now(),
          pubKey: identity.publicKeyB64,
        }
        wsRef.current.send(JSON.stringify({ ...payload, sig: signPayload(payload, identity) }))
      }
    }

    pc.oniceconnectionstatechange = () => {
      if ((pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') && connectGenRef.current === gen) {
        cleanup()
        setState('disconnected')
      }
    }

    const ws = new WebSocket(agentInfo.signalUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (connectGenRef.current !== gen) return
      const joinPayload = { type: 'join', roomId: agentInfo.roomId, clientId: clientId.current, pubKey: identity.publicKeyB64, ts: Date.now() }
      ws.send(JSON.stringify({ ...joinPayload, sig: signPayload(joinPayload, identity) }))
    }

    ws.onmessage = async (evt) => {
      if (connectGenRef.current !== gen) return
      let msg: Record<string, unknown>
      try { msg = JSON.parse(evt.data) } catch { return }

      try {
        if (msg.type === 'peer_joined') {
          // Ignore peer_joined from other mobile devices in the room
          if (msg.pubKey !== agentInfo.agentPubKey) return

          agentClientId = msg.clientId as string

          if (offerSent) {
            if (dcRef.current?.readyState === 'open') return
            connectGenRef.current++
            cleanup()
            setState('disconnected')
            return
          }
          offerSent = true

          const offer = await pc.createOffer()
          if (connectGenRef.current !== gen) return
          await pc.setLocalDescription(offer)
          if (connectGenRef.current !== gen) return

          const offerPayload = {
            type: 'offer',
            sdp: pc.localDescription?.sdp,
            from: clientId.current,
            to: agentClientId,
            ts: Date.now(),
            pubKey: identity.publicKeyB64,
          }
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ ...offerPayload, sig: signPayload(offerPayload, identity) }))
          }
        }

        if (msg.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg as unknown as RTCSessionDescriptionInit))
          if (connectGenRef.current !== gen) return
          remoteDescSet = true
          for (const c of pendingCandidates) await pc.addIceCandidate(new RTCIceCandidate(c))
          pendingCandidates.length = 0
        }

        if (msg.type === 'ice' && msg.candidate) {
          if (remoteDescSet) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit))
          } else {
            pendingCandidates.push(msg.candidate as RTCIceCandidateInit)
          }
        }

        if (msg.type === 'error') {
          setError(msg.message as string)
          setState('error')
        }
      } catch (e) {
        console.error('[webrtc] signal message error:', e)
        if (connectGenRef.current === gen) { cleanup(); setState('disconnected') }
      }
    }

    ws.onerror = () => {
      if (connectGenRef.current !== gen) return
      setError('Signal server connection failed')
      setState('error')
    }

    ws.onclose = () => {
      if (connectGenRef.current !== gen) return
      if (dcRef.current?.readyState !== 'open') setState('disconnected')
    }
  }, [identity, cleanup])

  const sendMessage = useCallback((data: string) => {
    if (dcRef.current?.readyState === 'open') dcRef.current.send(data)
  }, [])

  return { state, error, connect, disconnect, sendMessage }
}
